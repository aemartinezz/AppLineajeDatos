import os
import json
import logging
import time
import hashlib
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from google.cloud import bigquery
from google.api_core.exceptions import GoogleAPIError

from app.config import settings, current_app_config
from app.models.schemas import (
    LineageNode, LineageEdge, LineageGraph, ExecutionStatus,
    AppConfig, ModelConfig, StorageConfig, ToolType, RelationType, InferenceMethod,
    ModelUsageLog, ModelCostSummary, AppError
)
from app.engine.bigquery_metadata import BigQueryMetadataExtractor
from app.engine.lineage_linker import LineageLinker

logger = logging.getLogger("app.services.bigquery_service")

class BigQueryService:
    """
    Servicio de Base de Datos Unificada en BigQuery:
    - lineage_nodes
    - lineage_edges
    - execution_status_daily
    - app_configurations
    - app_users_roles
    - app_model_usage_logs
    - app_errors_log
    Soporta sincronización bidireccional entre BigQuery en GCP y caché local en memoria.
    """

    def __init__(self):
        self.nodes_store: Dict[str, LineageNode] = {}
        self.edges_store: Dict[str, LineageEdge] = {}
        self.status_store: Dict[str, Dict[str, Any]] = {}
        self.model_usage_store: List[ModelUsageLog] = []
        self.errors_store: Dict[str, AppError] = {}
        self.cached_config: AppConfig = current_app_config
        self._cached_graph: Optional[LineageGraph] = None
        self._cached_graph_time: float = 0.0
        self._cache_ttl_seconds: float = 30.0
        self.bq_client: Optional[bigquery.Client] = None
        self._init_client()
        self.init_demo_data()
        if self.bq_client:
            self.load_config_from_bigquery()

    def _init_client(self):
        """Inicializa el cliente de BigQuery si las credenciales o entorno están disponibles."""
        if settings.USE_MOCK_GCP:
            self.bq_client = None
            return
        try:
            self.bq_client = bigquery.Client(project=settings.GCP_PROJECT_ID)
            logger.info("Cliente de BigQuery inicializado exitosamente.")
        except Exception as e:
            logger.warning(f"No se pudo inicializar el cliente nativo de BigQuery ({e}). Usando modo local en memoria.")
            self.bq_client = None

    def init_demo_data(self):
        """Inicializa una topología base representativa con espectro variado de confianza."""
        # 1. Nodos base
        n1 = LineageNode(id="CONTROL_M:JOB_DIARIO_VENTAS", name="JOB_DIARIO_VENTAS", tool_type=ToolType.CONTROL_M, layer="INGESTION", status=ExecutionStatus.SUCCESS)
        n2 = LineageNode(id="SHELL:extract_oracle.sh", name="extract_oracle.sh", tool_type=ToolType.SHELL, layer="INGESTION", status=ExecutionStatus.SUCCESS)
        n3 = LineageNode(id="DATASTAGE:DS_LOAD_STAGING", name="DS_LOAD_STAGING", tool_type=ToolType.DATASTAGE, layer="PROCESSING", status=ExecutionStatus.RUNNING)
        n4 = LineageNode(id="AIRFLOW_COMPOSER:dag_ventas_analytics", name="dag_ventas_analytics", tool_type=ToolType.AIRFLOW_COMPOSER, layer="PROCESSING", status=ExecutionStatus.PENDING)
        n5 = LineageNode(id="SHELL:clean_staging_logs.sh", name="clean_staging_logs.sh", tool_type=ToolType.SHELL, layer="INGESTION", status=ExecutionStatus.SUCCESS)
        n6 = LineageNode(id="DATASTAGE:DS_ENRICH_CLIENTES", name="DS_ENRICH_CLIENTES", tool_type=ToolType.DATASTAGE, layer="PROCESSING", status=ExecutionStatus.SUCCESS)

        for node in [n1, n2, n3, n4, n5, n6]:
            self.nodes_store[node.id] = node

        # 2. Relaciones con niveles de certeza distribuidos (100%, 92%, 85%, 70%, 55%)
        edges = [
            LineageEdge(
                id=f"{n1.id}->{n2.id}",
                source_id=n1.id,
                target_id=n2.id,
                relation_type=RelationType.EXECUTES,
                confidence_score=1.0,
                inference_method=InferenceMethod.DETERMINISTIC_PARSER,
                evidence_snippet="Control-M command=/opt/scripts/extract_oracle.sh"
            ),
            LineageEdge(
                id=f"{n2.id}->{n3.id}",
                source_id=n2.id,
                target_id=n3.id,
                relation_type=RelationType.TRIGGERS,
                confidence_score=0.92,
                inference_method=InferenceMethod.GEMINI_FLASH,
                evidence_snippet="Shell ejecuta dsjob -run DS_LOAD_STAGING $FECHA"
            ),
            LineageEdge(
                id=f"{n3.id}->BIGQUERY:stg_transacciones_raw",
                source_id=n3.id,
                target_id="BIGQUERY:stg_transacciones_raw",
                relation_type=RelationType.LOADS_INTO,
                confidence_score=1.0,
                inference_method=InferenceMethod.DETERMINISTIC_PARSER,
                evidence_snippet="DataStage carga tabla BigQuery stg_transacciones_raw"
            ),
            LineageEdge(
                id=f"{n4.id}->BIGQUERY:sp_procesar_transacciones",
                source_id=n4.id,
                target_id="BIGQUERY:sp_procesar_transacciones",
                relation_type=RelationType.TRIGGERS,
                confidence_score=1.0,
                inference_method=InferenceMethod.DETERMINISTIC_PARSER,
                evidence_snippet="Composer task invoca sp_procesar_transacciones()"
            ),
            LineageEdge(
                id=f"{n5.id}->{n3.id}",
                source_id=n5.id,
                target_id=n3.id,
                relation_type=RelationType.TRIGGERS,
                confidence_score=0.75,
                inference_method=InferenceMethod.GEMINI_FLASH,
                evidence_snippet="Log heurístico: clean_staging invocado previamente por pipeline staging"
            ),
            LineageEdge(
                id=f"{n6.id}->BIGQUERY:dim_clientes",
                source_id=n6.id,
                target_id="BIGQUERY:dim_clientes",
                relation_type=RelationType.LOADS_INTO,
                confidence_score=0.60,
                inference_method=InferenceMethod.GEMINI_PRO,
                evidence_snippet="Inferencia semántica Gemini Pro: DS_ENRICH_CLIENTES escribe en dim_clientes"
            ),
        ]

        for e in edges:
            self.edges_store[e.id] = e

    def load_config_from_bigquery(self) -> AppConfig:
        """Carga los parámetros persistidos en la tabla app_configurations de BigQuery."""
        if not self.bq_client:
            return self.cached_config

        table_ref = f"{settings.GCP_PROJECT_ID}.{settings.BQ_DATASET}.app_configurations"
        query = f"SELECT config_json FROM `{table_ref}` WHERE config_key = 'current_config' LIMIT 1"
        try:
            query_job = self.bq_client.query(query)
            rows = list(query_job.result())
            if rows:
                data = json.loads(rows[0].config_json)
                self.cached_config = AppConfig(**data)
                logger.info("Configuración cargada exitosamente desde BigQuery.")
        except Exception as e:
            logger.warning(f"No se pudo leer app_configurations desde BigQuery: {e}")

        return self.cached_config

    def save_pipeline_result(self, nodes: List[LineageNode], edges: List[LineageEdge]):
        """Persiste nuevos nodos y aristas descubiertos en memoria y en BigQuery."""
        self._cached_graph = None  # Invalidar caché para reflejo instantáneo
        for n in nodes:
            self.nodes_store[n.id] = n
        for e in edges:
            self.edges_store[e.id] = e

        if not self.bq_client:
            return

        try:
            # 1. Insertar nodos en BigQuery
            nodes_table = f"{settings.GCP_PROJECT_ID}.{settings.BQ_DATASET}.lineage_nodes"
            node_rows = [
                {
                    "id": n.id,
                    "name": n.name,
                    "tool_type": n.tool_type.value if hasattr(n.tool_type, 'value') else str(n.tool_type),
                    "layer": n.layer,
                    "status": n.status.value if hasattr(n.status, 'value') else str(n.status),
                    "metadata": json.dumps(n.metadata or {}),
                    "status_updated_at": n.status_updated_at.isoformat() if n.status_updated_at else datetime.utcnow().isoformat(),
                    "created_at": datetime.utcnow().isoformat()
                }
                for n in nodes
            ]
            if node_rows:
                errors = self.bq_client.insert_rows_json(nodes_table, node_rows)
                if errors:
                    logger.error(f"Errores al insertar nodos en BigQuery: {errors}")

            # 2. Insertar aristas en BigQuery
            edges_table = f"{settings.GCP_PROJECT_ID}.{settings.BQ_DATASET}.lineage_edges"
            edge_rows = [
                {
                    "id": e.id,
                    "source_id": e.source_id,
                    "target_id": e.target_id,
                    "relation_type": e.relation_type.value if hasattr(e.relation_type, 'value') else str(e.relation_type),
                    "confidence_score": float(e.confidence_score),
                    "inference_method": e.inference_method.value if hasattr(e.inference_method, 'value') else str(e.inference_method),
                    "evidence_snippet": e.evidence_snippet or "",
                    "created_at": datetime.utcnow().isoformat()
                }
                for e in edges
            ]
            if edge_rows:
                errors = self.bq_client.insert_rows_json(edges_table, edge_rows)
                if errors:
                    logger.error(f"Errores al insertar aristas en BigQuery: {errors}")

        except Exception as e:
            logger.error(f"Excepción persistiendo en BigQuery: {e}")

    def get_full_graph(self, min_confidence: float = 0.0) -> LineageGraph:
        """Fusiona el linaje externo con la metadata nativa de BigQuery con caché ultrarrápida."""
        now = time.time()
        if self._cached_graph is None or (now - self._cached_graph_time > self._cache_ttl_seconds):
            # 1. Obtener linaje nativo de BigQuery
            bq_data = BigQueryMetadataExtractor.get_native_lineage(
                project_id=settings.GCP_PROJECT_ID,
                dataset_id=settings.BQ_DATASET,
                bq_client=self.bq_client
            )

            # 2. Fusionar con LineageLinker
            self._cached_graph = LineageLinker.fuse_graph(
                external_nodes=list(self.nodes_store.values()),
                external_edges=list(self.edges_store.values()),
                bq_nodes=bq_data["nodes"],
                bq_edges=bq_data["edges"],
                execution_date=datetime.utcnow().strftime("%Y-%m-%d")
            )
            self._cached_graph_time = now

        full_graph = self._cached_graph

        # 3. Filtrar aristas por umbral de certeza
        filtered_edges = [e for e in full_graph.edges if e.confidence_score >= min_confidence]

        # Retener solo nodos conectados si se filtra
        connected_node_ids = set()
        for e in filtered_edges:
            connected_node_ids.add(e.source_id)
            connected_node_ids.add(e.target_id)

        filtered_nodes = [n for n in full_graph.nodes if n.id in connected_node_ids or len(filtered_edges) == 0]

        return LineageGraph(
            nodes=filtered_nodes,
            edges=filtered_edges,
            total_nodes=len(filtered_nodes),
            total_edges=len(filtered_edges),
            execution_date=full_graph.execution_date
        )

    def update_node_status(self, node_id: str, status: ExecutionStatus):
        """Actualiza el estado operativo en vivo para la telemetría del día."""
        if node_id in self.nodes_store:
            self.nodes_store[node_id].status = status
            self.nodes_store[node_id].status_updated_at = datetime.utcnow()
        self.status_store[node_id] = {
            "status": status.value,
            "updated_at": datetime.utcnow().isoformat()
        }

        # Opcional: registrar en BigQuery execution_status_daily
        if self.bq_client:
            try:
                table_ref = f"{settings.GCP_PROJECT_ID}.{settings.BQ_DATASET}.execution_status_daily"
                rows = [{
                    "execution_date": datetime.utcnow().strftime("%Y-%m-%d"),
                    "node_id": node_id,
                    "status": status.value,
                    "updated_at": datetime.utcnow().isoformat(),
                    "details": "Actualización de telemetría en tiempo real"
                }]
                self.bq_client.insert_rows_json(table_ref, rows)
            except Exception as e:
                logger.warning(f"No se pudo registrar estado diario en BigQuery: {e}")

    def get_app_config(self) -> AppConfig:
        return self.cached_config

    def update_app_config(self, new_config: AppConfig) -> AppConfig:
        """Persiste la nueva configuración en BigQuery y refresca la caché."""
        self.cached_config = new_config

        if self.bq_client:
            try:
                table_ref = f"{settings.GCP_PROJECT_ID}.{settings.BQ_DATASET}.app_configurations"
                query = f"""
                MERGE `{table_ref}` T
                USING (SELECT 'current_config' as config_key, @config_json as config_json) S
                ON T.config_key = S.config_key
                WHEN MATCHED THEN
                  UPDATE SET config_json = S.config_json, updated_at = CURRENT_TIMESTAMP(), updated_by = 'web_admin'
                WHEN NOT MATCHED THEN
                  INSERT (config_key, config_json, updated_at, updated_by)
                  VALUES (S.config_key, S.config_json, CURRENT_TIMESTAMP(), 'web_admin')
                """
                job_config = bigquery.QueryJobConfig(
                    query_parameters=[
                        bigquery.ScalarQueryParameter("config_json", "STRING", new_config.model_dump_json())
                    ]
                )
                self.bq_client.query(query, job_config=job_config).result()
                logger.info("Configuración actualizada y persistida en BigQuery app_configurations.")
            except Exception as e:
                logger.error(f"Error al persistir configuración en BigQuery: {e}")

        return self.cached_config

    # -------------------------------------------------------------
    # GESTIÓN DE USUARIOS Y ROLES (RBAC) CON PERSISTENCIA EN BIGQUERY
    # -------------------------------------------------------------

    def list_users(self) -> List[Dict[str, Any]]:
        """Lista los usuarios corporativos registrados en app_users_roles."""
        if not self.bq_client:
            return [
                {
                    "email": "aemartinezz@liverpool.com.mx",
                    "name": "Argos Eyra Martinez Zeferino",
                    "roles": ["Admin", "Developer"],
                    "status": "ACTIVE",
                    "last_login": datetime.utcnow().isoformat()
                }
            ]

        table_ref = f"{settings.GCP_PROJECT_ID}.{settings.BQ_DATASET}.app_users_roles"
        query = f"SELECT email, name, roles, status, created_at, updated_at, last_login FROM `{table_ref}` ORDER BY created_at DESC"
        try:
            query_job = self.bq_client.query(query)
            users = []
            for r in query_job.result():
                users.append({
                    "email": r.email,
                    "name": r.name or r.email.split("@")[0],
                    "roles": list(r.roles) if r.roles else ["Viewer"],
                    "status": r.status or "ACTIVE",
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                    "updated_at": r.updated_at.isoformat() if r.updated_at else None,
                    "last_login": r.last_login.isoformat() if r.last_login else None
                })
            return users
        except Exception as e:
            logger.error(f"Error listando usuarios de BigQuery: {e}")
            return []

    def upsert_user(self, email: str, name: str, roles: List[str], status: str = "ACTIVE") -> Dict[str, Any]:
        """Crea o actualiza los roles de un usuario corporativo (restringido a @liverpool.com.mx)."""
        email_clean = email.strip().lower()
        if not email_clean.endswith("@liverpool.com.mx"):
            raise ValueError("Dominio no autorizado. Únicamente cuentas con terminación @liverpool.com.mx pueden ser dadas de alta.")

        if not roles:
            roles = ["Viewer"]

        if self.bq_client:
            table_ref = f"{settings.GCP_PROJECT_ID}.{settings.BQ_DATASET}.app_users_roles"
            query = f"""
            MERGE `{table_ref}` T
            USING (
                SELECT @email as email, @name as name, @roles as roles, @status as status
            ) S
            ON T.email = S.email
            WHEN MATCHED THEN
              UPDATE SET name = S.name, roles = S.roles, status = S.status, updated_at = CURRENT_TIMESTAMP()
            WHEN NOT MATCHED THEN
              INSERT (email, name, roles, status, created_at, updated_at, last_login)
              VALUES (S.email, S.name, S.roles, S.status, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
            """
            job_config = bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("email", "STRING", email_clean),
                    bigquery.ScalarQueryParameter("name", "STRING", name),
                    bigquery.ArrayQueryParameter("roles", "STRING", roles),
                    bigquery.ScalarQueryParameter("status", "STRING", status),
                ]
            )
            self.bq_client.query(query, job_config=job_config).result()

        return {
            "email": email_clean,
            "name": name,
            "roles": roles,
            "status": status,
            "updated_at": datetime.utcnow().isoformat()
        }

    def authenticate_user(self, email: str, name: Optional[str] = None) -> Dict[str, Any]:
        """
        Valida el correo corporativo. Si pertenece a @liverpool.com.mx,
        obtiene sus roles o lo auto-registra como Invitado/Viewer si es la primera vez.
        """
        email_clean = email.strip().lower()
        if not email_clean.endswith("@liverpool.com.mx"):
            raise PermissionError("Acceso denegado: Únicamente cuentas corporativas @liverpool.com.mx tienen acceso.")

        # Buscar usuario en BigQuery
        if self.bq_client:
            table_ref = f"{settings.GCP_PROJECT_ID}.{settings.BQ_DATASET}.app_users_roles"
            query = f"SELECT email, name, roles, status FROM `{table_ref}` WHERE email = @email LIMIT 1"
            job_config = bigquery.QueryJobConfig(
                query_parameters=[bigquery.ScalarQueryParameter("email", "STRING", email_clean)]
            )
            rows = list(self.bq_client.query(query, job_config=job_config).result())
            if rows:
                u = rows[0]
                update_q = f"UPDATE `{table_ref}` SET last_login = CURRENT_TIMESTAMP() WHERE email = @email"
                self.bq_client.query(update_q, job_config=job_config).result()
                return {
                    "email": u.email,
                    "name": u.name or email_clean.split("@")[0],
                    "roles": list(u.roles) if u.roles else ["Viewer"],
                    "status": u.status
                }
            else:
                new_user = self.upsert_user(
                    email=email_clean,
                    name=name or email_clean.split("@")[0],
                    roles=["Viewer"],
                    status="ACTIVE"
                )
                return new_user

        # Fallback local
        if email_clean == "aemartinezz@liverpool.com.mx":
            return {
                "email": email_clean,
                "name": "Argos Eyra Martinez Zeferino",
                "roles": ["Admin", "Developer"],
                "status": "ACTIVE"
            }
        return {
            "email": email_clean,
            "name": name or email_clean.split("@")[0],
            "roles": ["Viewer"],
            "status": "ACTIVE"
        }

    # -------------------------------------------------------------
    # CONTROL DE GASTOS Y AUDITORÍA DE MODELOS IA (BIGQUERY)
    # -------------------------------------------------------------

    def log_model_usage(
        self,
        model_name: str,
        input_tokens: int,
        output_tokens: int,
        cost_usd: Optional[float] = None,
        source_file: Optional[str] = None,
        confidence_score: Optional[float] = None,
        status: str = "SUCCESS"
    ) -> ModelUsageLog:
        """Registra el consumo de tokens y costo de inferencia en BigQuery."""
        if cost_usd is None:
            # Tarifas por millón de tokens
            if "pro" in model_name.lower():
                cost_usd = (input_tokens / 1_000_000.0 * 1.25) + (output_tokens / 1_000_000.0 * 5.00)
            else:
                cost_usd = (input_tokens / 1_000_000.0 * 0.01875) + (output_tokens / 1_000_000.0 * 0.075)

        usage = ModelUsageLog(
            id=str(uuid.uuid4()),
            timestamp=datetime.utcnow(),
            model_name=model_name,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=round(cost_usd, 6),
            source_file=source_file,
            confidence_score=confidence_score,
            status=status
        )
        self.model_usage_store.append(usage)

        if self.bq_client:
            try:
                table_ref = f"{settings.GCP_PROJECT_ID}.{settings.BQ_DATASET}.app_model_usage_logs"
                rows = [{
                    "id": usage.id,
                    "timestamp": usage.timestamp.isoformat(),
                    "model_name": usage.model_name,
                    "input_tokens": usage.input_tokens,
                    "output_tokens": usage.output_tokens,
                    "cost_usd": usage.cost_usd,
                    "source_file": usage.source_file or "",
                    "confidence_score": usage.confidence_score or 1.0,
                    "status": usage.status
                }]
                self.bq_client.insert_rows_json(table_ref, rows)
            except Exception as e:
                logger.warning(f"No se pudo registrar log de modelo en BigQuery: {e}")

        return usage

    def get_model_costs_summary(self) -> ModelCostSummary:
        """Obtiene el acumulado de tokens y costes agrupado por modelo."""
        # Si no hay datos en memoria local, sembrar datos de demo realistas
        if not self.model_usage_store and not self.bq_client:
            self.model_usage_store = [
                ModelUsageLog(id="demo-1", timestamp=datetime.utcnow(), model_name="gemini-1.5-flash", input_tokens=14200, output_tokens=3200, cost_usd=0.000506, source_file="extract_oracle.sh", confidence_score=0.92, status="SUCCESS"),
                ModelUsageLog(id="demo-2", timestamp=datetime.utcnow(), model_name="gemini-1.5-flash", input_tokens=22100, output_tokens=4100, cost_usd=0.000722, source_file="clean_staging_logs.sh", confidence_score=0.75, status="SUCCESS"),
                ModelUsageLog(id="demo-3", timestamp=datetime.utcnow(), model_name="gemini-1.5-pro", input_tokens=48500, output_tokens=8900, cost_usd=0.105125, source_file="DS_ENRICH_CLIENTES.dsx", confidence_score=0.60, status="SUCCESS"),
                ModelUsageLog(id="demo-4", timestamp=datetime.utcnow(), model_name="gemini-1.5-flash", input_tokens=9800, output_tokens=1950, cost_usd=0.000330, source_file="dag_ventas_analytics.py", confidence_score=0.95, status="SUCCESS"),
            ]

        if self.bq_client:
            try:
                table_ref = f"{settings.GCP_PROJECT_ID}.{settings.BQ_DATASET}.app_model_usage_logs"
                q = f"""
                SELECT 
                    model_name,
                    SUM(COALESCE(input_tokens, 0)) as total_input,
                    SUM(COALESCE(output_tokens, 0)) as total_output,
                    SUM(COALESCE(cost_usd, 0.0)) as total_cost,
                    COUNT(1) as calls
                FROM `{table_ref}`
                GROUP BY model_name
                """
                job = self.bq_client.query(q)
                rows = list(job.result())
                if rows:
                    tot_cost = 0.0
                    tot_in = 0
                    tot_out = 0
                    tot_calls = 0
                    cost_by_m = {}
                    tok_by_m = {}
                    for r in rows:
                        tot_cost += r.total_cost
                        tot_in += r.total_input
                        tot_out += r.total_output
                        tot_calls += r.calls
                        cost_by_m[r.model_name] = round(r.total_cost, 6)
                        tok_by_m[r.model_name] = r.total_input + r.total_output

                    pct = (tot_cost / 50.0) * 100.0
                    return ModelCostSummary(
                        total_cost_usd=round(tot_cost, 6),
                        total_input_tokens=tot_in,
                        total_output_tokens=tot_out,
                        total_calls=tot_calls,
                        budget_limit_usd=50.0,
                        budget_consumed_percentage=round(pct, 2),
                        alert_triggered=pct >= 80.0,
                        cost_by_model=cost_by_m,
                        tokens_by_model=tok_by_m,
                        last_updated=datetime.utcnow()
                    )
            except Exception as e:
                logger.warning(f"No se pudo consultar app_model_usage_logs en BigQuery: {e}")

        # Agregación en memoria local
        tot_cost = sum(u.cost_usd for u in self.model_usage_store)
        tot_in = sum(u.input_tokens for u in self.model_usage_store)
        tot_out = sum(u.output_tokens for u in self.model_usage_store)
        cost_by_m: Dict[str, float] = {}
        tok_by_m: Dict[str, int] = {}
        for u in self.model_usage_store:
            cost_by_m[u.model_name] = round(cost_by_m.get(u.model_name, 0.0) + u.cost_usd, 6)
            tok_by_m[u.model_name] = tok_by_m.get(u.model_name, 0) + u.input_tokens + u.output_tokens

        pct = (tot_cost / 50.0) * 100.0
        return ModelCostSummary(
            total_cost_usd=round(tot_cost, 6),
            total_input_tokens=tot_in,
            total_output_tokens=tot_out,
            total_calls=len(self.model_usage_store),
            budget_limit_usd=50.0,
            budget_consumed_percentage=round(pct, 2),
            alert_triggered=pct >= 80.0,
            cost_by_model=cost_by_m,
            tokens_by_model=tok_by_m,
            last_updated=datetime.utcnow()
        )

    # -------------------------------------------------------------
    # GESTIÓN Y SEGUIMIENTO DE ERRORES (BIGQUERY + AUTO-REAPERTURA)
    # -------------------------------------------------------------

    def log_error(
        self,
        error_type: str,
        message: str,
        stack_trace: Optional[str] = None,
        component: str = "BACKEND",
        severity: str = "WARNING"
    ) -> AppError:
        """
        Registra un error agrupado por hash.
        Si ya existía en estado RESOLVED y vuelve a ocurrir, se REABRE automáticamente a OPEN.
        """
        norm_msg = message[:120].strip()
        err_hash = hashlib.sha256(f"{error_type}:{component}:{norm_msg}".encode("utf-8")).hexdigest()[:12]
        error_id = f"ERR-{err_hash.upper()}"
        now = datetime.utcnow()

        if self.bq_client:
            try:
                table_ref = f"{settings.GCP_PROJECT_ID}.{settings.BQ_DATASET}.app_errors_log"
                merge_q = f"""
                MERGE `{table_ref}` T
                USING (
                    SELECT 
                        @error_id as error_id,
                        @error_type as error_type,
                        @message as message,
                        @stack_trace as stack_trace,
                        @component as component,
                        @severity as severity
                ) S
                ON T.error_id = S.error_id
                WHEN MATCHED THEN
                  UPDATE SET 
                    occurrence_count = T.occurrence_count + 1,
                    last_seen = CURRENT_TIMESTAMP(),
                    status = 'OPEN',
                    resolved_at = NULL,
                    resolved_by = NULL,
                    stack_trace = COALESCE(S.stack_trace, T.stack_trace),
                    severity = S.severity
                WHEN NOT MATCHED THEN
                  INSERT (
                    error_id, error_type, message, stack_trace, component, severity,
                    occurrence_count, first_seen, last_seen, status, resolved_at, resolved_by
                  )
                  VALUES (
                    S.error_id, S.error_type, S.message, S.stack_trace, S.component, S.severity,
                    1, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), 'OPEN', NULL, NULL
                  )
                """
                job_cfg = bigquery.QueryJobConfig(
                    query_parameters=[
                        bigquery.ScalarQueryParameter("error_id", "STRING", error_id),
                        bigquery.ScalarQueryParameter("error_type", "STRING", error_type),
                        bigquery.ScalarQueryParameter("message", "STRING", message),
                        bigquery.ScalarQueryParameter("stack_trace", "STRING", stack_trace or ""),
                        bigquery.ScalarQueryParameter("component", "STRING", component),
                        bigquery.ScalarQueryParameter("severity", "STRING", severity),
                    ]
                )
                self.bq_client.query(merge_q, job_config=job_cfg).result()
            except Exception as e:
                logger.warning(f"No se pudo registrar error en BigQuery app_errors_log: {e}")

        # Actualización en memoria local (con auto-reapertura)
        if error_id in self.errors_store:
            existing = self.errors_store[error_id]
            existing.occurrence_count += 1
            existing.last_seen = now
            existing.status = "OPEN"  # Auto-reabrir si vuelve a ocurrir
            existing.resolved_at = None
            existing.resolved_by = None
            if stack_trace:
                existing.stack_trace = stack_trace
            existing.severity = severity
            return existing
        else:
            new_err = AppError(
                error_id=error_id,
                error_type=error_type,
                message=message,
                stack_trace=stack_trace,
                component=component,
                severity=severity,
                occurrence_count=1,
                first_seen=now,
                last_seen=now,
                status="OPEN"
            )
            self.errors_store[error_id] = new_err
            return new_err

    def list_errors(self, status: Optional[str] = None) -> List[AppError]:
        """Obtiene la lista de incidencias técnicas ordenadas por última detección."""
        if not self.errors_store and not self.bq_client:
            # Sembrar incidencias de demostración iniciales
            self.errors_store = {
                "ERR-B10A92C1D4": AppError(
                    error_id="ERR-B10A92C1D4",
                    error_type="GCSBucketTimeoutException",
                    message="gs://datosdeentrada connection timeout after 10000ms",
                    stack_trace="Traceback (most recent call last):\n  File 'watcher.py', line 45, in check_bucket\n  TimeoutError: Socket read timeout",
                    component="GCS_WATCHER",
                    severity="WARNING",
                    occurrence_count=3,
                    first_seen=datetime.utcnow(),
                    last_seen=datetime.utcnow(),
                    status="OPEN"
                ),
                "ERR-C4D89E71F2": AppError(
                    error_id="ERR-C4D89E71F2",
                    error_type="BigQueryJobSyntaxWarning",
                    message="Dataset ti_data_driven contains unindexed partition scan",
                    stack_trace="Warning: BigQuery scan exceeded 150MB on unpartitioned table",
                    component="BIGQUERY_ENGINE",
                    severity="INFO",
                    occurrence_count=12,
                    first_seen=datetime.utcnow(),
                    last_seen=datetime.utcnow(),
                    status="RESOLVED",
                    resolved_at=datetime.utcnow(),
                    resolved_by="aemartinezz@liverpool.com.mx"
                )
            }

        if self.bq_client:
            try:
                table_ref = f"{settings.GCP_PROJECT_ID}.{settings.BQ_DATASET}.app_errors_log"
                where_clause = f"WHERE status = '{status}'" if status else ""
                q = f"""
                SELECT 
                    error_id, error_type, message, stack_trace, component, severity,
                    occurrence_count, first_seen, last_seen, status, resolved_at, resolved_by
                FROM `{table_ref}`
                {where_clause}
                ORDER BY last_seen DESC
                LIMIT 100
                """
                job = self.bq_client.query(q)
                errs = []
                for r in job.result():
                    errs.append(AppError(
                        error_id=r.error_id,
                        error_type=r.error_type,
                        message=r.message,
                        stack_trace=r.stack_trace,
                        component=r.component,
                        severity=r.severity,
                        occurrence_count=r.occurrence_count,
                        first_seen=r.first_seen if r.first_seen else datetime.utcnow(),
                        last_seen=r.last_seen if r.last_seen else datetime.utcnow(),
                        status=r.status,
                        resolved_at=r.resolved_at,
                        resolved_by=r.resolved_by
                    ))
                return errs
            except Exception as e:
                logger.warning(f"No se pudo consultar app_errors_log en BigQuery: {e}")

        all_errs = list(self.errors_store.values())
        if status:
            return [e for e in all_errs if e.status == status]
        return sorted(all_errs, key=lambda x: x.last_seen, reverse=True)

    def resolve_error(self, error_id: str, resolved_by: str = "admin") -> AppError:
        """Marca una incidencia técnica como SOLUCIONADO."""
        now = datetime.utcnow()

        if self.bq_client:
            try:
                table_ref = f"{settings.GCP_PROJECT_ID}.{settings.BQ_DATASET}.app_errors_log"
                q = f"""
                UPDATE `{table_ref}`
                SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP(), resolved_by = @resolved_by
                WHERE error_id = @error_id
                """
                job_cfg = bigquery.QueryJobConfig(
                    query_parameters=[
                        bigquery.ScalarQueryParameter("resolved_by", "STRING", resolved_by),
                        bigquery.ScalarQueryParameter("error_id", "STRING", error_id),
                    ]
                )
                self.bq_client.query(q, job_config=job_cfg).result()
            except Exception as e:
                logger.warning(f"No se pudo actualizar estado a RESOLVED en BigQuery: {e}")

        if error_id in self.errors_store:
            err = self.errors_store[error_id]
            err.status = "RESOLVED"
            err.resolved_at = now
            err.resolved_by = resolved_by
            return err

        # Si no existía en memoria pero se resolvió
        dummy_err = AppError(
            error_id=error_id,
            error_type="GenericError",
            message="Error resuelto",
            status="RESOLVED",
            resolved_at=now,
            resolved_by=resolved_by
        )
        self.errors_store[error_id] = dummy_err
        return dummy_err

bigquery_service = BigQueryService()


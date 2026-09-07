import os
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from google.cloud import bigquery
from google.api_core.exceptions import GoogleAPIError

from app.config import settings, current_app_config
from app.models.schemas import (
    LineageNode, LineageEdge, LineageGraph, ExecutionStatus,
    AppConfig, ModelConfig, StorageConfig, ToolType, RelationType, InferenceMethod
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
    Soporta sincronización bidireccional entre BigQuery en GCP y caché local en memoria.
    """

    def __init__(self):
        self.nodes_store: Dict[str, LineageNode] = {}
        self.edges_store: Dict[str, LineageEdge] = {}
        self.status_store: Dict[str, Dict[str, Any]] = {}
        self.cached_config: AppConfig = current_app_config
        self.bq_client: Optional[bigquery.Client] = None
        self._init_client()
        self.init_demo_data()
        self.load_config_from_bigquery()

    def _init_client(self):
        """Inicializa el cliente de BigQuery si las credenciales o entorno están disponibles."""
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
        """Fusiona el linaje externo con la metadata nativa de BigQuery y filtra por certeza."""
        # 1. Obtener linaje nativo de BigQuery
        bq_data = BigQueryMetadataExtractor.get_native_lineage(settings.GCP_PROJECT_ID, settings.BQ_DATASET)

        # 2. Fusionar con LineageLinker
        full_graph = LineageLinker.fuse_graph(
            external_nodes=list(self.nodes_store.values()),
            external_edges=list(self.edges_store.values()),
            bq_nodes=bq_data["nodes"],
            bq_edges=bq_data["edges"],
            execution_date=datetime.utcnow().strftime("%Y-%m-%d")
        )

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

bigquery_service = BigQueryService()

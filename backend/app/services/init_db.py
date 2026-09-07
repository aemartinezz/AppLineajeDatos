import os
import json
from datetime import datetime
from google.cloud import bigquery
from google.api_core.exceptions import NotFound, Conflict, Forbidden
from app.config import settings, current_app_config

DDL_LINEAGE_NODES = """
CREATE TABLE IF NOT EXISTS `{project}.{dataset}.lineage_nodes` (
    id STRING NOT NULL OPTIONS(description="Identificador único del nodo, ej: CONTROL_M:JOB_VENTAS"),
    name STRING NOT NULL OPTIONS(description="Nombre descriptivo del componente"),
    tool_type STRING NOT NULL OPTIONS(description="Herramienta emisora (CONTROL_M, SHELL, DATASTAGE, AIRFLOW_COMPOSER, BIGQUERY)"),
    layer STRING OPTIONS(description="Capa arquitectónica: INGESTION, PROCESSING, TRANSFORMATION, STORAGE, ANALYTICS"),
    status STRING OPTIONS(description="Estado de ejecución: PENDING, RUNNING, SUCCESS, FAILED"),
    metadata STRING OPTIONS(description="JSON serializado con atributos adicionales específicos de la herramienta"),
    status_updated_at TIMESTAMP OPTIONS(description="Fecha y hora de última actualización de estado"),
    created_at TIMESTAMP OPTIONS(description="Fecha y hora de descubrimiento del nodo")
)
OPTIONS(
    description="Catálogo de componentes y nodos del linaje de datos de extremo a extremo"
);
"""

DDL_LINEAGE_EDGES = """
CREATE TABLE IF NOT EXISTS `{project}.{dataset}.lineage_edges` (
    id STRING NOT NULL OPTIONS(description="Identificador único de la arista, ej: NODO_A->NODO_B"),
    source_id STRING NOT NULL OPTIONS(description="ID del nodo origen"),
    target_id STRING NOT NULL OPTIONS(description="ID del nodo destino"),
    relation_type STRING NOT NULL OPTIONS(description="Tipo de relación: EXECUTES, TRIGGERS, LOADS_INTO, READS_FROM, WRITES_TO"),
    confidence_score FLOAT64 NOT NULL OPTIONS(description="Puntuación de certeza de 0.0 a 1.0"),
    inference_method STRING NOT NULL OPTIONS(description="Método empleado: DETERMINISTIC_PARSER, GEMINI_FLASH, GEMINI_PRO, BQ_METADATA"),
    evidence_snippet STRING OPTIONS(description="Evidencia textual extraída del log, script o SQL"),
    created_at TIMESTAMP OPTIONS(description="Fecha y hora de registro")
)
OPTIONS(
    description="Relaciones y dependencias directas entre componentes con scoring de certeza"
);
"""

DDL_EXECUTION_STATUS_DAILY = """
CREATE TABLE IF NOT EXISTS `{project}.{dataset}.execution_status_daily` (
    execution_date DATE NOT NULL OPTIONS(description="Fecha operativa de ejecución"),
    node_id STRING NOT NULL OPTIONS(description="ID del nodo monitoreado"),
    status STRING NOT NULL OPTIONS(description="Estado operativo: PENDING, RUNNING, SUCCESS, FAILED"),
    updated_at TIMESTAMP NOT NULL OPTIONS(description="Marca temporal de actualización"),
    details STRING OPTIONS(description="Detalles o trazas de error en caso de fallo")
)
PARTITION BY execution_date
CLUSTER BY node_id, status
OPTIONS(
    description="Telemetría diaria de estados de ejecución para componentes monitoreados"
);
"""

DDL_APP_CONFIGURATIONS = """
CREATE TABLE IF NOT EXISTS `{project}.{dataset}.app_configurations` (
    config_key STRING NOT NULL OPTIONS(description="Clave de configuración, ej: current_config"),
    config_json STRING NOT NULL OPTIONS(description="JSON con la configuración de modelos, buckets y UI"),
    updated_at TIMESTAMP NOT NULL OPTIONS(description="Última modificación"),
    updated_by STRING OPTIONS(description="Usuario o proceso que modificó la configuración")
)
OPTIONS(
    description="Persistencia de parámetros dinámicos de modelos de IA e infraestructura"
);
"""

DDL_APP_USERS_ROLES = """
CREATE TABLE IF NOT EXISTS `{project}.{dataset}.app_users_roles` (
    email STRING NOT NULL OPTIONS(description="Correo corporativo del usuario (@liverpool.com.mx)"),
    name STRING OPTIONS(description="Nombre completo del colaborador"),
    roles ARRAY<STRING> OPTIONS(description="Roles asignados (Admin, Developer, Data Engineer, Auditor, Viewer)"),
    status STRING OPTIONS(description="Estado: ACTIVE, INACTIVE"),
    created_at TIMESTAMP OPTIONS(description="Fecha de alta"),
    updated_at TIMESTAMP OPTIONS(description="Última modificación"),
    last_login TIMESTAMP OPTIONS(description="Último acceso a la plataforma")
)
OPTIONS(
    description="Catálogo corporativo de usuarios y roles para control de acceso (RBAC)"
);
"""

DDL_APP_MODEL_USAGE_LOGS = """
CREATE TABLE IF NOT EXISTS `{project}.{dataset}.app_model_usage_logs` (
    id STRING NOT NULL OPTIONS(description="Identificador único del registro de uso de IA"),
    timestamp TIMESTAMP NOT NULL OPTIONS(description="Fecha y hora de invocación"),
    model_name STRING NOT NULL OPTIONS(description="Modelo invocado (gemini-1.5-flash o gemini-1.5-pro)"),
    input_tokens INT64 OPTIONS(description="Tokens de entrada procesados"),
    output_tokens INT64 OPTIONS(description="Tokens generados en la respuesta"),
    cost_usd FLOAT64 NOT NULL OPTIONS(description="Costo estimado en dólares estadounidenses"),
    source_file STRING OPTIONS(description="Archivo analizado"),
    confidence_score FLOAT64 OPTIONS(description="Score de certeza obtenido"),
    status STRING OPTIONS(description="SUCCESS, FAILED")
)
PARTITION BY DATE(timestamp)
CLUSTER BY model_name, status
OPTIONS(
    description="Auditoría y control de consumo de tokens y costes de modelos de IA"
);
"""

DDL_APP_ERRORS_LOG = """
CREATE TABLE IF NOT EXISTS `{project}.{dataset}.app_errors_log` (
    error_id STRING NOT NULL OPTIONS(description="Firma única del error agrupado"),
    error_type STRING NOT NULL OPTIONS(description="Clase o tipo de excepción"),
    message STRING NOT NULL OPTIONS(description="Mensaje descriptivo del error"),
    stack_trace STRING OPTIONS(description="Traza técnica completa de ejecución"),
    component STRING NOT NULL OPTIONS(description="Módulo emisor del error"),
    severity STRING NOT NULL OPTIONS(description="CRITICAL, WARNING, INFO"),
    occurrence_count INT64 NOT NULL OPTIONS(description="Número de veces que ha ocurrido"),
    first_seen TIMESTAMP NOT NULL OPTIONS(description="Primera detección"),
    last_seen TIMESTAMP NOT NULL OPTIONS(description="Última detección"),
    status STRING NOT NULL OPTIONS(description="OPEN, RESOLVED"),
    resolved_at TIMESTAMP OPTIONS(description="Fecha en que se marcó como solucionado"),
    resolved_by STRING OPTIONS(description="Usuario que resolvió la incidencia")
)
PARTITION BY DATE(last_seen)
CLUSTER BY status, severity
OPTIONS(
    description="Registro agrupado y gestión del ciclo de vida de errores de la plataforma"
);
"""

def init_bigquery_tables(project_id: str = None, dataset_id: str = None) -> dict:
    """
    Crea las 7 tablas principales en BigQuery si no existen e inicializa configuración y usuarios base.
    """
    proj = project_id or settings.GCP_PROJECT_ID
    ds = dataset_id or settings.BQ_DATASET
    
    results = {"tables_created": [], "errors": []}
    
    try:
        client = bigquery.Client(project=proj)
        
        # 1. Asegurar dataset (tolerante a Least Privilege IAM)
        dataset_ref = f"{proj}.{ds}"
        try:
            client.get_dataset(dataset_ref)
        except NotFound:
            try:
                dataset = bigquery.Dataset(dataset_ref)
                dataset.location = settings.GCP_REGION
                client.create_dataset(dataset, timeout=30)
                results["dataset_created"] = dataset_ref
            except Forbidden as f_err:
                print(f"Aviso Menor Privilegio: Sin permiso para crear dataset {dataset_ref} a nivel proyecto ({f_err}). Continuando asumiendo dataset pre-creado...")
        except Forbidden as f_get_err:
            print(f"Aviso Menor Privilegio: Permiso restringido en get_dataset ({f_get_err}). Continuando con DDLs...")
        except Exception as e_ds:
            print(f"Aviso comprobando dataset {dataset_ref}: {e_ds}")
            
        # 2. Ejecutar DDLs
        ddls = {
            "lineage_nodes": DDL_LINEAGE_NODES.format(project=proj, dataset=ds),
            "lineage_edges": DDL_LINEAGE_EDGES.format(project=proj, dataset=ds),
            "execution_status_daily": DDL_EXECUTION_STATUS_DAILY.format(project=proj, dataset=ds),
            "app_configurations": DDL_APP_CONFIGURATIONS.format(project=proj, dataset=ds),
            "app_users_roles": DDL_APP_USERS_ROLES.format(project=proj, dataset=ds),
            "app_model_usage_logs": DDL_APP_MODEL_USAGE_LOGS.format(project=proj, dataset=ds),
            "app_errors_log": DDL_APP_ERRORS_LOG.format(project=proj, dataset=ds),
        }
        
        for table_name, ddl_query in ddls.items():
            query_job = client.query(ddl_query)
            query_job.result()
            results["tables_created"].append(f"{ds}.{table_name}")
            
        # 3. Inicializar configuración por defecto en app_configurations si está vacía
        check_conf_query = f"SELECT count(1) as cnt FROM `{proj}.{ds}.app_configurations` WHERE config_key = 'current_config'"
        row_iter = client.query(check_conf_query).result()
        row = next(row_iter)
        if row.cnt == 0:
            default_json = current_app_config.model_dump_json()
            insert_conf = f"""
            INSERT INTO `{proj}.{ds}.app_configurations` (config_key, config_json, updated_at, updated_by)
            VALUES ('current_config', @config_json, CURRENT_TIMESTAMP(), 'system_init')
            """
            job_config = bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("config_json", "STRING", default_json)
                ]
            )
            client.query(insert_conf, job_config=job_config).result()
            results["default_config_seeded"] = True
        else:
            results["default_config_seeded"] = False

        # 4. Inicializar usuario principal (aemartinezz@liverpool.com.mx) con roles Admin y Developer
        admin_email = "aemartinezz@liverpool.com.mx"
        check_user_query = f"SELECT count(1) as cnt FROM `{proj}.{ds}.app_users_roles` WHERE email = @email"
        job_config_user = bigquery.QueryJobConfig(
            query_parameters=[bigquery.ScalarQueryParameter("email", "STRING", admin_email)]
        )
        u_iter = client.query(check_user_query, job_config=job_config_user).result()
        u_row = next(u_iter)
        if u_row.cnt == 0:
            insert_user = f"""
            INSERT INTO `{proj}.{ds}.app_users_roles` (email, name, roles, status, created_at, updated_at, last_login)
            VALUES (@email, 'Argos Eyra Martinez Zeferino', ['Admin', 'Developer'], 'ACTIVE', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
            """
            client.query(insert_user, job_config=job_config_user).result()
            results["admin_user_seeded"] = True
        else:
            results["admin_user_seeded"] = False

    except Exception as e:
        results["errors"].append(str(e))
        
    return results

if __name__ == "__main__":
    res = init_bigquery_tables()
    print("Resultado de inicialización BigQuery:", json.dumps(res, indent=2))

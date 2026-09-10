# Diccionario Canónico de Datos: Google BigQuery (`BQ_DATASET`)

Este documento define el **esquema formal DDL, tipos de datos, particionamiento, clustering, semántica de columnas y convenciones de persistencia** para las 7 tablas maestras alojadas en el dataset corporativo de BigQuery (por defecto `applineajedatos`).

---

## 1. Visión General del Dataset

- **Nombre Lógico:** `BQ_DATASET` (configurable en entorno, default `applineajedatos`).
- **Resiliencia:** Actúa como la **única fuente persistente de verdad** de la plataforma, blindando los datos ante reinicios o escalado a cero de los contenedores stateless de Cloud Run.
- **Inicialización:** Idempotente y asegurada automáticamente al arrancar la aplicación o mediante:
  ```python
  from app.services.init_db import init_bigquery_tables
  init_bigquery_tables(project_id="...", dataset_id="...")
  ```

---

## 2. Catálogo de las 7 Tablas Maestras

### 2.1. Tabla: `lineage_nodes`
- **Propósito:** Catálogo maestro de componentes y artefactos descubiertos en el ecosistema (jobs, scripts, DAGs, tablas, vistas).
- **Convención de Clave:** `id` sigue estrictamente el patrón canónico `TOOL_TYPE:nombre_componente` en mayúsculas (ej. `CONTROL_M:JOB_DIARIO_VENTAS`, `BIGQUERY:pruebasLineaje.ejemplotabla1`).
- **Esquema DDL:**
  | Columna | Tipo BigQuery | Modo | Descripción |
  |---------|:-------------:|:----:|-------------|
  | `id` | `STRING` | REQUIRED | Clave primaria canónica (`TOOL_TYPE:nombre`). |
  | `name` | `STRING` | REQUIRED | Nombre legible para visualización en el grafo. |
  | `tool_type` | `STRING` | REQUIRED | `CONTROL_M`, `SHELL`, `DATASTAGE`, `AIRFLOW_COMPOSER`, `BIGQUERY`, `GENERIC_TOOL`. |
  | `layer` | `STRING` | NULLABLE | Capa arquitectónica: `INGESTION`, `PROCESSING`, `TRANSFORMATION`, `STORAGE`, `ANALYTICS`. |
  | `status` | `STRING` | NULLABLE | Estado operativo: `PENDING`, `RUNNING`, `SUCCESS`, `FAILED`. |
  | `metadata` | `STRING` | NULLABLE | JSON serializado con atributos adicionales (ubicación, entorno, autor). |
  | `status_updated_at`| `TIMESTAMP` | NULLABLE | Marca de tiempo del último cambio de estado. |
  | `created_at` | `TIMESTAMP` | NULLABLE | Fecha de descubrimiento o registro del nodo. |

---

### 2.2. Tabla: `lineage_edges`
- **Propósito:** Relaciones de dependencia causal y flujo de datos entre componentes con scoring de certeza y evidencia.
- **Esquema DDL:**
  | Columna | Tipo BigQuery | Modo | Descripción |
  |---------|:-------------:|:----:|-------------|
  | `id` | `STRING` | REQUIRED | Clave compuesta única: `source_id->target_id`. |
  | `source_id` | `STRING` | REQUIRED | Referencia foránea a `lineage_nodes.id` del nodo origen. |
  | `target_id` | `STRING` | REQUIRED | Referencia foránea a `lineage_nodes.id` del nodo destino. |
  | `relation_type` | `STRING` | REQUIRED | `EXECUTES`, `TRIGGERS`, `LOADS_INTO`, `READS_FROM`, `WRITES_TO`, `TRANSFORMS`. |
  | `confidence_score`| `FLOAT64` | REQUIRED | Certeza normalizada de 0.0 a 1.0 (ej. 1.0 = 100%). |
  | `inference_method`| `STRING` | REQUIRED | `DETERMINISTIC_PARSER`, `GEMINI_FLASH`, `HEURISTIC_REGEX`, `BQ_METADATA`, `GENERIC_FALLBACK`. |
  | `evidence_snippet`| `STRING` | NULLABLE | Línea de código, query SQL o fragmento de log que justifica la relación. |
  | `created_at` | `TIMESTAMP` | NULLABLE | Fecha de creación del vínculo. |

---

### 2.3. Tabla: `execution_status_daily`
- **Propósito:** Histórico de telemetría y estados de ejecución diaria para semáforos y tableros operativos.
- **Particionamiento:** `PARTITION BY execution_date`
- **Clustering:** `CLUSTER BY node_id, status`
- **Esquema DDL:**
  | Columna | Tipo BigQuery | Modo | Descripción |
  |---------|:-------------:|:----:|-------------|
  | `execution_date` | `DATE` | REQUIRED | Fecha de la ejecución (partición diaria). |
  | `node_id` | `STRING` | REQUIRED | ID canónico del nodo monitoreado. |
  | `status` | `STRING` | REQUIRED | `PENDING`, `RUNNING`, `SUCCESS`, `FAILED`. |
  | `updated_at` | `TIMESTAMP` | REQUIRED | Momento exacto de la actualización. |
  | `details` | `STRING` | NULLABLE | Mensaje descriptivo o traza técnica de error. |

---

### 2.4. Tabla: `app_configurations`
- **Propósito:** Almacenamiento persistente de configuraciones dinámicas de la aplicación modificables desde la UI.
- **Esquema DDL:**
  | Columna | Tipo BigQuery | Modo | Descripción |
  |---------|:-------------:|:----:|-------------|
  | `config_key` | `STRING` | REQUIRED | Clave única de configuración (ej. `current_config`). |
  | `config_json` | `STRING` | REQUIRED | JSON con la configuración activa: `gemini_model`, `inbox_bucket`, `processed_bucket`, `budget_limit_usd`, `budget_alert_threshold_pct`. |
  | `updated_at` | `TIMESTAMP` | REQUIRED | Marca de tiempo de última actualización. |
  | `updated_by` | `STRING` | NULLABLE | Correo corporativo del administrador que realizó el cambio. |

---

### 2.5. Tabla: `app_users_roles`
- **Propósito:** Catálogo corporativo de usuarios RBAC exclusivos de El Puerto de Liverpool (`@liverpool.com.mx`).
- **Esquema DDL:**
  | Columna | Tipo BigQuery | Modo | Descripción |
  |---------|:-------------:|:----:|-------------|
  | `email` | `STRING` | REQUIRED | Correo corporativo institucional. |
  | `name` | `STRING` | NULLABLE | Nombre del colaborador. |
  | `roles` | `ARRAY<STRING>`| NULLABLE | Conjunto de roles: `Admin`, `Developer`, `Data Engineer`, `Auditor`, `Viewer`. |
  | `status` | `STRING` | NULLABLE | Estado operativo: `ACTIVE`, `INACTIVE`. |
  | `created_at` | `TIMESTAMP` | NULLABLE | Fecha de alta en el sistema. |
  | `updated_at` | `TIMESTAMP` | NULLABLE | Fecha de última actualización de perfil o rol. |
  | `last_login` | `TIMESTAMP` | NULLABLE | Última fecha y hora de sesión registrada. |

---

### 2.6. Tabla: `app_model_usage_logs`
- **Propósito:** Auditoría financiera y gobernanza de consumo de tokens y costos en dólares por llamadas a Gemini.
- **Particionamiento:** `PARTITION BY DATE(timestamp)`
- **Clustering:** `CLUSTER BY model_name, status`
- **Esquema DDL:**
  | Columna | Tipo BigQuery | Modo | Descripción |
  |---------|:-------------:|:----:|-------------|
  | `id` | `STRING` | REQUIRED | UUID del evento de inferencia. |
  | `timestamp` | `TIMESTAMP` | REQUIRED | Marca temporal de la llamada. |
  | `model_name` | `STRING` | REQUIRED | Modelo fundacional (`gemini-1.5-flash`, `gemini-1.5-pro`). |
  | `input_tokens` | `INT64` | NULLABLE | Tokens enviados en el prompt. |
  | `output_tokens`| `INT64` | NULLABLE | Tokens recibidos en la respuesta. |
  | `cost_usd` | `FLOAT64` | REQUIRED | Costo calculado en dólares según tarifas oficiales. |
  | `source_file` | `STRING` | NULLABLE | Archivo analizado causante del consumo. |
  | `confidence_score`| `FLOAT64` | NULLABLE | Puntuación de certeza devuelta. |
  | `status` | `STRING` | NULLABLE | `SUCCESS`, `FAILED`. |

---

### 2.7. Tabla: `app_errors_log`
- **Propósito:** Registro enriquecido de incidencias del frontend y backend con contexto ("carnita") y ciclo de vida.
- **Particionamiento:** `PARTITION BY DATE(last_seen)`
- **Clustering:** `CLUSTER BY status, severity`
- **Esquema DDL:**
  | Columna | Tipo BigQuery | Modo | Descripción |
  |---------|:-------------:|:----:|-------------|
  | `error_id` | `STRING` | REQUIRED | Hash criptográfico para agrupar incidencias idénticas repetidas. |
  | `error_type` | `STRING` | REQUIRED | Tipo de excepción (ej. `HTTPException`, `GraphRenderError`). |
  | `message` | `STRING` | REQUIRED | Mensaje descriptivo de la incidencia. |
  | `stack_trace`| `STRING` | NULLABLE | Traza de pila técnica completa para depuración inmediata. |
  | `component` | `STRING` | REQUIRED | Módulo emisor (ej. `BACKEND:storage_service`, `FRONTEND:LineageGraphView`). |
  | `severity` | `STRING` | REQUIRED | Severidad: `CRITICAL`, `WARNING`, `INFO`. |
  | `occurrence_count`| `INT64` | REQUIRED | Contador acumulado de repeticiones. |
  | `first_seen` | `TIMESTAMP` | REQUIRED | Fecha y hora de la primera detección. |
  | `last_seen` | `TIMESTAMP` | REQUIRED | Fecha y hora de la última detección. |
  | `status` | `STRING` | REQUIRED | Estado operativo: `OPEN`, `RESOLVED`. Si reaparece, conmuta automáticamente a `OPEN`. |
  | `resolved_at`| `TIMESTAMP` | NULLABLE | Marca de tiempo de resolución. |
  | `resolved_by`| `STRING` | NULLABLE | Usuario que cerró la incidencia. |

---

## 3. Linaje Multi-Dataset con Datasets de Negocio Externos

Además de las 7 tablas maestras, el recolector de linaje (`bigquery_metadata.py`) explora datasets de negocio en el mismo proyecto o proyectos monitoreados:
- **Descubrimiento de Vistas:** Mediante consultas a `INFORMATION_SCHEMA.VIEWS`, transpila la sentencia SQL con SQLGlot y genera aristas con certeza 1.0 hacia sus tablas origen (ej. `BIGQUERY:pruebasLineaje.ejemplotabla1 ➔ BIGQUERY:pruebasLineaje.vista_ejemplotabla_uno`).
- **Tablas Externas:** Identifica tablas vinculadas a Cloud Storage (`EXTERNAL TABLE`) y genera aristas `GCS:gs://bucket/archivo.csv ➔ BIGQUERY:dataset.tabla`.

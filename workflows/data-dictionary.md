# Diccionario de Datos: Tablas en Google BigQuery

Este documento detalla el **esquema canónico, tipos de datos, particionamiento, clustering y semántica** de las 7 tablas del dataset corporativo `applineajedatos` en Google BigQuery.

---

## Dataset: `applineajedatos`

### 1. Tabla: `lineage_nodes`
- **Descripción:** Catálogo maestro de componentes identificados en el ecosistema (procesos, scripts, jobs, tablas, modelos).
- **Esquema:**
  | Columna | Tipo BigQuery | Modo | Descripción |
  |---------|:-------------:|:----:|-------------|
  | `id` | `STRING` | REQUIRED | Clave única primaria con patrón `TOOL_TYPE:nombre` (ej. `CONTROL_M:JOB_DIARIO_VENTAS`, `BIGQUERY:pruebasLineaje.ejemplotabla1`). |
  | `name` | `STRING` | REQUIRED | Nombre legible del componente (ej. `JOB_DIARIO_VENTAS`, `ejemplotabla1`). |
  | `tool_type` | `STRING` | REQUIRED | Tipo de herramienta: `CONTROL_M`, `SHELL`, `DATASTAGE`, `AIRFLOW_COMPOSER`, `BIGQUERY`, `GENERIC_TOOL`. |
  | `layer` | `STRING` | NULLABLE | Capa de arquitectura: `INGESTION`, `PROCESSING`, `TRANSFORMATION`, `STORAGE`, `ANALYTICS`. |
  | `status` | `STRING` | NULLABLE | Estado operativo: `PENDING`, `RUNNING`, `SUCCESS`, `FAILED`. |
  | `metadata` | `STRING` | NULLABLE | JSON serializado con metadatos específicos (rutas, entorno, parámetros). |
  | `status_updated_at`| `TIMESTAMP` | NULLABLE | Última marca de tiempo de cambio de estado. |
  | `created_at` | `TIMESTAMP` | NULLABLE | Fecha de descubrimiento o registro del componente. |

---

### 2. Tabla: `lineage_edges`
- **Descripción:** Relaciones de dependencia y flujo de datos entre pares de componentes con scoring de certeza.
- **Esquema:**
  | Columna | Tipo BigQuery | Modo | Descripción |
  |---------|:-------------:|:----:|-------------|
  | `id` | `STRING` | REQUIRED | Identificador único de arista: `source_id->target_id`. |
  | `source_id` | `STRING` | REQUIRED | Clave foránea referenciando `lineage_nodes.id` del nodo origen. |
  | `target_id` | `STRING` | REQUIRED | Clave foránea referenciando `lineage_nodes.id` del nodo destino. |
  | `relation_type` | `STRING` | REQUIRED | Tipo de relación: `EXECUTES`, `TRIGGERS`, `LOADS_INTO`, `READS_FROM`, `WRITES_TO`. |
  | `confidence_score`| `FLOAT64` | REQUIRED | Puntuación normalizada de certeza de 0.0 a 1.0 (ej. 1.0 = 100%). |
  | `inference_method`| `STRING` | REQUIRED | Método de detección: `DETERMINISTIC_PARSER`, `GEMINI_FLASH`, `HEURISTIC_REGEX`, `GENERIC_FALLBACK`. |
  | `evidence_snippet`| `STRING` | NULLABLE | Fragmento textual o línea de log que fundamenta la relación inferida. |
  | `created_at` | `TIMESTAMP` | NULLABLE | Fecha de registro. |

---

### 3. Tabla: `execution_status_daily`
- **Descripción:** Telemetría histórica y estado operativo diario de los componentes monitoreados.
- **Particionamiento:** `PARTITION BY execution_date`
- **Clustering:** `CLUSTER BY node_id, status`
- **Esquema:**
  | Columna | Tipo BigQuery | Modo | Descripción |
  |---------|:-------------:|:----:|-------------|
  | `execution_date` | `DATE` | REQUIRED | Fecha operativa de la ejecución. |
  | `node_id` | `STRING` | REQUIRED | ID del nodo monitoreado. |
  | `status` | `STRING` | REQUIRED | `PENDING`, `RUNNING`, `SUCCESS`, `FAILED`. |
  | `updated_at` | `TIMESTAMP` | REQUIRED | Marca temporal precisa del evento. |
  | `details` | `STRING` | NULLABLE | Mensaje descriptivo o traza de error en caso de fallo. |

---

### 4. Tabla: `app_configurations`
- **Descripción:** Persistencia de parámetros dinámicos de infraestructura, modelos de IA, buckets y flags de UI.
- **Esquema:**
  | Columna | Tipo BigQuery | Modo | Descripción |
  |---------|:-------------:|:----:|-------------|
  | `config_key` | `STRING` | REQUIRED | Clave de configuración (ej. `current_config`). |
  | `config_json` | `STRING` | REQUIRED | Objeto JSON estructurado con los valores activos (`gemini_model`, `inbox_bucket`, `budget_limit_usd`, etc.). |
  | `updated_at` | `TIMESTAMP` | REQUIRED | Fecha y hora de última modificación. |
  | `updated_by` | `STRING` | NULLABLE | Correo corporativo del administrador que aplicó el cambio. |

---

### 5. Tabla: `app_users_roles`
- **Descripción:** Catálogo de usuarios corporativos de Liverpool y roles asignados para el control de acceso (RBAC).
- **Esquema:**
  | Columna | Tipo BigQuery | Modo | Descripción |
  |---------|:-------------:|:----:|-------------|
  | `email` | `STRING` | REQUIRED | Correo corporativo (ej. `colaborador@liverpool.com.mx`). |
  | `name` | `STRING` | NULLABLE | Nombre del colaborador. |
  | `roles` | `ARRAY<STRING>`| NULLABLE | Roles asignados: `Admin`, `Developer`, `Data Engineer`, `Auditor`, `Viewer`. |
  | `status` | `STRING` | NULLABLE | Estado operativo: `ACTIVE`, `INACTIVE`. |
  | `created_at` | `TIMESTAMP` | NULLABLE | Fecha de registro inicial. |
  | `updated_at` | `TIMESTAMP` | NULLABLE | Fecha de última modificación. |
  | `last_login` | `TIMESTAMP` | NULLABLE | Última fecha y hora de sesión. |

---

### 6. Tabla: `app_model_usage_logs`
- **Descripción:** Auditoría detallada del consumo de tokens y costes en USD por invocaciones a modelos de Gemini.
- **Particionamiento:** `PARTITION BY DATE(timestamp)`
- **Clustering:** `CLUSTER BY model_name, status`
- **Esquema:**
  | Columna | Tipo BigQuery | Modo | Descripción |
  |---------|:-------------:|:----:|-------------|
  | `id` | `STRING` | REQUIRED | UUID del log de invocación. |
  | `timestamp` | `TIMESTAMP` | REQUIRED | Momento exacto de la petición al modelo. |
  | `model_name` | `STRING` | REQUIRED | Modelo usado (ej. `gemini-1.5-flash`, `gemini-1.5-pro`). |
  | `input_tokens` | `INT64` | NULLABLE | Tokens de entrada enviados en el prompt. |
  | `output_tokens`| `INT64` | NULLABLE | Tokens generados en la respuesta. |
  | `cost_usd` | `FLOAT64` | REQUIRED | Costo estimado calculado en USD. |
  | `source_file` | `STRING` | NULLABLE | Archivo analizado causante de la llamada. |
  | `confidence_score`| `FLOAT64` | NULLABLE | Certeza obtenida en la respuesta. |
  | `status` | `STRING` | NULLABLE | `SUCCESS`, `FAILED`. |

---

### 7. Tabla: `app_errors_log`
- **Descripción:** Registro centralizado de errores del backend y frontend con contexto enriquecido y ciclo de vida de resolución.
- **Particionamiento:** `PARTITION BY DATE(last_seen)`
- **Clustering:** `CLUSTER BY status, severity`
- **Esquema:**
  | Columna | Tipo BigQuery | Modo | Descripción |
  |---------|:-------------:|:----:|-------------|
  | `error_id` | `STRING` | REQUIRED | Firma hash única para agrupar incidencias repetidas. |
  | `error_type` | `STRING` | REQUIRED | Tipo de excepción (ej. `FileNotFoundError`, `GraphRenderError`). |
  | `message` | `STRING` | REQUIRED | Mensaje descriptivo del fallo. |
  | `stack_trace`| `STRING` | NULLABLE | Traza técnica completa de ejecución. |
  | `component` | `STRING` | REQUIRED | Módulo emisor (ej. `BACKEND:storage_service`, `FRONTEND:LineageGraphView`). |
  | `severity` | `STRING` | REQUIRED | Severidad: `CRITICAL`, `WARNING`, `INFO`. |
  | `occurrence_count`| `INT64` | REQUIRED | Cantidad acumulada de ocurrencias. |
  | `first_seen` | `TIMESTAMP` | REQUIRED | Fecha y hora de primera detección. |
  | `last_seen` | `TIMESTAMP` | REQUIRED | Fecha y hora de última detección. |
  | `status` | `STRING` | REQUIRED | Estado de la incidencia: `OPEN`, `RESOLVED`. |
  | `resolved_at`| `TIMESTAMP` | NULLABLE | Fecha en que se marcó como resuelto. |
  | `resolved_by`| `STRING` | NULLABLE | Usuario que cerró la incidencia. |

# Memoria Arquitectónica y Registro de Decisiones (ADRs): GrafoLogsApps

Este documento constituye la **memoria viva del proyecto**. Registra todas las decisiones arquitectónicas clave, sus antecedentes, justificaciones técnicas y lecciones aprendidas para asegurar continuidad y coherencia en evoluciones futuras.

---

## Índice de Decisiones de Arquitectura (ADRs)

- **ADR-001:** Persistencia Integral y Resiliencia en Google BigQuery
- **ADR-002:** Pipeline de Inferencia en Cascada de 4 Niveles para Linaje
- **ADR-003:** Modo Dual Híbrido: GCP Nativo vs Mock Local Aislado
- **ADR-004:** Control de Acceso Basado en Roles (RBAC) y Modo Invitado para Liverpool
- **ADR-005:** Ingesta Asíncrona Continua mediante GCS Inbox Background Watcher
- **ADR-006:** Gobernanza y Control Presupuestario de Modelos de Lenguaje (IA)
- **ADR-007:** Algoritmo Adaptativo de Proximidad Dashboard (`layoutProximityDashboard`)
- **ADR-008:** Cajas de Nodos Responsivas en Cytoscape y Prevención de Desbordamientos

---

### ADR-001: Persistencia Integral y Resiliencia en Google BigQuery

- **Contexto:** Cloud Run es un entorno sin estado (stateless) que reinicia o escala a cero los contenedores periódicamente. Guardar configuraciones, linajes, usuarios o logs en memoria RAM o disco local efímero provocaba pérdida de datos ante nuevos despliegues.
- **Decisión:** BigQuery es la única fuente de verdad persistente del sistema, almacenando 7 tablas críticas:
  1. `lineage_nodes`: Catálogo maestro de componentes.
  2. `lineage_edges`: Relaciones de linaje con score de certeza y método de inferencia.
  3. `execution_status_daily`: Telemetría diaria particionada por fecha.
  4. `app_configurations`: Parámetros de modelos de IA, buckets GCS y banderas de UI.
  5. `app_users_roles`: Catálogo corporativo de usuarios y roles RBAC.
  6. `app_model_usage_logs`: Auditoría de consumo de tokens y costos en dólares.
  7. `app_errors_log`: Registro de errores con traza completa y severidad.
- **Impacto:** Resiliencia total. Los datos y configuraciones persisten independientemente del ciclo de vida del contenedor de Cloud Run o del proyecto donde se despliegue.

---

### ADR-002: Pipeline de Inferencia en Cascada de 4 Niveles para Linaje

- **Contexto:** Analizar miles de logs o scripts complejos puramente mediante LLMs (IA) es costoso y lento, mientras que usar solo parsers deterministas falla ante sintaxis heterogénea.
- **Decisión:** Implementar un motor en cascada de 4 capas:
  - **Nivel 1 (Determinista):** Parsers sintácticos especializados (SQLGlot para SQL, expresiones regulares exactas para Control-M XML, cabeceras estructuradas de DataStage). Certeza: 1.0 (100%). Latencia: < 5 ms.
  - **Nivel 2 (Semántico con IA):** Gemini 1.5 Flash para scripts dinámicos de Shell, DAGs de Python Airflow complejos o logs no estructurados. Certeza: 0.90 - 0.95. Latencia: ~600 ms.
  - **Nivel 3 (Heurístico / Fallback):** Patrones aproximados de regex cuando la IA no está disponible o para logs semi-estructurados. Certeza: 0.70 - 0.85.
  - **Nivel 4 (Genérico):** Clasificación del archivo como contenedor de datos o log sin procesar. Certeza: 0.50 - 0.70.
- **Impacto:** Máxima precisión y costo optimizado. El 80% de los logs se procesan a costo cero con certeza matemática, reservando Gemini solo para lógica compleja.

---

### ADR-003: Modo Dual Híbrido: GCP Nativo vs Mock Local Aislado

- **Contexto:** El desarrollo local y las pruebas continuas no deben requerir credenciales activas de GCP ni incurrir en facturación.
- **Decisión:** La variable `USE_MOCK_GCP` controla el modo de operación:
  - `USE_MOCK_GCP=true`: Los servicios `BigQueryService` y `StorageService` emulan almacenamiento en memoria y en carpetas locales (`local_storage/inbox`, `local_storage/processed`), permitiendo correr suites de test unitarios e integración en < 2 segundos.
  - `USE_MOCK_GCP=false`: Se inicializan los clientes oficiales de `google-cloud-bigquery` y `google-cloud-storage`, comunicándose directamente con la infraestructura en `crp-poc-it-hackathon-13`.
- **Impacto:** Desarrollo ágil, pruebas reproducibles sin conexión a internet y despliegues seguros en producción.

---

### ADR-004: Control de Acceso Basado en Roles (RBAC) y Modo Invitado para Liverpool

- **Contexto:** Requisito de seguridad corporativa para proteger la plataforma de accesos externos y gestionar permisos diferenciados.
- **Decisión:**
  - **Aislamiento de Dominio:** Solo se permite acceso con correos institucionales `@liverpool.com.mx`. Cualquier otro dominio recibe HTTP 403 Forbidden.
  - **Modo Invitado / Auto-Registro:** Un colaborador de Liverpool que ingrese por primera vez se auto-registra con rol `Viewer`, con acceso de solo lectura al grafo de linaje.
  - **Jerarquía de Roles:**
    - `ADMIN_ROOT` (`aemartinezz@liverpool.com.mx`): Control total, configuración, gestión de usuarios. Cuenta blindada (inmune a desactivación o borrado).
    - `DEVELOPER`: Acceso al grafo, telemetría, arquitectura viva, consulta de logs de error.
    - `DATA_ENGINEER`: Gestión de cargas, procesamiento de inbox y linaje.
    - `AUDITOR`: Acceso a logs de modelos, auditoría de costos y reportes.
    - `VIEWER`: Modo invitado, solo lectura de grafos.
- **Impacto:** Máxima seguridad y democratización segura del linaje corporativo.

---

### ADR-005: Ingesta Asíncrona Continua vía GCS Inbox Background Watcher

- **Contexto:** En operaciones reales, los procesos de batch depositan archivos directamente en buckets de Cloud Storage; los operadores no cargan archivos manualmente por la web.
- **Decisión:** Se creó `gcs_inbox_background_watcher`, una tarea asíncrona de fondo iniciada en el `lifespan` de FastAPI que escanea periódicamente el bucket `crp-poc-it-hackathon-13_inbox`. Al detectar nuevos archivos, los procesa por el pipeline en cascada, traslada los procesados al bucket `processed/`, actualiza el grafo en BigQuery y emite eventos vía WebSocket a los clientes conectados.
- **Impacto:** Ingesta desatendida y reactiva en tiempo real.

---

### ADR-006: Gobernanza y Control Presupuestario de Modelos de Lenguaje (IA)

- **Contexto:** El uso descontrolado de llamadas a LLM podría exceder presupuestos del proyecto.
- **Decisión:** Se diseñó el módulo de gobernanza financiera en `app_model_usage_logs` y `app_configurations`:
  - Cálculo de costos por invocación según tokens de entrada/salida.
  - Presupuesto mensual configurable en USD (por defecto $50.00 USD).
  - Umbral de alerta porcentual configurable (por defecto 80%). Al superarse, se disparan alertas en la UI visibles para `Admin` y `Developer`.
- **Impacto:** Costos predecibles y alertas tempranas antes de sobrepasar límites financieros.

---

### ADR-007: Algoritmo Adaptativo de Proximidad Dashboard (`layoutProximityDashboard`)

- **Contexto:** En la vista "Todas", Cytoscape distribuía los nodos según el orden del array. Las tablas conectadas (`stg_transacciones_raw`, `sp_procesar_transacciones`, `dim_clientes`) quedaban en las filas 7 y 8, mientras que sus pipelines estaban en la fila 0, creando aristas diagonales largas que cruzaban el catálogo de BigQuery.
- **Decisión:** Se implementó `layoutProximityDashboard`:
  - **Fila 0:** 10 columnas horizontales para la secuencia principal de orquestación (`CONTROL_M` ➔ `SHELL` ➔ `DATASTAGE` ➔ `COMPOSER`...).
  - **Fila 1:** Nodos dependientes directos ubicados en la **misma columna** (`x`) de su emisor, logrando aristas 100% verticales de 1 celda (115 px).
  - **Columnas y Filas Restantes:** Catálogo de 76+ tablas de BigQuery llenando la cuadrícula de forma armónica sin ninguna arista que las cruce.
- **Impacto:** Eliminación total de cruces de aristas largas, diseño ortogonal limpio y alineación perfecta idéntica a los requerimientos visuales del usuario.

---

### ADR-008: Cajas de Nodos Responsivas en Cytoscape y Prevención de Desbordamientos

- **Contexto:** Nombres largos de tareas de Composer (`dag_carga_ejemplotabla1.cargar_csv_a_bigquery`) o tablas de BigQuery desbordaban las cajas rectangulares en pantallas pequeñas.
- **Decisión:** Se creó la función `formatNodeBox(toolType, rawName)` que:
  - Tokeniza nombres largos respetando delimitadores (`.`, `_`, `/`, `-`).
  - Agrupa en líneas de máximo 22 a 26 caracteres.
  - Calcula dinámicamente `nodeWidth` (entre 160 y 320 px) y `nodeHeight` según la cantidad de líneas.
- **Impacto:** Renderizado impecable, tipografía nítida y cero desbordamientos en cualquier resolución.

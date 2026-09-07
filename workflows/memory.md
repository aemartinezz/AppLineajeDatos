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
- **ADR-009:** Telemetría Enriquecida de Incidencias ("Carnita") y Auto-Reapertura de Errores
- **ADR-010:** Feedback Visual Inmediato y CRUD Completo de Usuarios Corporativos
- **ADR-011:** Multi-Proyecto GCP Monitoreado y Validación de Conectividad BigQuery
- **ADR-012:** Introspección de Arquitectura Viva con Clasificación por Capas y Módulos Web
- **ADR-013:** Aislamiento Bidireccional de Subgrafos y Operaciones Atómicas en Batch de Cytoscape
- **ADR-014:** Estrategia de Rendimiento y Tuneo: Pre-Cálculo y Persistencia de Linaje en BigQuery
- **ADR-015:** Aislamiento Canónico de Tareas Airflow por DAG y Blindaje Estricto Anti-Colisión de Linaje

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

- **Contexto:** En operaciones reales, los procesos de batch depositan archivos directamente en buckets de Cloud Storage; los operadores no cargan archivos manualmente por la web. La vista `Bandeja Archivos` es un visor auxiliar, no la vía principal de entrada.
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
- **Decisión:** El usuario organizó manualmente la topología ideal en capturas compartidas. Se formalizó dicha disposición en el algoritmo `layoutProximityDashboard`:
  - **Fila 0:** 10 columnas horizontales para la secuencia principal de orquestación (`CONTROL_M` ➔ `SHELL` ➔ `DATASTAGE` ➔ `COMPOSER` ➔ ...).
  - **Fila 1:** Nodos dependientes directos ubicados en la **misma columna** (`x`) de su emisor, logrando aristas 100% verticales de 1 celda (115 px).
  - **Flujos Secundarios:** Jobs de pipelines adicionales (como `ejemplotabla2`) apilados verticalmente en la columna de su target (`cargar_csv_a_bigquery` en Col 8).
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

---

### ADR-009: Telemetría Enriquecida de Incidencias ("Carnita") y Auto-Reapertura de Errores

- **Contexto:** La vista de errores original solo mostraba el nombre del error sin detalles suficientes para diagnosticar si la falla provenía del frontend, backend o base de datos.
- **Decisión:** Enriquecer el modelo `app_errors_log` con traza técnica completa (`stack_trace`), identificador de componente emisor (`FRONTEND:LineageGraphView`, `BACKEND:storage_service`), severidades (`CRITICAL`, `WARNING`, `INFO`), URL del navegador, user agent y contexto JSON. Además, si un error previamente marcado como `RESOLVED` vuelve a ocurrir, el backend lo reabre automáticamente a `OPEN` e incrementa `occurrence_count`.
- **Impacto:** Diagnóstico rápido, trazabilidad clara y monitoreo proactivo sin errores desatendidos.

---

### ADR-010: Feedback Visual Inmediato y CRUD Completo de Usuarios Corporativos

- **Contexto:** Al interactuar con la gestión de usuarios, no se proporcionaba indicación visual de que la acción se estaba procesando, y no existía mecanismo para dar de baja definitiva a usuarios obsoletos.
- **Decisión:** Se implementó en `UserRolesView.tsx` un CRUD integral:
  - Creación de nuevo usuario corporativo (`@liverpool.com.mx`).
  - Modificación dinámica de roles con checkboxes multiselección.
  - Cambio de estado a `INACTIVE` (baja lógica) y reactivación a `ACTIVE`.
  - Eliminación física definitiva (`DELETE`).
  - Feedback visual inmediato: botones con spinners de carga en tiempo real y mensajes toast de confirmación.
  - Blindaje estricto de la cuenta maestra `ADMIN_ROOT` ante cualquier intento de borrado o suspensión.
- **Impacto:** Operación administrativa completa, intuitiva y a prueba de errores.

---

### ADR-011: Multi-Proyecto GCP Monitoreado y Validación de Conectividad BigQuery

- **Contexto:** La plataforma debe ser capaz de monitorear datasets de BigQuery alojados en múltiples proyectos de Google Cloud Platform de forma configurable.
- **Decisión:** En el módulo de Configuración se integró el endpoint `/api/gcp/validate` que valida sintácticamente el formato del `project_id`, comprueba la conectividad real con la API de BigQuery en GCP y contabiliza los datasets accesibles, permitiendo expandir la cobertura de la herramienta sin modificar código fuente.
- **Impacto:** Flexibilidad multi-entorno y validación preventiva de permisos de IAM.

---

### ADR-012: Introspección de Arquitectura Viva con Clasificación por Capas y Módulos Web

- **Contexto:** Los desarrolladores y auditores necesitan conocer en todo momento qué librerías, módulos, endpoints y componentes frontend integran la aplicación en ejecución.
- **Decisión:** Se desarrolló `code_architecture.py` y `ArchitectureView.tsx`, un módulo de auto-inspección viva que:
  - Clasifica componentes por lado: Frontend (React) vs Backend (FastAPI).
  - Categoriza por módulo web del menú: Inicio, Grafo Linaje, Estatus en Vivo, Arquitectura Viva, Bandeja Archivos, Usuarios y Roles, Configuración, Control Costos IA, Gestión Errores.
  - Detalla tecnologías empleadas, versiones y dependencias clave (`cytoscape`, `sqlglot`, `fastapi`, `pydantic`).
- **Impacto:** Transparencia técnica total y documentación viva auto-mantenida.

---

### ADR-013: Aislamiento Bidireccional de Subgrafos y Operaciones Atómicas en Batch de Cytoscape

- **Contexto:** Al filtrar por tecnología o buscar un nodo específico, ocultar elementos uno a uno producía parpadeos visuales y layouts desordenados.
- **Decisión:**
  - Todas las mutaciones del grafo se realizan dentro de `cy.batch(() => { ... })`.
  - El buscador soporta 3 modos de linaje: `UPSTREAM` (predecesores/origen), `DOWNSTREAM` (sucesores/destino) y `FULL` (ambos sentidos).
  - Al aislar un componente, se ocultan estrictamente todos los elementos ajenos y se aplica `relayoutVisibleElements(cy, 'dagre')` para ordenar la cadena de causalidad de izquierda a derecha sin huecos vacíos.
  - Al pulsar la 'X' para limpiar el buscador, se restaura la vista completa aplicando de nuevo el algoritmo de proximidad.
- **Impacto:** Rendimiento a 60 FPS, sin flicker y con aislamiento nítido del camino crítico.

---

### ADR-014: Estrategia de Rendimiento y Tuneo: Pre-Cálculo y Persistencia de Linaje en BigQuery

- **Contexto:** Calcular el linaje y ejecutar inferencias semánticas en cada carga de la aplicación causaba latencias elevadas y lentitud percibida.
- **Decisión:**
  - La inferencia se ejecuta una sola vez al depositarse el archivo en el bucket.
  - Los nodos y aristas resultantes se persisten inmediatamente en `lineage_nodes` y `lineage_edges` en BigQuery.
  - La API de consulta `/api/lineage/graph` lee el grafo ya materializado desde la base de datos con latencia < 80 ms.
  - El frontend cachea la estructura en memoria y solo aplica transiciones de visualización.
- **Impacto:** Experiencia ultra-rápida para los usuarios, bajo consumo de recursos en Cloud Run y reducción de consultas redundantes a BigQuery.

---

### ADR-015: Aislamiento Canónico de Tareas Airflow por DAG y Blindaje Estricto Anti-Colisión de Linaje

- **Contexto:** En Apache Airflow es habitual y estándar que múltiples DAGs contengan tareas con el mismo nombre (`task_id="cargar_csv_a_bigquery"`). El motor previo utilizaba como ID de nodo únicamente `AIRFLOW_COMPOSER:{task_id}` sin calificar por el DAG (`dag_id`), provocando que tareas homónimas de flujos independientes (ej. `dag_carga_ejemplotabla1` vs `dag_carga_ejemplotabla2`) colisionaran en un único nodo y fusionaran sus aristas, creando falsas conexiones cruzadas hacia tablas no relacionadas con 100% de confianza. Paralelamente, existía un residuo mock en `bigquery_metadata.py` que inyectaba forzosamente la arista `DATASTAGE:DS_LOAD_STAGING -> BIGQUERY:pruebasLineaje.ejemplotabla1`.
- **Decisión:**
  1. **Espacio de Nombres Calificado:** En `cascade_pipeline.py`, todo nodo de tarea de Airflow se genera bajo el formato canónico calificado `AIRFLOW_COMPOSER:{dag_id}.{task_id}` (ej. `AIRFLOW_COMPOSER:dag_carga_ejemplotabla1.cargar_csv_a_bigquery`), garantizando aislamiento matemático total entre pipelines paralelos.
  2. **Eliminación Total de Inyecciones Hardcodeadas:** Se suprimió definitivamente el mock de DataStage en `bigquery_metadata.py`, tanto en modo real como en modo emulado.
  3. **Purga y Rehidratación Limpia en BigQuery:** Se implementó el método `reset_lineage_tables()` y el endpoint administrativo `POST /api/lineage/reset` que ejecuta `DELETE FROM lineage_edges WHERE TRUE` y `DELETE FROM lineage_nodes WHERE TRUE` en BigQuery, reinicia la memoria y permite la reconstrucción limpia e impoluta del linaje con el endpoint `POST /api/lineage/reprocess-all`.
  4. **Adaptación del Algoritmo de Proximidad Frontend:** Se integraron los identificadores calificados en `PREFERRED_PIPELINE_ORDER` en `LineageGraphView.tsx`, asegurando que cada DAG y tarea se posicione adyacente a sus tablas destino en la cuadrícula ortogonal.
- **Impacto:** Eliminación total y permanente de relaciones falsas, separación estricta de responsabilidades entre flujos ETL/ELT y certidumbre matemática del 100% en el linaje visualizado.


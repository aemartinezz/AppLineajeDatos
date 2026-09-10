# Estándares de Ingeniería de Backend: Python 3.11+, FastAPI y BigQuery

Este documento define las **directrices técnicas, patrones de diseño de software, manejo de concurrencia y estándares de codificación** para los módulos de backend de la plataforma GrafoLogsApps.

---

## 1. Pila Tecnológica y Dependencias Principales

- **Lenguaje:** Python 3.11+.
- **Framework Asíncrono:** FastAPI con servidor ASGI Uvicorn.
- **Validación y Modelado:** Pydantic v2 (esquemas estrictos y tipado fuerte).
- **Motor de Análisis SQL:** SQLGlot para transpilación y extracción de árboles sintácticos (AST).
- **SDKs Oficiales de Google Cloud:** `google-cloud-bigquery`, `google-cloud-storage`, `google-cloud-logging`.
- **Integración con IA:** Llamadas directas REST a la API de Vertex AI (`aiplatform.googleapis.com`) para modelos Gemini 1.5 Flash y Pro con fallback resiliente.

---

## 2. Estructura Canónica de Directorios

```
backend/
├── app/
│   ├── main.py                  # Endpoints REST, WebSockets y ciclo de vida lifespan (GCS Watcher)
│   ├── config.py                # Pydantic Settings y resolución de variables de entorno
│   ├── security.py              # Validación RBAC, dominio @liverpool.com.mx e inmunidad de root
│   ├── models/
│   │   └── schemas.py           # Modelos de datos Pydantic, Enums (ToolType, Layer, etc.)
│   ├── services/
│   │   ├── bigquery_service.py  # Capa de acceso a datos, queries parametrizadas y emulación mock
│   │   ├── storage_service.py   # Gestión de archivos en GCS y ciclo de vida inbox/processed
│   │   └── init_db.py           # DDLs idempotentes y aseguramiento de esquemas en BigQuery
│   └── engine/
│       ├── tool_detector.py     # Clasificador agnóstico de herramientas por firmas y shebangs
│       ├── cascade_pipeline.py  # Pipeline en cascada de 4 capas con cálculo de certeza
│       ├── lineage_linker.py    # Motor de fusión y resolución de dependencias heterogéneas
│       ├── bigquery_metadata.py # Recolector multi-fuente de vistas, tablas y rutinas en BigQuery
│       └── code_architecture.py # Auto-introspección dinámica del código del repositorio
```

---

## 3. Convenciones de Codificación y Buenas Prácticas

1. **Tipado Estricto (Type Hinting):**
   - Todas las funciones y métodos deben declarar explícitamente tipos de entrada y retorno mediante el módulo `typing` (`List`, `Dict`, `Optional`, `Union`, etc.).
   ```python
   def get_full_graph(min_confidence: float = 0.0) -> LineageGraph:
       ...
   ```

2. **Modo Dual Híbrido Obligatorio:**
   - La plataforma debe operar tanto en entornos locales sin conexión como en Google Cloud mediante el flag `settings.USE_MOCK_GCP`:
     - `USE_MOCK_GCP=true`: Las clases `BigQueryService` y `StorageService` emulan almacenamiento en memoria y en carpetas locales (`local_storage/inbox`, `local_storage/processed`). Permite correr las 10 suites de prueba en < 3 segundos sin requerir credenciales de GCP.
     - `USE_MOCK_GCP=false`: Inicializa los clientes oficiales de GCP y se conecta a BigQuery y Cloud Storage en producción.

3. **Manejo Centralizado de Excepciones y Telemetría Enriquecida ("Carnita"):**
   - Queda estrictamente prohibido silenciar errores con `except: pass`.
   - Todo bloque `try-except` crítico debe:
     1. Extraer la traza completa de error con `traceback.format_exc()`.
     2. Registrar la incidencia en la tabla `app_errors_log` de BigQuery mediante `bigquery_service.log_error(...)`.
     3. Si el error ya existía previamente con estado `RESOLVED`, reabrirlo automáticamente a `OPEN` e incrementar `occurrence_count`.

4. **Nomenclatura Canónica de Nodos de Linaje:**
   - Para evitar colisiones entre herramientas, todo ID de nodo debe seguir obligatoriamente el formato:
     `TOOL_TYPE:nombre_componente` (con la herramienta en MAYÚSCULAS).
     - Ejemplo BigQuery: `BIGQUERY:dataset.tabla` o `BIGQUERY:dataset.vista`
     - Ejemplo Control-M: `CONTROL_M:JOB_DIARIO_VENTAS`
     - Ejemplo DataStage: `DATASTAGE:DS_LOAD_STAGING`
     - Ejemplo Shell: `SHELL:extract_oracle.sh`
     - Ejemplo Airflow: `AIRFLOW_COMPOSER:dag_ventas.task_carga`

5. **Análisis Sintáctico Seguro con SQLGlot:**
   - Al analizar vistas (`INFORMATION_SCHEMA.VIEWS`) o scripts SQL, usar `sqlglot.parse_one(sql, read="bigquery")`.
   - Es obligatorio inspeccionar las cláusulas `WITH` (CTEs) para descartar alias temporales y evitar relacionar tablas inexistentes en el grafo de linaje.

---

## 4. Gestión de Concurrencia y Tareas Asíncronas

1. **Ciclo de Vida `lifespan` en FastAPI:**
   - El background worker `gcs_inbox_background_watcher` se inicia en el evento de inicio del `lifespan` y se cancela limpiamente al apagar el servidor.
   - Debe ejecutarse de manera no bloqueante utilizando `asyncio.sleep` para no frenar la atención de solicitudes HTTP.
2. **Emisión de Eventos WebSocket:**
   - Las conexiones activas en `/ws/telemetry` se gestionan en una lista concurrente segura. Si un cliente se desconecta, se remueve silenciosamente de la lista sin generar errores en cascada.

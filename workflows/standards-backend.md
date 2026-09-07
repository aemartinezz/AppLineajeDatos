# Estándares de Ingeniería de Backend: Python y FastAPI

Este documento define las **directrices técnicas, patrones de diseño y estándares de codificación** para todos los módulos de backend de la plataforma GrafoLogsApps.

---

## 1. Pila Tecnológica y Versiones

- **Lenguaje:** Python 3.11+.
- **Framework Web:** FastAPI (asíncrono con Uvicorn).
- **Tipado y Serialización:** Pydantic v2 para esquemas de datos y validación de payloads.
- **Motor SQL:** SQLGlot para análisis sintáctico y transpilación de consultas SQL complejas.
- **SDKs Cloud:** `google-cloud-bigquery`, `google-cloud-storage`, `google-cloud-aiplatform`.

---

## 2. Estructura de Directorios

```
backend/
├── app/
│   ├── main.py                  # Endpoints REST, WebSockets y ciclo de vida (lifespan)
│   ├── config.py                # Pydantic Settings y variables de entorno
│   ├── models/
│   │   └── schemas.py           # Modelos de datos Pydantic y Enums
│   ├── services/
│   │   ├── bigquery_service.py  # Operaciones de persistencia y consultas en BigQuery
│   │   ├── storage_service.py   # Gestión de archivos en GCS y ciclo de vida de almacenamiento
│   │   └── init_db.py           # DDLs y aseguramiento de esquemas en BigQuery
│   └── engine/
│       ├── tool_detector.py     # Detección agnóstica de herramientas y firmas de logs
│       ├── cascade_pipeline.py  # Pipeline de inferencia en cascada de 4 niveles
│       ├── lineage_linker.py    # Algoritmos de fusión y resolución de nodos de linaje
│       └── code_architecture.py # Auto-introspección del código del proyecto
```

---

## 3. Convenciones de Código y Buenas Prácticas

1. **Tipado Estricto (Type Hinting):**
   - Todas las funciones y métodos deben declarar tipos de entrada y salida mediante `typing` (`List`, `Dict`, `Optional`, `Union`, etc.).
   ```python
   def get_full_graph(min_confidence: float = 0.0) -> LineageGraph:
       ...
   ```

2. **Manejo Centralizado de Excepciones y Reporte de Errores:**
   - Todo bloque `try-except` crítico debe capturar la traza completa con `traceback.format_exc()` y persistir la incidencia en `app_errors_log` en BigQuery con su severidad (`CRITICAL`, `WARNING`, `INFO`).
   - Jamás capturar excepciones con `pass` silencioso.

3. **Modo Híbrido Obrigatório:**
   - Todo servicio que interactúe con GCP debe verificar `settings.USE_MOCK_GCP`. Si es `True`, debe proveer una implementación simulada coherente en memoria o disco local sin lanzar excepciones de credenciales faltantes.

4. **Persistencia Dinámica de Configuración:**
   - La configuración de la aplicación no se hardcodea. Se consulta y actualiza en la tabla `app_configurations` de BigQuery, garantizando que cambios realizados desde el módulo de Configuración se propaguen de inmediato.

---

## 4. Estándares de BigQuery y Consultas

1. **Nomenclatura Canónica de Nodos:**
   - Todo ID de nodo debe seguir el patrón `TOOL_TYPE:nombre_componente` en mayúsculas para la herramienta (ej. `CONTROL_M:JOB_DIARIO_VENTAS`, `BIGQUERY:dataset.tabla`, `DATASTAGE:DS_JOB_NAME`).
2. **Optimización de Costos y Particionamiento:**
   - Tablas que crecen con el tiempo (`execution_status_daily`, `app_model_usage_logs`, `app_errors_log`) deben particionarse por fecha (`PARTITION BY DATE(...)`) y aplicar `CLUSTER BY` sobre columnas de filtrado frecuente (`status`, `severity`, `node_id`).
   - Evitar `SELECT *` masivos sobre tablas de logs; filtrar siempre por rango de fechas o limitar el volumen consultado.

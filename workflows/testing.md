# Metodología y Protocolo Exhaustivo de Pruebas: GrafoLogsApps

Este documento define la **estrategia de aseguramiento de calidad (QA), ejecución de pruebas locales, validación de frontend y verificación en producción** que debe ejecutarse y aprobarse al 100% antes de realizar cualquier commit o despliegue.

---

## 1. Comando Unificado de Pruebas Locales (El Guardián del Repositorio)

El proyecto cuenta con un orquestador integral de pruebas que ejecuta todas las suites en orden secuencial con aislamiento total:

```bash
USE_MOCK_GCP=true PYTHONPATH=backend ./venv/bin/python3 scriptsPrueba/run_all_tests.py
```

> [!IMPORTANT]
> **Criterio de Aprobación Obligatorio (10/10 OK):**
> Las 10 suites deben reportar `[APROBADO]` con salida final `RESULTADO FINAL: TODAS LAS PRUEBAS PASARON [OK]`.
> Si tan solo una prueba falla, el agente tiene **terminantemente prohibido realizar `git commit` o desplegar en GCP** hasta investigar la causa raíz y subsanar el defecto.

---

## 2. Desglose Detallado de las 10 Suites de Prueba

| Suite | Archivo de Prueba | Componente Validado | Qué Valida Específicamente |
|:-----:|-------------------|---------------------|---------------------------|
| **1** | `test_tool_detector.py` | `engine/tool_detector.py` | Identificación agnóstica de herramientas y firmas: `SHELL` (.sh), `AIRFLOW_COMPOSER` (.py con DAGs), `DATASTAGE` (.dsx), `CONTROL_M` (.xml), `BIGQUERY` (.sql) y `GENERIC_TOOL` (.log). |
| **2** | `test_cascade_pipeline.py` | `engine/cascade_pipeline.py` | Pipeline de inferencia en 4 capas: Nivel 1 (Parsers sintácticos SQLGlot/Regex con Certeza 1.0), Nivel 2 (Gemini Vertex AI / Semántico con Certeza 0.90-0.95), Nivel 3 (Heurístico) y Nivel 4 (Genérico). |
| **3** | `test_lineage_linker.py` | `engine/lineage_linker.py` | Fusión end-to-end de dependencias heterogéneas: cadena completa `Control-M ➔ Shell ➔ DataStage ➔ BigQuery`. Resolución de IDs canónicos y descarte de falsos positivos. |
| **4** | `test_storage_service.py` | `services/storage_service.py` | Ciclo de vida de archivos en Cloud Storage: depósito en `inbox/`, procesamiento por pipeline, traslado a `processed/` y lectura segura para el Inspector. |
| **5** | `test_api_endpoints.py` | `main.py` | Endpoints REST `/api/health`, `/api/lineage/graph`, `/api/config`, `/api/gcp/validate` y actualización en tiempo real de telemetría de ejecución `/api/telemetry/status`. |
| **6** | `test_introspection_and_persistence.py` | `engine/code_architecture.py` & `services/bigquery_service.py` | Mapeo automático del código fuente del repositorio y persistencia dinámica de configuración en la tabla `app_configurations` de BigQuery. Filtrado por certeza diferencial. |
| **7** | `test_security_rbac.py` | `main.py` & `models/schemas.py` | Restricción de dominio corporativo `@liverpool.com.mx`, bloqueo 403 para dominios externos, auto-registro en Modo Invitado (`Viewer`), bloqueo RBAC y mitigación de Path Traversal. |
| **8** | `test_multidataset_costs_errors.py` | `engine/bigquery_metadata.py` & `services/bigquery_service.py` | Recolección multi-fuente de linaje en BigQuery (tablas, vistas como `vista_ejemplotabla_uno`, rutinas), tracking de tokens/costos de IA y ciclo de vida de errores. |
| **9** | `test_security_crud_users_budget.py` | `main.py` & `services/bigquery_service.py` | Inmunidad de `ADMIN_ROOT`, CRUD completo de usuarios corporativos (crear, dar de baja, reactivar, eliminar), sanitización de `project_id` y alertas de presupuesto mensual de IA. |
| **10**| `test_watcher_logs_bq.py` | `main.py` & `services/storage_service.py` | Background worker asíncrono de GCS Inbox, procesamiento de logs estructurados en Nivel 1 (100% certeza) y validación de conectividad de buckets. |

---

## 3. Pruebas de Compilación de Frontend (TypeScript Estricto)

Antes de generar contenedores Docker o subir cambios a producción:

```bash
cd frontend && npm run build
```

- **Criterio de éxito:** El compilador de Vite debe generar los bundles en `frontend/dist/` en pocos segundos sin ningún error de TypeScript (`tsc`).
- **Regla:** Queda prohibido el uso de directivas `@ts-ignore` o tipos `any` injustificados.

---

## 4. Validación Visual en Producción con Subagente Navegador (`/browser`)

Tras cada despliegue en Google Cloud Run (`https://applineaje-frontend-138247328035.us-central1.run.app/`):

1. **Recarga Limpia sin Caché:** Abrir la URL garantizando que no se carguen versiones obsoletas en caché.
2. **Inspección de Consola JS:**
   - La consola del navegador debe reportar **0 errores** de JavaScript.
   - Cualquier advertencia o excepción debe ser investigada de inmediato.
3. **Verificación de Layout y Topología:**
   - En el módulo "Grafo Linaje", comprobar la vista general "Todas" con el algoritmo `layoutProximityDashboard`.
   - Probar los filtros de tecnología (BigQuery, DataStage, Composer, Shell).
   - Probar el buscador con un componente específico (ej. `ejemplotabla1`) para verificar el aislamiento causal de izquierda a derecha con Dagre.
4. **Registro de Evidencias:**
   - Capturar pantallas de alta resolución y adjuntarlas en el archivo `walkthrough.md`.

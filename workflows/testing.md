# Protocolo y Metodología de Pruebas: GrafoLogsApps

Este documento define la **estrategia obligatoria de verificación y pruebas automatizadas** que debe ejecutarse y aprobarse antes de realizar cualquier commit o despliegue.

---

## 1. Comando Unificado de Pruebas Locales

El proyecto cuenta con un orquestador integral de pruebas que ejecuta todas las suites en orden:

```bash
USE_MOCK_GCP=true PYTHONPATH=backend ./venv/bin/python3 scriptsPrueba/run_all_tests.py
```

> [!IMPORTANT]
> **Criterio de Aprobación Obligatorio:** Las 10 suites deben reportar `[APROBADO]` (100% de éxito). Si tan solo una falla, el agente tiene terminantemente prohibido hacer commit o despliegue hasta corregir el defecto.

---

## 2. Desglose de las 10 Suites de Prueba

1. **Detector Agnóstico de Herramientas (`test_tool_detector.py`):**
   - Valida la detección correcta de firmas y tipos de archivo: `SHELL` (.sh), `AIRFLOW_COMPOSER` (.py con DAGs), `DATASTAGE` (.dsx), `CONTROL_M` (.xml), `BIGQUERY` (.sql) y `GENERIC_TOOL` (.log).
2. **Pipeline en Cascada de 4 Niveles (`test_cascade_pipeline.py`):**
   - Evalúa resolución sintáctica determinista (Nivel 1), heurísticas (Nivel 3) y fallback genérico (Nivel 4), verificando scoring de certeza.
3. **Motor de Fusión y Linaje End-to-End (`test_lineage_linker.py`):**
   - Comprueba la unión de la cadena completa de ejecución: `Control-M ➔ Shell ➔ DataStage ➔ BigQuery`.
4. **Ciclo de Vida de Almacenamiento (`test_storage_service.py`):**
   - Valida el flujo `inbox/` ➔ procesamiento en cascada ➔ traslado a `processed/` e inspección.
5. **Endpoints REST y Telemetría WebSocket (`test_api_endpoints.py`):**
   - Valida `/api/health`, `/api/lineage/graph`, `/api/config`, `/api/gcp/validate` y actualización de estado en `/api/telemetry/status`.
6. **Introspección de Arquitectura y Persistencia BigQuery (`test_introspection_and_persistence.py`):**
   - Valida el mapeo automático de componentes (backend/frontend) y la persistencia de configuración en BigQuery.
7. **Seguridad, RBAC y Restricción de Dominio Liverpool (`test_security_rbac.py`):**
   - Valida rechazo 403 para dominios ajenos, auto-registro en Modo Invitado (`Viewer`), bloqueo de acciones para roles no autorizados y mitigación de Path Traversal.
8. **Multi-Dataset BigQuery, Costos IA y Errores (`test_multidataset_costs_errors.py`):**
   - Valida linaje multi-dataset (`pruebasLineaje.ejemplotabla1`), tracking de tokens/costos en USD y ciclo de vida de errores.
9. **Seguridad GCP, CRUD Usuarios y Presupuesto IA (`test_security_crud_users_budget.py`):**
   - Valida inmunidad de la cuenta raíz, CRUD completo de usuarios (creación, baja, reactivación, borrado), sanitización de `project_id` y alertas presupuestarias.
10. **GCS Inbox Watcher y Persistencia BigQuery (`test_watcher_logs_bq.py`):**
    - Valida el background worker asíncrono de GCS, procesamiento de logs estructurados Nivel 1 y validación de buckets.

---

## 3. Pruebas de Frontend y Compilación

Antes de generar contenedores o subir cambios de UI:
```bash
cd frontend && npm run build
```
- Debe compilar sin errores de TypeScript y generar los bundles en `frontend/dist/`.

---

## 4. Validación en Vivo con Subagente Navegador (`/browser`)

Tras cada despliegue en Google Cloud Run (`https://applineaje-frontend-138247328035.us-central1.run.app/`):
1. Abrir la URL con recarga limpia (evitar caché de service workers).
2. Verificar la consola de JavaScript (**0 errores permitidos**).
3. Validar visualmente la vista "Todas", el filtro de tecnologías y el buscador de componentes.
4. Tomar capturas de pantalla de evidencia y registrar los resultados en `walkthrough.md`.

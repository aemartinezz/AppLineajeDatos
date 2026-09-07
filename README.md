# Plataforma de Linaje End-to-End & Observabilidad en GCP

Plataforma empresarial en Google Cloud Platform (GCP) diseñada para descubrir, correlacionar y visualizar el linaje de datos de extremo a extremo a través de múltiples herramientas heterogéneas on-premise y nube (**Control-M, Shell Scripts, DataStage, Cloud Composer, BigQuery**).

---

## 🏛️ Sistema de Gobernanza y Directrices para Agentes de IA

Este repositorio cuenta con un **sistema de gobernanza exhaustivo** obligatorio para cualquier agente de Inteligencia Artificial (especialmente Google Gemini / Antigravity) y desarrollador. Consulta los documentos maestros:

* 🧭 [**Guía Maestra y Entrypoint (`gemini.md`)**](gemini.md)
* 📜 [**Manifiesto y Reglas Operativas (`workflows/gemini.md`)**](workflows/gemini.md)
* 🧠 [**Memoria y Registro de Decisiones de Arquitectura (`workflows/memory.md`)**](workflows/memory.md)
* 🔒 [**Políticas de Seguridad y RBAC Liverpool (`workflows/security.md`)**](workflows/security.md)
* 🧪 [**Protocolo y Suite de Pruebas (`workflows/testing.md`)**](workflows/testing.md)
* 🎨 [**Estándares de Frontend y UX (`workflows/standards-frontend.md`)**](workflows/standards-frontend.md)
* ⚙️ [**Estándares de Backend y Python (`workflows/standards-backend.md`)**](workflows/standards-backend.md)
* 🏗️ [**Arquitectura Técnica Integral (`workflows/architecture.md`)**](workflows/architecture.md)
* 📖 [**Diccionario de Datos BigQuery (`workflows/data-dictionary.md`)**](workflows/data-dictionary.md)
* 🚀 [**Manual de Despliegue en GCP (`workflows/operations-deployment.md`)**](workflows/operations-deployment.md)

---

## 1. Características Principales

* **Detector Agnóstico de Herramientas:** Reconoce dinámicamente cualquier tecnología por extensión, firmas de contenido o inferencia semántica con IA.
* **Metadata Profunda de BigQuery:** Integra automáticamente el catálogo y linaje de `INFORMATION_SCHEMA.TABLES`, `VIEWS`, `ROUTINES` y `JOBS_BY_PROJECT`.
* **Pipeline en Cascada de 4 Niveles (Optimización de Costes):**
  * **Nivel 1:** Parsers deterministas y AST (`sqlglot`, Python AST, XML).
  * **Nivel 2:** Filtro de relevancia y limpieza del 95% de ruido en logs.
  * **Nivel 3:** Modelo ligero (Gemini 1.5 Flash) con extracción JSON estructurada.
  * **Nivel 4:** Escalado automático a Gemini 1.5 Pro solo para casos complejos.
* **Persistencia Real en BigQuery (`applineajedatos`):**
  * `lineage_nodes`: Catálogo global de componentes.
  * `lineage_edges`: Relaciones y dependencias con scoring de certeza.
  * `execution_status_daily`: Telemetría diaria particionada por fecha.
  * `app_configurations`: Persistencia permanente de parámetros de modelos y buckets entre reinicios de Cloud Run.
* **Documentación Viva de Arquitectura de Código (Dev & Admin):**
  * Grafo interactivo que introspecta en vivo las rutas de FastAPI, servicios, motores de inferencia y vistas React.
  * Selector de rol en tiempo de ejecución para auditar o extender componentes.
* **Experiencia de Usuario Avanzada en Cytoscape.js:**
  * Zoom y scroll suavizados (`wheelSensitivity: 0.12`) con límites estables (`minZoom: 0.25`, `maxZoom: 2.2`).
  * Botón **"Centrar Grafo"** para reencuadrar la vista instantáneamente.
  * Tooltips explicativos con icono **ℹ️** en cada control y semáforo.
  * **Buscador de Entidades con Trazabilidad Bidireccional:** Resalta linaje hacia atrás (**Origen / Upstream**) o hacia adelante (**Destino / Downstream**).
* **Telemetría en Vivo:** Semáforos en tiempo real mediante WebSockets sin recargar la página (🟢 Éxito, 🔵 Ejecutando, 🔴 Fallo, ⚪ Pendiente).

---

## 2. Guía de Despliegue en Cualquier Proyecto de GCP

El script `deploy/deploy_gcp.sh` es parametrizado e idempotente. Puede ejecutarse en cualquier proyecto de Google Cloud con un solo comando.

### 2.1. Permisos y Roles IAM Requeridos

#### A. Roles para el Usuario Implementador (quien ejecuta el despliegue):
* `roles/run.admin` (Crear y administrar servicios de Cloud Run)
* `roles/storage.admin` (Crear buckets y gestionar objetos en Cloud Storage)
* `roles/bigquery.admin` (Crear datasets, tablas y consultar metadatos)
* `roles/cloudbuild.builds.editor` (Compilar contenedores en Cloud Build)
* `roles/artifactregistry.admin` (Almacenar imágenes de contenedor)
* `roles/iam.serviceAccountUser` (Asignar la Service Account por defecto a Cloud Run)
* `roles/serviceusage.serviceUsageAdmin` (Habilitar las APIs requeridas)

#### B. Roles para la Service Account de Ejecución de Cloud Run:
*(Por defecto `[PROJECT_NUMBER]-compute@developer.gserviceaccount.com`)*
* `roles/bigquery.dataEditor` y `roles/bigquery.jobUser` (o `roles/bigquery.admin`)
* `roles/storage.objectAdmin` (sobre los buckets de inbox y procesados)
* `roles/aiplatform.user` (para invocar Gemini Flash / Pro en Vertex AI)
* `roles/logging.logWriter` (emisión de logs y trazas)

### 2.2. APIs de GCP que el Script Habilita Automáticamente:
1. `run.googleapis.com` (Cloud Run)
2. `cloudbuild.googleapis.com` (Cloud Build)
3. `artifactregistry.googleapis.com` (Artifact Registry)
4. `bigquery.googleapis.com` (Google BigQuery)
5. `storage.googleapis.com` (Google Cloud Storage)
6. `aiplatform.googleapis.com` (Vertex AI para Gemini)
7. `logging.googleapis.com` (Cloud Logging)
8. `pubsub.googleapis.com` (Cloud Pub/Sub)

### 2.3. Ejecución del Despliegue:
```bash
# Sintaxis:
./deploy/deploy_gcp.sh [PROJECT_ID] [REGION] [BQ_DATASET] [INBOX_BUCKET] [PROCESSED_BUCKET]

# Ejemplo para el proyecto del hackathon:
./deploy/deploy_gcp.sh crp-poc-it-hackathon-13 us-central1 applineajedatos datosdeentrada datosprocesadosapp
```

---

## 3. Pruebas Locales y Ejecución

### Pruebas Automatizadas
Las pruebas se encuentran en `scriptsPrueba/` y guardan los reportes en `resultadosPrueba/` (ignorado por git):
```bash
./venv/bin/python3 scriptsPrueba/run_all_tests.py
```

### Ejecutar Localmente la Aplicación Completa
```bash
./run_local.sh
```
Abre en tu navegador: **http://localhost:3000**

# Manual Operativo de Despliegue y Mantenimiento en Google Cloud Platform

Este documento describe los **procedimientos operativos para la compilación, despliegue, configuración de variables de entorno y rollback** de la plataforma GrafoLogsApps en Google Cloud Platform (GCP).

---

## 1. Parámetros de Entorno y Configuración

### Backend (`backend/app/config.py`)
| Variable | Valor por Defecto | Descripción |
|----------|:-----------------:|-------------|
| `GCP_PROJECT_ID` | `crp-poc-it-hackathon-13` | Identificador del proyecto de GCP. |
| `GCP_REGION` | `us-central1` | Región para servicios Cloud Run y Cloud Build. |
| `BQ_DATASET` | `applineajedatos` | Dataset maestro de BigQuery (configurable). |
| `GCS_INBOX_BUCKET` | `datosdeentrada` | Bucket de entrada para ingesta automática de archivos. |
| `GCS_PROCESSED_BUCKET` | `datosprocesadosapp` | Bucket histórico para archivos ya analizados. |
| `GCS_QUARANTINE_BUCKET` | `datosquarentena` | Bucket para anomalías o archivos no procesables. |
| `GCP_SERVICE_ACCOUNT` | `sa-applineaje-backend@...` | Service Account dedicada con roles de menor privilegio. |
| `USE_MOCK_GCP` | `false` (en prod) / `true` (en local) | Si es `true`, simula BigQuery y GCS localmente. |
| `PORT` | `8080` | Puerto HTTP para Uvicorn en Cloud Run. |

---

---

## 2. Procedimiento de Instalación en Nuevos Proyectos GCP (Menor Privilegio)

Para instalar la plataforma en un proyecto nuevo de Google Cloud Platform sin utilizar permisos de superadministrador (`roles/owner`, `roles/editor` o `roles/bigquery.admin`), siga este procedimiento:

### Paso 1: Habilitar APIs Requeridas
```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  bigquery.googleapis.com \
  storage.googleapis.com \
  aiplatform.googleapis.com \
  logging.googleapis.com \
  --project="[PROJECT_ID]"
```

### Paso 2: Crear Service Account Dedicada para Backend
```bash
gcloud iam service-accounts create sa-applineaje-backend \
  --display-name="SA Backend Linaje End-to-End" \
  --project="[PROJECT_ID]"
```

### Paso 3: Asignar Roles Estrictos de Menor Privilegio (Least Privilege)
```bash
SA_EMAIL="sa-applineaje-backend@[PROJECT_ID].iam.gserviceaccount.com"

# 1. Nivel Proyecto: Ejecutar consultas SQL y llamadas a Gemini Vertex AI
gcloud projects add-iam-policy-binding "[PROJECT_ID]" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/bigquery.jobUser"

gcloud projects add-iam-policy-binding "[PROJECT_ID]" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding "[PROJECT_ID]" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/logging.logWriter"

# 2. Nivel Dataset de la Aplicación (sin ser BigQuery Admin)
bq add-iam-policy-binding \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/bigquery.dataEditor" \
  "[PROJECT_ID]:[BQ_DATASET]"

# 3. Nivel Buckets de Cloud Storage (sin ser Storage Admin)
gcloud storage buckets add-iam-policy-binding "gs://[INBOX_BUCKET]" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.objectAdmin"

gcloud storage buckets add-iam-policy-binding "gs://[PROCESSED_BUCKET]" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.objectAdmin"
```

### Paso 4: Despliegue Automatizado con Script
```bash
./deploy/deploy_gcp.sh \
  "[PROJECT_ID]" \
  "[REGION]" \
  "[BQ_DATASET]" \
  "[INBOX_BUCKET]" \
  "[PROCESSED_BUCKET]" \
  "sa-applineaje-backend"
```

---

## 3. Proceso Manual de Compilación y Despliegue Paso a Paso

### A. Despliegue del Frontend React (`applineaje-frontend`)
1. **Compilación y Empaquetado con Google Cloud Build:**
   ```bash
   gcloud builds submit frontend --tag gcr.io/crp-poc-it-hackathon-13/applineaje-frontend:latest
   ```
2. **Despliegue en Cloud Run:**
   ```bash
   gcloud run deploy applineaje-frontend \
     --image gcr.io/crp-poc-it-hackathon-13/applineaje-frontend:latest \
     --region us-central1 \
     --allow-unauthenticated
   ```
   - **URL de Producción:** [https://applineaje-frontend-138247328035.us-central1.run.app](https://applineaje-frontend-138247328035.us-central1.run.app)

### B. Despliegue del Backend FastAPI (`applineaje-backend`)
1. **Compilación y Empaquetado con Google Cloud Build:**
   ```bash
   gcloud builds submit backend --tag gcr.io/crp-poc-it-hackathon-13/applineaje-backend:latest
   ```
2. **Despliegue en Cloud Run:**
   ```bash
   gcloud run deploy applineaje-backend \
     --image gcr.io/crp-poc-it-hackathon-13/applineaje-backend:latest \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars GCP_PROJECT_ID=crp-poc-it-hackathon-13,BQ_DATASET=applineajedatos,USE_MOCK_GCP=false
   ```

---

## 3. Verificación Post-Despliegue (Smoke Testing)

1. **Health Check del Backend:**
   ```bash
   curl -s https://applineaje-frontend-138247328035.us-central1.run.app/api/health
   ```
   - Debe responder: `{"status":"healthy","gcp_project":"crp-poc-it-hackathon-13","mode":"GCP_CONNECTED"}`.
2. **Consulta del Grafo de Linaje:**
   ```bash
   curl -s "https://applineaje-frontend-138247328035.us-central1.run.app/api/lineage/graph?min_confidence=0" | jq '{nodes: .total_nodes, edges: .total_edges}'
   ```
3. **Inspección Visual en Navegador:**
   - Navegar con el subagente `/browser` para confirmar 0 errores en consola de JavaScript y renderizado limpio de la cuadrícula.

---

## 4. Procedimiento de Rollback Inmediato

Si una nueva versión presenta incidencias críticas en producción, se puede revertir el tráfico a la revisión estable previa en segundos sin reconstruir la imagen:

```bash
# 1. Listar revisiones recientes
gcloud run revisions list --service applineaje-frontend --region us-central1

# 2. Enrutar el 100% del tráfico a la revisión previa estable
gcloud run services update-traffic applineaje-frontend \
  --to-revisions applineaje-frontend-00012-q8m=100 \
  --region us-central1
```

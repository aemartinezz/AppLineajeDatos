# Manual Operativo de Despliegue, Infraestructura y Mantenimiento en GCP

Este documento describe los **procedimientos estandarizados para el aprovisionamiento de infraestructura de Día 0, asignación de permisos IAM bajo menor privilegio, compilación de imágenes Docker, despliegue en Google Cloud Run, smoke testing y rollback** de la plataforma GrafoLogsApps.

---

## 1. Parámetros de Entorno y Configuración Base

| Variable | Valor por Defecto | Nivel | Descripción |
|----------|:-----------------:|:-----:|-------------|
| `GCP_PROJECT_ID` | `crp-poc-it-hackathon-13` | Contenedor | Identificador del proyecto de Google Cloud. |
| `GCP_REGION` | `us-central1` | Contenedor | Región para Cloud Run, Cloud Build y Artifact Registry. |
| `BQ_DATASET` | `applineajedatos` | Contenedor / BigQuery | Dataset maestro para las 7 tablas de la aplicación. |
| `GCS_INBOX_BUCKET` | `datosdeentrada` | Contenedor / Storage | Bucket de ingesta automática para archivos pendientes. |
| `GCS_PROCESSED_BUCKET`| `datosprocesadosapp` | Contenedor / Storage | Bucket histórico de archivos analizados. |
| `GCS_QUARANTINE_BUCKET`| `datosquarentena` | Contenedor / Storage | Bucket para archivos corruptos o no procesables. |
| `GCP_SERVICE_ACCOUNT`| `sa-applineaje-backend@...`| Cloud Run | Service Account de menor privilegio adjunta al backend. |
| `USE_MOCK_GCP` | `false` (producción) | Contenedor | Si es `true`, conmuta al emulador local en memoria. |
| `PORT` | `8080` | Cloud Run | Puerto expuesto por el contenedor Uvicorn. |

---

## 2. Procedimiento de Aprovisionamiento e Instalación (Principio de Menor Privilegio)

### Paso 0: Prerrequisitos Previos (Día 0 - Infraestructura Base)

Antes de desplegar, un administrador del proyecto debe ejecutar:

1. **Vincular Cuenta de Facturación Activa (Billing):**
   ```bash
   gcloud billing projects link "$PROJECT_ID" --billing-account="XXXXXX-XXXXXX-XXXXXX"
   ```

2. **Habilitar las 6 APIs Fundamentales:**
   ```bash
   gcloud services enable \
     run.googleapis.com \
     cloudbuild.googleapis.com \
     artifactregistry.googleapis.com \
     bigquery.googleapis.com \
     storage.googleapis.com \
     aiplatform.googleapis.com \
     logging.googleapis.com \
     --project="$PROJECT_ID"
   ```

3. **Pre-crear Recursos de Almacenamiento (Evita otorgar roles Admin al operador):**
   ```bash
   # Crear Dataset Maestro en BigQuery
   bq --location="$GCP_REGION" mk -d \
     --description="Dataset maestro de la Plataforma de Linaje" \
     "${GCP_PROJECT_ID}:${BQ_DATASET}"

   # Crear Buckets en Cloud Storage con Acceso Uniforme
   gcloud storage buckets create "gs://${GCS_INBOX_BUCKET}" --project="$GCP_PROJECT_ID" --location="$GCP_REGION" --uniform-bucket-level-access
   gcloud storage buckets create "gs://${GCS_PROCESSED_BUCKET}" --project="$GCP_PROJECT_ID" --location="$GCP_REGION" --uniform-bucket-level-access
   gcloud storage buckets create "gs://${GCS_QUARANTINE_BUCKET}" --project="$GCP_PROJECT_ID" --location="$GCP_REGION" --uniform-bucket-level-access
   ```

4. **Crear Service Account Dedicada:**
   ```bash
   gcloud iam service-accounts create sa-applineaje-backend \
     --display-name="App Lineaje Backend SA" \
     --description="Service Account exclusiva para backend de linaje" \
     --project="$GCP_PROJECT_ID"
   ```

---

### Paso 1: Asignar Roles Estrictos de Menor Privilegio para la Service Account

La cuenta `sa-applineaje-backend` **NO requiere roles Owner ni Editor**:

```bash
SA_EMAIL="sa-applineaje-backend@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

# 1. Nivel Proyecto: Consultas SQL, Inferencia Gemini y Logs
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/bigquery.jobUser"

gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/logging.logWriter"

# 2. Nivel Dataset: Lectura y escritura exclusiva sobre BQ_DATASET
bq add-iam-policy-binding \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/bigquery.dataEditor" \
  "${GCP_PROJECT_ID}:${BQ_DATASET}"

# 3. Nivel Buckets: Permisos de objetos exclusivamente sobre los buckets de la app
gcloud storage buckets add-iam-policy-binding "gs://${GCS_INBOX_BUCKET}" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.objectAdmin"

gcloud storage buckets add-iam-policy-binding "gs://${GCS_PROCESSED_BUCKET}" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.objectAdmin"

gcloud storage buckets add-iam-policy-binding "gs://${GCS_QUARANTINE_BUCKET}" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.objectAdmin"
```

---

### Paso 2: Permisos Quirúrgicos para el Operador DevOps que Despliega

El ingeniero o pipeline CI/CD que ejecuta el despliegue requiere únicamente:

```bash
OPERADOR_EMAIL="user:tu-correo@liverpool.com.mx"

# 1. Despliegue en Cloud Run
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="$OPERADOR_EMAIL" \
  --role="roles/run.admin"

# 2. Compilación de contenedores
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="$OPERADOR_EMAIL" \
  --role="roles/cloudbuild.builds.editor"

# 3. Subir imágenes a Container / Artifact Registry
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="$OPERADOR_EMAIL" \
  --role="roles/artifactregistry.writer"

# 4. Adjuntar la Service Account dedicada (actAs) acotado únicamente a sa-applineaje-backend
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --member="$OPERADOR_EMAIL" \
  --role="roles/iam.serviceAccountUser"
```

---

### Paso 3: Inicialización Automática de Tablas DDL en BigQuery

Ejecute la inicialización de las 7 tablas maestras:

```bash
USE_MOCK_GCP=false PYTHONPATH=backend python3 -c "
from app.services.init_db import init_bigquery_tables
res = init_bigquery_tables(project_id='$GCP_PROJECT_ID', dataset_id='$BQ_DATASET')
print('Resultado inicialización:', res)
"
```

---

### Paso 4: Despliegue en Google Cloud Run

#### Opción A: Despliegue Automatizado con Script
```bash
./deploy/deploy_gcp.sh \
  "$GCP_PROJECT_ID" \
  "$GCP_REGION" \
  "$BQ_DATASET" \
  "$GCS_INBOX_BUCKET" \
  "$GCS_PROCESSED_BUCKET" \
  "sa-applineaje-backend"
```

#### Opción B: Despliegue Manual Paso a Paso

**1. Desplegar Backend FastAPI:**
```bash
# Compilar imagen con Cloud Build
gcloud builds submit backend --tag "gcr.io/${GCP_PROJECT_ID}/applineaje-backend:latest" --project="$GCP_PROJECT_ID"

# Desplegar en Cloud Run con la SA dedicada
gcloud run deploy applineaje-backend \
  --image="gcr.io/${GCP_PROJECT_ID}/applineaje-backend:latest" \
  --region="$GCP_REGION" \
  --project="$GCP_PROJECT_ID" \
  --platform=managed \
  --allow-unauthenticated \
  --service-account="$SA_EMAIL" \
  --set-env-vars="GCP_PROJECT_ID=$GCP_PROJECT_ID,BQ_DATASET=$BQ_DATASET,GCS_INBOX_BUCKET=$GCS_INBOX_BUCKET,GCS_PROCESSED_BUCKET=$GCS_PROCESSED_BUCKET,GCS_QUARANTINE_BUCKET=$GCS_QUARANTINE_BUCKET,GCP_SERVICE_ACCOUNT=$SA_EMAIL,USE_MOCK_GCP=false"

BACKEND_URL=$(gcloud run services describe applineaje-backend --region="$GCP_REGION" --project="$GCP_PROJECT_ID" --format='value(status.url)')
echo "Backend activo en: $BACKEND_URL"
```

**2. Configurar y Desplegar Frontend React con Nginx:**
```bash
BACKEND_HOST=$(echo "$BACKEND_URL" | sed -e 's|^[^/]*//||' -e 's|/.*$||')

# Configurar el reverse proxy en nginx.conf
sed -i.bak "s|proxy_pass https://[^;]*;|proxy_pass https://$BACKEND_HOST;|g" frontend/nginx.conf
sed -i.bak "s|proxy_set_header Host [^;]*;|proxy_set_header Host $BACKEND_HOST;|g" frontend/nginx.conf
rm -f frontend/nginx.conf.bak

# Compilar imagen frontend con Cloud Build
gcloud builds submit frontend --tag "gcr.io/${GCP_PROJECT_ID}/applineaje-frontend:latest" --project="$GCP_PROJECT_ID"

# Desplegar en Cloud Run
gcloud run deploy applineaje-frontend \
  --image="gcr.io/${GCP_PROJECT_ID}/applineaje-frontend:latest" \
  --region="$GCP_REGION" \
  --project="$GCP_PROJECT_ID" \
  --platform=managed \
  --allow-unauthenticated

FRONTEND_URL=$(gcloud run services describe applineaje-frontend --region="$GCP_REGION" --project="$GCP_PROJECT_ID" --format='value(status.url)')
echo "Frontend activo en: $FRONTEND_URL"
```

---

## 3. Verificación Post-Despliegue (Smoke Testing)

Validar empíricamente que la solución está en estado operativo:

```bash
# 1. Health Check del backend a través del frontend proxy
curl -s "${FRONTEND_URL}/api/health"
# Salida esperada: {"status":"healthy","gcp_project":"...","mode":"GCP_CONNECTED"}

# 2. Validación de conectividad y conteo de tablas en BigQuery
curl -s -X POST "${FRONTEND_URL}/api/gcp/validate-dataset" \
  -H "Content-Type: application/json" \
  -d "{\"dataset_name\": \"$BQ_DATASET\"}"
# Salida esperada: {"is_valid": true, "tables_count": 7}

# 3. Consulta de nodos y aristas persistidos
curl -s "${FRONTEND_URL}/api/lineage/graph?min_confidence=0" | jq '{total_nodes, total_edges}'
```

---

## 4. Procedimiento de Rollback Inmediato

Si una nueva versión en producción presenta inconsistencias, se puede desviar el tráfico a la revisión previa estable en segundos sin compilar:

```bash
# 1. Listar revisiones recientes
gcloud run revisions list --service applineaje-frontend --region "$GCP_REGION" --project "$GCP_PROJECT_ID"

# 2. Asignar el 100% del tráfico a la revisión previa estable
gcloud run services update-traffic applineaje-frontend \
  --to-revisions="applineaje-frontend-00016-rq9=100" \
  --region="$GCP_REGION" \
  --project="$GCP_PROJECT_ID"
```

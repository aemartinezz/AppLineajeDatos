#!/bin/bash
# ==============================================================================
# SCRIPT DE DESPLIEGUE MULTI-PROYECTO EN GOOGLE CLOUD PLATFORM (GCP)
# Plataforma de Linaje End-to-End & Observabilidad Multi-Herramienta
# ==============================================================================
# Uso:
#   ./deploy/deploy_gcp.sh [PROJECT_ID] [REGION] [BQ_DATASET] [INBOX_BUCKET] [PROCESSED_BUCKET]
# Ejemplo:
#   ./deploy/deploy_gcp.sh crp-poc-it-hackathon-13 us-central1 applineajedatos datosdeentrada datosprocesadosapp
# ==============================================================================

set -e

PROJECT_ID="${1:-${GCP_PROJECT_ID:-crp-poc-it-hackathon-13}}"
REGION="${2:-${GCP_REGION:-us-central1}}"
BQ_DATASET="${3:-${BQ_DATASET:-applineajedatos}}"
INBOX_BUCKET="${4:-${GCS_INBOX_BUCKET:-datosdeentrada}}"
PROCESSED_BUCKET="${5:-${GCS_PROCESSED_BUCKET:-datosprocesadosapp}}"
QUARANTINE_BUCKET="${GCS_QUARANTINE_BUCKET:-datosquarentena}"

BACKEND_SERVICE="applineaje-backend"
FRONTEND_SERVICE="applineaje-frontend"

echo "================================================================="
echo "  DESPLIEGUE AUTOMATIZADO MULTI-PROYECTO EN GOOGLE CLOUD (GCP)   "
echo "  Proyecto Objetivo:  $PROJECT_ID                                "
echo "  Región Cloud Run:   $REGION                                    "
echo "  Dataset BigQuery:   $BQ_DATASET                                "
echo "  Bucket Inbox:       gs://$INBOX_BUCKET                         "
echo "  Bucket Procesados:  gs://$PROCESSED_BUCKET                     "
echo "================================================================="

# -------------------------------------------------------------
# 1. Configuración de proyecto activo en gcloud
# -------------------------------------------------------------
echo ""
echo "[1/7] Configurando proyecto activo en gcloud..."
gcloud config set project "$PROJECT_ID"

# -------------------------------------------------------------
# 2. Habilitación de APIs necesarias en GCP
# -------------------------------------------------------------
echo ""
echo "[2/7] Verificando y habilitando APIs requeridas de GCP..."
REQUIRED_APIS=(
    "run.googleapis.com"
    "cloudbuild.googleapis.com"
    "artifactregistry.googleapis.com"
    "bigquery.googleapis.com"
    "storage.googleapis.com"
    "aiplatform.googleapis.com"
    "logging.googleapis.com"
    "pubsub.googleapis.com"
)

for api in "${REQUIRED_APIS[@]}"; do
    echo "  -> Habilitando $api..."
    gcloud services enable "$api" --project="$PROJECT_ID" || true
done
echo "  -> Todas las APIs esenciales de GCP verificadas [OK]"

# -------------------------------------------------------------
# 3. Validación y creación de Dataset en BigQuery
# -------------------------------------------------------------
echo ""
echo "[3/7] Validando Dataset de BigQuery: $BQ_DATASET..."
if bq show --dataset "$PROJECT_ID:$BQ_DATASET" >/dev/null 2>&1; then
    echo "  -> Dataset $BQ_DATASET ya existe [OK]"
else
    echo "  -> Dataset $BQ_DATASET no existe. Creando en BigQuery..."
    bq mk --dataset --location="$REGION" --description="Metadatos de linaje y persistencia unificada" "$PROJECT_ID:$BQ_DATASET"
    echo "  -> Dataset $BQ_DATASET creado exitosamente."
fi

# -------------------------------------------------------------
# 4. Validación y creación de Buckets de Cloud Storage
# -------------------------------------------------------------
echo ""
echo "[4/7] Validando Buckets de Cloud Storage..."
for BUCKET in "$INBOX_BUCKET" "$PROCESSED_BUCKET" "$QUARANTINE_BUCKET"; do
    if gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1; then
        echo "  -> Bucket gs://$BUCKET ya existe [OK]"
    else
        echo "  -> Creando bucket gs://$BUCKET en $REGION..."
        gcloud storage buckets create "gs://$BUCKET" --location="$REGION" --uniform-bucket-level-access || true
        echo "  -> Bucket gs://$BUCKET listo."
    fi
done

# -------------------------------------------------------------
# 5. Creación física de Tablas DDL en BigQuery
# -------------------------------------------------------------
echo ""
echo "[5/7] Inicializando esquemas DDL en BigQuery (lineage_nodes, lineage_edges, execution_status_daily, app_configurations, app_users_roles, app_model_usage_logs, app_errors_log)..."
python3 -c "
import os, sys
sys.path.append('backend')
from app.services.init_db import init_bigquery_tables
res = init_bigquery_tables(project_id='$PROJECT_ID', dataset_id='$BQ_DATASET')
print('Tablas aseguradas en BigQuery:', res.get('tables_created', []))
" || echo "  -> Advertencia: Asegure credenciales activas de BigQuery."

# -------------------------------------------------------------
# 6. Despliegue de Backend en Cloud Run
# -------------------------------------------------------------
echo ""
echo "[6/7] Desplegando Backend FastAPI en Cloud Run ($BACKEND_SERVICE)..."
gcloud run deploy "$BACKEND_SERVICE" \
    --source=./backend \
    --region="$REGION" \
    --platform=managed \
    --allow-unauthenticated \
    --set-env-vars="GCP_PROJECT_ID=$PROJECT_ID,BQ_DATASET=$BQ_DATASET,GCS_INBOX_BUCKET=$INBOX_BUCKET,GCS_PROCESSED_BUCKET=$PROCESSED_BUCKET,GCS_QUARANTINE_BUCKET=$QUARANTINE_BUCKET,USE_MOCK_GCP=false"

BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" --region="$REGION" --format='value(status.url)')
echo "  -> Backend desplegado exitosamente en: $BACKEND_URL"

# -------------------------------------------------------------
# 7. Despliegue de Frontend en Cloud Run con Reverse Proxy Nginx
# -------------------------------------------------------------
echo ""
echo "[7/7] Desplegando Frontend React en Cloud Run ($FRONTEND_SERVICE)..."
BACKEND_HOST=$(echo "$BACKEND_URL" | sed -e 's|^[^/]*//||' -e 's|/.*$||')

# Actualizar configuración de proxy en nginx.conf
sed -i.bak "s|proxy_pass https://[^;]*;|proxy_pass https://$BACKEND_HOST;|g" frontend/nginx.conf
sed -i.bak "s|proxy_set_header Host [^;]*;|proxy_set_header Host $BACKEND_HOST;|g" frontend/nginx.conf
rm -f frontend/nginx.conf.bak

gcloud run deploy "$FRONTEND_SERVICE" \
    --source=./frontend \
    --region="$REGION" \
    --platform=managed \
    --allow-unauthenticated

FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SERVICE" --region="$REGION" --format='value(status.url)')

echo ""
echo "================================================================="
echo "  DESPLIEGUE FINALIZADO EXITOSAMENTE                             "
echo "  -------------------------------------------------------------  "
echo "  Frontend SPA:    $FRONTEND_URL                                 "
echo "  Backend API:     $BACKEND_URL                                  "
echo "  BigQuery:        $PROJECT_ID.$BQ_DATASET                       "
echo "  Storage Inbox:   gs://$INBOX_BUCKET                            "
echo "  Storage Archivo: gs://$PROCESSED_BUCKET                        "
echo "================================================================="

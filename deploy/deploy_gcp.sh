#!/bin/bash
set -e

PROJECT_ID="crp-poc-it-hackathon-13"
REGION="us-central1"
BQ_DATASET="applineajedatos"
INBOX_BUCKET="datosdeentrada"
PROCESSED_BUCKET="datosprocesadosapp"
QUARANTINE_BUCKET="datosquarentena"

echo "================================================================="
echo "  DESPLIEGUE AUTOMATIZADO E IDEMPOTENTE EN GOOGLE CLOUD (GCP)    "
echo "  Proyecto Objetivo: $PROJECT_ID                                 "
echo "  Región: $REGION                                                "
echo "================================================================="

# 1. Configurar proyecto actual
echo "[1/6] Configurando proyecto en gcloud CLI..."
gcloud config set project "$PROJECT_ID"

# 2. Validar o crear Dataset en BigQuery
echo "[2/6] Validando Dataset de BigQuery: $BQ_DATASET..."
if bq show --dataset "$PROJECT_ID:$BQ_DATASET" >/dev/null 2>&1; then
    echo "  -> Dataset $BQ_DATASET ya existe [OK]"
else
    echo "  -> Dataset $BQ_DATASET no encontrado. Creando dataset en BigQuery..."
    bq mk --dataset --location="$REGION" --description="Metadatos de linaje y catálogo del grafo" "$PROJECT_ID:$BQ_DATASET"
    echo "  -> Dataset $BQ_DATASET creado con éxito."
fi

# 3. Validar o crear Buckets de Cloud Storage
echo "[3/6] Validando Buckets de Cloud Storage..."
for BUCKET in "$INBOX_BUCKET" "$PROCESSED_BUCKET" "$QUARANTINE_BUCKET"; do
    if gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1; then
        echo "  -> Bucket gs://$BUCKET ya existe [OK]"
    else
        echo "  -> Creando bucket gs://$BUCKET..."
        gcloud storage buckets create "gs://$BUCKET" --location="$REGION" --uniform-bucket-level-access
        echo "  -> Bucket gs://$BUCKET creado."
    fi
done

# 4. Validar Secret Manager (Clave de API Gemini)
echo "[4/6] Verificando secretos en Secret Manager..."
if gcloud secrets describe "GEMINI_API_KEY" >/dev/null 2>&1; then
    echo "  -> Secreto GEMINI_API_KEY detectado en Secret Manager [OK]"
else
    echo "  -> [AVISO DE SEGURIDAD] No se encontró el secreto 'GEMINI_API_KEY'."
    echo "     Para habilitar llamadas reales a Vertex AI/Gemini, ejecuta:"
    echo "     gcloud secrets create GEMINI_API_KEY --replication-policy='automatic'"
    echo "     echo -n 'TU_API_KEY' | gcloud secrets versions add GEMINI_API_KEY --data-file=-"
fi

# 5. Desplegar Backend en Cloud Run
echo "[5/6] Desplegando Backend Cloud Run (FastAPI)..."
gcloud run deploy backend-lineage \
    --source=./backend \
    --region="$REGION" \
    --platform=managed \
    --allow-unauthenticated \
    --set-env-vars="GCP_PROJECT_ID=$PROJECT_ID,BQ_DATASET=$BQ_DATASET,GCS_INBOX_BUCKET=$INBOX_BUCKET,GCS_PROCESSED_BUCKET=$PROCESSED_BUCKET,GCS_QUARANTINE_BUCKET=$QUARANTINE_BUCKET,USE_MOCK_GCP=false"

BACKEND_URL=$(gcloud run services describe backend-lineage --region="$REGION" --format='value(status.url)')
echo "  -> Backend desplegado exitosamente en: $BACKEND_URL"

# 6. Desplegar Frontend en Cloud Run
echo "[6/6] Desplegando Frontend Cloud Run (React)..."
gcloud run deploy frontend-lineage \
    --source=./frontend \
    --region="$REGION" \
    --platform=managed \
    --allow-unauthenticated

FRONTEND_URL=$(gcloud run services describe frontend-lineage --region="$REGION" --format='value(status.url)')
echo "================================================================="
echo "  DESPLIEGUE FINALIZADO CON ÉXITO                                "
echo "  URL del Frontend: $FRONTEND_URL                                "
echo "  URL del Backend API: $BACKEND_URL                              "
echo "================================================================="

# Manual Operativo de Despliegue y Mantenimiento en Google Cloud Platform

Este documento describe los **procedimientos operativos para la compilación, despliegue, configuración de variables de entorno y rollback** de la plataforma GrafoLogsApps en Google Cloud Platform (GCP).

---

## 1. Parámetros de Entorno y Configuración

### Backend (`backend/app/config.py`)
| Variable | Valor por Defecto | Descripción |
|----------|:-----------------:|-------------|
| `GCP_PROJECT_ID` | `crp-poc-it-hackathon-13` | Identificador del proyecto de GCP. |
| `GCP_REGION` | `us-central1` | Región para servicios Cloud Run y Cloud Build. |
| `BQ_DATASET` | `applineajedatos` | Dataset maestro de BigQuery. |
| `GCS_INBOX_BUCKET` | `crp-poc-it-hackathon-13_inbox` | Bucket de entrada para ingesta automática de archivos. |
| `GCS_PROCESSED_BUCKET` | `crp-poc-it-hackathon-13_processed` | Bucket histórico para archivos ya analizados. |
| `USE_MOCK_GCP` | `false` (en prod) / `true` (en local) | Si es `true`, simula BigQuery y GCS localmente. |
| `PORT` | `8080` | Puerto HTTP para Uvicorn en Cloud Run. |

---

## 2. Proceso de Despliegue Paso a Paso

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

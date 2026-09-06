# Plataforma de Linaje End-to-End & Observabilidad en GCP

Plataforma empresarial en Google Cloud Platform (GCP) diseñada para descubrir, correlacionar y visualizar el linaje de datos de extremo a extremo a través de múltiples herramientas heterogéneas on-premise y nube (**Control-M, Shell Scripts, DataStage, Cloud Composer, BigQuery**).

---

## 1. Características Principales

* **Detector Agnóstico de Herramientas:** Reconoce dinámicamente cualquier tecnología por extensión, firmas de contenido o inferencia semántica con IA.
* **Metadata Profunda de BigQuery:** Integra automáticamente el catálogo y linaje de `INFORMATION_SCHEMA.TABLES`, `VIEWS`, `ROUTINES` y `JOBS_BY_PROJECT`.
* **Pipeline en Cascada de 4 Niveles (Optimización de Costes):**
  * **Nivel 1:** Parsers deterministas y AST (`sqlglot`, Python AST, XML).
  * **Nivel 2:** Filtro de relevancia y limpieza del 95% de ruido en logs.
  * **Nivel 3:** Modelo ligero (Gemini 1.5 Flash) con extracción JSON estructurada.
  * **Nivel 4:** Escalado automático a Gemini 1.5 Pro solo para casos complejos.
* **Modelo de Certeza (% Confidence):** Aristas continuas para relaciones 100% certeras y discontinuas con etiqueta de % para inferencias. Slider de filtro en UI.
* **Telemetría en Vivo:** Semáforos en tiempo real mediante WebSockets sin recargar la página (🟢 Éxito, 🔵 Ejecutando, 🔴 Fallo, ⚪ Pendiente).
* **Ciclo de Vida en Cloud Storage:** Ingesta en `gs://lineage-inbox/`, traslado automático tras procesar a `gs://lineage-processed/YYYY/MM/DD/`, o cuarentena ante fallos.
* **Módulo de Configuración Dinámico:** Parametrización en caliente de modelos de IA, temperaturas, umbrales de escalado y buckets con persistencia en BigQuery.

---

## 2. Ejecución Local y Pruebas

### Pruebas Automatizadas
Las pruebas se encuentran en `scriptsPrueba/` y guardan los reportes en `resultadosPrueba/` (ignorado por git):
```bash
./venv/bin/python3 scriptsPrueba/run_all_tests.py
```

### Ejecutar Localmente la Aplicación Completa
Para levantar tanto el Backend (FastAPI en puerto 8000) como el Frontend (React en puerto 3000):
```bash
./run_local.sh
```
Abre en tu navegador: **http://localhost:3000**

---

## 3. Despliegue Automatizado en GCP (Proyecto: crp-poc-it-hackathon-13)

El script `deploy/deploy_gcp.sh` es totalmente **idempotente**: valida si los recursos existen y crea únicamente lo faltante:
```bash
./deploy/deploy_gcp.sh
```
El script verifica:
1. Dataset de BigQuery `lineage_metadata`.
2. Buckets de Cloud Storage: `lineage-inbox-...`, `lineage-processed-...`, `lineage-quarantine-...`.
3. Secreto de Secret Manager para `GEMINI_API_KEY` (guía al usuario si falta).
4. Despliegue de los dos servicios en **Cloud Run**:
   * `backend-lineage` (Python FastAPI)
   * `frontend-lineage` (React + Nginx)

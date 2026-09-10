# Arquitectura Técnica Integral: Plataforma de Linaje de Datos GrafoLogsApps

Este documento detalla la **arquitectura técnica global, el modelo C4 de contenedores, los flujos de datos asíncronos y deterministas, la topología en Google Cloud Platform (GCP) y el catálogo funcional de módulos** de la solución.

---

## 1. Visión General de la Solución

GrafoLogsApps es una plataforma empresarial diseñada para reconstruir, visualizar y auditar de forma autónoma el linaje de datos de extremo a extremo a través de múltiples herramientas heterogéneas:
- **Orquestación:** Control-M (XML/CLI), Apache Airflow / Cloud Composer (Python DAGs).
- **Extracción y Procesamiento:** Scripts de Shell (Bash), IBM InfoSphere DataStage (DSX).
- **Almacenamiento y Analítica:** Google BigQuery (tablas maestras de la app, vistas estándar, vistas materializadas y datasets externos).
- **Inteligencia Artificial:** Vertex AI Gemini 1.5 Flash y Pro con fallback transparente a motor heurístico.

---

## 2. Diagrama de Arquitectura de Infraestructura en Google Cloud Platform

```mermaid
flowchart TD
    subgraph Cliente["Cliente Web Corporativo (Liverpool)"]
        Browser["Navegador Web (Chrome / Edge / Safari)"]
    end

    subgraph GCP["Google Cloud Platform (crp-poc-it-hackathon-13)"]
        subgraph CloudRun["Cloud Run (Serverless)"]
            Frontend["applineaje-frontend\n(Nginx Alpine + React 18 + Cytoscape.js)\nReverse Proxy /api ➔ Backend"]
            Backend["applineaje-backend\n(FastAPI + Python 3.11 + Uvicorn)\nService Account: sa-applineaje-backend"]
        end

        subgraph Storage["Google Cloud Storage (GCS)"]
            InboxBucket[("Bucket: datosdeentrada\n(GCS_INBOX_BUCKET)")]
            ProcessedBucket[("Bucket: datosprocesadosapp\n(GCS_PROCESSED_BUCKET)")]
            QuarantineBucket[("Bucket: datosquarentena\n(GCS_QUARANTINE_BUCKET)")]
        end

        subgraph BigQueryStore["Google BigQuery (Dataset: BQ_DATASET / applineajedatos)"]
            NodesTable[("lineage_nodes (Catálogo)")]
            EdgesTable[("lineage_edges (Relaciones)")]
            TelemetryTable[("execution_status_daily (Particionado)")]
            ConfigTable[("app_configurations (Persistencia)")]
            UsersTable[("app_users_roles (RBAC Liverpool)")]
            CostsTable[("app_model_usage_logs (Auditoría)")]
            ErrorsTable[("app_errors_log (Telemetría Enriquecida)")]
        end

        subgraph ExternalBQ["Datasets de Negocio Monitoreados"]
            ExtTables[("Tablas Corporativas\n(ej. pruebasLineaje.ejemplotabla1)")]
            ExtViews[("Vistas SQL\n(ej. pruebasLineaje.vista_ejemplotabla_uno)")]
        end

        subgraph AI["Vertex AI (Modelos Fundacionales)"]
            GeminiFlash["Gemini 1.5 Flash / Pro\n(roles/aiplatform.user)"]
        end
    end

    Browser -->|HTTPS :443| Frontend
    Browser -->|WSS /ws/telemetry| Frontend
    Frontend -->|Reverse Proxy /api & /ws| Backend
    Backend -->|Escaneo Asíncrono de Fondo| InboxBucket
    Backend -->|Traslado tras procesar| ProcessedBucket
    Backend -->|Inferencia Semántica REST| GeminiFlash
    Backend -->|Persistencia DDL/DML SQL| BigQueryStore
    Backend -->|Introspección INFORMATION_SCHEMA| ExternalBQ
```

---

## 3. Pipeline de Inferencia en Cascada de 4 Niveles

Para garantizar máxima precisión matemática y optimizar al 100% los costos operativos de inteligencia artificial, el procesamiento de archivos se ejecuta mediante un motor en cascada de 4 capas:

```mermaid
flowchart TD
    Archivo["Archivo de Entrada\n(.sh, .sql, .py, .dsx, .xml, .log)"] --> Detector["Detector Agnóstico de Herramientas\n(tool_detector.py)"]
    
    Detector --> Nivel1{"¿Parser Determinista Disponible?\n(SQLGlot, Regex Control-M, DataStage)"}
    Nivel1 -- Sí --> R1["Nivel 1: Parser Sintáctico\nCerteza: 1.0 (100%)\nLatencia: < 5 ms\nCosto: $0.00 USD"]
    
    Nivel1 -- No --> Nivel2{"¿Script Dinámico o DAG Complejo?"}
    Nivel2 -- Sí --> R2["Nivel 2: Inferencia con Gemini en Vertex AI\nCerteza: 0.90 - 0.95\nLatencia: ~600 ms\n(Fallback automático si falla la API)"]
    
    Nivel2 -- No --> Nivel3{"¿Coincidencias Heurísticas?"}
    Nivel3 -- Sí --> R3["Nivel 3: Motor Heurístico / Regex Avanzado\nCerteza: 0.70 - 0.85\nLatencia: < 10 ms"]
    
    Nivel3 -- No --> R4["Nivel 4: Clasificador Genérico\nCerteza: 0.50\nClasificación como Contenedor de Datos"]

    R1 --> Fusion["Motor de Fusión y Linaje\n(lineage_linker.py)"]
    R2 --> Fusion
    R3 --> Fusion
    R4 --> Fusion

    Fusion --> BigQuery[("Persistencia Atómica en BigQuery\nlineage_nodes + lineage_edges")]
```

---

## 4. Flujo Asíncrono de Ingesta y Notificación en Tiempo Real

```mermaid
sequenceDiagram
    autonumber
    actor Operador as Proceso ETL / Operador
    participant GCS as Bucket GCS (Inbox)
    participant Watcher as GCS Inbox Watcher (FastAPI Lifespan)
    participant Detector as Detector Agnóstico
    participant Cascada as Pipeline en Cascada
    participant BQ as BigQuery (lineage_nodes / edges)
    participant WS as WebSocket Manager (/ws/telemetry)
    participant UI as Frontend React (Cytoscape)

    Operador->>GCS: Deposita archivo en gs://datosdeentrada
    loop Polling cada N segundos
        Watcher->>GCS: Lista archivos pendientes
    end
    Watcher->>Detector: Envía contenido para tipificación
    Detector->>Cascada: Enruta al nivel correspondiente
    Cascada->>GCS: Mueve archivo a gs://datosprocesadosapp
    Cascada->>BQ: Inserta/Actualiza nodos y aristas
    Cascada->>WS: Emite evento broadcast NEW_FILE_PROCESSED
    WS->>UI: Transmite payload vía WebSocket
    UI->>UI: Aplica layout adaptativo layoutProximityDashboard sin parpadeo
```

---

## 5. Arquitectura de Código del Repositorio

### A. Frontend (`frontend/src/`)
- **`App.tsx`:** Contenedor de la aplicación, barra de navegación corporativa Liverpool y gestión de sesión activa.
- **`components/LineageGraphView.tsx`:** Visualizador de linaje con Cytoscape.js, algoritmo `layoutProximityDashboard`, cajas responsivas y buscador bidireccional.
- **`components/LiveStatusView.tsx`:** Semáforos de telemetría en vivo sincronizados por WebSockets.
- **`components/ArchitectureView.tsx`:** Introspección del propio código con filtrado por capas y módulos.
- **`components/FileDropzoneView.tsx`:** Carga manual y consulta histórica de archivos.
- **`components/UserRolesView.tsx`:** Gestión RBAC de usuarios corporativos `@liverpool.com.mx`.
- **`components/ConfigView.tsx`:** Panel dinámico de configuración en BigQuery y Guía Maestra IAM desplegable.
- **`components/CostsView.tsx`:** Auditoría de costos de IA y control presupuestario mensual.
- **`components/ErrorsView.tsx`:** Consola de incidencias enriquecidas ("carnita") y ciclo de vida de resolución.

### B. Backend (`backend/app/`)
- **`main.py`:** Endpoints REST, WebSockets y background worker asíncrono de GCS.
- **`config.py`:** Pydantic Settings parametrizadas para proyectos GCP, datasets y buckets.
- **`security.py`:** Control de acceso RBAC, dominios Liverpool e inmunidad de `ADMIN_ROOT`.
- **`models/schemas.py`:** Esquemas de datos Pydantic v2 (LineageNode, LineageEdge, User, etc.).
- **`services/bigquery_service.py`:** Acceso a BigQuery con modo dual (`USE_MOCK_GCP`).
- **`services/storage_service.py`:** Abstracción de GCS con mitigación estricta de Path Traversal.
- **`services/init_db.py`:** Aseguramiento idempotente de las 7 tablas maestras en BigQuery.
- **`engine/tool_detector.py`:** Clasificador agnóstico de herramientas.
- **`engine/cascade_pipeline.py`:** Pipeline en cascada de 4 capas y conector Vertex AI.
- **`engine/lineage_linker.py`:** Algoritmo de unión de dependencias cross-tool.
- **`engine/bigquery_metadata.py`:** Recolector de vistas (`INFORMATION_SCHEMA.VIEWS`) con AST SQLGlot.
- **`engine/code_architecture.py`:** Auto-introspección dinámica del código fuente.

---

## 6. Catálogo de los 8 Módulos Web de la Plataforma

| Módulo | Componente React | Roles Autorizados | Funcionalidad Principal |
|--------|------------------|:-----------------:|-------------------------|
| **1. Grafo Linaje** | `LineageGraphView.tsx` | Todos (incluye `Viewer`) | Visualización interactiva con algoritmo de proximidad, filtros de tecnología, buscador con aislamiento bidireccional upstream/downstream y slider de certeza (0% a 100%). |
| **2. Estatus en Vivo** | `LiveStatusView.tsx` | Todos | Monitoreo en tiempo real de la ejecución diaria mediante semáforos (🟢 Éxito, 🔵 Ejecutando, 🔴 Fallo, ⚪ Pendiente) por WebSocket. |
| **3. Arquitectura Viva** | `ArchitectureView.tsx` | `Developer`, `Admin` | Grafo de auto-introspección del código del sistema. Filtra por capa (Frontend/Backend) y módulo web. |
| **4. Bandeja Archivos** | `FileDropzoneView.tsx` | `Data Engineer`, `Admin` | Visor de archivos procesados en GCS y subida manual de scripts para análisis puntual. |
| **5. Usuarios y Roles** | `UserRolesView.tsx` | `Admin` | CRUD administrativo de colaboradores `@liverpool.com.mx` con roles RBAC y blindaje de la cuenta raíz `ADMIN_ROOT`. |
| **6. Configuración** | `ConfigView.tsx` | `Admin` | Gestión dinámica de parámetros en BigQuery: modelos de IA, buckets GCS, validación de datasets y Guía Maestra IAM. |
| **7. Control Costos IA** | `CostsView.tsx` | `Admin`, `Developer` | Auditoría de consumo de tokens y costes en dólares por modelo. Presupuesto mensual configurable en USD con alertas tempranas. |
| **8. Gestión Errores** | `ErrorsView.tsx` | `Admin`, `Developer` | Consola centralizada de incidencias con telemetría enriquecida ("carnita"): stack trace completo, severidad, URL, componente origen y auto-reapertura. |

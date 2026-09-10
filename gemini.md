# Guía Maestra y Punto de Entrada Universal para Agentes Gemini (Root Entrypoint)

> [!IMPORTANT]
> **ATENCIÓN AGENTE DE INTELIGENCIA ARTIFICIAL (GEMINI / ANTIGRAVITY):**
> Si estás iniciando una sesión en este repositorio desde **cualquier editor, entorno de desarrollo o interfaz**, **ESTE ES TU PUNTO DE ENTRADA OBLIGATORIO**.
> Antes de proponer cambios, analizar código o generar modificaciones, **DEBES** leer y comprender este documento y el sistema de gobernanza y arquitectura alojado en [`workflows/`](workflows/).
> Conoce este proyecto como la palma de tu mano antes de tocar una sola línea de código.

---

## 1. Identidad y Mentalidad Operativa del Agente

Actúas como un **Staff Principal Engineer & Cloud Architect corporativo de El Puerto de Liverpool**. Tu trabajo se distingue por:
- **Rigor Técnico Absoluto:** No aceptas soluciones improvisadas, "parches rápidos" ni código sin tipar o sin pruebas.
- **Mentalidad Preventiva:** Antes de modificar un archivo, analizas los impactos colaterales en la persistencia de BigQuery, la visualización en Cytoscape y la seguridad de la infraestructura.
- **Transparencia y Veracidad:** Compruebas cada afirmación con comandos reales de prueba e inspección. Nunca inventas el estado de un servicio, una base de datos o un despliegue.

---

## 2. Las 5 Leyes Innegociables de Operación

1. **Idioma Estrictamente en Español:**
   Toda comunicación con el usuario, respuestas, explicaciones técnicas, mensajes de commit, documentación y comentarios en código deben realizarse **exclusivamente en español**, sin excepciones.
2. **Principio de Veracidad Empírica (Cero Alucinaciones):**
   Valida empíricamente cada afirmación ejecutando herramientas reales (`run_command` sobre scripts de prueba locales, inspección de base de datos o subagente de navegación `/browser`). Si algo falla, repórtalo con evidencia y su traza de error.
3. **Ciclo de Vida Obligatorio de 8 Fases:**
   Queda terminantemente prohibido saltarse fases:
   ```
   [1. Análisis Workflows] ➔ [2. Diagnóstico/Investigación] ➔ [3. Desarrollo Local] ➔
   [4. Test Suite 10/10 OK] ➔ [5. Commit Semántico Git] ➔ [6. Push a main] ➔
   [7. Cloud Build & Run] ➔ [8. Verificación Visual en Navegador]
   ```
4. **Principio Inquebrantable de Menor Privilegio (Least Privilege IAM):**
   Prohibido el uso de `roles/owner`, `roles/editor`, `roles/bigquery.admin`, `roles/storage.admin` o `roles/aiplatform.admin`. Todo acceso de ejecución se delega exclusivamente a la Service Account dedicada `sa-applineaje-backend` con roles quirúrgicos por recurso.
5. **Persistencia Integral y Resiliencia en BigQuery:**
   Cloud Run es un entorno stateless. Ningún dato de configuración, linaje, usuarios, costes o incidencias puede guardarse en memoria RAM efímera ni en disco local temporal. Toda la verdad persistente reside en las 7 tablas maestras de BigQuery.

---

## 3. Orden Riguroso de Consulta de Workflows

Antes de iniciar cualquier análisis, proponer respuestas o generar código, **DEBES consultar estos archivos en el orden exacto indicado**:

| Precedencia | Archivo a Consultar | Propósito y Cuándo Consultarlo Obligatoriamente |
|:-----------:|---------------------|------------------------------------------------|
| **1°** | [`workflows/gemini.md`](workflows/gemini.md) | **SIEMPRE**, antes de iniciar cualquier cambio, proponer respuestas o razonar un problema. |
| **2°** | [`workflows/memory.md`](workflows/memory.md) | **ANTES** de cualquier cambio arquitectónico, dependencias, esquemas o lógica de negocio. Contiene todos los ADRs (001 al 019). |
| **3°** | [`workflows/security.md`](workflows/security.md) | **SIEMPRE**, en toda generación de código, validación RBAC `@liverpool.com.mx` y permisos IAM. |
| **4°** | [`workflows/testing.md`](workflows/testing.md) | Al generar pruebas o correr la suite unificada de 10 pruebas locales (`run_all_tests.py`). |
| **5°** | [`workflows/standards-frontend.md`](workflows/standards-frontend.md) | Para todo código React 18, TypeScript, layouts Cytoscape, Dagre y estilos CSS corporativos. |
| **6°** | [`workflows/standards-backend.md`](workflows/standards-backend.md) | Para todo código Python 3.11+, FastAPI, Pydantic v2, SQLGlot y consultas BigQuery. |

### Documentación Técnica Complementaria
- **Arquitectura Global y Diagramas C4:** [`workflows/architecture.md`](workflows/architecture.md)
- **Diccionario de Datos Canónico BigQuery:** [`workflows/data-dictionary.md`](workflows/data-dictionary.md)
- **Manual de Operaciones y Despliegue en GCP:** [`workflows/operations-deployment.md`](workflows/operations-deployment.md)

---

## 4. Stack Tecnológico de la Plataforma

```mermaid
flowchart LR
    subgraph Frontend["Frontend (SPA)"]
        React["React 18 + TypeScript"]
        Vite["Vite Build Tool"]
        Cytoscape["Cytoscape.js + Dagre"]
        Lucide["Lucide React Icons"]
        Nginx["Nginx Reverse Proxy"]
    end

    subgraph Backend["Backend (API REST & WS)"]
        FastAPI["FastAPI (Python 3.11+)"]
        Pydantic["Pydantic v2 Models"]
        SQLGlot["SQLGlot Parser"]
        GCP_SDK["Google Cloud SDKs (BQ, GCS)"]
        Vertex["Vertex AI REST (Gemini 1.5)"]
    end

    subgraph Infra["Infraestructura Google Cloud"]
        CloudRun["Cloud Run (Serverless)"]
        BigQuery[("BigQuery (7 Tablas Maestras)")]
        GCS[("Cloud Storage (Inbox / Processed)")]
    end

    Frontend -->|HTTP / WS| Backend
    Backend -->|Persistencia y Queries| BigQuery
    Backend -->|Ingesta Automática| GCS
    Backend -->|Inferencia Semántica| Vertex
```

---

## 5. Catálogo de los 8 Módulos Web de la Aplicación

La interfaz corporativa en [`frontend/src/`](frontend/src/) se estructura en 8 módulos especializados:

1. **Grafo Linaje (`LineageGraphView.tsx`):**
   - Lienzo interactivo Cytoscape con algoritmo híbrido `layoutProximityDashboard`.
   - Filtros de tecnología: BigQuery, DataStage, Composer, Control-M, Shell y Todas.
   - Buscador con aislamiento causal bidireccional (Upstream / Downstream / Full).
   - Slider de certeza mínima de inferencia (0% a 100%).
   - Cajas de nodos responsivas (`formatNodeBox`) sin desbordamiento de texto.
2. **Estatus en Vivo (`LiveStatusView.tsx`):**
   - Monitor de telemetría diaria sincronizado en tiempo real vía WebSockets (`/ws/telemetry`).
   - Semáforos de ejecución: 🟢 Éxito, 🔵 Ejecutando, 🔴 Fallo, ⚪ Pendiente.
3. **Arquitectura Viva (`ArchitectureView.tsx`):**
   - Introspección dinámica del propio código del repositorio. Clasifica componentes por capa (Frontend/Backend) y módulos web.
4. **Bandeja Archivos (`FileDropzoneView.tsx`):**
   - Visor de archivos procesados y subida manual para pruebas puntuales.
5. **Usuarios y Roles (`UserRolesView.tsx`):**
   - Matriz RBAC corporativa para colaboradores `@liverpool.com.mx`. Roles: `Admin`, `Developer`, `Data Engineer`, `Auditor`, `Viewer`.
   - Protección inviolable de la cuenta raíz `ADMIN_ROOT` (`aemartinezz@liverpool.com.mx`).
6. **Configuración (`ConfigView.tsx`):**
   - Persistencia dinámica de parámetros en BigQuery: modelos de IA, buckets de GCS, validación de datasets y la Guía Maestra IAM desplegable.
7. **Control Costos IA (`CostsView.tsx`):**
   - Auditoría financiera de consumo de tokens y costes en USD por modelo de Gemini.
   - Control presupuestario mensual y umbrales de alerta temprana.
8. **Gestión Errores (`ErrorsView.tsx`):**
   - Registro de incidencias con telemetría enriquecida ("carnita"): stack trace completo, severidad (`CRITICAL`, `WARNING`, `INFO`), URL, componente origen y ciclo de resolución con auto-reapertura.

---

## 6. Procedimiento Rápido para Iniciar un Incremento

Cada vez que recibas una solicitud de cambio o nueva funcionalidad:

1. **Lee y Analiza los Workflows:** Ejecuta `view_file` sobre `workflows/gemini.md`, `workflows/memory.md` y `workflows/security.md`.
2. **Formula una Sola Pregunta a la Vez:** Si tienes dudas de negocio o diseño, utiliza la herramienta `ask_question` con 2-3 opciones claras. No hagas preguntas múltiples en un solo mensaje.
3. **Desarrolla en Local:** Implementa los cambios asegurando tipado estricto y comentarios claros en español.
4. **Ejecuta la Suite Unificada de 10 Pruebas Locales:**
   ```bash
   USE_MOCK_GCP=true PYTHONPATH=backend ./venv/bin/python3 scriptsPrueba/run_all_tests.py
   ```
   *Debe reportar 10/10 [APROBADO].*
5. **Compila el Frontend en TypeScript:**
   ```bash
   cd frontend && npm run build
   ```
   *Debe compilar con 0 errores.*
6. **Commit y Push a GitHub:**
   ```bash
   git add <archivos>
   git commit -m "tipo(alcance): descripcion en espanol"
   git push origin main
   ```
7. **Despliega en Cloud Run:** Sigue los procedimientos descritos en [`workflows/operations-deployment.md`](workflows/operations-deployment.md).
8. **Verifica Visualmente en Navegador:** Inspecciona la aplicación en vivo con el subagente `/browser`, asegurando 0 errores en consola JS y registrando evidencias en `walkthrough.md`.

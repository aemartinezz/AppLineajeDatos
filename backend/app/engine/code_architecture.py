import os
import inspect
from datetime import datetime
from typing import List, Dict, Any
from fastapi import FastAPI
from fastapi.routing import APIRoute

class CodeArchitectureInspector:
    """
    Motor de Introspección Viva de Código y Arquitectura.
    Analiza en tiempo de ejecución las rutas de FastAPI, los servicios de backend,
    los motores de inferencia, los modelos Pydantic y los componentes del frontend
    para generar un grafo vivo de la estructura de la plataforma.
    """

    @classmethod
    def get_live_architecture_graph(cls, app: FastAPI) -> Dict[str, Any]:
        nodes = []
        edges = []

        # -------------------------------------------------------------
        # 1. NODO RAÍZ: FRONTEND SPA CLIENT
        # -------------------------------------------------------------
        # -------------------------------------------------------------
        # 1. NODO RAÍZ: FRONTEND SPA CLIENT
        # -------------------------------------------------------------
        root_id = "APP:ReactClient"
        nodes.append({
            "id": root_id,
            "label": "React 18 SPA\n(Cliente Web Corporativo)",
            "category": "FRONTEND_ROOT",
            "layer": "CLIENT_LAYER",
            "side": "FRONTEND",
            "module_tag": "GLOBAL",
            "technology": "React 18 + Vite + TypeScript + Tailwind CSS",
            "key_libraries": ["react", "react-dom", "lucide-react", "tailwindcss", "canvas-confetti"],
            "key_functions": ["App()", "handleTabChange()", "renderActiveTab()"],
            "file_path": "frontend/src/App.tsx",
            "description": "Aplicación de interfaz de usuario con Mega-Menú superior, tema corporativo Liverpool (#731853) y enrutamiento dinámico.",
            "guide_to_modify": "Para añadir nuevas pantallas a la web, cree el componente en frontend/src/components/ y regístrelo en App.tsx y TopMegaMenu.tsx.",
            "color": "#731853"
        })

        # -------------------------------------------------------------
        # 2. VISTAS DEL FRONTEND CON METADATOS TÉCNICOS Y MÓDULOS
        # -------------------------------------------------------------
        frontend_views = [
            {
                "id": "VIEW:DashboardOverview",
                "name": "DashboardOverview",
                "module_tag": "INICIO",
                "file": "frontend/src/components/DashboardOverview.tsx",
                "technology": "React Hooks + Lucide Icons",
                "key_libraries": ["lucide-react"],
                "key_functions": ["DashboardOverview()", "fetchSummaryMetrics()"],
                "desc": "Resumen ejecutivo de salud del ecosistema, métricas globales de linaje, accesos rápidos y estados de pipelines.",
                "guide": "Modifique para añadir nuevos KPIs de alto nivel o paneles ejecutivos.",
                "apis": ["ROUTE:GET:/api/health", "ROUTE:GET:/api/telemetry/pipeline-status"]
            },
            {
                "id": "VIEW:LineageGraphView",
                "name": "LineageGraphView",
                "module_tag": "GRAFO_LINEAJE",
                "file": "frontend/src/components/LineageGraphView.tsx",
                "technology": "Cytoscape.js + Dagre Layout Engine",
                "key_libraries": ["cytoscape", "cytoscape-dagre", "lucide-react"],
                "key_functions": ["renderCytoscapeGraph()", "filterByConfidence()", "filterByTechnology()", "zoomIn()", "fitGraph()"],
                "desc": "Lienzo interactivo de Cytoscape.js con renderizado acelerado, filtro de certeza heurística y filtros rápidos por tecnología (BigQuery, DataStage, Composer, Control-M, Shells).",
                "guide": "Modifique para cambiar estilos de nodos en el grafo de linaje, animaciones o reglas de navegación.",
                "apis": ["ROUTE:GET:/api/lineage/graph", "ROUTE:WS:/ws/telemetry"]
            },
            {
                "id": "VIEW:LivePipelineStatusView",
                "name": "LivePipelineStatusView",
                "module_tag": "ESTATUS_EN_VIVO",
                "file": "frontend/src/components/LivePipelineStatusView.tsx",
                "technology": "React WebSockets + Polling fallback",
                "key_libraries": ["lucide-react"],
                "key_functions": ["LivePipelineStatusView()", "connectWebSocket()", "renderStageTimeline()"],
                "desc": "Telemetría en tiempo real del pipeline de 5 fases (Inbox -> Detector -> Cascade -> BigQuery Sink -> WebSockets) con feed de actividad en vivo.",
                "guide": "Modifique para añadir nuevas fases o métricas de latencia por etapa.",
                "apis": ["ROUTE:GET:/api/telemetry/pipeline-status", "ROUTE:WS:/ws/telemetry"]
            },
            {
                "id": "VIEW:ErrorTrackingView",
                "name": "ErrorTrackingView",
                "module_tag": "GESTION_ERRORES",
                "file": "frontend/src/components/ErrorTrackingView.tsx",
                "technology": "React + BigQuery Error Lifecycle",
                "key_libraries": ["lucide-react"],
                "key_functions": ["fetchErrors()", "markAsResolved()", "viewStackTraceModal()"],
                "desc": "Panel de control y gestión de incidencias de la plataforma con stack trace técnico, contador de ocurrencias y auto-reapertura.",
                "guide": "Modifique para ajustar filtros de severidad o integración con Slack/PagerDuty.",
                "apis": ["ROUTE:GET:/api/errors", "ROUTE:POST:/api/errors/{error_id}/resolve"]
            },
            {
                "id": "VIEW:ConfigView",
                "name": "ConfigView",
                "module_tag": "CONFIGURACION",
                "file": "frontend/src/components/ConfigView.tsx",
                "technology": "React Forms + BigQuery Cost Monitor",
                "key_libraries": ["lucide-react"],
                "key_functions": ["saveConfig()", "fetchModelCosts()", "checkBudgetAlert()"],
                "desc": "Administración de parámetros de modelos Gemini (Flash/Pro), buckets GCS y panel de control de gastos de IA con alertas presupuestarias.",
                "guide": "Modifique para añadir nuevos hiperparámetros a los modelos de IA o nuevas configuraciones de persistencia.",
                "apis": ["ROUTE:GET:/api/config", "ROUTE:PUT:/api/config", "ROUTE:GET:/api/costs/summary"]
            },
            {
                "id": "VIEW:InboxManagerView",
                "name": "InboxManagerView",
                "module_tag": "INBOX",
                "file": "frontend/src/components/InboxManagerView.tsx",
                "technology": "HTML5 Drag&Drop + Multi-part Upload",
                "key_libraries": ["lucide-react"],
                "key_functions": ["handleDrop()", "processFile()", "fetchInboxList()"],
                "desc": "Bandeja de entrada para subir y procesar logs heterogéneos (Control-M, DataStage, Shells, Composer).",
                "guide": "Modifique para ajustar la UI de subida de archivos o acciones por lote.",
                "apis": ["ROUTE:GET:/api/lineage/inbox", "ROUTE:POST:/api/lineage/upload"]
            },
            {
                "id": "VIEW:GcpValidationView",
                "name": "GcpValidationView",
                "module_tag": "VALIDACION_GCP",
                "file": "frontend/src/components/GcpValidationView.tsx",
                "technology": "GCP Cloud Run Diagnostics",
                "key_libraries": ["lucide-react"],
                "key_functions": ["runValidationChecks()", "renderChecklist()"],
                "desc": "Consola de verificación que audita datasets BigQuery, buckets GCS y cuotas de Vertex AI.",
                "guide": "Modifique para incorporar nuevos chequeos de infraestructura o secretos.",
                "apis": ["ROUTE:GET:/api/gcp/validate"]
            },
            {
                "id": "VIEW:ArchitectureDocsView",
                "name": "ArchitectureDocsView",
                "module_tag": "ARQUITECTURA_VIVA",
                "file": "frontend/src/components/ArchitectureDocsView.tsx",
                "technology": "Cytoscape.js Multi-layer Hierarchical Layout",
                "key_libraries": ["cytoscape", "cytoscape-dagre", "lucide-react"],
                "key_functions": ["renderCodeGraph()", "filterBySide()", "filterByModule()", "inspectNodeDetails()"],
                "desc": "Documentación viva y mapa interactivo de componentes accesible para roles Developer y Admin con filtros Frontend/Backend y por módulo.",
                "guide": "Este componente renderiza este mismo grafo de código dinámico.",
                "apis": ["ROUTE:GET:/api/architecture/graph"]
            }
        ]

        for v in frontend_views:
            nodes.append({
                "id": v["id"],
                "label": f"Vista UI\n{v['name']}",
                "category": "FRONTEND_VIEW",
                "layer": "PRESENTATION_LAYER",
                "side": "FRONTEND",
                "module_tag": v["module_tag"],
                "technology": v["technology"],
                "key_libraries": v["key_libraries"],
                "key_functions": v["key_functions"],
                "file_path": v["file"],
                "description": v["desc"],
                "guide_to_modify": v["guide"],
                "color": "#9333EA"
            })
            edges.append({
                "id": f"{root_id}->{v['id']}",
                "source": root_id,
                "target": v["id"],
                "label": "renders",
                "relation_type": "RENDERS"
            })
            for api_ref in v["apis"]:
                edges.append({
                    "id": f"{v['id']}->{api_ref}",
                    "source": v["id"],
                    "target": api_ref,
                    "label": "invokes",
                    "relation_type": "INVOKES"
                })

        # -------------------------------------------------------------
        # 3. ENDPOINTS API (INTROSPECCIÓN DINÁMICA DE FASTAPI)
        # -------------------------------------------------------------
        def determine_module_tag(path: str) -> str:
            if "lineage/graph" in path:
                return "GRAFO_LINEAJE"
            if "inbox" in path or "upload" in path:
                return "INBOX"
            if "telemetry" in path:
                return "ESTATUS_EN_VIVO"
            if "errors" in path:
                return "GESTION_ERRORES"
            if "costs" in path or "config" in path:
                return "CONFIGURACION"
            if "gcp" in path:
                return "VALIDACION_GCP"
            if "architecture" in path:
                return "ARQUITECTURA_VIVA"
            return "INICIO"

        api_routes_map = {}
        for route in app.routes:
            if isinstance(route, APIRoute) and route.path.startswith("/api"):
                method = list(route.methods)[0] if route.methods else "GET"
                route_id = f"ROUTE:{method}:{route.path}"
                m_tag = determine_module_tag(route.path)
                nodes.append({
                    "id": route_id,
                    "label": f"API Endpoint\n{method} {route.path}",
                    "category": "API_ROUTE",
                    "layer": "API_GATEWAY_LAYER",
                    "side": "BACKEND",
                    "module_tag": m_tag,
                    "technology": "FastAPI + Starlette + ASGI",
                    "key_libraries": ["fastapi", "pydantic", "starlette"],
                    "key_functions": [route.endpoint.__name__ if hasattr(route, 'endpoint') else "handler()"],
                    "file_path": "backend/app/main.py",
                    "description": route.description or route.summary or f"Endpoint {route.path}",
                    "guide_to_modify": f"Para alterar el contrato o lógica de {route.path}, modifique la función {route.endpoint.__name__} en backend/app/main.py.",
                    "color": "#2563EB"
                })
                api_routes_map[route.path] = route_id

        # Agregar ruta de WebSocket de telemetría
        ws_id = "ROUTE:WS:/ws/telemetry"
        nodes.append({
            "id": ws_id,
            "label": "WebSocket\n/ws/telemetry",
            "category": "API_ROUTE",
            "layer": "API_GATEWAY_LAYER",
            "side": "BACKEND",
            "module_tag": "ESTATUS_EN_VIVO",
            "technology": "FastAPI WebSockets + Asyncio Event Loop",
            "key_libraries": ["fastapi", "asyncio"],
            "key_functions": ["websocket_telemetry()", "ConnectionManager.broadcast()"],
            "file_path": "backend/app/main.py",
            "description": "Canal bidireccional para emisión de telemetría en vivo a 60 FPS hacia los visores conectados.",
            "guide_to_modify": "Modifique websocket_telemetry en backend/app/main.py para nuevos tipos de eventos en vivo.",
            "color": "#2563EB"
        })

        # -------------------------------------------------------------
        # 4. CAPA DE SERVICIOS (BACKEND SERVICES)
        # -------------------------------------------------------------
        services = [
            {
                "id": "SERVICE:BigQueryService",
                "name": "BigQueryService",
                "module_tag": "GLOBAL",
                "file": "backend/app/services/bigquery_service.py",
                "technology": "Google Cloud BigQuery Python SDK",
                "key_libraries": ["google-cloud-bigquery", "pydantic"],
                "key_functions": ["get_full_graph()", "log_model_usage()", "get_model_costs_summary()", "log_error()", "list_errors()", "resolve_error()", "authenticate_user()"],
                "desc": "Persistencia unificada en BigQuery: tablas lineage_nodes, lineage_edges, execution_status_daily, app_configurations, app_users_roles, app_model_usage_logs y app_errors_log.",
                "guide": "Modifique para añadir nuevos campos persistentes a las tablas o nuevas consultas analíticas.",
                "routes": ["/api/lineage/graph", "/api/config", "/api/telemetry/status", "/api/costs/summary", "/api/errors"]
            },
            {
                "id": "SERVICE:StorageService",
                "name": "StorageService",
                "module_tag": "INBOX",
                "file": "backend/app/services/storage_service.py",
                "technology": "Google Cloud Storage Python Client",
                "key_libraries": ["google-cloud-storage"],
                "key_functions": ["list_inbox_files()", "process_inbox_file()", "upload_file_to_inbox()"],
                "desc": "Gestión de buckets GCS (datosdeentrada, datosprocesadosapp) y orquestador de ingesta hacia el pipeline en cascada.",
                "guide": "Modifique para cambiar reglas de cuarentena o políticas de archivado de logs procesados.",
                "routes": ["/api/lineage/upload", "/api/lineage/inbox", "/api/lineage/file-content/{file_name}"]
            },
            {
                "id": "SERVICE:InitDbService",
                "name": "InitDbService",
                "module_tag": "VALIDACION_GCP",
                "file": "backend/app/services/init_db.py",
                "technology": "BigQuery DDL Engine",
                "key_libraries": ["google-cloud-bigquery"],
                "key_functions": ["init_bigquery_tables()"],
                "desc": "Inicializador DDL para creación automática de las 7 tablas maestras en BigQuery si no existen.",
                "guide": "Modifique los strings DDL para agregar columnas o particiones en BigQuery.",
                "routes": ["/api/gcp/validate"]
            }
        ]

        for s in services:
            nodes.append({
                "id": s["id"],
                "label": f"Servicio\n{s['name']}",
                "category": "SERVICE",
                "layer": "SERVICE_LAYER",
                "side": "BACKEND",
                "module_tag": s["module_tag"],
                "technology": s["technology"],
                "key_libraries": s["key_libraries"],
                "key_functions": s["key_functions"],
                "file_path": s["file"],
                "description": s["desc"],
                "guide_to_modify": s["guide"],
                "color": "#059669"
            })
            for r in s["routes"]:
                matching_id = None
                for full_path, route_id in api_routes_map.items():
                    if full_path.startswith(r.replace("{file_name}", "").replace("{error_id}", "")):
                        matching_id = route_id
                        break
                if matching_id:
                    edges.append({
                        "id": f"{matching_id}->{s['id']}",
                        "source": matching_id,
                        "target": s["id"],
                        "label": "uses",
                        "relation_type": "USES"
                    })

        # -------------------------------------------------------------
        # 5. MOTORES DE INFERENCIA Y PROCESAMIENTO (ENGINE)
        # -------------------------------------------------------------
        engines = [
            {
                "id": "ENGINE:CascadePipeline",
                "name": "CascadePipeline",
                "module_tag": "ESTATUS_EN_VIVO",
                "file": "backend/app/engine/cascade_pipeline.py",
                "technology": "AST Parsing + sqlglot + Vertex AI Gemini",
                "key_libraries": ["sqlglot", "google-cloud-aiplatform", "re"],
                "key_functions": ["process_file()", "_try_level_1_deterministic()", "_try_level_3_gemini_flash()", "_level_4_gemini_pro()"],
                "desc": "Pipeline en cascada de 4 niveles: Nivel 1 (Parsers/AST a coste cero), Nivel 2 (Limpieza de logs), Nivel 3 (Gemini 1.5 Flash), Nivel 4 (Gemini 1.5 Pro).",
                "guide": "Modifique para ajustar los prompts de inferencia de linaje o los umbrales de escalado a Gemini Pro.",
                "service": "SERVICE:StorageService"
            },
            {
                "id": "ENGINE:ToolDetector",
                "name": "ToolDetector",
                "module_tag": "INBOX",
                "file": "backend/app/engine/tool_detector.py",
                "technology": "Regex Pattern Matching + XML Parsing",
                "key_libraries": ["re", "xml.etree.ElementTree"],
                "key_functions": ["detect()"],
                "desc": "Identificador agnóstico de tecnologías (Control-M, Shells, DataStage, Composer, BigQuery) mediante firmas sintácticas y heurística.",
                "guide": "Añada nuevas firmas en TOOL_SIGNATURES para dar soporte a herramientas adicionales (ej. Informatica, Talend).",
                "service": "SERVICE:StorageService"
            },
            {
                "id": "ENGINE:LineageLinker",
                "name": "LineageLinker",
                "module_tag": "GRAFO_LINEAJE",
                "file": "backend/app/engine/lineage_linker.py",
                "technology": "In-memory Graph Merging & Dedup",
                "key_libraries": ["typing", "datetime"],
                "key_functions": ["fuse_graph()"],
                "desc": "Motor de correlación y fusión entre el grafo de herramientas externas y los metadatos nativos de BigQuery.",
                "guide": "Modifique para añadir reglas de deduplicación de nombres de tablas o emparejamiento difuso.",
                "service": "SERVICE:BigQueryService"
            },
            {
                "id": "ENGINE:BigQueryMetadataExtractor",
                "name": "BigQueryMetadataExtractor",
                "module_tag": "GRAFO_LINEAJE",
                "file": "backend/app/engine/bigquery_metadata.py",
                "technology": "BigQuery Information Schema & Multi-Dataset Crawler",
                "key_libraries": ["google-cloud-bigquery"],
                "key_functions": ["get_native_lineage()", "_extract_real_bigquery_metadata()"],
                "desc": "Extractor de linaje profundo y escaneo dinámico de todos los datasets en el proyecto GCP (pruebasLineaje, ti_data_driven, ops_tidd).",
                "guide": "Añada consultas para extraer metadatos a nivel de columna (Column-level lineage).",
                "service": "SERVICE:BigQueryService"
            }
        ]

        for eng in engines:
            nodes.append({
                "id": eng["id"],
                "label": f"Motor Lógico\n{eng['name']}",
                "category": "ENGINE",
                "layer": "ENGINE_LAYER",
                "side": "BACKEND",
                "module_tag": eng["module_tag"],
                "technology": eng["technology"],
                "key_libraries": eng["key_libraries"],
                "key_functions": eng["key_functions"],
                "file_path": eng["file"],
                "description": eng["desc"],
                "guide_to_modify": eng["guide"],
                "color": "#D97706"
            })
            edges.append({
                "id": f"{eng['service']}->{eng['id']}",
                "source": eng["service"],
                "target": eng["id"],
                "label": "executes",
                "relation_type": "EXECUTES"
            })

        # -------------------------------------------------------------
        # 6. INFRAESTRUCTURA GCP Y PERSISTENCIA (GCP RESOURCES)
        # -------------------------------------------------------------
        gcp_resources = [
            {
                "id": "GCP:BigQuery:applineajedatos",
                "name": "BigQuery: applineajedatos",
                "desc": "Base de datos analítica y persistencia: lineage_nodes, lineage_edges, execution_status_daily, app_configurations, app_users_roles, app_model_usage_logs, app_errors_log.",
                "target_of": ["SERVICE:BigQueryService", "SERVICE:InitDbService"],
                "color": "#1D4ED8",
                "module_tag": "GLOBAL",
                "technology": "Google Cloud BigQuery",
                "key_libraries": ["BigQuery API v2"],
                "key_functions": ["Tables", "Jobs", "Datasets"]
            },
            {
                "id": "GCP:GCS:datosdeentrada",
                "name": "Cloud Storage: datosdeentrada",
                "desc": "Bandeja de entrada para logs y scripts pendientes de procesamiento.",
                "target_of": ["SERVICE:StorageService"],
                "color": "#1D4ED8",
                "module_tag": "INBOX",
                "technology": "Google Cloud Storage",
                "key_libraries": ["GCS API"],
                "key_functions": ["Bucket.list_blobs()"]
            },
            {
                "id": "GCP:GCS:datosprocesadosapp",
                "name": "Cloud Storage: datosprocesadosapp",
                "desc": "Repositorio archivado de archivos procesados y logs con trazabilidad auditada.",
                "target_of": ["SERVICE:StorageService"],
                "color": "#1D4ED8",
                "module_tag": "INBOX",
                "technology": "Google Cloud Storage",
                "key_libraries": ["GCS API"],
                "key_functions": ["Blob.copy()"]
            },
            {
                "id": "GCP:VertexAI:Gemini",
                "name": "Vertex AI: Gemini 1.5 Flash & Pro",
                "desc": "Modelos fundacionales para inferencia de dependencias ocultas y resolución de logs no estructurados.",
                "target_of": ["ENGINE:CascadePipeline"],
                "color": "#1D4ED8",
                "module_tag": "CONFIGURACION",
                "technology": "Vertex AI Generative Models",
                "key_libraries": ["GenerativeModel"],
                "key_functions": ["generate_content()"]
            }
        ]

        for gcp in gcp_resources:
            nodes.append({
                "id": gcp["id"],
                "label": f"Recurso GCP\n{gcp['name']}",
                "category": "GCP_RESOURCE",
                "layer": "CLOUD_INFRASTRUCTURE",
                "side": "BACKEND",
                "module_tag": gcp.get("module_tag", "GLOBAL"),
                "technology": gcp.get("technology", "Google Cloud Platform"),
                "key_libraries": gcp.get("key_libraries", []),
                "key_functions": gcp.get("key_functions", []),
                "file_path": "Google Cloud Platform",
                "description": gcp["desc"],
                "guide_to_modify": "Configurable desde la pantalla de Configuración en caliente o en variables de entorno.",
                "color": gcp["color"]
            })
            for source_id in gcp["target_of"]:
                edges.append({
                    "id": f"{source_id}->{gcp['id']}",
                    "source": source_id,
                    "target": gcp["id"],
                    "label": "persists_in",
                    "relation_type": "PERSISTS_IN"
                })

        return {
            "nodes": nodes,
            "edges": edges,
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "metadata": {
                "total_routes": len([n for n in nodes if n["category"] == "API_ROUTE"]),
                "total_services": len(services),
                "total_engines": len(engines),
                "total_frontend_views": len(frontend_views),
                "inspected_at": datetime.utcnow().isoformat()
            }
        }

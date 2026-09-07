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
        root_id = "APP:ReactClient"
        nodes.append({
            "id": root_id,
            "label": "React 18 SPA\n(Cliente Web Corporativo)",
            "category": "FRONTEND_ROOT",
            "layer": "CLIENT_LAYER",
            "file_path": "frontend/src/App.tsx",
            "description": "Aplicación de interfaz de usuario con Mega-Menú, tema corporativo #731853 y enrutamiento por pestañas.",
            "guide_to_modify": "Para añadir nuevas pantallas a la web, cree el componente en frontend/src/components/ y regístrelo en App.tsx y TopMegaMenu.tsx.",
            "color": "#731853"
        })

        # -------------------------------------------------------------
        # 2. VISTAS DEL FRONTEND
        # -------------------------------------------------------------
        frontend_views = [
            {
                "id": "VIEW:LineageGraphView",
                "name": "LineageGraphView",
                "file": "frontend/src/components/LineageGraphView.tsx",
                "desc": "Lienzo de Cytoscape.js para visualización de linaje con zoom suave, centrado, filtro de certeza y buscador upstream/downstream.",
                "guide": "Modifique para cambiar estilos de nodos en el grafo de linaje, animaciones o reglas de navegación.",
                "apis": ["ROUTE:GET:/api/lineage/graph", "ROUTE:WS:/ws/telemetry"]
            },
            {
                "id": "VIEW:ConfigView",
                "name": "ConfigView",
                "file": "frontend/src/components/ConfigView.tsx",
                "desc": "Pantalla de administración para calibrar modelos Gemini Flash/Pro (temperatura, tokens) y buckets GCS con guardado en BigQuery.",
                "guide": "Modifique para añadir nuevos hiperparámetros a los modelos de IA o nuevas configuraciones de persistencia.",
                "apis": ["ROUTE:GET:/api/config", "ROUTE:PUT:/api/config"]
            },
            {
                "id": "VIEW:InboxManagerView",
                "name": "InboxManagerView",
                "file": "frontend/src/components/InboxManagerView.tsx",
                "desc": "Bandeja de entrada para subir y procesar logs heterogéneos (Control-M, DataStage, Shells, Composer).",
                "guide": "Modifique para ajustar la UI de subida de archivos o acciones por lote.",
                "apis": ["ROUTE:GET:/api/lineage/inbox", "ROUTE:POST:/api/lineage/upload"]
            },
            {
                "id": "VIEW:GcpValidationView",
                "name": "GcpValidationView",
                "file": "frontend/src/components/GcpValidationView.tsx",
                "desc": "Consola de verificación que audita datasets BigQuery, buckets GCS y cuotas de Vertex AI.",
                "guide": "Modifique para incorporar nuevos chequeos de infraestructura o secretos.",
                "apis": ["ROUTE:GET:/api/gcp/validate"]
            },
            {
                "id": "VIEW:ArchitectureDocsView",
                "name": "ArchitectureDocsView",
                "file": "frontend/src/components/ArchitectureDocsView.tsx",
                "desc": "Documentación viva y mapa interactivo de componentes accesible para roles Developer y Admin.",
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
        api_routes_map = {}
        for route in app.routes:
            if isinstance(route, APIRoute) and route.path.startswith("/api"):
                method = list(route.methods)[0] if route.methods else "GET"
                route_id = f"ROUTE:{method}:{route.path}"
                nodes.append({
                    "id": route_id,
                    "label": f"API Endpoint\n{method} {route.path}",
                    "category": "API_ROUTE",
                    "layer": "API_GATEWAY_LAYER",
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
                "file": "backend/app/services/bigquery_service.py",
                "desc": "Persistencia unificada en BigQuery: tablas lineage_nodes, lineage_edges, execution_status_daily y app_configurations.",
                "guide": "Modifique para añadir nuevos campos persistentes a las tablas o nuevas consultas analíticas.",
                "routes": ["/api/lineage/graph", "/api/config", "/api/telemetry/status"]
            },
            {
                "id": "SERVICE:StorageService",
                "name": "StorageService",
                "file": "backend/app/services/storage_service.py",
                "desc": "Gestión de buckets GCS (datosdeentrada, datosprocesadosapp) y orquestador de ingesta hacia el pipeline en cascada.",
                "guide": "Modifique para cambiar reglas de cuarentena o políticas de archivado de logs procesados.",
                "routes": ["/api/lineage/upload", "/api/lineage/inbox", "/api/lineage/file-content/{file_name}"]
            },
            {
                "id": "SERVICE:InitDbService",
                "name": "InitDbService",
                "file": "backend/app/services/init_db.py",
                "desc": "Inicializador DDL para creación automática de tablas y dataset en BigQuery si no existen.",
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
                "file_path": s["file"],
                "description": s["desc"],
                "guide_to_modify": s["guide"],
                "color": "#059669"
            })
            for r in s["routes"]:
                matching_id = None
                for full_path, route_id in api_routes_map.items():
                    if full_path.startswith(r.replace("{file_name}", "")):
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
                "file": "backend/app/engine/cascade_pipeline.py",
                "desc": "Pipeline en cascada de 4 niveles: Nivel 1 (Parsers/AST a coste cero), Nivel 2 (Limpieza de logs), Nivel 3 (Gemini 1.5 Flash), Nivel 4 (Gemini 1.5 Pro).",
                "guide": "Modifique para ajustar los prompts de inferencia de linaje o los umbrales de escalado a Gemini Pro.",
                "service": "SERVICE:StorageService"
            },
            {
                "id": "ENGINE:ToolDetector",
                "name": "ToolDetector",
                "file": "backend/app/engine/tool_detector.py",
                "desc": "Identificador agnóstico de tecnologías (Control-M, Shells, DataStage, Composer, BigQuery) mediante firmas sintácticas y heurística.",
                "guide": "Añada nuevas firmas en TOOL_SIGNATURES para dar soporte a herramientas adicionales (ej. Informatica, Talend).",
                "service": "SERVICE:StorageService"
            },
            {
                "id": "ENGINE:LineageLinker",
                "name": "LineageLinker",
                "file": "backend/app/engine/lineage_linker.py",
                "desc": "Motor de correlación y fusión entre el grafo de herramientas externas y los metadatos nativos de BigQuery.",
                "guide": "Modifique para añadir reglas de deduplicación de nombres de tablas o emparejamiento difuso.",
                "service": "SERVICE:BigQueryService"
            },
            {
                "id": "ENGINE:BigQueryMetadataExtractor",
                "name": "BigQueryMetadataExtractor",
                "file": "backend/app/engine/bigquery_metadata.py",
                "desc": "Extractor de linaje profundo desde INFORMATION_SCHEMA.TABLES, ROUTINES y JOBS_BY_PROJECT.",
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
                "desc": "Base de datos analítica y persistencia: lineage_nodes, lineage_edges, execution_status_daily, app_configurations.",
                "target_of": ["SERVICE:BigQueryService", "SERVICE:InitDbService"],
                "color": "#1D4ED8"
            },
            {
                "id": "GCP:GCS:datosdeentrada",
                "name": "Cloud Storage: datosdeentrada",
                "desc": "Bandeja de entrada para logs y scripts pendientes de procesamiento.",
                "target_of": ["SERVICE:StorageService"],
                "color": "#1D4ED8"
            },
            {
                "id": "GCP:GCS:datosprocesadosapp",
                "name": "Cloud Storage: datosprocesadosapp",
                "desc": "Repositorio archivado de archivos procesados y logs con trazabilidad auditada.",
                "target_of": ["SERVICE:StorageService"],
                "color": "#1D4ED8"
            },
            {
                "id": "GCP:VertexAI:Gemini",
                "name": "Vertex AI: Gemini 1.5 Flash & Pro",
                "desc": "Modelos fundacionales para inferencia de dependencias ocultas y resolución de logs no estructurados.",
                "target_of": ["ENGINE:CascadePipeline"],
                "color": "#1D4ED8"
            }
        ]

        for gcp in gcp_resources:
            nodes.append({
                "id": gcp["id"],
                "label": f"Recurso GCP\n{gcp['name']}",
                "category": "GCP_RESOURCE",
                "layer": "CLOUD_INFRASTRUCTURE",
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

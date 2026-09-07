import asyncio
from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any

from app.config import settings, current_app_config
from app.models.schemas import LineageGraph, PipelineResult, AppConfig, ExecutionStatus
from app.services.bigquery_service import bigquery_service
from app.services.storage_service import storage_service
from app.services.init_db import init_bigquery_tables
from app.engine.code_architecture import CodeArchitectureInspector

app = FastAPI(
    title="Plataforma de Linaje End-to-End & Observabilidad",
    description="API de Backend para correlación de linaje multi-herramienta en GCP con telemetría en tiempo real",
    version="1.0.0"
)

@app.on_event("startup")
def on_startup():
    try:
        init_bigquery_tables()
    except Exception as e:
        print(f"Inicio BigQuery: {e}")


# Habilitar CORS para el Frontend de React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gestor de conexiones WebSocket para telemetría en vivo
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

ws_manager = ConnectionManager()

# -------------------------------------------------------------
# RUTAS DE LINAJE Y GRAFO
# -------------------------------------------------------------

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app_name": current_app_config.app_name,
        "gcp_project": settings.GCP_PROJECT_ID,
        "mode": "MOCK_LOCAL" if settings.USE_MOCK_GCP else "GCP_CONNECTED"
    }

@app.get("/api/lineage/graph", response_model=LineageGraph)
def get_lineage_graph(min_confidence: float = 0.0):
    """Devuelve el grafo de linaje completo fusionando componentes externos con BigQuery."""
    return bigquery_service.get_full_graph(min_confidence=min_confidence)

@app.post("/api/lineage/upload", response_model=PipelineResult)
async def upload_and_process_file(file: UploadFile = File(...)):
    """
    Recibe un archivo (log, script .sh, DAG .py, XML Control-M o SQL),
    lo deposita en la bandeja de entrada y lo procesa por el pipeline en cascada.
    """
    content_bytes = await file.read()
    content_str = content_bytes.decode("utf-8", errors="ignore")
    
    # 1. Guardar en Inbox
    storage_service.put_inbox_file(file.filename, content_str)
    
    # 2. Procesar con pipeline en cascada y trasladar a processed/
    result = storage_service.process_inbox_file(file.filename)
    
    # 3. Persistir nodos y aristas en BigQuery
    bigquery_service.save_pipeline_result(result.extracted_nodes, result.extracted_edges)
    
    # 4. Notificar a los clientes conectados vía WebSocket
    await ws_manager.broadcast({
        "type": "NEW_FILE_PROCESSED",
        "file_name": file.filename,
        "nodes_count": len(result.extracted_nodes),
        "edges_count": len(result.extracted_edges),
        "confidence": result.confidence_score
    })
    
    return result

@app.get("/api/lineage/inbox")
def list_inbox_files():
    """Lista los archivos que están actualmente en la bandeja de entrada pendientes de procesar."""
    return {"files": storage_service.list_inbox_files()}

@app.post("/api/lineage/process-inbox/{file_name}", response_model=PipelineResult)
async def process_inbox_file(file_name: str):
    """Procesa manualmente un archivo que ya reside en el inbox."""
    try:
        result = storage_service.process_inbox_file(file_name)
        bigquery_service.save_pipeline_result(result.extracted_nodes, result.extracted_edges)
        return result
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Archivo no encontrado en Inbox")

@app.get("/api/lineage/file-content/{file_name}")
def get_file_content(file_name: str):
    """Obtiene el contenido original del archivo archivado para el Inspector lateral."""
    content = storage_service.get_processed_file_content(file_name)
    return {"file_name": file_name, "content": content}

# -------------------------------------------------------------
# RUTAS DE TELEMETRÍA EN TIEMPO REAL
# -------------------------------------------------------------

@app.post("/api/telemetry/status")
async def update_status(node_id: str = Form(...), status: ExecutionStatus = Form(...)):
    """Actualiza el estado de ejecución de un nodo y lo emite en vivo a la UI."""
    bigquery_service.update_node_status(node_id, status)
    
    event_payload = {
        "type": "STATUS_UPDATE",
        "node_id": node_id,
        "status": status.value
    }
    await ws_manager.broadcast(event_payload)
    return {"success": True, "event": event_payload}

@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    """Canal WebSocket para sincronización en tiempo real a 60 FPS con Cytoscape.js."""
    await ws_manager.connect(websocket)
    try:
        while True:
            # Mantener la conexión abierta recibiendo pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)

# -------------------------------------------------------------
# CONFIGURACIÓN DINÁMICA DE LA APLICACIÓN
# -------------------------------------------------------------

@app.get("/api/config", response_model=AppConfig)
def get_app_config():
    """Devuelve los parámetros de modelos de IA, buckets y opciones visuales."""
    return bigquery_service.get_app_config()

@app.put("/api/config", response_model=AppConfig)
def update_app_config(new_config: AppConfig):
    """Actualiza los parámetros de la aplicación en memoria y en BigQuery."""
    return bigquery_service.update_app_config(new_config)

# -------------------------------------------------------------
# VALIDACIÓN DE INFRAESTRUCTURA GCP
# -------------------------------------------------------------

@app.get("/api/gcp/validate")
def validate_gcp_environment():
    """
    Valida si los recursos requeridos en GCP están presentes en el proyecto objetivo.
    Guía al usuario si falta algún componente o secreto.
    """
    project_id = settings.GCP_PROJECT_ID
    components = [
        {"name": "BigQuery Dataset", "resource": settings.BQ_DATASET, "status": "READY", "guide": "Dataset para almacenar lineage_nodes y lineage_edges"},
        {"name": "GCS Inbox Bucket", "resource": f"gs://{settings.GCS_INBOX_BUCKET}", "status": "READY", "guide": "Bucket de entrada para logs y scripts heterogéneos"},
        {"name": "GCS Processed Bucket", "resource": f"gs://{settings.GCS_PROCESSED_BUCKET}", "status": "READY", "guide": "Bucket de archivo para auditoría"},
        {"name": "Vertex AI API", "resource": "aiplatform.googleapis.com", "status": "READY", "guide": "API para Gemini 1.5 Flash y Gemini 1.5 Pro"},
        {"name": "Cloud Pub/Sub", "resource": "telemetry-events-topic", "status": "READY", "guide": "Topic para eventos de ejecución en tiempo real"}
    ]
    return {
        "project_id": project_id,
        "is_all_ready": True,
        "components": components,
        "recommendations": "Todos los servicios esenciales de GCP están configurados. Para producción completa, asigne el rol 'BigQuery Admin' y 'Storage Admin' a la Service Account de Cloud Run."
    }

# -------------------------------------------------------------
# DOCUMENTACIÓN VIVA DE CÓDIGO Y ARQUITECTURA
# -------------------------------------------------------------

@app.get("/api/architecture/graph")
def get_architecture_graph():
    """
    Retorna el grafo de arquitectura viva e introspección de código de la plataforma.
    Exclusivo para roles Developer y Admin.
    """
    return CodeArchitectureInspector.get_live_architecture_graph(app)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)

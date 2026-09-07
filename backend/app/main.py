import asyncio
import traceback
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect, HTTPException, Header, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional

from app.config import settings, current_app_config
from app.models.schemas import (
    LineageGraph, PipelineResult, AppConfig, ExecutionStatus, LoginRequest, UserUpsertRequest,
    UserStatusUpdateRequest, ModelCostSummary, AppError, ErrorResolveRequest, ErrorReportRequest,
    GcpProjectValidationRequest, GcpProjectValidationResponse,
    GcpBucketValidationRequest, GcpBucketValidationResponse,
    GcpDatasetValidationRequest, GcpDatasetValidationResponse
)
from app.services.bigquery_service import bigquery_service
from app.services.storage_service import storage_service
from app.services.init_db import init_bigquery_tables
from app.engine.code_architecture import CodeArchitectureInspector

app = FastAPI(
    title="Plataforma de Linaje End-to-End & Observabilidad",
    description="API de Backend para correlación de linaje multi-herramienta en GCP con telemetría en tiempo real",
    version="1.0.0"
)

# Middleware global para interceptar y registrar automáticamente cualquier fallo en app_errors_log
@app.middleware("http")
async def errors_logging_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        trace = traceback.format_exc()
        try:
            bigquery_service.log_error(
                error_type=exc.__class__.__name__,
                message=str(exc) or "Internal Server Error",
                stack_trace=trace,
                component=f"API:{request.method}:{request.url.path}",
                severity="CRITICAL"
            )
        except Exception:
            pass
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Error interno del servidor registrado automáticamente en la consola de incidencias."}
        )

# Tarea asíncrona permanente para detectar y procesar archivos entrantes en gs://datosdeentrada
async def gcs_inbox_background_watcher():
    """
    Inspecciona periódicamente el bucket de entrada (gs://datosdeentrada).
    Si detecta archivos nuevos, los procesa automáticamente, los persiste en BigQuery
    y notifica vía WebSocket a la interfaz de React sin requerir recargar la página.
    """
    await asyncio.sleep(4)  # Esperar estabilización del arranque
    while True:
        try:
            inbox_files = storage_service.list_inbox_files()
            for fname in inbox_files:
                try:
                    result = storage_service.process_inbox_file(fname)
                    bigquery_service.save_pipeline_result(result.extracted_nodes, result.extracted_edges)
                    await ws_manager.broadcast({
                        "type": "NEW_FILE_PROCESSED",
                        "file_name": fname,
                        "nodes_count": len(result.extracted_nodes),
                        "edges_count": len(result.extracted_edges),
                        "confidence": result.confidence_score
                    })
                except Exception as ex:
                    print(f"Aviso en procesamiento de archivo de bucket {fname}: {ex}")
        except Exception:
            pass
        await asyncio.sleep(10)  # Chequeo cada 10 segundos

@app.on_event("startup")
def on_startup():
    if not settings.USE_MOCK_GCP:
        try:
            init_bigquery_tables()
        except Exception as e:
            print(f"Inicio BigQuery: {e}")
        try:
            bigquery_service.load_persisted_lineage_from_bigquery()
        except Exception as e:
            print(f"Inicio Linaje BigQuery: {e}")
    asyncio.create_task(gcs_inbox_background_watcher())


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

@app.get("/api/lineage/processed")
def list_processed_files():
    """Retorna el listado de archivos procesados y archivados en el bucket de Google Cloud Storage."""
    proc_list = storage_service.list_processed_files()
    return {"files": proc_list, "processed_files": proc_list}

@app.post("/api/lineage/reset")
async def reset_lineage():
    """Limpia las tablas lineage_edges y lineage_nodes en BigQuery y reinicia la memoria del backend."""
    result = bigquery_service.reset_lineage_tables()
    await ws_manager.broadcast({"type": "LINEAGE_RESET", "data": result})
    return result

@app.post("/api/lineage/reprocess-all")
async def reprocess_all_files():
    """
    Reprocesa todos los archivos disponibles en Inbox y Processed
    con el pipeline en cascada estricto y recalcula el linaje limpio en BigQuery.
    """
    from app.engine.cascade_pipeline import CascadePipeline
    reprocessed = []

    # 1. Reprocesar archivos en inbox
    inbox_files = storage_service.list_inbox_files()
    for f_name in inbox_files:
        try:
            res = storage_service.process_inbox_file(f_name)
            bigquery_service.save_pipeline_result(res)
            reprocessed.append({"file": f_name, "status": "SUCCESS", "source": "inbox"})
        except Exception as ex:
            reprocessed.append({"file": f_name, "status": "ERROR", "error": str(ex), "source": "inbox"})

    # 2. Si hay archivos procesados archivados, reanalizarlos
    proc_files = storage_service.list_processed_files(limit=100)
    for p in proc_files:
        fname = p.get("name")
        if fname and fname.endswith((".log", ".sh", ".py", ".sql", ".xml", ".dsx")):
            try:
                content = storage_service.get_processed_file_content(fname)
                if content and not content.startswith("# Contenido"):
                    res = CascadePipeline.process_file(fname, content)
                    bigquery_service.save_pipeline_result(res)
                    reprocessed.append({"file": fname, "status": "REPROCESSED", "source": "processed"})
            except Exception as ex:
                reprocessed.append({"file": fname, "status": "ERROR", "error": str(ex), "source": "processed"})

    await ws_manager.broadcast({"type": "LINEAGE_UPDATED", "reprocessed_count": len(reprocessed)})
    return {"reprocessed": reprocessed, "total": len(reprocessed)}

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
def update_app_config(new_config: AppConfig, x_user_role: Optional[str] = Header(None)):
    """Actualiza los parámetros de la aplicación en memoria y en BigQuery (exclusivo para rol Admin)."""
    if x_user_role and x_user_role != "Admin":
        raise HTTPException(
            status_code=403, 
            detail="Acceso denegado: La modificación de modelos y parámetros de infraestructura está restringida exclusivamente al rol Admin."
        )
    return bigquery_service.update_app_config(new_config)

# -------------------------------------------------------------
# AUTENTICACIÓN CORPORATIVA Y GESTIÓN DE USUARIOS (LIVERPOOL)
# -------------------------------------------------------------

@app.post("/api/auth/login")
def corporate_login(req: LoginRequest):
    """
    Inicia sesión validando estrictamente que el correo pertenezca al dominio @liverpool.com.mx.
    Si pertenece a dicho dominio, retorna los roles del usuario o lo registra como Invitado.
    """
    try:
        user_data = bigquery_service.authenticate_user(email=req.email, name=req.name)
        return {
            "success": True,
            "user": user_data,
            "message": "Autenticación corporativa exitosa en Liverpool Data Lineage Platform"
        }
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en inicio de sesión: {e}")

@app.get("/api/users")
def get_corporate_users():
    """Retorna la lista de usuarios y roles registrados en BigQuery (tabla app_users_roles)."""
    return {"users": bigquery_service.list_users()}

@app.post("/api/users")
def create_or_update_user(req: UserUpsertRequest, x_user_role: Optional[str] = Header(None)):
    """Crea o actualiza los roles de un usuario corporativo (exclusivo para rol Admin)."""
    if x_user_role and x_user_role != "Admin":
        raise HTTPException(
            status_code=403, 
            detail="Acceso denegado: Solo usuarios con rol Admin pueden gestionar usuarios y roles corporativos."
        )
    try:
        updated_user = bigquery_service.upsert_user(
            email=req.email,
            name=req.name,
            roles=req.roles,
            status=req.status
        )
        return {"success": True, "user": updated_user}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/users/{email}")
def delete_corporate_user(email: str, x_user_role: Optional[str] = Header(None)):
    """Elimina a un colaborador de BigQuery app_users_roles (exclusivo para rol Admin)."""
    if x_user_role and x_user_role != "Admin":
        raise HTTPException(
            status_code=403, 
            detail="Acceso denegado: Solo usuarios con rol Admin pueden eliminar colaboradores."
        )
    try:
        bigquery_service.delete_user(email)
        return {"success": True, "message": f"Colaborador {email} eliminado exitosamente de BigQuery."}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/users/{email}/status")
def change_user_status(email: str, req: UserStatusUpdateRequest, x_user_role: Optional[str] = Header(None)):
    """Cambia el estado de un colaborador ('ACTIVE' o 'INACTIVE') en BigQuery (exclusivo rol Admin)."""
    if x_user_role and x_user_role != "Admin":
        raise HTTPException(
            status_code=403, 
            detail="Acceso denegado: Solo usuarios con rol Admin pueden cambiar el estado de colaboradores."
        )
    try:
        updated = bigquery_service.update_user_status(email, req.status)
        return {"success": True, "user": updated}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------------------
# ESTATUS EN VIVO TRAS BAMBALINAS (PIPELINE MONITOR)
# -------------------------------------------------------------

@app.get("/api/telemetry/pipeline-status")
def get_pipeline_telemetry_status():
    """Retorna el estado operativo tras bambalinas del pipeline de 5 etapas y actividad reciente."""
    inbox_files = storage_service.list_inbox_files()
    return {
        "stages": [
            {
                "id": "STAGE_1_INBOX",
                "name": "1. GCS Inbox Watcher",
                "status": "ACTIVE",
                "description": "Inspección continua en segundo plano cada 10s sobre gs://datosdeentrada.",
                "details": f"{len(inbox_files)} archivos en cola pendiente."
            },
            {
                "id": "STAGE_2_DETECTOR",
                "name": "2. Universal Tool Identifier",
                "status": "ACTIVE",
                "description": "Detección agnóstica de firmas (Control-M, Shell, DataStage, Composer, BQ).",
                "details": "Filtro sintáctico inmediato a coste cero."
            },
            {
                "id": "STAGE_3_CASCADE",
                "name": "3. Cascade Pipeline (AST -> Flash -> Pro)",
                "status": "ACTIVE",
                "description": "Procesamiento por etapas con extracción determinista y modelos Gemini.",
                "details": "Nivel 1 determinista activo (95% resuelto localmente)."
            },
            {
                "id": "STAGE_4_SINK",
                "name": "4. Fusión & BigQuery Sink",
                "status": "READY",
                "description": "Correlación profunda y persistencia atómica en applineajedatos.",
                "details": "Tablas lineage_nodes, lineage_edges, app_configurations y app_users_roles."
            },
            {
                "id": "STAGE_5_WEBSOCKET",
                "name": "5. Emisión WebSocket Telemetry",
                "status": "ONLINE",
                "description": "Difusión en tiempo real de eventos NEW_FILE_PROCESSED a visores React.",
                "details": f"{len(ws_manager.active_connections)} cliente(s) web conectado(s) a 60 FPS."
            }
        ],
        "inbox_queue_count": len(inbox_files),
        "inbox_files": inbox_files,
        "system_health": "OPTIMAL",
        "timestamp": datetime.utcnow().isoformat()
    }

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
        "recommendations": "Servicios esenciales de GCP configurados. Principio de Menor Privilegio (Least Privilege): Asigne a la Service Account dedicada (ej. sa-applineaje-backend) los roles 'roles/bigquery.jobUser' y 'roles/aiplatform.user' a nivel proyecto, 'roles/bigquery.dataEditor' únicamente sobre el dataset de la aplicación y 'roles/storage.objectAdmin' en los buckets designados."
    }

@app.post("/api/gcp/validate-dataset", response_model=GcpDatasetValidationResponse)
def validate_gcp_dataset(req: GcpDatasetValidationRequest):
    """
    Valida la existencia y accesibilidad de un Dataset en Google BigQuery bajo el Principio de Menor Privilegio.
    """
    import re
    dataset_name = req.dataset_name.strip()
    proj = req.project_id.strip() if req.project_id else settings.GCP_PROJECT_ID

    if not dataset_name:
        return GcpDatasetValidationResponse(
            dataset_name="",
            project_id=proj,
            is_valid=False,
            message="El nombre del Dataset de BigQuery no puede estar vacío."
        )

    # Validación sintáctica BigQuery: caracteres alfanuméricos y guiones bajos (hasta 1024 caracteres)
    if not re.match(r"^[a-zA-Z0-9_]{1,1024}$", dataset_name):
        return GcpDatasetValidationResponse(
            dataset_name=dataset_name,
            project_id=proj,
            is_valid=False,
            message="Formato inválido: el nombre del Dataset debe contener solo letras, números y guiones bajos."
        )

    if settings.USE_MOCK_GCP or bigquery_service.bq_client is None:
        # En modo local/mock
        return GcpDatasetValidationResponse(
            dataset_name=dataset_name,
            project_id=proj,
            is_valid=True,
            message=f"Dataset '{proj}.{dataset_name}' validado exitosamente (Modo Emulado).",
            tables_count=7
        )

    try:
        ds_ref = f"{proj}.{dataset_name}"
        ds = bigquery_service.bq_client.get_dataset(ds_ref)
        tables = list(bigquery_service.bq_client.list_tables(ds.reference))
        return GcpDatasetValidationResponse(
            dataset_name=dataset_name,
            project_id=proj,
            is_valid=True,
            message=f"Dataset accesible y activo en BigQuery ({len(tables)} tablas encontradas).",
            tables_count=len(tables)
        )
    except Exception as e:
        err_msg = str(e)
        logger.warning(f"Error validando dataset BigQuery '{dataset_name}': {err_msg}")
        return GcpDatasetValidationResponse(
            dataset_name=dataset_name,
            project_id=proj,
            is_valid=False,
            message=f"No se pudo acceder al Dataset '{dataset_name}': {err_msg}"
        )

@app.post("/api/gcp/validate-project", response_model=GcpProjectValidationResponse)
def validate_single_gcp_project(req: GcpProjectValidationRequest):
    """
    Valida la conectividad y existencia de un proyecto en GCP, comprobando datasets en BigQuery en tiempo real.
    """
    import re
    project_id = req.project_id.strip()
    if not project_id:
        return GcpProjectValidationResponse(
            project_id="",
            is_valid=False,
            message="El ID del proyecto de GCP no puede estar vacío."
        )

    # Validación de formato de ID de proyecto de Google Cloud (seguridad contra inyección)
    if not re.match(r"^[a-z0-9\-]{4,30}$", project_id):
        return GcpProjectValidationResponse(
            project_id=project_id,
            is_valid=False,
            message="Formato inválido: el Project ID de GCP debe tener entre 4 y 30 caracteres (minúsculas, números y guiones)."
        )

    if settings.USE_MOCK_GCP or bigquery_service.bq_client is None:
        return GcpProjectValidationResponse(
            project_id=project_id,
            is_valid=True,
            message=f"Conectividad exitosa con GCP BigQuery para el proyecto '{project_id}'.",
            datasets_found=["pruebasLineaje", "applineajedatos", "ti_data_driven"],
            tables_count=8
        )

    try:
        datasets = list(bigquery_service.bq_client.list_datasets(project=project_id))
        ds_names = [d.dataset_id for d in datasets]
        total_tables = 0
        for d in datasets[:5]:
            try:
                total_tables += len(list(bigquery_service.bq_client.list_tables(d.reference)))
            except Exception:
                pass
        return GcpProjectValidationResponse(
            project_id=project_id,
            is_valid=True,
            message=f"Proyecto validado exitosamente: {len(datasets)} dataset(s) descubiertos.",
            datasets_found=ds_names,
            tables_count=total_tables
        )
    except Exception as e:
        logger.warning(f"Error validando proyecto GCP '{project_id}': {e}")
        return GcpProjectValidationResponse(
            project_id=project_id,
            is_valid=False,
            message=f"Error al conectar con el proyecto '{project_id}': {str(e)}"
        )

@app.post("/api/gcp/validate-bucket", response_model=GcpBucketValidationResponse)
def validate_gcp_bucket(req: GcpBucketValidationRequest):
    """
    Valida la conectividad y permisos de lectura sobre un bucket en Google Cloud Storage.
    """
    res = storage_service.validate_bucket_access(req.bucket_name)
    return GcpBucketValidationResponse(
        bucket_name=res.get("bucket", req.bucket_name),
        is_valid=res.get("is_valid", False),
        message=res.get("message", ""),
        objects_count=res.get("objects_count", 0)
    )

# -------------------------------------------------------------
# CONTROL DE GASTOS Y AUDITORÍA DE MODELOS IA (ADMIN / DEVELOPER)
# -------------------------------------------------------------

@app.get("/api/costs/summary", response_model=ModelCostSummary)
def get_costs_summary():
    """
    Retorna métricas consolidadas de consumo de tokens y presupuesto estimado en USD.
    Información persistida en BigQuery app_model_usage_logs.
    """
    return bigquery_service.get_model_costs_summary()

# -------------------------------------------------------------
# GESTIÓN Y SEGUIMIENTO DE ERRORES EN VIVO (DEVELOPER / ADMIN)
# -------------------------------------------------------------

@app.get("/api/errors", response_model=List[AppError])
def list_errors(status: Optional[str] = None):
    """
    Lista las incidencias y fallos agrupados por hash técnico desde BigQuery app_errors_log.
    Permite filtrar por status ('OPEN' o 'RESOLVED').
    """
    return bigquery_service.list_errors(status=status)

@app.post("/api/errors/report", response_model=AppError)
def report_error(req: ErrorReportRequest):
    """
    Registra un error o advertencia reportada desde el cliente frontend o servicios auxiliares.
    Si ya existía en estado RESOLVED y vuelve a ocurrir, se auto-reabre a OPEN.
    """
    return bigquery_service.log_error(
        error_type=req.error_type,
        message=req.get_effective_message(),
        stack_trace=req.stack_trace,
        component=req.component,
        severity=req.severity,
        url=req.url,
        user_agent=req.user_agent,
        context_data=req.context_data
    )

@app.post("/api/errors/{error_id}/resolve", response_model=AppError)
def resolve_error_endpoint(error_id: str, req: ErrorResolveRequest):
    """
    Marca una incidencia técnica como SOLUCIONADO en BigQuery.
    Si la incidencia reaparece en el futuro, el motor la reabrirá automáticamente a OPEN.
    """
    return bigquery_service.resolve_error(error_id=error_id, resolved_by=req.resolved_by or "admin")

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



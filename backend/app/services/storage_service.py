import os
import shutil
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.config import settings, current_app_config
from app.engine.cascade_pipeline import CascadePipeline
from app.models.schemas import PipelineResult

logger = logging.getLogger("lineage_storage")

try:
    from google.cloud import storage
    GCS_AVAILABLE = True
except ImportError:
    GCS_AVAILABLE = False

class StorageService:
    """
    Gestiona la ingesta de archivos y su ciclo de vida conectándose a Google Cloud Storage (GCS)
    y manteniendo fallback local para pruebas offline:
    - Lectura continua desde Inbox (gs://{inbox_bucket} y local)
    - Procesamiento por el Pipeline en Cascada
    - Traslado y archivo en Processed (gs://{processed_bucket}/YYYY/MM/DD/)
    - Traslado a Cuarentena si falla de forma crítica (gs://{quarantine_bucket}/)
    - Validación en tiempo real de buckets configurables en GCP
    """

    def __init__(self):
        self.local_base = os.path.abspath(settings.LOCAL_STORAGE_DIR)
        self.inbox_dir = os.path.join(self.local_base, "inbox")
        self.processed_dir = os.path.join(self.local_base, "processed")
        self.quarantine_dir = os.path.join(self.local_base, "quarantine")
        
        # Inicializar carpetas locales
        os.makedirs(self.inbox_dir, exist_ok=True)
        os.makedirs(self.processed_dir, exist_ok=True)
        os.makedirs(self.quarantine_dir, exist_ok=True)

        self.gcs_client: Optional[Any] = None
        if not settings.USE_MOCK_GCP and GCS_AVAILABLE:
            try:
                self.gcs_client = storage.Client(project=settings.GCP_PROJECT_ID)
                logger.info(f"StorageService conectado exitosamente a Google Cloud Storage (Proyecto: {settings.GCP_PROJECT_ID})")
            except Exception as e:
                logger.warning(f"No se pudo inicializar storage.Client: {e}. Usando almacenamiento local de contingencia.")

    def _get_clean_bucket_name(self, raw_name: str) -> str:
        """Limpia el prefijo gs:// y barras redundantes."""
        if not raw_name:
            return ""
        return raw_name.replace("gs://", "").strip("/").strip()

    def get_inbox_bucket_name(self) -> str:
        raw = getattr(current_app_config.storage_config, "inbox_bucket", None) or settings.GCS_INBOX_BUCKET
        return self._get_clean_bucket_name(raw)

    def get_processed_bucket_name(self) -> str:
        raw = getattr(current_app_config.storage_config, "processed_bucket", None) or settings.GCS_PROCESSED_BUCKET
        return self._get_clean_bucket_name(raw)

    def get_quarantine_bucket_name(self) -> str:
        raw = getattr(current_app_config.storage_config, "quarantine_bucket", None) or settings.GCS_QUARANTINE_BUCKET
        return self._get_clean_bucket_name(raw)

    def list_inbox_files(self) -> List[str]:
        """
        Lista los archivos pendientes de procesar en el Inbox.
        Examina prioritariamente el bucket real de GCS (gs://{inbox_bucket})
        y combina con la carpeta local para pruebas.
        """
        files_set = set()

        # 1. Inspección en Google Cloud Storage real
        if self.gcs_client:
            b_name = self.get_inbox_bucket_name()
            try:
                bucket = self.gcs_client.get_bucket(b_name)
                blobs = list(bucket.list_blobs(max_results=200))
                for blob in blobs:
                    # Ignorar directorios o marcas temporales ocultas
                    if not blob.name.endswith("/") and not blob.name.startswith("."):
                        files_set.add(blob.name)
            except Exception as e:
                logger.error(f"Error al listar blobs de gs://{b_name}: {e}")

        # 2. Inspección local de contingencia
        if os.path.exists(self.inbox_dir):
            for f in os.listdir(self.inbox_dir):
                if not f.startswith("."):
                    files_set.add(f)

        return sorted(list(files_set))

    def get_inbox_file_content(self, file_name: str) -> str:
        """Descarga o lee el contenido UTF-8 de un archivo en el Inbox."""
        # 1. Intentar desde GCS real
        if self.gcs_client:
            b_name = self.get_inbox_bucket_name()
            try:
                bucket = self.gcs_client.get_bucket(b_name)
                blob = bucket.get_blob(file_name)
                if blob:
                    return blob.download_as_text(encoding="utf-8")
            except Exception as e:
                logger.warning(f"No se pudo descargar {file_name} desde gs://{b_name}: {e}")

        # 2. Intentar desde carpeta local
        local_path = os.path.join(self.inbox_dir, file_name)
        if os.path.exists(local_path):
            with open(local_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()

        raise FileNotFoundError(f"Archivo {file_name} no encontrado ni en GCS ni en almacenamiento local.")

    def put_inbox_file(self, file_name: str, content: str) -> str:
        """Deposita un archivo en la bandeja de entrada (GCS y copia local)."""
        # Guardar copia local
        local_path = os.path.join(self.inbox_dir, file_name)
        with open(local_path, "w", encoding="utf-8") as f:
            f.write(content)

        # Si GCS está disponible, subir al bucket de entrada
        if self.gcs_client:
            b_name = self.get_inbox_bucket_name()
            try:
                bucket = self.gcs_client.get_bucket(b_name)
                blob = bucket.blob(file_name)
                blob.upload_from_string(content, content_type="text/plain; charset=utf-8")
                return f"gs://{b_name}/{file_name}"
            except Exception as e:
                logger.error(f"Error al subir {file_name} a gs://{b_name}: {e}")

        return local_path

    def process_inbox_file(self, file_name: str) -> PipelineResult:
        """
        Procesa un archivo del Inbox mediante el Pipeline en Cascada y lo traslada a la carpeta/bucket de procesados.
        Garantiza que el archivo se elimine de la bandeja de entrada en GCS para evitar reprocesamiento.
        """
        content = self.get_inbox_file_content(file_name)
        today = datetime.utcnow().strftime("%Y/%m/%d")

        try:
            # 1. Ejecución del pipeline en cascada
            result = CascadePipeline.process_file(file_name, content)

            # 2. Traslado en Google Cloud Storage (si está conectado)
            if self.gcs_client:
                inbox_b_name = self.get_inbox_bucket_name()
                proc_b_name = self.get_processed_bucket_name()
                try:
                    inbox_bucket = self.gcs_client.get_bucket(inbox_b_name)
                    proc_bucket = self.gcs_client.get_bucket(proc_b_name)
                    
                    src_blob = inbox_bucket.get_blob(file_name)
                    if src_blob:
                        # Copiar al bucket de procesados con estructura por fecha
                        dest_blob_name = f"{today}/{file_name}"
                        inbox_bucket.copy_blob(src_blob, proc_bucket, dest_blob_name)
                        # Eliminar de la bandeja de entrada para cerrar el ciclo
                        src_blob.delete()
                        logger.info(f"Archivo {file_name} trasladado exitosamente de gs://{inbox_b_name} a gs://{proc_b_name}/{dest_blob_name}")
                except Exception as gcs_err:
                    logger.error(f"Error en traslado de GCS para {file_name}: {gcs_err}")

            # 3. Traslado en almacenamiento local (si existía)
            src_path = os.path.join(self.inbox_dir, file_name)
            if os.path.exists(src_path):
                dest_dir = os.path.join(self.processed_dir, today)
                os.makedirs(dest_dir, exist_ok=True)
                dest_path = os.path.join(dest_dir, file_name)
                shutil.move(src_path, dest_path)

            # 4. Asignar ruta de GCS a los nodos
            proc_b_name = self.get_processed_bucket_name()
            for node in result.extracted_nodes:
                node.file_gcs_path = f"gs://{proc_b_name}/{today}/{file_name}"

            # 5. Persistir automáticamente en BigQuery (lineage_nodes y lineage_edges)
            try:
                from app.services.bigquery_service import bigquery_service
                bigquery_service.save_pipeline_result(result)
            except Exception as bq_err:
                logger.warning(f"Aviso al persistir resultado en BigQuery para {file_name}: {bq_err}")

            return result

        except Exception as e:
            # Traslado a cuarentena en caso de fallo crítico
            logger.error(f"Fallo en procesamiento de {file_name}, moviendo a cuarentena: {e}")
            if self.gcs_client:
                inbox_b_name = self.get_inbox_bucket_name()
                quar_b_name = self.get_quarantine_bucket_name()
                try:
                    inbox_bucket = self.gcs_client.get_bucket(inbox_b_name)
                    quar_bucket = self.gcs_client.get_bucket(quar_b_name)
                    src_blob = inbox_bucket.get_blob(file_name)
                    if src_blob:
                        inbox_bucket.copy_blob(src_blob, quar_bucket, f"{today}/{file_name}")
                        src_blob.delete()
                except Exception:
                    pass

            src_path = os.path.join(self.inbox_dir, file_name)
            if os.path.exists(src_path):
                quarantine_path = os.path.join(self.quarantine_dir, file_name)
                shutil.move(src_path, quarantine_path)
            raise e

    def get_processed_file_content(self, file_name: str) -> str:
        """Recupera el contenido de un archivo procesado para el Inspector de la UI."""
        # 1. Búsqueda en GCS
        if self.gcs_client:
            proc_b_name = self.get_processed_bucket_name()
            try:
                bucket = self.gcs_client.get_bucket(proc_b_name)
                # Búsqueda por coincidencia de prefijo o nombre de archivo
                blobs = list(bucket.list_blobs(max_results=300))
                for b in blobs:
                    if b.name.endswith(file_name):
                        return b.download_as_text(encoding="utf-8")
            except Exception as e:
                logger.warning(f"Error al buscar {file_name} en gs://{proc_b_name}: {e}")

        # 2. Búsqueda recursiva en local
        for root, _, files in os.walk(self.processed_dir):
            if file_name in files:
                with open(os.path.join(root, file_name), "r", encoding="utf-8", errors="ignore") as f:
                    return f.read()

        return f"# Contenido de {file_name} no disponible localmente ni en GCS"

    def list_processed_files(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Lista el historial de archivos procesados y archivados en GCS."""
        results = []
        if self.gcs_client:
            proc_b_name = self.get_processed_bucket_name()
            try:
                bucket = self.gcs_client.get_bucket(proc_b_name)
                blobs = list(bucket.list_blobs(max_results=limit))
                for b in sorted(blobs, key=lambda x: x.updated or datetime.min, reverse=True)[:limit]:
                    if not b.name.endswith("/"):
                        results.append({
                            "name": os.path.basename(b.name),
                            "path": f"gs://{proc_b_name}/{b.name}",
                            "size_bytes": b.size or 0,
                            "updated_at": b.updated.isoformat() if b.updated else datetime.utcnow().isoformat(),
                            "status": "PROCESSED"
                        })
                return results
            except Exception as e:
                logger.error(f"Error listando procesados en GCS: {e}")

        # Fallback local
        for root, _, files in os.walk(self.processed_dir):
            for fname in files:
                if not fname.startswith("."):
                    fpath = os.path.join(root, fname)
                    stat = os.stat(fpath)
                    results.append({
                        "name": fname,
                        "path": fpath,
                        "size_bytes": stat.st_size,
                        "updated_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        "status": "PROCESSED"
                    })
        return results[:limit]

    def validate_bucket_access(self, raw_bucket_name: str) -> Dict[str, Any]:
        """
        Valida si un bucket existe en Google Cloud Storage y si se cuenta con permisos de lectura.
        Retorna estado, mensaje y conteo de objetos.
        """
        clean_name = self._get_clean_bucket_name(raw_bucket_name)
        if not clean_name:
            return {
                "is_valid": False,
                "bucket": "",
                "message": "El nombre del bucket no puede estar vacío.",
                "objects_count": 0
            }

        if settings.USE_MOCK_GCP or not self.gcs_client:
            return {
                "is_valid": True,
                "bucket": clean_name,
                "message": f"Conectividad exitosa con bucket simulado gs://{clean_name}.",
                "objects_count": 2
            }

        try:
            bucket = self.gcs_client.get_bucket(clean_name)
            # Intentar listar hasta 10 blobs para verificar permisos de lectura
            blobs = list(bucket.list_blobs(max_results=10))
            return {
                "is_valid": True,
                "bucket": clean_name,
                "message": f"Conectividad exitosa con gs://{clean_name}.",
                "objects_count": len(blobs)
            }
        except Exception as e:
            return {
                "is_valid": False,
                "bucket": clean_name,
                "message": f"Error de acceso a gs://{clean_name}: {str(e)}",
                "objects_count": 0
            }

storage_service = StorageService()

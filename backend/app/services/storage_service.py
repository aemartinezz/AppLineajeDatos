import os
import shutil
from datetime import datetime
from typing import List, Dict, Any, Tuple
from app.config import settings
from app.engine.cascade_pipeline import CascadePipeline
from app.models.schemas import PipelineResult

class StorageService:
    """
    Gestiona la ingesta de archivos y su ciclo de vida:
    - Lectura desde Inbox (Local o gs://lineage-inbox)
    - Procesamiento por el Pipeline en Cascada
    - Traslado a Processed (gs://lineage-processed/YYYY/MM/DD/)
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

    def list_inbox_files(self) -> List[str]:
        """Lista los archivos pendientes de procesar en el Inbox."""
        if not os.path.exists(self.inbox_dir):
            return []
        return [f for f in os.listdir(self.inbox_dir) if not f.startswith(".")]

    def put_inbox_file(self, file_name: str, content: str) -> str:
        """Deposita un archivo en la bandeja de entrada para su procesamiento."""
        target_path = os.path.join(self.inbox_dir, file_name)
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(content)
        return target_path

    def process_inbox_file(self, file_name: str) -> PipelineResult:
        """Procesa un archivo del Inbox y lo traslada a la carpeta de procesados."""
        src_path = os.path.join(self.inbox_dir, file_name)
        if not os.path.exists(src_path):
            raise FileNotFoundError(f"Archivo no encontrado en Inbox: {file_name}")

        with open(src_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        try:
            # 1. Ejecución del pipeline en cascada
            result = CascadePipeline.process_file(file_name, content)
            
            # 2. Traslado exitoso a processed/YYYY/MM/DD/
            today = datetime.utcnow().strftime("%Y/%m/%d")
            dest_dir = os.path.join(self.processed_dir, today)
            os.makedirs(dest_dir, exist_ok=True)
            
            dest_path = os.path.join(dest_dir, file_name)
            shutil.move(src_path, dest_path)
            
            # Guardar referencia del path final
            for node in result.extracted_nodes:
                node.file_gcs_path = f"gs://{settings.GCS_PROCESSED_BUCKET}/{today}/{file_name}"
            
            return result
        except Exception as e:
            # Traslado a cuarentena si falló de forma crítica
            quarantine_path = os.path.join(self.quarantine_dir, file_name)
            shutil.move(src_path, quarantine_path)
            raise e

    def get_processed_file_content(self, file_name: str) -> str:
        """Recupera el contenido de un archivo procesado para el Inspector de la UI."""
        # Búsqueda recursiva en processed/
        for root, _, files in os.walk(self.processed_dir):
            if file_name in files:
                with open(os.path.join(root, file_name), "r", encoding="utf-8", errors="ignore") as f:
                    return f.read()
        return f"# Contenido de {file_name} no disponible localmente (archivado en GCS)"

storage_service = StorageService()

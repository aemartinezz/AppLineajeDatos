import os
from pydantic_settings import BaseSettings
from app.models.schemas import AppConfig, ModelConfig, StorageConfig

class Settings(BaseSettings):
    PROJECT_NAME: str = "Lineage End-to-End & Observability"
    GCP_PROJECT_ID: str = os.getenv("GCP_PROJECT_ID", "crp-poc-it-hackathon-13")
    BQ_DATASET: str = os.getenv("BQ_DATASET", "lineage_metadata")
    
    GCS_INBOX_BUCKET: str = os.getenv("GCS_INBOX_BUCKET", "lineage-inbox")
    GCS_PROCESSED_BUCKET: str = os.getenv("GCS_PROCESSED_BUCKET", "lineage-processed")
    GCS_QUARANTINE_BUCKET: str = os.getenv("GCS_QUARANTINE_BUCKET", "lineage-quarantine")
    
    # Modo Local / Simulado si no hay credenciales GCP activas
    USE_MOCK_GCP: bool = os.getenv("USE_MOCK_GCP", "true").lower() in ("true", "1", "yes")
    
    VERTEX_AI_LOCATION: str = os.getenv("VERTEX_AI_LOCATION", "us-central1")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    
    HOST: str = "0.0.0.0"
    PORT: int = int(os.getenv("PORT", "8000"))
    
    LOCAL_STORAGE_DIR: str = os.getenv("LOCAL_STORAGE_DIR", "./local_storage")

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()

# Configuración en memoria con persistencia dinámica
current_app_config = AppConfig(
    app_name="Plataforma de Linaje End-to-End",
    subtitle="Observabilidad y Linaje de Datos Multi-Herramienta",
    models_settings=ModelConfig(),
    storage_config=StorageConfig(
        inbox_bucket=f"gs://{settings.GCS_INBOX_BUCKET}",
        processed_bucket=f"gs://{settings.GCS_PROCESSED_BUCKET}",
        quarantine_bucket=f"gs://{settings.GCS_QUARANTINE_BUCKET}",
        gcp_project_id=settings.GCP_PROJECT_ID,
        bq_dataset=settings.BQ_DATASET
    )
)

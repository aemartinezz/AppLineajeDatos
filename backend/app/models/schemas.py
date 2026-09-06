from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime

class ToolType(str, Enum):
    CONTROL_M = "CONTROL_M"
    SHELL = "SHELL"
    DATASTAGE = "DATASTAGE"
    AIRFLOW_COMPOSER = "AIRFLOW_COMPOSER"
    BIGQUERY = "BIGQUERY"
    SQL_SCRIPT = "SQL_SCRIPT"
    PYTHON_SCRIPT = "PYTHON_SCRIPT"
    GENERIC_TOOL = "GENERIC_TOOL"
    UNKNOWN = "UNKNOWN"

class RelationType(str, Enum):
    EXECUTES = "EXECUTES"
    TRIGGERS = "TRIGGERS"
    LOADS_INTO = "LOADS_INTO"
    WRITES_TO = "WRITES_TO"
    READS_FROM = "READS_FROM"
    TRANSFORMS = "TRANSFORMS"
    DEPENDS_ON = "DEPENDS_ON"

class ExecutionStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"

class InferenceMethod(str, Enum):
    DETERMINISTIC_PARSER = "DETERMINISTIC_PARSER"
    HEURISTIC_ML = "HEURISTIC_ML"
    GEMINI_FLASH = "GEMINI_FLASH"
    GEMINI_PRO = "GEMINI_PRO"
    BQ_METADATA = "BQ_METADATA"

class LineageNode(BaseModel):
    id: str
    name: str
    tool_type: ToolType
    layer: str = "PROCESSING"  # INGESTION, PROCESSING, STORAGE, ANALYTICS
    file_gcs_path: Optional[str] = None
    status: ExecutionStatus = ExecutionStatus.PENDING
    status_updated_at: Optional[datetime] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class LineageEdge(BaseModel):
    id: str
    source_id: str
    target_id: str
    relation_type: RelationType
    confidence_score: float = Field(ge=0.0, le=1.0, default=1.0)
    inference_method: InferenceMethod = InferenceMethod.DETERMINISTIC_PARSER
    evidence_snippet: Optional[str] = None
    source_column: Optional[str] = None  # Preparado para Fase 2 (Nivel Columna)
    target_column: Optional[str] = None  # Preparado para Fase 2 (Nivel Columna)
    transformation_logic: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class LineageGraph(BaseModel):
    nodes: List[LineageNode]
    edges: List[LineageEdge]
    total_nodes: int
    total_edges: int
    execution_date: str

class PipelineResult(BaseModel):
    file_name: str
    detected_tool: ToolType
    detected_by: str
    extracted_edges: List[LineageEdge]
    extracted_nodes: List[LineageNode]
    cascade_level_reached: int
    confidence_score: float
    raw_snippet: Optional[str] = None
    processing_time_ms: float

class ModelConfig(BaseModel):
    light_model_name: str = "gemini-1.5-flash"
    light_temperature: float = 0.1
    light_max_tokens: int = 1024
    escalate_confidence_threshold: float = 0.85
    advanced_model_name: str = "gemini-1.5-pro"
    advanced_temperature: float = 0.1

class StorageConfig(BaseModel):
    inbox_bucket: str = "gs://lineage-inbox"
    processed_bucket: str = "gs://lineage-processed"
    quarantine_bucket: str = "gs://lineage-quarantine"
    gcp_project_id: str = "crp-poc-it-hackathon-13"
    bq_dataset: str = "lineage_metadata"

class AppConfig(BaseModel):
    app_name: str = "Plataforma de Linaje End-to-End"
    subtitle: str = "Observabilidad y Linaje de Datos Multi-Herramienta"
    models_settings: ModelConfig = Field(default_factory=ModelConfig)
    storage_config: StorageConfig = Field(default_factory=StorageConfig)
    default_confidence_threshold: float = 0.80
    realtime_poll_interval_sec: int = 5
    layout_type: str = "dagre-horizontal"

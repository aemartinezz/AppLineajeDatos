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
    monthly_budget_usd: float = 50.0
    alert_threshold_pct: float = 80.0

class StorageConfig(BaseModel):
    inbox_bucket: str = "gs://lineage-inbox"
    processed_bucket: str = "gs://lineage-processed"
    quarantine_bucket: str = "gs://lineage-quarantine"
    gcp_project_id: str = "crp-poc-it-hackathon-13"
    bq_dataset: str = "lineage_metadata"
    monitored_projects: List[str] = Field(default_factory=lambda: ["crp-poc-it-hackathon-13"])
    service_account: Optional[str] = "sa-applineaje-backend@crp-poc-it-hackathon-13.iam.gserviceaccount.com"

class AppConfig(BaseModel):
    app_name: str = "Plataforma de Linaje End-to-End"
    subtitle: str = "Observabilidad y Linaje de Datos Multi-Herramienta"
    models_settings: ModelConfig = Field(default_factory=ModelConfig)
    storage_config: StorageConfig = Field(default_factory=StorageConfig)
    default_confidence_threshold: float = 0.80
    realtime_poll_interval_sec: int = 5
    layout_type: str = "dagre-horizontal"

class LoginRequest(BaseModel):
    email: str
    name: Optional[str] = None

class UserUpsertRequest(BaseModel):
    email: str
    name: str
    roles: List[str]
    status: str = "ACTIVE"

class UserStatusUpdateRequest(BaseModel):
    status: str

class ModelUsageLog(BaseModel):
    id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    model_name: str
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    source_file: Optional[str] = None
    confidence_score: Optional[float] = None
    status: str = "SUCCESS"

class ModelCostSummary(BaseModel):
    total_cost_usd: float = 0.0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_calls: int = 0
    budget_limit_usd: float = 50.0  # Umbral mensual configurable
    budget_consumed_percentage: float = 0.0
    alert_triggered: bool = False
    cost_by_model: Dict[str, float] = Field(default_factory=dict)
    tokens_by_model: Dict[str, int] = Field(default_factory=dict)
    last_updated: datetime = Field(default_factory=datetime.utcnow)

class AppError(BaseModel):
    error_id: str
    error_type: str
    message: str
    stack_trace: Optional[str] = None
    component: str = "BACKEND"
    severity: str = "WARNING"  # CRITICAL, WARNING, INFO
    url: Optional[str] = None
    user_agent: Optional[str] = None
    context_data: Optional[Dict[str, Any]] = None
    occurrence_count: int = 1
    first_seen: datetime = Field(default_factory=datetime.utcnow)
    last_seen: datetime = Field(default_factory=datetime.utcnow)
    status: str = "OPEN"  # OPEN, RESOLVED
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None

class ErrorResolveRequest(BaseModel):
    resolved_by: Optional[str] = "admin"

class ErrorReportRequest(BaseModel):
    error_type: str
    message: Optional[str] = None
    error_message: Optional[str] = None
    stack_trace: Optional[str] = None
    component: str = "FRONTEND"
    severity: str = "WARNING"
    url: Optional[str] = None
    user_agent: Optional[str] = None
    context_data: Optional[Dict[str, Any]] = None

    def get_effective_message(self) -> str:
        return self.message or self.error_message or "Error sin descripción"

class GcpProjectValidationRequest(BaseModel):
    project_id: str

class GcpProjectValidationResponse(BaseModel):
    project_id: str
    is_valid: bool
    message: str
    datasets_found: List[str] = []
    tables_count: int = 0

class GcpBucketValidationRequest(BaseModel):
    bucket_name: str

class GcpBucketValidationResponse(BaseModel):
    bucket_name: str
    is_valid: bool
    message: str
    objects_count: int = 0

class GcpDatasetValidationRequest(BaseModel):
    dataset_name: str
    project_id: Optional[str] = None

class GcpDatasetValidationResponse(BaseModel):
    dataset_name: str
    project_id: str
    is_valid: bool
    message: str
    tables_count: int = 0





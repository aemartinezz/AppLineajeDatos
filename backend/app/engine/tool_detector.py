import os
import re
from typing import Tuple
from app.models.schemas import ToolType

class ToolDetector:
    """
    Detector agnóstico y universal de herramientas y lenguajes.
    Identifica la tecnología a partir de:
    1. Metadatos (nombre de archivo y extensión).
    2. Firmas de contenido (shebangs, imports, comandos CLI).
    3. Clasificador heurístico de respaldo.
    """
    
    # Patrones por extensión
    EXTENSION_MAP = {
        ".sh": ToolType.SHELL,
        ".bash": ToolType.SHELL,
        ".ksh": ToolType.SHELL,
        ".zsh": ToolType.SHELL,
        ".sql": ToolType.SQL_SCRIPT,
        ".bq": ToolType.SQL_SCRIPT,
        ".py": ToolType.PYTHON_SCRIPT,
        ".dsx": ToolType.DATASTAGE,
        ".isx": ToolType.DATASTAGE,
        ".dbt": ToolType.SQL_SCRIPT,
    }

    # Firmas de contenido
    SIGNATURES = [
        # Control-M
        (r"<SMART_FOLDER|<JOB\s+NAME|ctmorder|ctmvar", ToolType.CONTROL_M, "CONTROL_M_XML_OR_CLI"),
        # DataStage
        (r"BEGIN\s+DSJOB|dsjob\s+-run|InfoSphere\s+DataStage|DSR_PROJECT", ToolType.DATASTAGE, "DATASTAGE_SIGNATURE"),
        # Cloud Composer / Airflow
        (r"from\s+airflow|import\s+airflow|DAG\(|BigQueryInsertJobOperator|BashOperator", ToolType.AIRFLOW_COMPOSER, "AIRFLOW_SIGNATURE"),
        # BigQuery SQL / Routine
        (r"CREATE\s+OR\s+REPLACE\s+(TABLE|VIEW|PROCEDURE|FUNCTION)|MERGE\s+INTO|`[a-zA-Z0-9_\-]+(\.[a-zA-Z0-9_\-]+){2}`", ToolType.BIGQUERY, "BIGQUERY_DDL_DML"),
        # Shell CLI directos
        (r"^#!\s*/bin/(bash|sh|ksh)|gcloud\s+composer|bq\s+(query|load|extract)", ToolType.SHELL, "SHELL_SHEBANG_OR_GCLOUD"),
    ]

    @classmethod
    def detect(cls, file_name: str, content: str) -> Tuple[ToolType, str, float]:
        """
        Retorna: (ToolType, metodo_deteccion, confianza_inicial)
        """
        ext = os.path.splitext(file_name)[1].lower()
        
        # 1. Inspección de firmas de contenido prioritarias
        for pattern, tool_type, method_name in cls.SIGNATURES:
            if re.search(pattern, content, re.IGNORECASE | re.MULTILINE):
                # Caso especial: Python que es Airflow
                if tool_type == ToolType.AIRFLOW_COMPOSER:
                    return ToolType.AIRFLOW_COMPOSER, method_name, 1.0
                return tool_type, method_name, 1.0
        
        # 2. Mapeo por extensión si no hubo firma directa
        if ext in cls.EXTENSION_MAP:
            return cls.EXTENSION_MAP[ext], f"EXTENSION_{ext.upper()}", 0.95

        # 3. Inspección heurística de logs
        if "ERROR" in content or "INFO" in content or "DEBUG" in content or "WARN" in content:
            if "bqjob_" in content or "bigquery.googleapis.com" in content:
                return ToolType.BIGQUERY, "LOG_SIGNATURE_BQ", 0.90
            if "dsjob" in content:
                return ToolType.DATASTAGE, "LOG_SIGNATURE_DATASTAGE", 0.90
            if "control-m" in content.lower() or "ctm" in content.lower():
                return ToolType.CONTROL_M, "LOG_SIGNATURE_CONTROLM", 0.90
            return ToolType.GENERIC_TOOL, "GENERIC_LOG_CONTAINER", 0.70

        return ToolType.UNKNOWN, "UNKNOWN_SOURCE", 0.30

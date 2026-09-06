import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.config import settings, current_app_config
from app.models.schemas import (
    LineageNode, LineageEdge, LineageGraph, ExecutionStatus,
    AppConfig, ModelConfig, StorageConfig, ToolType, RelationType, InferenceMethod
)
from app.engine.bigquery_metadata import BigQueryMetadataExtractor
from app.engine.lineage_linker import LineageLinker

class BigQueryService:
    """
    Servicio de Base de Datos Unificada en BigQuery:
    - lineage_nodes
    - lineage_edges
    - execution_status_daily
    - app_configurations
    Incluye fallback en memoria para ejecución local inmediata sin credenciales.
    """

    def __init__(self):
        self.nodes_store: Dict[str, LineageNode] = {}
        self.edges_store: Dict[str, LineageEdge] = {}
        self.status_store: Dict[str, Dict[str, Any]] = {}
        self.init_demo_data()

    def init_demo_data(self):
        """Inicializa una topología base de ejemplo para arranque local."""
        # 1. Componentes iniciales de prueba (Control-M -> Shell -> DataStage -> Composer)
        n1 = LineageNode(id="CONTROL_M:JOB_DIARIO_VENTAS", name="JOB_DIARIO_VENTAS", tool_type=ToolType.CONTROL_M, layer="INGESTION", status=ExecutionStatus.SUCCESS)
        n2 = LineageNode(id="SHELL:extract_oracle.sh", name="extract_oracle.sh", tool_type=ToolType.SHELL, layer="INGESTION", status=ExecutionStatus.SUCCESS)
        n3 = LineageNode(id="DATASTAGE:DS_LOAD_STAGING", name="DS_LOAD_STAGING", tool_type=ToolType.DATASTAGE, layer="PROCESSING", status=ExecutionStatus.RUNNING)
        n4 = LineageNode(id="AIRFLOW_COMPOSER:dag_ventas_analytics", name="dag_ventas_analytics", tool_type=ToolType.AIRFLOW_COMPOSER, layer="PROCESSING", status=ExecutionStatus.PENDING)
        
        self.nodes_store[n1.id] = n1
        self.nodes_store[n2.id] = n2
        self.nodes_store[n3.id] = n3
        self.nodes_store[n4.id] = n4

        # 2. Relaciones entre componentes externos
        e1 = LineageEdge(id=f"{n1.id}->{n2.id}", source_id=n1.id, target_id=n2.id, relation_type=RelationType.EXECUTES, confidence_score=1.0, inference_method=InferenceMethod.DETERMINISTIC_PARSER, evidence_snippet="Control-M command=/opt/scripts/extract_oracle.sh")
        e2 = LineageEdge(id=f"{n2.id}->{n3.id}", source_id=n2.id, target_id=n3.id, relation_type=RelationType.TRIGGERS, confidence_score=0.92, inference_method=InferenceMethod.GEMINI_FLASH, evidence_snippet="Shell ejecuta dsjob -run DS_LOAD_STAGING $FECHA")
        e3 = LineageEdge(id=f"{n3.id}->BIGQUERY:stg_transacciones_raw", source_id=n3.id, target_id="BIGQUERY:stg_transacciones_raw", relation_type=RelationType.LOADS_INTO, confidence_score=1.0, inference_method=InferenceMethod.DETERMINISTIC_PARSER, evidence_snippet="DataStage carga tabla BigQuery stg_transacciones_raw")
        e4 = LineageEdge(id=f"{n4.id}->BIGQUERY:sp_procesar_transacciones", source_id=n4.id, target_id="BIGQUERY:sp_procesar_transacciones", relation_type=RelationType.TRIGGERS, confidence_score=1.0, inference_method=InferenceMethod.DETERMINISTIC_PARSER, evidence_snippet="Composer task invoca sp_procesar_transacciones()")
        
        self.edges_store[e1.id] = e1
        self.edges_store[e2.id] = e2
        self.edges_store[e3.id] = e3
        self.edges_store[e4.id] = e4

    def save_pipeline_result(self, nodes: List[LineageNode], edges: List[LineageEdge]):
        """Persiste nuevos nodos y aristas descubiertos."""
        for n in nodes:
            self.nodes_store[n.id] = n
        for e in edges:
            self.edges_store[e.id] = e

    def get_full_graph(self, min_confidence: float = 0.0) -> LineageGraph:
        """Fusiona el linaje externo con la metadata nativa de BigQuery y filtra por certeza."""
        # 1. Obtener linaje nativo de BigQuery
        bq_data = BigQueryMetadataExtractor.get_native_lineage(settings.GCP_PROJECT_ID, settings.BQ_DATASET)
        
        # 2. Fusionar con LineageLinker
        full_graph = LineageLinker.fuse_graph(
            external_nodes=list(self.nodes_store.values()),
            external_edges=list(self.edges_store.values()),
            bq_nodes=bq_data["nodes"],
            bq_edges=bq_data["edges"],
            execution_date=datetime.utcnow().strftime("%Y-%m-%d")
        )

        # 3. Filtrar aristas por umbral de certeza
        filtered_edges = [e for e in full_graph.edges if e.confidence_score >= min_confidence]
        
        # Retener solo nodos conectados si se filtra
        connected_node_ids = set()
        for e in filtered_edges:
            connected_node_ids.add(e.source_id)
            connected_node_ids.add(e.target_id)
            
        filtered_nodes = [n for n in full_graph.nodes if n.id in connected_node_ids or len(filtered_edges) == 0]

        return LineageGraph(
            nodes=filtered_nodes,
            edges=filtered_edges,
            total_nodes=len(filtered_nodes),
            total_edges=len(filtered_edges),
            execution_date=full_graph.execution_date
        )

    def update_node_status(self, node_id: str, status: ExecutionStatus):
        """Actualiza el estado operativo en vivo para la telemetría del día."""
        if node_id in self.nodes_store:
            self.nodes_store[node_id].status = status
            self.nodes_store[node_id].status_updated_at = datetime.utcnow()
        self.status_store[node_id] = {
            "status": status.value,
            "updated_at": datetime.utcnow().isoformat()
        }

    def get_app_config(self) -> AppConfig:
        return current_app_config

    def update_app_config(self, new_config: AppConfig) -> AppConfig:
        global current_app_config
        current_app_config = new_config
        return current_app_config

bigquery_service = BigQueryService()

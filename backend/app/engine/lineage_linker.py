from typing import List, Dict
from app.models.schemas import LineageNode, LineageEdge, LineageGraph

class LineageLinker:
    """
    Motor de Fusión de Linaje End-to-End:
    Une los eslabones externos (Control-M -> Shell -> DataStage -> Composer)
    con el catálogo y linaje interno de BigQuery.
    """

    @classmethod
    def fuse_graph(cls, external_nodes: List[LineageNode], external_edges: List[LineageEdge], bq_nodes: List[LineageNode], bq_edges: List[LineageEdge], execution_date: str) -> LineageGraph:
        node_map: Dict[str, LineageNode] = {}
        edge_map: Dict[str, LineageEdge] = {}

        # 1. Registrar nodos externos
        for node in external_nodes:
            norm_id = cls._normalize_node_id(node.id)
            node.id = norm_id
            node_map[norm_id] = node

        # 2. Registrar nodos de BigQuery
        for node in bq_nodes:
            norm_id = cls._normalize_node_id(node.id)
            node.id = norm_id
            if norm_id in node_map:
                # Combinar metadatos
                node_map[norm_id].metadata.update(node.metadata)
            else:
                node_map[norm_id] = node

        # 3. Registrar aristas externas
        for edge in external_edges:
            src = cls._normalize_node_id(edge.source_id)
            tgt = cls._normalize_node_id(edge.target_id)
            edge.source_id = src
            edge.target_id = tgt
            edge.id = f"{src}->{tgt}"
            edge_map[edge.id] = edge

        # 4. Registrar aristas de BigQuery
        for edge in bq_edges:
            src = cls._normalize_node_id(edge.source_id)
            tgt = cls._normalize_node_id(edge.target_id)
            edge.source_id = src
            edge.target_id = tgt
            edge.id = f"{src}->{tgt}"
            edge_map[edge.id] = edge

        # 5. El Puente de Fusión (Linkage Bridge) e Integridad Referencial Absoluta:
        from app.models.schemas import ToolType
        for edge in list(edge_map.values()):
            # A. Resolver Target si falta
            if edge.target_id not in node_map:
                tgt_name = edge.target_id.split(":")[-1]
                matched_id = None
                for n_id in node_map.keys():
                    if n_id.endswith(f".{tgt_name}") or n_id == f"BIGQUERY:{tgt_name}":
                        matched_id = n_id
                        break
                if matched_id:
                    edge.target_id = matched_id
                else:
                    parts = edge.target_id.split(":", 1)
                    tool = parts[0] if len(parts) > 1 else "BIGQUERY"
                    name = parts[1] if len(parts) > 1 else edge.target_id
                    t_type = ToolType(tool) if tool in [t.value for t in ToolType] else ToolType.BIGQUERY
                    synth_node = LineageNode(
                        id=edge.target_id,
                        name=name,
                        tool_type=t_type,
                        layer="STORAGE" if t_type == ToolType.BIGQUERY else "PROCESSING"
                    )
                    node_map[edge.target_id] = synth_node

            # B. Resolver Source si falta
            if edge.source_id not in node_map:
                src_name = edge.source_id.split(":")[-1]
                matched_id = None
                for n_id in node_map.keys():
                    if n_id.endswith(f".{src_name}") or n_id == f"SHELL:{src_name}":
                        matched_id = n_id
                        break
                if matched_id:
                    edge.source_id = matched_id
                else:
                    parts = edge.source_id.split(":", 1)
                    tool = parts[0] if len(parts) > 1 else "GENERIC_TOOL"
                    name = parts[1] if len(parts) > 1 else edge.source_id
                    t_type = ToolType(tool) if tool in [t.value for t in ToolType] else ToolType.GENERIC_TOOL
                    synth_node = LineageNode(
                        id=edge.source_id,
                        name=name,
                        tool_type=t_type,
                        layer="INGESTION" if "GCS" in edge.source_id or "INBOX" in edge.source_id else "PROCESSING"
                    )
                    node_map[edge.source_id] = synth_node

        nodes_list = list(node_map.values())
        edges_list = list(edge_map.values())

        return LineageGraph(
            nodes=nodes_list,
            edges=edges_list,
            total_nodes=len(nodes_list),
            total_edges=len(edges_list),
            execution_date=execution_date
        )

    @staticmethod
    def _normalize_node_id(raw_id: str) -> str:
        """Normaliza los identificadores de nodos para evitar colisiones o discrepancias de prefijo."""
        if not raw_id:
            return "UNKNOWN"
        parts = raw_id.split(":", 1)
        if len(parts) == 2:
            tool, name = parts
            clean_name = name.strip("`'\"").split("/")[-1] # Tomar nombre base si es ruta
            return f"{tool.upper()}:{clean_name}"
        return raw_id.strip()

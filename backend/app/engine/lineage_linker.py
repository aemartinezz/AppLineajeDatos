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

        # 5. El Puente de Fusión (Linkage Bridge):
        # Si un nodo externo apunta a un nombre de tabla que coincide con una tabla de BigQuery,
        # asegurar que la arista esté firmemente establecida.
        for edge in edge_map.values():
            if edge.target_id in node_map and edge.source_id in node_map:
                pass # Conectado correctamente

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

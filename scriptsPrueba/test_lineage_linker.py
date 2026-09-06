import sys
import os

# Agregar path de backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from app.services.bigquery_service import bigquery_service

def run_tests():
    print("[TEST] Probando Motor de Fusión y Linaje End-to-End...")
    
    # Obtener grafo completo con umbral por defecto
    graph = bigquery_service.get_full_graph(min_confidence=0.50)
    
    # Verificar que el grafo contenga tanto componentes externos como BigQuery
    tools_found = set(n.tool_type.value for n in graph.nodes)
    has_controlm = "CONTROL_M" in tools_found
    has_shell = "SHELL" in tools_found
    has_datastage = "DATASTAGE" in tools_found
    has_bq = "BIGQUERY" in tools_found

    is_complete = has_controlm and has_shell and has_datastage and has_bq
    
    print(f"  Herramientas descubiertas en el grafo: {tools_found}")
    print(f"  Total Nodos: {graph.total_nodes}, Total Aristas: {graph.total_edges}")

    if is_complete:
        print("  [OK] El grafo fusiona exitosamente la cadena Control-M -> Shell -> DataStage -> BigQuery.")
    else:
        print("  [FAIL] Faltan herramientas en la cadena de fusión.")

    return {
        "suite": "LineageLinker",
        "total_nodes": graph.total_nodes,
        "total_edges": graph.total_edges,
        "tools_discovered": list(tools_found),
        "passed": is_complete
    }

if __name__ == "__main__":
    res = run_tests()
    sys.exit(0 if res["passed"] else 1)

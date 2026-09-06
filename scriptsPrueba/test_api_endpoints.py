import sys
import os

# Agregar path de backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def run_tests():
    print("[TEST] Probando Endpoints de la API FastAPI y WebSockets...")
    
    # 1. Health check
    r1 = client.get("/api/health")
    assert r1.status_code == 200, f"Error en /api/health: {r1.status_code}"
    assert r1.json()["status"] == "healthy"
    print("  [OK] /api/health responde con status=healthy")

    # 2. Get lineage graph
    r2 = client.get("/api/lineage/graph?min_confidence=0.5")
    assert r2.status_code == 200, f"Error en /api/lineage/graph: {r2.status_code}"
    graph_data = r2.json()
    assert graph_data["total_nodes"] > 0
    assert graph_data["total_edges"] > 0
    print(f"  [OK] /api/lineage/graph retorna {graph_data['total_nodes']} nodos y {graph_data['total_edges']} aristas")

    # 3. Get / Update Config
    r3 = client.get("/api/config")
    assert r3.status_code == 200
    config_data = r3.json()
    assert "models_settings" in config_data or "app_name" in config_data
    print("  [OK] /api/config responde con la configuración activa")

    # 4. GCP Validate Endpoint
    r4 = client.get("/api/gcp/validate")
    assert r4.status_code == 200
    gcp_data = r4.json()
    assert gcp_data["project_id"] == "crp-poc-it-hackathon-13"
    print(f"  [OK] /api/gcp/validate valida el proyecto {gcp_data['project_id']}")

    # 5. Telemetry Status Update
    r5 = client.post("/api/telemetry/status", data={"node_id": "SHELL:extract_oracle.sh", "status": "RUNNING"})
    assert r5.status_code == 200
    assert r5.json()["success"] is True
    print("  [OK] /api/telemetry/status actualiza el estado del nodo exitosamente")

    return {
        "suite": "ApiEndpoints",
        "health": "OK",
        "nodes_loaded": graph_data["total_nodes"],
        "edges_loaded": graph_data["total_edges"],
        "passed": True
    }

if __name__ == "__main__":
    res = run_tests()
    sys.exit(0 if res["passed"] else 1)

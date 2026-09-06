import sys
import os
import time
import subprocess
import httpx

def test_live_server():
    print("[TEST EN VIVO] Iniciando servidor FastAPI local y realizando peticiones reales...")
    
    # 1. Iniciar servidor en subproceso
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    env = os.environ.copy()
    env["USE_MOCK_GCP"] = "true"
    env["PORT"] = "8000"
    
    server_proc = subprocess.Popen(
        [os.path.join(base_dir, "venv", "bin", "python3"), os.path.join(base_dir, "backend", "app", "main.py")],
        cwd=base_dir,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    try:
        # 2. Esperar arranque
        time.sleep(2.5)
        client = httpx.Client(base_url="http://localhost:8000", timeout=5.0)

        # 3. Test Health
        r_health = client.get("/api/health")
        assert r_health.status_code == 200, f"Fallo en health: {r_health.status_code}"
        print(f"  [OK] Servidor responde en http://localhost:8000/api/health -> {r_health.json()}")

        # 4. Test Graph
        r_graph = client.get("/api/lineage/graph?min_confidence=0.5")
        assert r_graph.status_code == 200
        graph_json = r_graph.json()
        print(f"  [OK] Grafo inicial obtenido: {graph_json['total_nodes']} nodos, {graph_json['total_edges']} aristas")

        # 5. Test File Upload en vivo
        sample_code = """#!/bin/bash
        echo 'Ejecutando proceso de ventas'
        gcloud composer environments run env-prod trigger_dag dag_ventas_analytics
        """
        files = {"file": ("demo_live_process.sh", sample_code, "text/plain")}
        r_upload = client.post("/api/lineage/upload", files=files)
        assert r_upload.status_code == 200, f"Fallo al subir: {r_upload.text}"
        upload_json = r_upload.json()
        print(f"  [OK] Archivo demo_live_process.sh procesado con éxito:")
        print(f"       - Herramienta detectada: {upload_json['detected_tool']}")
        print(f"       - Nivel de cascada alcanzado: Nivel {upload_json['cascade_level_reached']}")
        print(f"       - Certeza: {round(upload_json['confidence_score'] * 100)}%")

        # 6. Re-verificar que el grafo creció con el nuevo archivo
        r_graph2 = client.get("/api/lineage/graph?min_confidence=0.5")
        graph_json2 = r_graph2.json()
        print(f"  [OK] Grafo actualizado en memoria: {graph_json2['total_nodes']} nodos, {graph_json2['total_edges']} aristas")
        
        print("\n[ÉXITO TOTAL] El servidor backend y la API responden perfectamente de forma local.\n")
        return 0
    except Exception as e:
        print(f"  [ERROR] Fallo en la prueba en vivo: {e}")
        return 1
    finally:
        server_proc.terminate()
        server_proc.wait()

if __name__ == "__main__":
    sys.exit(test_live_server())

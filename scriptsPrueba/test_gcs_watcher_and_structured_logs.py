import sys
import os
import json
from fastapi.testclient import TestClient

# Agregar backend al path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from app.engine.cascade_pipeline import CascadePipeline
from app.services.storage_service import storage_service
from app.services.bigquery_service import bigquery_service
from app.main import app

def run_tests():
    print("[TEST] Probando Watcher GCS, Logs Estructurados Nivel 1 y Persistencia BQ...")
    client = TestClient(app)

    # 1. Probar parser estructurado Nivel 1 con log simulado de carga BigQuery
    bq_log_content = """[2026-03-06 20:00:00,120] INFO - Iniciando proceso de carga a BigQuery
{"timestamp": "2026-03-06T20:00:00Z", "event": "DATA_LINEAGE", "source": "gs://bucket-simulado-lineaje/archivos/ejemplotabla1_20260306.csv", "target": "crp-poc-it-hackathon-13.pruebasLineaje.ejemplotabla1", "operation": "LOAD_CSV", "job_id": "bqjob_r123456_stage_to_raw", "rows_inserted": 15000}
{"timestamp": "2026-03-06T20:01:00Z", "event": "TASK_END", "task_id": "cargar_csv_a_bigquery", "status": "SUCCESS"}
"""
    result_bq = CascadePipeline.process_file("carga_bigquery.log", bq_log_content)
    assert result_bq.cascade_level_reached == 1, f"Se esperaba Nivel 1 pero se obtuvo Nivel {result_bq.cascade_level_reached}"
    assert result_bq.confidence_score == 1.0, f"Se esperaba certeza 1.0 pero se obtuvo {result_bq.confidence_score}"
    
    # Verificar que existen nodos GCS y BigQuery
    node_types = {n.tool_type for n in result_bq.extracted_nodes}
    assert any("bucket" in n.id.lower() or "gs://" in n.id or n.tool_type.value in ["GCS", "GCS_BUCKET"] for n in result_bq.extracted_nodes), "Debe existir nodo de GCS"
    assert any("pruebasLineaje.ejemplotabla1" in n.id for n in result_bq.extracted_nodes), "Debe existir nodo de tabla BigQuery"
    print("  [OK] carga_bigquery.log resuelto en Nivel 1 con 100% de certeza.")

    # 2. Probar parser estructurado Nivel 1 con log simulado de Shell y Airflow
    sh_log_content = """[2026-03-06 19:58:00] [INFO] Script de lanzamiento invocado: /opt/scripts/lanzar_carga_ejemplotabla1.sh
{"timestamp": "2026-03-06T19:58:02Z", "event": "ORCHESTRATION_LINK", "parent_script": "lanzar_carga_ejemplotabla1.sh", "dag_id": "dag_carga_ejemplotabla1", "task_id": "cargar_csv_a_bigquery"}
{"timestamp": "2026-03-06T19:58:05Z", "event": "JOB_SUBMIT", "tool": "AIRFLOW", "target_table": "crp-poc-it-hackathon-13.pruebasLineaje.ejemplotabla1"}
"""
    result_sh = CascadePipeline.process_file("shell_airflow.log", sh_log_content)
    assert result_sh.cascade_level_reached == 1, f"Se esperaba Nivel 1 pero se obtuvo Nivel {result_sh.cascade_level_reached}"
    assert result_sh.confidence_score == 1.0, f"Se esperaba certeza 1.0 pero se obtuvo {result_sh.confidence_score}"
    assert any("lanzar_carga_ejemplotabla1.sh" in n.id for n in result_sh.extracted_nodes), "Debe existir nodo del script Shell"
    assert any("dag_carga_ejemplotabla1" in n.id for n in result_sh.extracted_nodes), "Debe existir nodo del DAG de Airflow"
    print("  [OK] shell_airflow.log resuelto en Nivel 1 enlazando Shell -> Airflow -> BigQuery.")

    # 3. Probar persistencia e hidratación en BigQuery Service
    bigquery_service.save_pipeline_result(result_bq)
    bigquery_service.save_pipeline_result(result_sh)
    persisted_graph = bigquery_service.load_persisted_lineage_from_bigquery()
    assert len(persisted_graph.get("nodes", [])) > 0, "El grafo persistido debe contener nodos"
    assert len(persisted_graph.get("edges", [])) > 0, "El grafo persistido debe contener aristas"
    print(f"  [OK] Persistencia e hidratación de BigQuery exitosa ({len(persisted_graph['nodes'])} nodos, {len(persisted_graph['edges'])} aristas).")

    # 4. Probar endpoints de validación de buckets en FastAPI
    resp_valid = client.post("/api/gcp/validate-bucket", json={"bucket_name": "datosdeentrada"})
    assert resp_valid.status_code == 200
    data_valid = resp_valid.json()
    assert "is_valid" in data_valid
    assert data_valid["is_valid"] is True
    assert "objects_count" in data_valid
    print(f"  [OK] Endpoint /api/gcp/validate-bucket validó correctamente (Status: {resp_valid.status_code}, is_valid: {data_valid['is_valid']}).")

    # 5. Probar listado de archivos procesados
    resp_proc = client.get("/api/lineage/processed")
    assert resp_proc.status_code == 200
    assert "processed_files" in resp_proc.json()
    print("  [OK] Endpoint /api/lineage/processed respondió exitosamente.")

    return {
        "suite": "GcsWatcherAndStructuredLogs",
        "bq_log_level": result_bq.cascade_level_reached,
        "sh_log_level": result_sh.cascade_level_reached,
        "persisted_nodes": len(persisted_graph["nodes"]),
        "persisted_edges": len(persisted_graph["edges"]),
        "passed": True
    }

if __name__ == "__main__":
    res = run_tests()
    sys.exit(0 if res["passed"] else 1)

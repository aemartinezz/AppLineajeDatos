import os
import sys
from fastapi.testclient import TestClient

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
os.environ["USE_MOCK_GCP"] = "true"

from app.main import app
from app.services.bigquery_service import bigquery_service
from app.engine.bigquery_metadata import BigQueryMetadataExtractor

def run_tests():
    client = TestClient(app)
    details = []

    try:
        # 1. Detección Multi-Dataset de BigQuery (incluyendo pruebasLineaje.ejemplotabla1)
        bq_data = BigQueryMetadataExtractor.get_native_lineage(
            project_id="crp-poc-it-hackathon-13",
            dataset_id="applineajedatos",
            bq_client=None
        )
        node_ids = [n.id for n in bq_data["nodes"]]
        assert "BIGQUERY:pruebasLineaje.ejemplotabla1" in node_ids, "Debe detectar pruebasLineaje.ejemplotabla1"
        target_node = next(n for n in bq_data["nodes"] if n.id == "BIGQUERY:pruebasLineaje.ejemplotabla1")
        assert target_node.metadata.get("dataset") == "pruebasLineaje"
        details.append("Detección multi-dataset de pruebasLineaje.ejemplotabla1 y metadata [OK]")

        # 2. Control de Costos de Modelos IA y Alertas de Presupuesto
        usage_flash = bigquery_service.log_model_usage(
            model_name="gemini-1.5-flash",
            input_tokens=15000,
            output_tokens=3000,
            source_file="pipeline.sh"
        )
        assert usage_flash.cost_usd > 0.0
        summary = bigquery_service.get_model_costs_summary()
        assert summary.total_cost_usd > 0.0
        assert "gemini-1.5-flash" in summary.cost_by_model

        # Simular consumo alto para disparar alerta (>= 80% de $50 USD)
        bigquery_service.log_model_usage(
            model_name="gemini-1.5-pro",
            input_tokens=10000000,
            output_tokens=2000000,
            cost_usd=42.0,
            source_file="complex.sql"
        )
        alert_summary = bigquery_service.get_model_costs_summary()
        assert alert_summary.alert_triggered, "Debe disparar alert_triggered >= 80%"
        details.append("Registro de costos por modelo y disparo de alerta de presupuesto [OK]")

        # 3. Ciclo de Vida de Errores y Auto-Reapertura a OPEN
        err = bigquery_service.log_error(
            error_type="BigQueryTimeoutException",
            message="Read timeout after 10000ms",
            stack_trace="Traceback: line 10",
            component="BIGQUERY_ENGINE",
            severity="CRITICAL"
        )
        assert err.status == "OPEN"
        err_id = err.error_id

        # Marcar como Solucionado
        resolved = bigquery_service.resolve_error(err_id, resolved_by="aemartinezz@liverpool.com.mx")
        assert resolved.status == "RESOLVED"

        # La anomalía vuelve a ocurrir -> REAPERTURA AUTOMÁTICA
        reopened = bigquery_service.log_error(
            error_type="BigQueryTimeoutException",
            message="Read timeout after 10000ms",
            stack_trace="Traceback: line 10 (segundo fallo)",
            component="BIGQUERY_ENGINE",
            severity="CRITICAL"
        )
        assert reopened.error_id == err_id
        assert reopened.status == "OPEN", "La incidencia debe reabrirse automáticamente"
        assert reopened.occurrence_count >= 2, "El conteo de ocurrencias debe incrementarse"
        details.append("Ciclo de vida de errores y auto-reapertura a OPEN verificados [OK]")

        # 4. Endpoints API REST de Costos y Errores
        res_costs = client.get("/api/costs/summary")
        assert res_costs.status_code == 200
        assert "total_cost_usd" in res_costs.json()

        res_errs = client.get("/api/errors")
        assert res_errs.status_code == 200
        assert isinstance(res_errs.json(), list)

        res_rep = client.post("/api/errors/report", json={
            "error_type": "FrontendWarning",
            "message": "Render latency warning",
            "component": "FRONTEND_REACT",
            "severity": "WARNING"
        })
        assert res_rep.status_code == 200
        rep_id = res_rep.json()["error_id"]

        res_res = client.post(f"/api/errors/{rep_id}/resolve", json={"resolved_by": "tester"})
        assert res_res.status_code == 200
        assert res_res.json()["status"] == "RESOLVED"
        details.append("Endpoints REST /api/costs/summary y /api/errors [OK]")

        # 5. Metadatos Técnicos y Módulos en Arquitectura Viva
        res_arch = client.get("/api/architecture/graph")
        assert res_arch.status_code == 200
        arch_nodes = res_arch.json()["nodes"]
        assert any(n.get("technology") for n in arch_nodes), "Nodos con tecnología"
        assert any(n.get("side") == "FRONTEND" for n in arch_nodes), "Nodos Frontend"
        assert any(n.get("side") == "BACKEND" for n in arch_nodes), "Nodos Backend"
        assert any(n.get("module_tag") == "GESTION_ERRORES" for n in arch_nodes), "Módulo GESTION_ERRORES"
        details.append("Arquitectura viva enriquecida con tecnología, side y módulos web [OK]")

        return {
            "suite": "Multi-Dataset BigQuery, Control de Costos IA y Gestión de Errores",
            "passed": True,
            "details": details
        }
    except Exception as e:
        return {
            "suite": "Multi-Dataset BigQuery, Control de Costos IA y Gestión de Errores",
            "passed": False,
            "error": str(e),
            "details": details
        }

if __name__ == "__main__":
    r = run_tests()
    print("Resultado:", r)

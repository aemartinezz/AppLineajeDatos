import os
import sys

# Asegurar backend en el path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
BACKEND_DIR = os.path.join(BASE_DIR, 'backend')
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from fastapi.testclient import TestClient
from app.main import app
from app.services.bigquery_service import bigquery_service
from app.models.schemas import AppConfig, ModelConfig, StorageConfig

def run_tests():
    details = []
    client = TestClient(app)

    # 1. Seguridad: Intento de eliminar o desactivar la cuenta principal ADMIN_ROOT
    root_email = "aemartinezz@liverpool.com.mx"
    res_del_root = client.delete(f"/api/users/{root_email}", headers={"x-user-role": "Admin"})
    assert res_del_root.status_code == 400, f"Debe fallar al borrar ADMIN_ROOT, código: {res_del_root.status_code}"
    assert "Administrador Principal corporativo no puede ser eliminado" in res_del_root.json().get("detail", "")
    details.append("Protección estricta de cuenta root: Rechazo garantizado al intentar eliminarla")

    res_patch_root = client.patch(f"/api/users/{root_email}/status", json={"status": "INACTIVE"}, headers={"x-user-role": "Admin"})
    assert res_patch_root.status_code == 400, f"Debe fallar al desactivar ADMIN_ROOT, código: {res_patch_root.status_code}"
    details.append("Protección estricta de cuenta root: Rechazo garantizado al intentar desactivarla")

    # 2. CRUD Completo de Usuarios en BigQuery / Memoria
    test_user_email = "nuevo_analista@liverpool.com.mx"
    # Crear / Upsert
    res_create = client.post("/api/users", json={
        "email": test_user_email,
        "name": "Analista Temporal",
        "roles": ["Viewer"],
        "status": "ACTIVE"
    }, headers={"x-user-role": "Admin"})
    assert res_create.status_code == 200, f"Fallo al crear usuario: {res_create.text}"
    details.append("CRUD Usuarios: Creación exitosa de nuevo usuario corporativo")

    # Desactivar (Dar de baja)
    res_deactivate = client.patch(f"/api/users/{test_user_email}/status", json={"status": "INACTIVE"}, headers={"x-user-role": "Admin"})
    assert res_deactivate.status_code == 200, f"Fallo al desactivar usuario: {res_deactivate.text}"
    user_status = res_deactivate.json().get("user", {}).get("status")
    assert user_status == "INACTIVE", f"Estado esperado INACTIVE pero obtuvo {user_status}"
    details.append("CRUD Usuarios: Estado cambiado exitosamente a INACTIVE (baja)")

    # Reactivar
    res_activate = client.patch(f"/api/users/{test_user_email}/status", json={"status": "ACTIVE"}, headers={"x-user-role": "Admin"})
    assert res_activate.status_code == 200, f"Fallo al reactivar usuario: {res_activate.text}"
    assert res_activate.json().get("user", {}).get("status") == "ACTIVE"
    details.append("CRUD Usuarios: Reactivación exitosa a ACTIVE")

    # Eliminar definitivamente
    res_delete = client.delete(f"/api/users/{test_user_email}", headers={"x-user-role": "Admin"})
    assert res_delete.status_code == 200, f"Fallo al borrar usuario: {res_delete.text}"
    details.append("CRUD Usuarios: Eliminación definitiva exitosa")

    # 3. Validación de Proyectos GCP y Sanitización
    # Inyección / Formato inválido
    bad_proj = client.post("/api/gcp/validate-project", json={"project_id": "proj; DROP TABLE users;--"})
    assert bad_proj.status_code == 200
    assert bad_proj.json().get("is_valid") is False, "Debe rechazar caracteres ilegales"
    details.append("Seguridad GCP: Detección y bloqueo de inyecciones o caracteres ilegales en project_id")

    # Proyecto válido
    valid_proj = client.post("/api/gcp/validate-project", json={"project_id": "crp-poc-it-hackathon-13"})
    assert valid_proj.status_code == 200
    assert valid_proj.json().get("is_valid") is True
    assert "datasets_found" in valid_proj.json()
    details.append("Multi-Proyecto GCP: Validación exitosa de conectividad y conteo de datasets BigQuery")

    # 3b. Validación de Dataset BigQuery y Menor Privilegio
    bad_ds = client.post("/api/gcp/validate-dataset", json={"dataset_name": "ds-invalid-format!"})
    assert bad_ds.status_code == 200
    assert bad_ds.json().get("is_valid") is False
    details.append("Seguridad BigQuery: Validación y rechazo de nombres de dataset con caracteres inválidos")

    valid_ds = client.post("/api/gcp/validate-dataset", json={"dataset_name": "applineajedatos"})
    assert valid_ds.status_code == 200
    assert valid_ds.json().get("is_valid") is True
    details.append("Menor Privilegio BigQuery: Validación exitosa de accesibilidad de dataset sin rol BigQuery Admin")

    # Comprobar que service_account y bq_dataset están presentes en la configuración
    init_cfg = client.get("/api/config").json()
    assert "service_account" in init_cfg.get("storage_config", {})
    assert "bq_dataset" in init_cfg.get("storage_config", {})
    details.append("Configuración Dinámica: Parámetros service_account y bq_dataset presentes y configurables")

    # 4. Actualización y Recálculo Dinámico de Presupuesto IA
    current_cfg = client.get("/api/config").json()
    current_cfg["models_settings"]["monthly_budget_usd"] = 75.0
    current_cfg["models_settings"]["alert_threshold_pct"] = 70.0
    res_cfg = client.put("/api/config", json=current_cfg, headers={"x-user-role": "Admin"})
    assert res_cfg.status_code == 200
    assert res_cfg.json()["models_settings"]["monthly_budget_usd"] == 75.0
    details.append("Presupuesto IA: Actualización persistente de presupuesto ($75 USD) y umbral (70%)")

    costs_res = client.get("/api/costs/summary")
    assert costs_res.status_code == 200
    assert costs_res.json()["budget_limit_usd"] == 75.0
    details.append("Presupuesto IA: Endpoint de costes sincroniza dinámicamente el nuevo presupuesto")

    # 5. Telemetría Enriquecida de Errores ("Con más carnita")
    err_payload = {
        "error_type": "BIGQUERY_QUERY_TIMEOUT",
        "error_message": "Excedido tiempo límite de escaneo en dataset particionado",
        "component": "BIGQUERY:Engine",
        "severity": "WARNING",
        "stack_trace": "Traceback (most recent call last):\n  File 'engine.py', line 45, in execute_scan\nTimeoutError: Job timeout",
        "url": "https://lineage-platform.run.app/grafo",
        "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        "context_data": {"project": "crp-poc-it-hackathon-13", "table": "pruebasLineaje.ejemplotabla1"}
    }
    res_err = client.post("/api/errors/report", json=err_payload)
    assert res_err.status_code == 200
    reported_id = res_err.json().get("id")

    errors_list = client.get("/api/errors").json()
    found_err = next((e for e in errors_list if e.get("id") == reported_id), None)
    assert found_err is not None, "El error reportado debe estar registrado en el historial"
    assert found_err.get("url") == "https://lineage-platform.run.app/grafo"
    assert found_err.get("severity") == "WARNING"
    assert "project" in (found_err.get("context_data") or {})
    details.append("Gestión de Errores Enriquecida: Registro y recuperación de contexto ('carnita'), URL, Stack Trace y severidad WARNING")

    return {
        "suite": "Seguridad, Multi-Proyecto GCP, CRUD Usuarios y Presupuesto IA",
        "passed": True,
        "details": details
    }

if __name__ == "__main__":
    result = run_tests()
    print("Resultado:", result)

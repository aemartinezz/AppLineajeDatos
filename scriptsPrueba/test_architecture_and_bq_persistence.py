import os
import sys
from datetime import datetime

# Añadir ruta del backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.main import app
from app.engine.code_architecture import CodeArchitectureInspector
from app.services.bigquery_service import bigquery_service
from app.models.schemas import AppConfig

def run_tests():
    details = []
    
    # Test 1: Introspección de arquitectura
    try:
        arch = CodeArchitectureInspector.get_live_architecture_graph(app)
        assert len(arch["nodes"]) > 15, "Deben existir más de 15 nodos de arquitectura"
        assert len(arch["edges"]) > 15, "Deben existir más de 15 aristas de flujo"
        assert arch["metadata"]["total_routes"] >= 8, "Debe haber al menos 8 endpoints"
        details.append(f"Arquitectura: {arch['total_nodes']} nodos, {arch['total_edges']} aristas [OK]")
    except Exception as e:
        return {"suite": "Introspección de Arquitectura y Persistencia BigQuery", "passed": False, "error": str(e)}

    # Test 2: Persistencia de configuración
    try:
        initial_config = bigquery_service.get_app_config()
        old_temp = initial_config.models_settings.light_temperature
        test_temp = 0.22
        initial_config.models_settings.light_temperature = test_temp
        updated = bigquery_service.update_app_config(initial_config)
        assert updated.models_settings.light_temperature == test_temp
        
        # Restaurar
        initial_config.models_settings.light_temperature = old_temp
        bigquery_service.update_app_config(initial_config)
        details.append("Persistencia BigQuery app_configurations: validada y restaurada [OK]")
    except Exception as e:
        return {"suite": "Introspección de Arquitectura y Persistencia BigQuery", "passed": False, "error": str(e)}

    # Test 3: Filtro de certeza
    try:
        g_low = bigquery_service.get_full_graph(min_confidence=0.50)
        g_mid = bigquery_service.get_full_graph(min_confidence=0.80)
        g_high = bigquery_service.get_full_graph(min_confidence=0.95)
        assert g_low.total_edges >= g_mid.total_edges >= g_high.total_edges
        details.append(f"Filtro de certeza diferencial (50%={g_low.total_edges}, 80%={g_mid.total_edges}, 95%={g_high.total_edges}) [OK]")
    except Exception as e:
        return {"suite": "Introspección de Arquitectura y Persistencia BigQuery", "passed": False, "error": str(e)}

    return {
        "suite": "Introspección de Arquitectura y Persistencia BigQuery",
        "passed": True,
        "details": details
    }

if __name__ == "__main__":
    res = run_tests()
    print("Resultado:", res)

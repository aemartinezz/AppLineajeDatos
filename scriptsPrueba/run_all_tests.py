import os
import sys
import json
import time
from datetime import datetime

# Rutas del proyecto
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RESULTS_DIR = os.path.join(BASE_DIR, "resultadosPrueba")
os.makedirs(RESULTS_DIR, exist_ok=True)

import test_tool_detector
import test_cascade_pipeline
import test_lineage_linker
import test_storage_lifecycle
import test_api_endpoints
import test_architecture_and_bq_persistence
import test_security_and_rbac

def execute_all():
    print("=" * 70)
    print("  EJECUTOR DE PRUEBAS LOCALES - PLATAFORMA DE LINEAJE END-TO-END")
    print(f"  Fecha: {datetime.utcnow().isoformat()} UTC")
    print("=" * 70)
    
    start_time = time.time()
    suites_results = []
    all_passed = True

    for name, module in [
        ("Detector Universal de Herramientas", test_tool_detector),
        ("Pipeline en Cascada de 4 Niveles", test_cascade_pipeline),
        ("Motor de Fusión y Linaje End-to-End", test_lineage_linker),
        ("Ciclo de Vida de Almacenamiento (Inbox/Processed)", test_storage_lifecycle),
        ("Endpoints REST y Telemetría de la API", test_api_endpoints),
        ("Introspección de Arquitectura y Persistencia BigQuery", test_architecture_and_bq_persistence),
        ("Seguridad, RBAC y Validación de Dominio Liverpool", test_security_and_rbac)
    ]:
        print(f"\n--- Ejecutando: {name} ---")
        try:
            res = module.run_tests()
            suites_results.append(res)
            if not res.get("passed", True):
                all_passed = False
                print(f"  [FALLO] {res.get('error', 'Fallo desconocido')}")
            else:
                print(f"  [APROBADO] {res.get('details', ['OK'])}")
        except Exception as e:
            print(f"  [ERROR] Excepción en suite {name}: {e}")
            suites_results.append({"suite": name, "passed": False, "error": str(e)})
            all_passed = False

    elapsed = round(time.time() - start_time, 3)

    report = {
        "timestamp": datetime.utcnow().isoformat(),
        "elapsed_seconds": elapsed,
        "all_passed": all_passed,
        "suites": suites_results
    }

    # Guardar reporte JSON
    json_path = os.path.join(RESULTS_DIR, "test_report.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    # Guardar resumen en texto
    txt_path = os.path.join(RESULTS_DIR, "resumen_ejecucion.txt")
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("RESUMEN DE PRUEBAS DE LA PLATAFORMA DE LINAJE\n")
        f.write(f"Fecha: {datetime.utcnow().isoformat()} UTC\n")
        f.write(f"Estado General: {'EXITOSO' if all_passed else 'FALLIDO'}\n")
        f.write(f"Tiempo Total: {elapsed} segundos\n")
        f.write("-" * 50 + "\n")
        for s in suites_results:
            status = "APROBADO" if s.get("passed", False) else "FALLIDO"
            f.write(f"- {s.get('suite', 'Suite')}: {status}\n")

    print("\n" + "=" * 70)
    print(f"  RESULTADO FINAL: {'TODAS LAS PRUEBAS PASARON [OK]' if all_passed else 'FALLOS DETECTADOS'}")
    print(f"  Reporte generado en: {json_path}")
    print(f"  Resumen generado en: {txt_path}")
    print("=" * 70)

    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(execute_all())

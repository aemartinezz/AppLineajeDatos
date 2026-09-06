import sys
import os

# Agregar path de backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from app.engine.tool_detector import ToolDetector
from app.models.schemas import ToolType

def run_tests():
    print("[TEST] Probando Detector Agnóstico de Herramientas...")
    
    cases = [
        ("etl_ventas.sh", "#!/bin/bash\necho 'Iniciando proceso'", ToolType.SHELL),
        ("pipeline_crm.py", "from airflow import DAG\nwith DAG('mkt') as dag: pass", ToolType.AIRFLOW_COMPOSER),
        ("job_export.dsx", "BEGIN DSJOB\n  Identifier 'DS_LOAD_STAGING'\nEND DSJOB", ToolType.DATASTAGE),
        ("controlm_def.xml", "<SMART_FOLDER><JOB NAME='J_DAILY_EXTRACT' MEMNAME='run.sh'/></SMART_FOLDER>", ToolType.CONTROL_M),
        ("transform.sql", "SELECT id, cliente FROM `proyecto.dataset.clientes`", ToolType.SQL_SCRIPT),
        ("unknown_tool.log", "2026-09-06 INFO [main] Processing payload batch 12", ToolType.GENERIC_TOOL)
    ]

    passed = 0
    results = []
    for filename, content, expected in cases:
        tool, method, conf = ToolDetector.detect(filename, content)
        is_ok = (tool == expected) or (expected == ToolType.SQL_SCRIPT and tool == ToolType.BIGQUERY)
        if is_ok:
            passed += 1
            print(f"  [OK] {filename} -> Detectado: {tool.value} ({method}, Certeza: {conf})")
        else:
            print(f"  [FAIL] {filename} -> Esperado: {expected.value}, Obtenido: {tool.value}")
        results.append({
            "file": filename,
            "expected": expected.value,
            "detected": tool.value,
            "method": method,
            "confidence": conf,
            "passed": is_ok
        })

    return {"suite": "ToolDetector", "total": len(cases), "passed": passed, "details": results}

if __name__ == "__main__":
    res = run_tests()
    sys.exit(0 if res["passed"] == res["total"] else 1)

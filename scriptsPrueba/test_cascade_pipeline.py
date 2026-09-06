import sys
import os

# Agregar path de backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from app.engine.cascade_pipeline import CascadePipeline

def run_tests():
    print("[TEST] Probando Pipeline en Cascada de 4 Niveles...")

    cases = [
        # Caso 1: Nivel 1 Determinista (Control-M XML)
        (
            "controlm_jobs.xml",
            "<SMART_FOLDER><JOB NAME='JOB_DIARIO_FINANZAS' MEMNAME='extract_oracle.sh'/></SMART_FOLDER>",
            1, # Nivel esperado
            1.0 # Confianza esperada
        ),
        # Caso 2: Nivel 1 Determinista (SQL Query BigQuery)
        (
            "kpi_calc.sql",
            "SELECT id, total FROM `crp-poc-it-hackathon-13.lineage_metadata.stg_transacciones_raw` WHERE activo = true;",
            1,
            1.0
        ),
        # Caso 3: Nivel 3 Inferencia Semántica (Shell con variables dinámicas)
        (
            "run_dynamic.sh",
            """#!/bin/bash
            ENVIRONMENT="PROD"
            TARGET_JOB="DS_LOAD_STAGING"
            echo "Invocando DataStage..."
            dsjob -run $TARGET_JOB
            """,
            3, # Debe alcanzar nivel 3 de inferencia
            0.85 # Certeza >= 85%
        )
    ]

    passed = 0
    results = []
    for filename, content, exp_level, min_conf in cases:
        res = CascadePipeline.process_file(filename, content)
        is_ok = (res.cascade_level_reached == exp_level and res.confidence_score >= min_conf)
        if is_ok:
            passed += 1
            print(f"  [OK] {filename} -> Nivel: {res.cascade_level_reached}, Certeza: {round(res.confidence_score*100)}%, Aristas: {len(res.extracted_edges)}")
        else:
            print(f"  [FAIL] {filename} -> Esperaba Nivel {exp_level}, obtuvo {res.cascade_level_reached}. Certeza: {res.confidence_score}")
        results.append({
            "file": filename,
            "level_reached": res.cascade_level_reached,
            "confidence": res.confidence_score,
            "edges_count": len(res.extracted_edges),
            "nodes_count": len(res.extracted_nodes),
            "passed": is_ok
        })

    return {"suite": "CascadePipeline", "total": len(cases), "passed": passed, "details": results}

if __name__ == "__main__":
    res = run_tests()
    sys.exit(0 if res["passed"] == res["total"] else 1)

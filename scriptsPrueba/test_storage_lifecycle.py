import sys
import os

# Agregar path de backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from app.services.storage_service import storage_service

def run_tests():
    print("[TEST] Probando Ciclo de Vida de Archivos (Inbox -> Processed)...")
    
    test_file_name = "test_extract_job.sh"
    test_content = "#!/bin/bash\necho 'Extracción exitosa'\ndsjob -run DS_CARGA_STAGE"
    
    # 1. Poner archivo en Inbox
    inbox_path = storage_service.put_inbox_file(test_file_name, test_content)
    assert os.path.exists(inbox_path), "Fallo al depositar archivo en Inbox"
    print("  [OK] Archivo depositado en Inbox exitosamente.")

    # 2. Procesar archivo
    result = storage_service.process_inbox_file(test_file_name)
    assert not os.path.exists(inbox_path), "El archivo original no debe quedar en Inbox"
    print(f"  [OK] Archivo procesado por pipeline en cascada (Nivel {result.cascade_level_reached}).")

    # 3. Verificar que se puede recuperar para el Inspector lateral
    retrieved_content = storage_service.get_processed_file_content(test_file_name)
    assert "DS_CARGA_STAGE" in retrieved_content, "El contenido archivado no coincide"
    print("  [OK] Archivo recuperado de la carpeta 'processed/' correctamente para el Inspector.")

    return {
        "suite": "StorageLifecycle",
        "file_name": test_file_name,
        "cascade_level": result.cascade_level_reached,
        "passed": True
    }

if __name__ == "__main__":
    res = run_tests()
    sys.exit(0 if res["passed"] else 1)

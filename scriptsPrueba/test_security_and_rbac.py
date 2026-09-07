import os
import sys
from fastapi.testclient import TestClient

# Añadir ruta del backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
os.environ["USE_MOCK_GCP"] = "true"

from app.main import app

def run_tests():
    client = TestClient(app)
    details = []

    # 1. Prueba de Dominio Corporativo Estricto (@liverpool.com.mx)
    try:
        # Intento con @gmail.com
        res_gmail = client.post("/api/auth/login", json={"email": "usuario_externo@gmail.com", "name": "Externo"})
        assert res_gmail.status_code == 403, f"Esperaba 403 para @gmail.com, obtuve {res_gmail.status_code}"
        details.append("Rechazo estricto de dominio externo @gmail.com (403 Forbidden) [OK]")

        # Intento con @outlook.com
        res_outlook = client.post("/api/auth/login", json={"email": "hacker@outlook.com", "name": "Hacker"})
        assert res_outlook.status_code == 403, f"Esperaba 403 para @outlook.com, obtuve {res_outlook.status_code}"
        details.append("Rechazo estricto de dominio externo @outlook.com (403 Forbidden) [OK]")

        # Intento con @liverpool.com.mx (Usuario Real)
        res_real = client.post("/api/auth/login", json={"email": "aemartinezz@liverpool.com.mx", "name": "Argos Eyra Martinez Zeferino"})
        assert res_real.status_code == 200, f"Esperaba 200 para @liverpool.com.mx, obtuve {res_real.status_code}"
        user_data = res_real.json()["user"]
        assert "Admin" in user_data["roles"] and "Developer" in user_data["roles"]
        details.append("Autenticación exitosa de aemartinezz@liverpool.com.mx con roles Admin y Developer [OK]")

        # Intento con nuevo empleado @liverpool.com.mx (Modo Invitado / Viewer automático)
        res_invitado = client.post("/api/auth/login", json={"email": "nuevo_ingreso@liverpool.com.mx", "name": "Nuevo Ingreso"})
        assert res_invitado.status_code == 200
        assert res_invitado.json()["user"]["roles"] == ["Viewer"]
        details.append("Auto-registro en Modo Invitado / Viewer para cuenta corporativa nueva [OK]")

    except Exception as e:
        return {"suite": "Seguridad y RBAC Corporativo", "passed": False, "error": f"Fallo en prueba de dominio: {e}"}

    # 2. Prueba de Protección RBAC en Endpoints Críticos
    try:
        # Intento de alterar configuración con rol Viewer (debe dar 403)
        conf_res = client.get("/api/config").json()
        put_viewer = client.put("/api/config", json=conf_res, headers={"x-user-role": "Viewer"})
        assert put_viewer.status_code == 403, f"Esperaba 403 para Viewer en /api/config, obtuve {put_viewer.status_code}"
        details.append("Bloqueo de modificación de configuración para rol Viewer (403 Forbidden) [OK]")

        # Intento de alterar configuración con rol Auditor (debe dar 403)
        put_auditor = client.put("/api/config", json=conf_res, headers={"x-user-role": "Auditor"})
        assert put_auditor.status_code == 403, f"Esperaba 403 para Auditor en /api/config, obtuve {put_auditor.status_code}"
        details.append("Bloqueo de modificación de configuración para rol Auditor (403 Forbidden) [OK]")

        # Intento con rol Admin (debe permitirlo)
        put_admin = client.put("/api/config", json=conf_res, headers={"x-user-role": "Admin"})
        assert put_admin.status_code == 200, f"Esperaba 200 para Admin en /api/config, obtuve {put_admin.status_code}"
        details.append("Autorización concedida para rol Admin en /api/config (200 OK) [OK]")

        # Intento de gestión de usuarios con rol Developer (debe dar 403)
        post_user_dev = client.post(
            "/api/users", 
            json={"email": "test_dev@liverpool.com.mx", "name": "Test", "roles": ["Viewer"]},
            headers={"x-user-role": "Developer"}
        )
        assert post_user_dev.status_code == 403, f"Esperaba 403 para Developer en /api/users, obtuve {post_user_dev.status_code}"
        details.append("Bloqueo de administración de usuarios para rol Developer (403 Forbidden) [OK]")

    except Exception as e:
        return {"suite": "Seguridad y RBAC Corporativo", "passed": False, "error": f"Fallo en prueba RBAC: {e}"}

    # 3. Prueba de Prevención de Path Traversal
    try:
        from app.services.storage_service import storage_service
        # Intentar solicitar archivo con path traversal
        malicious_name = "../../../../etc/passwd"
        content = storage_service.get_processed_file_content(malicious_name)
        # Debe manejarlo de forma segura devolviendo mensaje controlado sin exponer el sistema de archivos
        assert "root:" not in content
        details.append("Mitigación de Path Traversal en lectura de archivos verificada [OK]")
    except Exception as e:
        return {"suite": "Seguridad y RBAC Corporativo", "passed": False, "error": f"Fallo en prueba de Path Traversal: {e}"}

    return {
        "suite": "Seguridad y RBAC Corporativo",
        "passed": True,
        "details": details
    }

if __name__ == "__main__":
    res = run_tests()
    print("Resultado Seguridad:", res)

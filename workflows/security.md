# Políticas de Seguridad y Mitigación de Vulnerabilidades: GrafoLogsApps

Este documento establece las **normas obligatorias de seguridad**, autenticación, autorización, validación de entradas y protección de infraestructura que deben cumplirse en cada línea de código desarrollada para la plataforma.

---

## 1. Autenticación y Restricción de Dominio Corporativo

1. **Aislamiento Exclusivo a `@liverpool.com.mx`:**
   - Todo endpoint protegido y toda verificación de identidad debe validar estrictamente que el correo electrónico termine exactamente con `@liverpool.com.mx`.
   - Si un usuario intenta autenticarse o enviar peticiones con dominios públicos (`@gmail.com`, `@hotmail.com`, `@outlook.com`, etc.) o de terceros, el backend debe retornar de forma inmediata **HTTP 403 Forbidden**.
   - No se permiten bypasses ni excepciones por comodines (`*`).

2. **Modo Invitado / Auto-Registro Seguro:**
   - Nuevos colaboradores de Liverpool que inicien sesión reciben automáticamente el rol `Viewer`.
   - Este rol posee exclusivamente permisos de lectura (`GET /api/lineage/graph`). Cualquier intento de modificar configuraciones, subir archivos o administrar usuarios es bloqueado con HTTP 403.

---

## 2. Protección Inmune de Cuenta Raíz (`ADMIN_ROOT`)

1. **Inmunidad de `aemartinezz@liverpool.com.mx`:**
   - La cuenta del administrador maestro posee protección inviolable en el backend:
     - **Prohibido eliminar:** Endpoint `DELETE /api/users/{email}` rechaza la operación si el correo corresponde a la cuenta raíz.
     - **Prohibido desactivar o cambiar estado a INACTIVE:** Endpoint `PUT /api/users/{email}/status` rechaza cualquier intento de suspenderla.
     - **Prohibido despojar del rol Admin:** Endpoint `PUT /api/users/{email}/roles` exige la permanencia del rol `Admin`.

---

## 3. Validación y Sanitización de Entradas

1. **Validación de Parámetros de Google Cloud (`project_id`):**
   - El identificador del proyecto de GCP debe cumplir obligatoriamente la expresión regular:
     ```python
     GCP_PROJECT_REGEX = re.compile(r"^[a-z0-9-]{6,30}$")
     ```
   - Rechazar cualquier cadena que contenga espacios, barras, comillas, caracteres especiales o intentos de inyección de comandos.

2. **Validación de Buckets de Google Cloud Storage (`validate-bucket`):**
   - Nombres de buckets deben validarse contra nombres legales de GCS (minúsculas, números, guiones y puntos, sin caracteres de escape).

3. **Mitigación Estricta de Path Traversal:**
   - En la gestión de archivos (`storage_service.py` y endpoints de subida/descarga), ningún nombre de archivo puede contener secuencias de escape como `../` o `..\`.
   - Se debe utilizar obligatoriamente `os.path.basename(filename)` y comprobar que la ruta absoluta resuelta pertenezca al directorio autorizado:
     ```python
     safe_name = os.path.basename(raw_name)
     full_path = os.path.abspath(os.path.join(base_dir, safe_name))
     if not full_path.startswith(os.path.abspath(base_dir)):
         raise SecurityException("Intento de evasión de directorio detectado.")
     ```

---

## 4. Gestión de Credenciales, Service Accounts y Menor Privilegio (Least Privilege IAM)

1. **Prohibición de Secretos en Código Fuente:**
   - Jamás se deben escribir llaves de API, Service Account Keys en formato JSON, contraseñas o tokens en el código fuente ni subirlos a GitHub.
   - Todo acceso a GCP debe gestionarse mediante **Application Default Credentials (ADC)** o la Service Account dedicada adjunta al contenedor de Cloud Run (`--service-account`).

2. **Principio Innegociable de Menor Privilegio (Least Privilege):**
   - **Queda estrictamente prohibido** el uso de roles de superadministrador o de amplio espectro en la infraestructura:
     - ❌ `roles/owner` o `roles/editor`
     - ❌ `roles/bigquery.admin`
     - ❌ `roles/storage.admin`
   - La plataforma debe operar únicamente con los roles indispensables y delimitados por recurso:
      - **A nivel de Proyecto GCP:**
        - `roles/bigquery.jobUser`: Permite ejecutar consultas SQL (`bigquery.jobs.create`, `bigquery.jobs.get`).
        - `roles/aiplatform.user`: Permite invocar modelos fundacionales Gemini 1.5 Flash y Pro en Vertex AI (`aiplatform.endpoints.predict`). Queda estrictamente prohibido `roles/aiplatform.admin`.
        - `roles/logging.logWriter`: Permite enviar telemetría e incidencias a Cloud Logging.
      - **A nivel de Dataset de la Aplicación (`BQ_DATASET`):**
        - `roles/bigquery.dataEditor`: Permite crear y actualizar las 7 tablas maestras de la aplicación sin permisos administrativos sobre el resto de BigQuery.
      - **A nivel de Datasets Externos Monitoreados:**
        - `roles/bigquery.metadataViewer`: Solo lectura de esquemas, `INFORMATION_SCHEMA.VIEWS` y rutinas sin acceso a datos confidenciales.
      - **A nivel de Buckets de Almacenamiento:**
        - `roles/storage.objectAdmin`: Concedido exclusivamente sobre `gs://$INBOX_BUCKET` y `gs://$PROCESSED_BUCKET`.

3. **Roles Mínimos del Operador DevOps (Sin ser Owner):**
   - El ingeniero u operador que aprovisiona la plataforma en un proyecto GCP nuevo tampoco debe utilizar `roles/owner`. Debe contar únicamente con:
     - `roles/serviceusage.serviceUsageAdmin` (habilitación de APIs).
     - `roles/resourcemanager.projectIamAdmin` (asignación de bindings IAM a la SA).
     - `roles/iam.serviceAccountAdmin` (creación de la SA).
     - `roles/run.admin` (despliegue en Cloud Run).
     - `roles/cloudbuild.builds.editor` (ejecución de builds).
     - `roles/artifactregistry.admin` (gestión de imágenes Docker).
     - `roles/bigquery.dataEditor` sobre el proyecto (creación del dataset inicial).
     - `roles/storage.admin` (creación de buckets iniciales).

4. **Parametrización Dinámica de la Service Account:**
   - La Service Account debe ser configurable mediante la variable `GCP_SERVICE_ACCOUNT` y reflejarse en la interfaz de configuración del frontend para auditoría.

---

## 5. Seguridad en Frontend y Cabeceras HTTP

1. **Protección CORS:**
   - En producción, restringir los orígenes permitidos al dominio institucional de la plataforma.
2. **Encabezados HTTP de Seguridad:**
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
   - `Content-Security-Policy`: Restringir la carga de scripts ajenos a orígenes confiables.

# Manifiesto Operativo y Reglas para Agentes Gemini: GrafoLogsApps

Este documento define las **reglas obligatorias e inquebrantables** que rigen el comportamiento, análisis, toma de decisiones y generación de código de cualquier agente de Inteligencia Artificial (especialmente Google Gemini / Antigravity) que opere sobre este repositorio.

---

## 1. Principios Fundamentales Obligatorios

1. **Idioma Estrictamente en Español:**
   - Todas las comunicaciones con el usuario, explicaciones técnicas, resúmenes, mensajes de commit, documentación y comentarios en código deben realizarse **exclusivamente en español**, sin excepciones.
   
2. **Principio de Veracidad Empírica (Cero Alucinaciones):**
   - El agente **nunca debe asumir, mentir ni alucinar** respuestas sobre el estado de la aplicación, bases de datos o despliegues.
   - Todo resultado debe ser verificado empíricamente mediante herramientas reales:
     - Ejecución de comandos de prueba (`run_command` sobre scripts locales).
     - Inspección de base de datos o almacenamiento.
     - Navegación visual e inspección de consola en vivo en el navegador (`/browser`).
   - Si algo no funciona o se desconoce, debe reportarse con total transparencia y evidencia técnica.

3. **Ciclo de Vida Obligatorio de Desarrollo y Despliegue:**
   Cualquier cambio en el código debe seguir sin saltarse ningún paso el siguiente ciclo:
   ```
   [1. Análisis de Workflows] ➔ [2. Desarrollo Local] ➔ [3. Pruebas Locales (10/10 OK)] ➔
   [4. Commit Semántico Git] ➔ [5. Push a GitHub main] ➔ [6. Cloud Build GCP] ➔
   [7. Cloud Run Deploy] ➔ [8. Verificación en Vivo /browser con evidencias fotográficas]
   ```

---

## 2. Orden Obligatorio de Consulta de Archivos

Antes de iniciar cualquier análisis, proponer respuestas o generar código, el agente **DEBE consultar estos archivos en el orden riguroso indicado**:

| Orden | Archivo | Cuándo Consultarlo Obligatoriamente |
|:-----:|---------|------------------------------------|
| **1°** | `workflows/gemini.md` | **SIEMPRE**, antes de iniciar cualquier cambio, proponer respuestas o aplicar modificaciones. |
| **2°** | `workflows/memory.md` | **ANTES** de proponer cambios arquitectónicos, añadir dependencias o alterar flujos de datos. |
| **3°** | `workflows/security.md` | **SIEMPRE**, sin excepción alguna, en cada generación o modificación de código. |
| **4°** | `workflows/testing.md` | Al generar o ejecutar pruebas, scripts testeables o validar suites. |
| **5°** | `workflows/standards-frontend.md` | Para cualquier archivo HTML, TypeScript, React, CSS o elementos visuales. |
| **6°** | `workflows/standards-backend.md` | Para todo código Python, FastAPI, consultas BigQuery o scripts de shell. |

---

## 3. Documentación Complementaria del Sistema

Para comprender la totalidad del sistema a 360 grados, el agente debe consultar:
- `workflows/architecture.md`: Arquitectura global, diagramas Mermaid, interacción Cloud Run, BigQuery, GCS y LLM.
- `workflows/data-dictionary.md`: Esquema DDL de las 7 tablas de BigQuery, particiones, clustering y tipos de datos.
- `workflows/operations-deployment.md`: Manual operativo de despliegue en Google Cloud Platform, variables de entorno y rollback.
- `gemini.md` (en la raíz): Punto de entrada maestro del repositorio.

---

## 4. Reglas de Interacción con el Usuario

- **Claridad y Precisión:** Explicaciones directas, técnicas y fundamentadas, sin rodeos innecesarios.
- **Dudas y Aclaraciones:** Si un requerimiento presenta ambigüedad o múltiples alternativas de diseño, el agente debe formular **una sola pregunta a la vez** acompañada de 2 a 3 opciones claras de respuesta estructuradas como respuesta directa del usuario.
- **Preservación de Contexto:** Cualquier decisión arquitectónica o ajuste relevante tomado durante la conversación debe registrarse en `workflows/memory.md` para que la memoria del proyecto se mantenga permanentemente viva y actualizada.

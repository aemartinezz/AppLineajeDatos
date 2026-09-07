# Guía Maestra y Punto de Entrada para Agentes Gemini (Root Entrypoint)

> [!IMPORTANT]
> **ATENCIÓN AGENTE DE INTELIGENCIA ARTIFICIAL (GEMINI / ANTIGRAVITY):**
> Si estás iniciando una sesión en este repositorio, **ESTE ES TU PUNTO DE ENTRADA OBLIGATORIO**.
> Antes de proponer cambios, analizar código o generar modificaciones, **DEBES** consultar obligatoriamente el sistema de gobernanza y arquitectura en el directorio `workflows/`.

---

## 1. Reglas Innegociables de Operación

1. **Idioma Exclusivo en Español:** Comunícate, documenta y comenta **estrictamente en español**.
2. **Cero Alucinaciones:** Valida empíricamente cada afirmación ejecutando comandos reales de prueba, consultas a bases de datos o inspección visual en el navegador. Nunca inventes respuestas.
3. **Ciclo de Desarrollo Obligatorio:**
   `Desarrollo Local ➔ Test Suite (10/10 OK) ➔ Git Commit ➔ Git Push ➔ Cloud Build ➔ Cloud Run ➔ Verificación en Navegador`.

---

## 2. Orden Riguroso de Consulta de Workflows

Antes de generar o modificar código, consulta obligatoriamente los archivos en este orden:

| Precedencia | Archivo a Consultar | Cuándo Consultarlo |
|:-----------:|---------------------|-------------------|
| **1°** | [`workflows/gemini.md`](file:///Users/aemartinezz/Documents/PruebasAntigravity/GrafoLogsApps/workflows/gemini.md) | **SIEMPRE**, antes de iniciar cualquier cambio o análisis. |
| **2°** | [`workflows/memory.md`](file:///Users/aemartinezz/Documents/PruebasAntigravity/GrafoLogsApps/workflows/memory.md) | **ANTES** de cambios arquitectónicos, dependencias o esquemas. |
| **3°** | [`workflows/security.md`](file:///Users/aemartinezz/Documents/PruebasAntigravity/GrafoLogsApps/workflows/security.md) | **SIEMPRE**, en toda generación de código y validación RBAC. |
| **4°** | [`workflows/testing.md`](file:///Users/aemartinezz/Documents/PruebasAntigravity/GrafoLogsApps/workflows/testing.md) | Al generar pruebas o correr la suite de 10 pruebas. |
| **5°** | [`workflows/standards-frontend.md`](file:///Users/aemartinezz/Documents/PruebasAntigravity/GrafoLogsApps/workflows/standards-frontend.md) | Para código React 18, TypeScript, Cytoscape y CSS. |
| **6°** | [`workflows/standards-backend.md`](file:///Users/aemartinezz/Documents/PruebasAntigravity/GrafoLogsApps/workflows/standards-backend.md) | Para código Python 3.11+, FastAPI y BigQuery. |

---

## 3. Documentación Técnica de Referencia

- **Arquitectura y Diagramas:** [`workflows/architecture.md`](file:///Users/aemartinezz/Documents/PruebasAntigravity/GrafoLogsApps/workflows/architecture.md)
- **Diccionario de Datos BigQuery:** [`workflows/data-dictionary.md`](file:///Users/aemartinezz/Documents/PruebasAntigravity/GrafoLogsApps/workflows/data-dictionary.md)
- **Manual de Despliegue en GCP:** [`workflows/operations-deployment.md`](file:///Users/aemartinezz/Documents/PruebasAntigravity/GrafoLogsApps/workflows/operations-deployment.md)

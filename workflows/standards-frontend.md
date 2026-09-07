# Estándares de Frontend y Diseño de Experiencia de Usuario (UX)

Este documento establece las **directrices visuales, diseño de componentes, buenas prácticas de React/TypeScript y estándares de renderizado de grafos** para la interfaz web de GrafoLogsApps.

---

## 1. Pila Tecnológica y Herramientas

- **Framework:** React 18 con TypeScript y Vite.
- **Iconografía:** Lucide React (`lucide-react`).
- **Motor de Visualización de Grafos:** Cytoscape.js con la extensión `cytoscape-dagre`.
- **Servidor Web:** Nginx Alpine para servir archivos estáticos en Cloud Run.

---

## 2. Identidad Visual Corporativa (Paleta Liverpool)

Toda la interfaz debe apegarse estrictamente a la paleta institucional:

| Elemento / Rol | Código HEX | Uso en la Aplicación |
|----------------|:----------:|---------------------|
| **Color Institucional Principal** | `#731853` | Encabezados, botones primarios, bordes activos, títulos. |
| **Superficie y Contenedores Suaves** | `#FAF0F5` | Fondos de etiquetas activas, badges, tarjetas seleccionadas. |
| **Fondo General del Canvas** | `#F8F9FA` | Lienzo interactivo del grafo de Cytoscape. |
| **Estado de Éxito / OK** | `#2E7D32` | Nodos completados, checks de validación, badges de estado. |
| **Estado en Ejecución / Running** | `#0284C7` | Nodos en progreso, spinners de carga, conexiones activas. |
| **Estado de Error / Fallo** | `#C62828` | Nodos fallidos, alertas críticas, mensajes de excepción. |
| **Estado Pendiente / Neutro** | `#9CA3AF` | Nodos en espera, aristas estándar, bordes deshabilitados. |

---

## 3. Renderizado y Manejo del Grafo de Linaje (Cytoscape)

1. **Responsividad de Nodos (`formatNodeBox`):**
   - Los nombres de componentes (tablas, DAGs, scripts) no deben desbordar el contenedor rectangular.
   - Todo nodo debe pasar por `formatNodeBox(toolType, rawName)` que:
     - Divide nombres largos por delimitadores (`.`, `_`, `/`).
     - Asegura líneas de entre 20 y 26 caracteres.
     - Calcula proporcionalmente el ancho (`nodeWidth`, 160 a 320 px) y alto (`nodeHeight`).
     - Asigna `text-max-width` y `text-wrap: wrap`.

2. **Algoritmo Adaptativo de Layout (`relayoutVisibleElements`):**
   - **Vista "Todas" o Dashboard Mixto:** Ejecutar `layoutProximityDashboard`:
     - Fila 0 para la cadena horizontal del pipeline (hasta 10 columnas).
     - Fila 1 para tablas/archivos destino colocados en la **misma columna** de su emisor (distancia vertical mínima de 1 celda = 115 px).
     - Filas y columnas restantes para el catálogo de 76+ tablas de BigQuery, ordenadas alfabéticamente.
   - **Subgrafos Conectados / Aislamiento:** Ejecutar `dagre` con `rankDir: 'LR'` para mostrar linaje causal de izquierda a derecha.
   - **Filtro de Catálogo Aislado (ej. solo BigQuery):** Ejecutar `grid` con columnas proporcionales apaisadas.
   - **Pocos Nodos Desconectados (<= 4, ej. DataStage o Shell):** Centrado agrupado con espaciado natural de 260 px.

3. **Operaciones Atómicas en Batch:**
   - Ocultar o mostrar elementos siempre dentro de `cy.batch(() => { ... })` para evitar repintados innecesarios y garantizar animaciones fluidas a 60 FPS.

---

## 4. Estándares de Experiencia de Usuario (UX) y Accesibilidad

1. **Retroalimentación Visual Inmediata (Feedback):**
   - Ninguna acción del usuario debe quedar sin respuesta visual. Al pulsar un botón de acción (como guardar usuario, cambiar rol o validar bucket), debe mostrarse un spinner o estado de carga inmediato.
2. **Animaciones Suaves:**
   - Las transiciones de layout deben durar 350 ms con curva `ease-in-out-cubic`.
3. **Consola Limpia:**
   - La consola del navegador debe mantenerse en **0 errores de JavaScript**. Cualquier excepción no capturada debe reportarse al backend vía `/api/errors/report`.

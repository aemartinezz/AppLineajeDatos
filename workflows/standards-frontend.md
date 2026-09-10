# Estándares de Frontend, Experiencia de Usuario (UX) y Visualización de Grafos

Este documento establece las **directrices técnicas, patrones de diseño de componentes, normas visuales corporativas y estándares de renderizado de grafos** para la aplicación web de GrafoLogsApps.

---

## 1. Pila Tecnológica del Frontend

- **Framework:** React 18 con TypeScript y Vite.
- **Iconografía:** Lucide React (`lucide-react`).
- **Motor de Renderizado de Grafos:** Cytoscape.js con la extensión `cytoscape-dagre`.
- **Servidor Web:** Nginx Alpine actuando como servidor estático y Reverse Proxy hacia el backend.

---

## 2. Identidad Visual Corporativa (Paleta El Puerto de Liverpool)

La interfaz debe respetar estrictamente la identidad visual corporativa:

| Elemento / Rol | Código HEX | Aplicación en la Plataforma |
|----------------|:----------:|----------------------------|
| **Color Primario Institucional** | `#731853` | Encabezados, botones principales, bordes de selección, títulos destacados. |
| **Superficie y Contenedores Suaves** | `#FAF0F5` | Fondos de etiquetas activas, badges, tarjetas seleccionadas, estados hover suaves. |
| **Lienzo del Grafo** | `#F8F9FA` | Fondo neutro de alta legibilidad para el canvas de Cytoscape. |
| **Estado Éxito (Success)** | `#2E7D32` | Nodos completados, badges de validación correcta, checks de confirmación. |
| **Estado En Ejecución (Running)** | `#0284C7` | Nodos en progreso, spinners de actividad, bordes animados de procesamiento. |
| **Estado Fallo (Failed / Error)** | `#C62828` | Nodos con error, alertas críticas, tarjetas de incidencias abiertas. |
| **Estado Pendiente (Pending / Neutral)** | `#9CA3AF` | Nodos en cola de espera, aristas genéricas, bordes secundarios deshabilitados. |

---

## 3. Renderizado y Manejo de Grafos con Cytoscape.js

1. **Responsividad de Nodos (`formatNodeBox`):**
   - Los nombres de componentes (tablas con dataset, DAGs de Composer, scripts de Shell) varían ampliamente en longitud.
   - **Regla:** Ningún texto puede salirse o desbordar la caja del nodo.
   - Todo nodo debe procesarse mediante `formatNodeBox(toolType, rawName)` que:
     - Divide nombres largos por delimitadores naturales (`.`, `_`, `/`).
     - Agrupa tokens en líneas de 20 a 26 caracteres.
     - Calcula proporcionalmente el ancho (`nodeWidth`, entre 160 px y 320 px) y el alto (`nodeHeight`, entre 65 px y 130 px).
     - Asigna dinámicamente estilos de Cytoscape: `text-max-width: nodeWidth - 24`, `text-wrap: wrap` y `text-valign: center`.

2. **Algoritmo Adaptativo de Layout (`layoutProximityDashboard`):**
   - **Vista "Todas" (Dashboard Mixto):**
     - **Fila 0:** Cadena horizontal secuencial de jobs de procesamiento (Control-M, Shell, DataStage, Composer) espaciados homogéneamente (hasta 10 columnas).
     - **Fila 1:** Tablas y archivos destino ubicados en la **misma columna** de su job emisor (arista vertical corta de 1 celda = 115 px), eliminando por completo cruces diagonales desordenados.
     - **Filas 2 en adelante:** Catálogo de 76+ tablas de BigQuery organizadas en una cuadrícula compacta y armónica, ordenadas alfabéticamente.
   - **Subgrafos Conectados / Aislamiento Causal:**
     - Al buscar o seleccionar un componente, ejecutar `dagre` con `rankDir: 'LR'` (izquierda a derecha) para representar causalidad temporal clara.
   - **Filtro de Catálogo Aislado (ej. solo BigQuery):**
     - Ejecutar `grid` apaisado para aprovechar el ancho de pantalla panorámico.
   - **Pocos Componentes Desconectados (<= 4, ej. solo DataStage):**
     - Agrupación centrada con espaciado natural de 260 px entre centros.

3. **Operaciones Atómicas en Batch:**
   - Para evitar bloqueos del hilo principal del navegador y garantizar 60 FPS:
     ```typescript
     cy.batch(() => {
       // Ocultar, mostrar o actualizar estilos masivamente
       cy.elements().addClass('hidden');
       visibleElements.removeClass('hidden');
     });
     ```

4. **Buscador de Linaje y Trazabilidad Bidireccional:**
   - Localización por coincidencia parcial en nombre o identificador.
   - Modos de aislamiento:
     - `UPSTREAM`: Aísla predecesores (`node.predecessors()`) para conocer el origen de los datos.
     - `DOWNSTREAM`: Aísla sucesores (`node.successors()`) para evaluar impacto de modificaciones.
     - `FULL`: Combina ambos para desplegar la ruta de linaje completa.
   - Botón `X` para restaurar instantáneamente la topología general sin recargar la página.

---

## 4. Gestión de Estado y Telemetría WebSocket sin Parpadeos

1. **Actualización Puntual de Nodos:**
   - Al recibir eventos de telemetría vía WebSocket (`STATUS_UPDATE`), **no se debe destruir ni recrear la instancia de Cytoscape**.
   - Se debe localizar el nodo por su ID y mutar únicamente su clase o propiedad de estado:
     ```typescript
     const node = cy.getElementById(nodeId);
     if (node.nonempty()) {
       node.data('status', newStatus);
     }
     ```
2. **Consola Limpia (Zero Console Errors):**
   - Todo renderizado debe ejecutarse sin emitir excepciones en la consola del navegador.
   - Cualquier error no controlado debe reportarse automáticamente al backend mediante `POST /api/errors/report`.

import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
// @ts-ignore
import dagre from 'cytoscape-dagre';
import { 
  Sliders, RefreshCw, ZoomIn, ZoomOut, Maximize2, 
  Search, ArrowLeft, ArrowRight, RotateCcw, Info, X, LayoutGrid
} from 'lucide-react';

if (typeof cytoscape('core', 'dagre') === 'undefined') {
  cytoscape.use(dagre);
}

interface NodeData {
  id: string;
  name: string;
  tool_type: string;
  layer: string;
  status: string;
  metadata?: any;
}

interface EdgeData {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  confidence_score: number;
  inference_method: string;
  evidence_snippet?: string;
}

interface LineageGraphViewProps {
  onSelectNode: (node: NodeData) => void;
}

// Formateo inteligente de cajas de nodos para evitar desbordamientos de texto
const formatNodeBox = (toolType: string, rawName: string) => {
  const maxLineChars = 22;
  const rawTokens = rawName.split(/([._\-\/:]+)/);
  const formattedLines: string[] = [];
  let currentLine = '';

  for (const token of rawTokens) {
    if (!token) continue;
    if ((currentLine + token).length > maxLineChars && currentLine.length > 0) {
      formattedLines.push(currentLine);
      currentLine = token;
    } else {
      currentLine += token;
    }
  }
  if (currentLine) {
    formattedLines.push(currentLine);
  }

  const cleanLines: string[] = [];
  for (const line of formattedLines) {
    if (line.length <= 26) {
      cleanLines.push(line);
    } else {
      for (let i = 0; i < line.length; i += 22) {
        cleanLines.push(line.slice(i, i + 22));
      }
    }
  }

  const allLines = [toolType, ...cleanLines];
  const maxChars = Math.max(...allLines.map(l => l.length));

  const nodeWidth = Math.min(320, Math.max(160, Math.round(maxChars * 7.5 + 36)));
  const nodeHeight = Math.max(65, Math.round((cleanLines.length + 1) * 16 + 28));
  const textMaxWidth = nodeWidth - 22;

  const label = `${toolType}\n${cleanLines.join('\n')}`;

  return { label, nodeWidth, nodeHeight, textMaxWidth };
};

// Algoritmo de Proximidad Dashboard: Organiza la pipeline de jobs en la Fila 0 y coloca
// sus tablas/archivos conectados directamente debajo en la Fila 1 (distancia vertical mínima de 1 celda),
// rellenando armoniosamente el resto de la cuadrícula con el catálogo de BigQuery sin cruces de aristas.
const layoutProximityDashboard = (
  cy: cytoscape.Core,
  visibleNodes: cytoscape.NodeCollection,
  visibleEdges: cytoscape.EdgeCollection,
  cols: number = 10
) => {
  const connectedNodeIds = new Set<string>();
  const targetsOf = new Map<string, string[]>();
  const sourcesOf = new Map<string, string[]>();

  visibleEdges.forEach((edge) => {
    const s = edge.data('source');
    const t = edge.data('target');
    if (s && t) {
      connectedNodeIds.add(s);
      connectedNodeIds.add(t);
      if (!targetsOf.has(s)) targetsOf.set(s, []);
      targetsOf.get(s)!.push(t);
      if (!sourcesOf.has(t)) sourcesOf.set(t, []);
      sourcesOf.get(t)!.push(s);
    }
  });

  // Orden secuencial preferido para la pipeline principal de jobs en Fila 0
  const PREFERRED_PIPELINE_ORDER = [
    'CONTROL_M:JOB_DIARIO_VENTAS',
    'SHELL:extract_oracle.sh',
    'DATASTAGE:DS_LOAD_STAGING',
    'AIRFLOW_COMPOSER:dag_ventas_analytics',
    'SHELL:clean_staging_logs.sh',
    'DATASTAGE:DS_ENRICH_CLIENTES',
    'SHELL:lanzar_carga_ejemplotabla1.sh',
    'AIRFLOW_COMPOSER:dag_carga_ejemplotabla1',
    'AIRFLOW_COMPOSER:dag_carga_ejemplotabla1.cargar_csv_a_bigquery',
    'AIRFLOW_COMPOSER:cargar_csv_a_bigquery',
    'BIGQUERY:pruebasLineaje.ejemplotabla1',
  ];

  const connectedNodes = visibleNodes.filter((n) => connectedNodeIds.has(n.id()));
  const pipelineNodes: cytoscape.NodeSingular[] = [];
  const placedIds = new Set<string>();

  // 1. Extraer jobs de pipeline en el orden preferido
  for (const pid of PREFERRED_PIPELINE_ORDER) {
    const matching = connectedNodes.filter((n) => n.id() === pid && !placedIds.has(n.id()));
    if (matching.length > 0) {
      pipelineNodes.push(matching[0]);
      placedIds.add(pid);
    }
  }

  // Si hay más nodos de pipeline/orquestación no listados explícitamente:
  connectedNodes.forEach((n) => {
    const tool = n.data('tool_type');
    if (['CONTROL_M', 'SHELL', 'DATASTAGE', 'AIRFLOW_COMPOSER'].includes(tool) && !placedIds.has(n.id())) {
      pipelineNodes.push(n);
      placedIds.add(n.id());
    }
  });

  const gridPositions = new Map<string, { row: number; col: number }>();
  const occupiedCells = new Set<string>();

  // 2. Asignar Fila 0 a los nodos del pipeline (hasta 'cols' columnas)
  pipelineNodes.slice(0, cols).forEach((pNode, colIdx) => {
    gridPositions.set(pNode.id(), { row: 0, col: colIdx });
    occupiedCells.add(`0,${colIdx}`);
  });

  // 3. Colocar tablas/archivos destino inmediatamente debajo de su emisor en la misma columna (Fila 1)
  pipelineNodes.slice(0, cols).forEach((pNode, colIdx) => {
    // Buscar targets (ej. DS_LOAD_STAGING -> stg_transacciones_raw)
    const targets = targetsOf.get(pNode.id()) || [];
    for (const targetId of targets) {
      if (!placedIds.has(targetId)) {
        let targetRow = 1;
        while (occupiedCells.has(`${targetRow},${colIdx}`)) {
          targetRow++;
        }
        gridPositions.set(targetId, { row: targetRow, col: colIdx });
        occupiedCells.add(`${targetRow},${colIdx}`);
        placedIds.add(targetId);
      }
    }
    // Buscar sources (ej. ejemplotabla1_20260907.csv -> pruebasLineaje.ejemplotabla1)
    const sources = sourcesOf.get(pNode.id()) || [];
    for (const sourceId of sources) {
      if (!placedIds.has(sourceId)) {
        let targetRow = 1;
        while (occupiedCells.has(`${targetRow},${colIdx}`)) {
          targetRow++;
        }
        gridPositions.set(sourceId, { row: targetRow, col: colIdx });
        occupiedCells.add(`${targetRow},${colIdx}`);
        placedIds.add(sourceId);
      }
    }
  });

  // Si aún quedan nodos conectados sin colocar (ej. pipelines con más de 10 columnas)
  connectedNodes.forEach((n) => {
    if (!placedIds.has(n.id())) {
      let r = 1;
      let c = 0;
      while (occupiedCells.has(`${r},${c}`)) {
        c++;
        if (c >= cols) {
          c = 0;
          r++;
        }
      }
      gridPositions.set(n.id(), { row: r, col: c });
      occupiedCells.add(`${r},${c}`);
      placedIds.add(n.id());
    }
  });

  // 4. Rellenar las celdas restantes con las tablas de catálogo desconectadas (BigQuery)
  const isolatedNodes = visibleNodes.filter((n) => !placedIds.has(n.id())).sort((a, b) => {
    const nameA = a.data('name') || a.id();
    const nameB = b.data('name') || b.id();
    return nameA.localeCompare(nameB);
  });

  let curRow = 1;
  let curCol = 0;

  isolatedNodes.forEach((node) => {
    while (occupiedCells.has(`${curRow},${curCol}`)) {
      curCol++;
      if (curCol >= cols) {
        curCol = 0;
        curRow++;
      }
    }
    gridPositions.set(node.id(), { row: curRow, col: curCol });
    occupiedCells.add(`${curRow},${curCol}`);
    curCol++;
    if (curCol >= cols) {
      curCol = 0;
      curRow++;
    }
  });

  // 5. Calcular coordenadas espaciales centradas y animar fluidamente
  const totalRows = curRow + 1;
  const spacingX = 270;
  const spacingY = 115;
  const startX = -((cols - 1) * spacingX) / 2;
  const startY = -((totalRows - 1) * spacingY) / 2;

  visibleNodes.forEach((node) => {
    const pos = gridPositions.get(node.id());
    if (pos) {
      const targetX = startX + pos.col * spacingX;
      const targetY = startY + pos.row * spacingY;
      node.animate({
        position: { x: targetX, y: targetY },
      }, {
        duration: 350,
        easing: 'ease-in-out-cubic',
      });
    }
  });

  setTimeout(() => {
    cy.fit(visibleNodes, 45);
  }, 380);
};

// Motor de Re-layout Adaptativo para organizar armónicamente los nodos visibles
const relayoutVisibleElements = (
  cy: cytoscape.Core,
  preferredLayout?: 'auto' | 'grid' | 'dagre'
) => {
  const visibleNodes = cy.nodes(':visible');
  if (visibleNodes.length === 0) return;

  const visibleEdges = cy.edges(':visible');
  const visibleElements = visibleNodes.union(visibleEdges);

  const nodeCount = visibleNodes.length;
  const edgeCount = visibleEdges.length;

  // Para 2, 3 o 4 componentes independientes (ej. DataStage con 2 jobs o Shell con 3 scripts),
  // agruparlos juntos y centrados con espaciado natural (evitando vacíos de 800px entre ellos)
  if (nodeCount <= 4 && edgeCount === 0) {
    const centerX = cy.width() / 2;
    const centerY = cy.height() / 2;
    const spacingX = 260;
    const totalWidth = (nodeCount - 1) * spacingX;
    const startX = centerX - totalWidth / 2;

    visibleNodes.forEach((node, idx) => {
      node.animate({
        position: { x: startX + idx * spacingX, y: centerY },
      }, {
        duration: 350,
        easing: 'ease-in-out-cubic',
      });
    });
    setTimeout(() => {
      cy.fit(visibleNodes, 120);
    }, 370);
    return;
  }

  // Caso Dashboard con Pipeline conectado + Catálogo de BigQuery (Vista "Todas" o grafos mixtos)
  const isDashboardProximity =
    preferredLayout !== 'dagre' &&
    nodeCount > 10 &&
    edgeCount > 0 &&
    edgeCount / nodeCount < 0.35;

  if (isDashboardProximity) {
    layoutProximityDashboard(cy, visibleNodes, visibleEdges, 10);
    return;
  }

  // Si hay varios nodos con pocas o ninguna arista entre sí (ej. 76 tablas BigQuery aisladas),
  // se organizan en una cuadrícula rectangular armoniosa (Grid) en lugar de una lista vertical infinita.
  const isCatalog =
    preferredLayout === 'grid' ||
    (preferredLayout !== 'dagre' && (
      edgeCount === 0 || (nodeCount > 3 && edgeCount / nodeCount < 0.25)
    ));

  let layoutOptions: any;

  if (isCatalog) {
    // Proporción rectangular apaisada (similar a 16:9 / 4:3)
    const cols = Math.min(10, Math.max(2, Math.ceil(Math.sqrt(nodeCount * 1.6))));
    layoutOptions = {
      name: 'grid',
      fit: true,
      padding: 45,
      cols: cols,
      avoidOverlap: true,
      nodeDimensionsIncludeLabels: true,
      animate: true,
      animationDuration: 350,
      animationEasing: 'ease-in-out-cubic',
    };
  } else {
    // Para pipelines y linajes conectados específicos: Layout jerárquico Dagre de izquierda a derecha
    layoutOptions = {
      name: 'dagre',
      // @ts-ignore
      rankDir: 'LR',
      nodeSep: 50,
      rankSep: 90,
      fit: true,
      padding: 45,
      animate: true,
      animationDuration: 350,
      animationEasing: 'ease-in-out-cubic',
    };
  }

  try {
    const layout = visibleElements.layout(layoutOptions);
    layout.run();
  } catch (err) {
    console.warn("Fallback de layout activado:", err);
    try {
      const fallback = visibleElements.layout({
        name: isCatalog ? 'grid' : 'cose',
        animate: false,
        fit: true,
        padding: 40,
      });
      fallback.run();
    } catch (e) {
      cy.fit(visibleElements, 40);
    }
  }
};

export const LineageGraphView: React.FC<LineageGraphViewProps> = ({ onSelectNode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const [minConfidence, setMinConfidence] = useState<number>(0.0);
  const [totalNodes, setTotalNodes] = useState<number>(0);
  const [totalEdges, setTotalEdges] = useState<number>(0);
  const [allNodes, setAllNodes] = useState<NodeData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filtro de tecnología (BigQuery, DataStage, Composer, Control-M, Shells, etc.)
  const [selectedTechFilter, setSelectedTechFilter] = useState<string>('TODOS');

  // Buscador y aislamiento upstream/downstream
  const [selectedSearchNodeId, setSelectedSearchNodeId] = useState<string>('');
  const [lineageMode, setLineageMode] = useState<'NONE' | 'UPSTREAM' | 'DOWNSTREAM' | 'FULL'>('NONE');

  // Tooltips interactivos
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Cargar datos desde la API
  const fetchGraph = async (confidence: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/lineage/graph?min_confidence=${confidence}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Fallo al consultar grafo de linaje`);
      }
      const data = await res.json();
      setTotalNodes(data.total_nodes);
      setTotalEdges(data.total_edges);
      setAllNodes(data.nodes || []);
      renderCytoscape(data.nodes || [], data.edges || []);
    } catch (err: any) {
      console.error("Error al cargar grafo de linaje:", err);
      // Reporte automático al backend para la consola de errores
      fetch('/api/errors/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error_type: err.name || 'GraphFetchError',
          message: err.message || 'Error de red o procesamiento al consultar grafo de linaje',
          stack_trace: err.stack || '',
          component: 'FRONTEND:LineageGraphView',
          severity: 'WARNING',
          url: window.location.href,
          user_agent: navigator.userAgent,
          context_data: { confidence }
        })
      }).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  // Filtrar y enfocar por tecnología (ocultando estrictamente los demás componentes y recalculando layout)
  const handleFilterByTech = (tech: string) => {
    setSelectedTechFilter(tech);
    const cy = cyRef.current;
    if (!cy) return;

    // Reiniciar búsqueda específica de nodo si estaba activa
    setSelectedSearchNodeId('');
    setLineageMode('NONE');

    if (tech === 'TODOS') {
      cy.batch(() => {
        cy.elements().show();
      });
      relayoutVisibleElements(cy);
      return;
    }

    let matchingNodes = cy.nodes();

    if (tech === 'OTROS') {
      matchingNodes = matchingNodes.filter((ele) => {
        const t = ele.data('tool_type');
        return !['BIGQUERY', 'DATASTAGE', 'AIRFLOW_COMPOSER', 'CONTROL_M', 'SHELL'].includes(t);
      });
    } else {
      matchingNodes = matchingNodes.filter((ele) => ele.data('tool_type') === tech);
    }

    const nonMatchingNodes = cy.nodes().not(matchingNodes);

    // Ocultar elementos ajenos y mostrar coincidentes en un solo batch atómico
    cy.batch(() => {
      cy.elements().show();
      nonMatchingNodes.hide();
    });

    // Recalcular layout adaptativo: grid para catálogos como BigQuery o Dagre para pipelines
    relayoutVisibleElements(cy);
  };

  const renderCytoscape = (nodes: NodeData[], edges: EdgeData[]) => {
    if (!containerRef.current) return;

    // 1. Integridad Referencial: Garantizar que cada arista tenga sus nodos fuente y destino
    const nodeMap = new Map<string, NodeData>(nodes.map((n) => [n.id, n]));

    edges.forEach((e) => {
      if (!nodeMap.has(e.source_id)) {
        const parts = e.source_id.split(':');
        const tool = parts.length > 1 ? parts[0] : 'GENERIC_TOOL';
        const name = parts.length > 1 ? parts.slice(1).join(':') : e.source_id;
        nodeMap.set(e.source_id, {
          id: e.source_id,
          name: name,
          tool_type: tool,
          layer: 'PROCESSING',
          status: 'SUCCESS'
        });
      }
      if (!nodeMap.has(e.target_id)) {
        const parts = e.target_id.split(':');
        const tool = parts.length > 1 ? parts[0] : 'BIGQUERY';
        const name = parts.length > 1 ? parts.slice(1).join(':') : e.target_id;
        nodeMap.set(e.target_id, {
          id: e.target_id,
          name: name,
          tool_type: tool,
          layer: tool === 'BIGQUERY' ? 'STORAGE' : 'PROCESSING',
          status: 'SUCCESS'
        });
      }
    });

    const safeNodes = Array.from(nodeMap.values());
    const validNodeIds = new Set(safeNodes.map((n) => n.id));
    const safeEdges = edges.filter((e) => validNodeIds.has(e.source_id) && validNodeIds.has(e.target_id));

    const elements: cytoscape.ElementDefinition[] = [
      ...safeNodes.map((n) => {
        let statusColor = '#9CA3AF'; // PENDING (Gris)
        if (n.status === 'SUCCESS') statusColor = '#2E7D32'; // OK (Verde)
        if (n.status === 'RUNNING') statusColor = '#0284C7'; // RUNNING (Azul)
        if (n.status === 'FAILED') statusColor = '#C62828';  // ERROR (Rojo)

        const { label, nodeWidth, nodeHeight, textMaxWidth } = formatNodeBox(n.tool_type, n.name);

        return {
          data: {
            id: n.id,
            label: label,
            nodeWidth: nodeWidth,
            nodeHeight: nodeHeight,
            textMaxWidth: textMaxWidth,
            tool_type: n.tool_type,
            statusColor: statusColor,
            nodeRaw: n,
          },
        };
      }),
      ...safeEdges.map((e) => ({
        data: {
          id: e.id,
          source: e.source_id,
          target: e.target_id,
          label: `${Math.round(e.confidence_score * 100)}%`,
          confidence: e.confidence_score,
          isDashed: e.confidence_score < 1.0,
          edgeRaw: e,
        },
      })),
    ];

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    try {
      const cy = cytoscape({
        container: containerRef.current,
        elements: elements,
        wheelSensitivity: 0.2, // Zoom suave, sin saltos bruscos
        minZoom: 0.15,         // Límite mínimo amplio para ver todo el grafo
        maxZoom: 2.5,          // Límite máximo para no pixelar
        style: [
          {
            selector: 'node',
            style: {
              'shape': 'round-rectangle',
              'background-color': '#FFFFFF',
              'border-width': 2.5,
              'border-color': 'data(statusColor)',
              'label': 'data(label)',
              'color': '#1F2937',
              'font-size': '10px',
              'font-weight': '600',
              'text-valign': 'center',
              'text-halign': 'center',
              'text-wrap': 'wrap',
              'text-max-width': 'data(textMaxWidth)',
              'width': 'data(nodeWidth)',
              'height': 'data(nodeHeight)',
              'padding': '6px',
            } as any,
          },
          {
            selector: 'node:selected',
            style: {
              'border-width': 4,
              'border-color': '#731853',
              'background-color': '#FAF0F5',
            },
          },
          {
            selector: 'edge',
            style: {
              'width': 2,
              'line-color': '#9CA3AF',
              'target-arrow-color': '#9CA3AF',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              'label': 'data(label)',
              'font-size': '10px',
              'font-weight': 'bold',
              'color': '#731853',
              'text-background-color': '#FAF0F5',
              'text-background-opacity': 0.9,
              'text-background-padding': '2px',
              'line-style': (ele: any) => (ele.data('isDashed') ? 'dashed' : 'solid'),
            },
          },
        ],
        layout: {
          name: 'dagre',
          // @ts-ignore
          rankDir: 'LR',
          nodeSep: 55,
          rankSep: 95,
        },
      });

      cy.on('tap', 'node', (evt) => {
        const nodeData = evt.target.data('nodeRaw');
        if (nodeData) {
          onSelectNode(nodeData);
        }
      });

      cyRef.current = cy;

      // Asegurar centrado y ajuste automático tras el cálculo del layout adaptativo
      setTimeout(() => {
        if (cyRef.current) {
          cyRef.current.resize();
          relayoutVisibleElements(cyRef.current);
        }
      }, 150);
    } catch (renderError) {
      console.error("Fallo con layout dagre, aplicando fallback a layout cose:", renderError);
      const fallbackCy = cytoscape({
        container: containerRef.current,
        elements: elements,
        layout: { name: 'cose', animate: false },
      });
      cyRef.current = fallbackCy;
      setTimeout(() => {
        if (cyRef.current) {
          cyRef.current.resize();
          relayoutVisibleElements(cyRef.current);
        }
      }, 150);
    }
  };

  // Conexión a WebSocket para telemetría en tiempo real y listeners de ventana
  useEffect(() => {
    fetchGraph(minConfidence);

    const handleWindowResize = () => {
      if (cyRef.current) {
        cyRef.current.resize();
        cyRef.current.fit(undefined, 40);
      }
    };
    window.addEventListener('resize', handleWindowResize);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'STATUS_UPDATE') {
          const cy = cyRef.current;
          if (cy) {
            const node = cy.getElementById(msg.node_id);
            if (node.length > 0) {
              let color = '#9CA3AF';
              if (msg.status === 'SUCCESS') color = '#2E7D32';
              if (msg.status === 'RUNNING') color = '#0284C7';
              if (msg.status === 'FAILED') color = '#C62828';
              node.style('border-color', color);
            }
          }
        } else if (msg.type === 'NEW_FILE_PROCESSED') {
          fetchGraph(minConfidence);
        }
      } catch (e) {
        console.error("Error parsing ws event", e);
      }
    };

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      ws.close();
      if (cyRef.current) {
        cyRef.current.destroy();
      }
    };
  }, []);

  // Función para centrar y reajustar el grafo
  const handleCenterGraph = () => {
    if (cyRef.current) {
      cyRef.current.fit(undefined, 50);
      cyRef.current.center();
    }
  };

  // Función para filtrar y aislar el linaje de un componente (ocultando todo lo demás y recalculando el flujo)
  const applyLineageFilter = (query: string, mode: 'UPSTREAM' | 'DOWNSTREAM' | 'FULL') => {
    const cy = cyRef.current;
    if (!cy) return;

    const trimmed = query.trim();
    if (!trimmed) {
      clearLineageFilter();
      return;
    }

    // 1. Localizar el nodo objetivo (por ID exacto o coincidencia por nombre/ID)
    let targetNodes = cy.getElementById(trimmed);
    if (targetNodes.length === 0) {
      const qLower = trimmed.toLowerCase();
      targetNodes = cy.nodes().filter((ele) => {
        const raw = ele.data('nodeRaw');
        const name = (raw?.name || '').toLowerCase();
        const id = ele.id().toLowerCase();
        return name.includes(qLower) || id.includes(qLower);
      });
    }

    if (targetNodes.length === 0) {
      return;
    }

    setLineageMode(mode);

    // 2. Extraer colección de linaje según el modo
    let lineageCollection = cy.collection().add(targetNodes);

    if (mode === 'UPSTREAM') {
      // Predecesores (origen / ingesta)
      const preds = targetNodes.predecessors();
      lineageCollection = lineageCollection.add(preds);
    } else if (mode === 'DOWNSTREAM') {
      // Sucesores (consumo / destino)
      const succs = targetNodes.successors();
      lineageCollection = lineageCollection.add(succs);
    } else if (mode === 'FULL') {
      // Ambos sentidos (flujo completo de impacto)
      const preds = targetNodes.predecessors();
      const succs = targetNodes.successors();
      lineageCollection = lineageCollection.add(preds).add(succs);
    }

    // 3. Ocultar TODO lo que NO pertenezca al linaje seleccionado en batch
    cy.batch(() => {
      cy.elements().hide();
      lineageCollection.show();
    });

    // 4. Re-calcular layout del linaje conectado de izquierda a derecha (Dagre)
    relayoutVisibleElements(cy, 'dagre');

    // Seleccionar visualmente los nodos coincidentes
    targetNodes.select();
  };

  const clearLineageFilter = () => {
    const cy = cyRef.current;
    if (cy) {
      // Si hay un filtro de tecnología activo diferente a 'TODOS', reaplicarlo
      if (selectedTechFilter !== 'TODOS') {
        let matchingNodes = cy.nodes();
        if (selectedTechFilter === 'OTROS') {
          matchingNodes = matchingNodes.filter((ele) => {
            const t = ele.data('tool_type');
            return !['BIGQUERY', 'DATASTAGE', 'AIRFLOW_COMPOSER', 'CONTROL_M', 'SHELL'].includes(t);
          });
        } else {
          matchingNodes = matchingNodes.filter((ele) => ele.data('tool_type') === selectedTechFilter);
        }
        cy.batch(() => {
          cy.elements().show();
          cy.nodes().not(matchingNodes).hide();
        });
        relayoutVisibleElements(cy);
      } else {
        cy.batch(() => {
          cy.elements().show();
        });
        relayoutVisibleElements(cy);
      }
    }
    setLineageMode('NONE');
    setSelectedSearchNodeId('');
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 120px)', minHeight: '700px', backgroundColor: '#F8F9FA' }}>
      <style>{`
        .faded { opacity: 0.15 !important; }
        .info-btn { 
          background: none; 
          border: none; 
          cursor: pointer; 
          color: #9CA3AF; 
          display: flex; 
          align-items: center; 
          padding: 2px;
          border-radius: 50%;
        }
        .info-btn:hover { color: #731853; }
      `}</style>

      {/* Barra de Herramientas Superior */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 10,
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          padding: '10px 16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap'
        }}
      >
        {/* 1. Filtro de Certeza */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
          <Sliders size={18} color="#731853" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
            Filtro de Certeza:
          </span>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={minConfidence}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setMinConfidence(val);
              fetchGraph(val);
            }}
            style={{ accentColor: '#731853', width: '110px', cursor: 'pointer' }}
          />
          <span className="badge badge-brand" style={{ fontSize: '11px' }}>
            ≥ {Math.round(minConfidence * 100)}%
          </span>

          <button 
            className="info-btn" 
            onClick={() => setActiveTooltip(activeTooltip === 'CONFIDENCE' ? null : 'CONFIDENCE')}
            title="¿Qué es el Filtro de Certeza?"
          >
            <Info size={15} />
          </button>

          {activeTooltip === 'CONFIDENCE' && (
            <div style={{
              position: 'absolute',
              top: '32px',
              left: 0,
              width: '260px',
              backgroundColor: '#1E293B',
              color: '#F8FAFC',
              fontSize: '11px',
              padding: '10px 12px',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              zIndex: 30,
              lineHeight: '1.4'
            }}>
              <b>Filtro de Certeza:</b> Oculta dependencias inferidas por IA con score inferior al umbral. Las líneas continuas son deterministas (100%), las discontinuas fueron inferidas por Gemini Flash o Pro.
            </div>
          )}
        </div>

        <div style={{ height: '20px', width: '1px', backgroundColor: '#E5E7EB' }} />

        {/* 2. Buscador y Trazabilidad Upstream / Downstream */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
          <Search size={16} color="#6B7280" />
          <input
            type="text"
            list="nodes-datalist"
            placeholder="Buscar componente..."
            value={selectedSearchNodeId}
            onChange={(e) => {
              setSelectedSearchNodeId(e.target.value);
              if (e.target.value) {
                applyLineageFilter(e.target.value, 'FULL');
              } else {
                clearLineageFilter();
              }
            }}
            style={{
              padding: '5px 10px',
              fontSize: '12px',
              borderRadius: '6px',
              border: '1px solid #D1D5DB',
              width: '180px'
            }}
          />
          <datalist id="nodes-datalist">
            {allNodes.map(n => (
              <option key={n.id} value={n.id}>{n.name} ({n.tool_type})</option>
            ))}
          </datalist>

          {selectedSearchNodeId && (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => applyLineageFilter(selectedSearchNodeId, 'UPSTREAM')}
                className="btn-secondary"
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  backgroundColor: lineageMode === 'UPSTREAM' ? '#FAF0F5' : '#FFF',
                  borderColor: lineageMode === 'UPSTREAM' ? '#731853' : '#D1D5DB',
                  color: lineageMode === 'UPSTREAM' ? '#731853' : '#374151'
                }}
                title="Ver linaje hacia atrás (origen / ingesta)"
              >
                <ArrowLeft size={13} /> Origen
              </button>

              <button
                onClick={() => applyLineageFilter(selectedSearchNodeId, 'DOWNSTREAM')}
                className="btn-secondary"
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  backgroundColor: lineageMode === 'DOWNSTREAM' ? '#FAF0F5' : '#FFF',
                  borderColor: lineageMode === 'DOWNSTREAM' ? '#731853' : '#D1D5DB',
                  color: lineageMode === 'DOWNSTREAM' ? '#731853' : '#374151'
                }}
                title="Ver linaje hacia adelante (consumo / destino)"
              >
                Destino <ArrowRight size={13} />
              </button>

              <button
                onClick={() => applyLineageFilter(selectedSearchNodeId, 'FULL')}
                className="btn-secondary"
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  backgroundColor: lineageMode === 'FULL' ? '#FAF0F5' : '#FFF',
                  borderColor: lineageMode === 'FULL' ? '#731853' : '#D1D5DB',
                  color: lineageMode === 'FULL' ? '#731853' : '#374151'
                }}
                title="Ver linaje completo (origen y destino)"
              >
                Todo
              </button>

              <button
                onClick={clearLineageFilter}
                className="btn-secondary"
                style={{ padding: '4px 6px', fontSize: '11px' }}
                title="Limpiar filtro de nodo"
              >
                <X size={13} />
              </button>
            </div>
          )}

          <button 
            className="info-btn" 
            onClick={() => setActiveTooltip(activeTooltip === 'SEARCH' ? null : 'SEARCH')}
            title="¿Cómo funciona el buscador de impacto?"
          >
            <Info size={15} />
          </button>

          {activeTooltip === 'SEARCH' && (
            <div style={{
              position: 'absolute',
              top: '32px',
              left: 0,
              width: '260px',
              backgroundColor: '#1E293B',
              color: '#F8FAFC',
              fontSize: '11px',
              padding: '10px 12px',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              zIndex: 30,
              lineHeight: '1.4'
            }}>
              <b>Análisis de Impacto:</b> Seleccione un componente para aislar su flujo. <b>Origen (Upstream)</b> muestra qué jobs o scripts lo alimentan; <b>Destino (Downstream)</b> muestra qué tablas o reportes consumen sus datos.
            </div>
          )}
        </div>

        <div style={{ height: '20px', width: '1px', backgroundColor: '#E5E7EB' }} />

        {/* 3. Filtros Rápidos por Tecnología */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', marginRight: '3px' }}>
            Tecnología:
          </span>
          {[
            { id: 'TODOS', label: 'Todas' },
            { id: 'BIGQUERY', label: 'BigQuery' },
            { id: 'DATASTAGE', label: 'DataStage' },
            { id: 'AIRFLOW_COMPOSER', label: 'Composer' },
            { id: 'CONTROL_M', label: 'Control-M' },
            { id: 'SHELL', label: 'Shell' },
            { id: 'OTROS', label: 'Otros' },
          ].map((tech) => (
            <button
              key={tech.id}
              onClick={() => handleFilterByTech(tech.id)}
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '12px',
                border: selectedTechFilter === tech.id ? '1px solid #731853' : '1px solid #E5E7EB',
                backgroundColor: selectedTechFilter === tech.id ? '#731853' : '#F9FAFB',
                color: selectedTechFilter === tech.id ? '#FFFFFF' : '#374151',
                fontWeight: selectedTechFilter === tech.id ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tech.label}
            </button>
          ))}
        </div>

        <div style={{ height: '20px', width: '1px', backgroundColor: '#E5E7EB' }} />

        {/* 4. Resumen y Controles de Vista */}
        <div style={{ fontSize: '12px', color: '#6B7280' }}>
          <b>{totalNodes}</b> componentes | <b>{totalEdges}</b> dependencias
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {/* Botón Centrar Grafo */}
          <button
            className="btn-secondary"
            onClick={handleCenterGraph}
            title="Centrar Grafo en pantalla"
            style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600 }}
          >
            <Maximize2 size={15} />
            Centrar
          </button>

          {/* Botón Reorganizar Layout */}
          <button
            className="btn-secondary"
            onClick={() => cyRef.current && relayoutVisibleElements(cyRef.current)}
            title="Reorganizar y alinear nodos visibles en pantalla"
            style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600 }}
          >
            <LayoutGrid size={15} />
            Reorganizar
          </button>

          <button
            className="btn-secondary"
            onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2)}
            title="Acercar"
            style={{ padding: '6px' }}
          >
            <ZoomIn size={16} />
          </button>

          <button
            className="btn-secondary"
            onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)}
            title="Alejar"
            style={{ padding: '6px' }}
          >
            <ZoomOut size={16} />
          </button>

          <button
            className="btn-secondary"
            onClick={() => fetchGraph(minConfidence)}
            title="Refrescar datos"
            style={{ padding: '6px' }}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Leyenda de Semáforos */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          zIndex: 10,
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          padding: '8px 14px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
          border: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          fontSize: '12px',
          fontWeight: 600,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#2E7D32' }} />
          <span>Éxito</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#0284C7' }} />
          <span>Ejecutando</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#C62828' }} />
          <span>Fallo</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#9CA3AF' }} />
          <span>Pendiente</span>
        </div>

        <button 
          className="info-btn" 
          onClick={() => setActiveTooltip(activeTooltip === 'STATUS' ? null : 'STATUS')}
          title="Telemetría en tiempo real"
        >
          <Info size={14} />
        </button>

        {activeTooltip === 'STATUS' && (
          <div style={{
            position: 'absolute',
            bottom: '36px',
            left: 0,
            width: '280px',
            backgroundColor: '#1E293B',
            color: '#F8FAFC',
            fontSize: '11px',
            padding: '10px 12px',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: 30,
            lineHeight: '1.4'
          }}>
            <b>Telemetría en Vivo:</b> Los bordes de los nodos cambian de color en tiempo real conforme llegan eventos de ejecución vía WebSocket (/ws/telemetry) procedentes de Cloud Logging y Pub/Sub.
          </div>
        )}
      </div>

      {/* Canvas Cytoscape */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

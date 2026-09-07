import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
// @ts-ignore
import dagre from 'cytoscape-dagre';
import { 
  Sliders, RefreshCw, ZoomIn, ZoomOut, Maximize2, 
  Search, ArrowLeft, ArrowRight, RotateCcw, Info, X
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

  // Filtrar y enfocar por tecnología (ocultando estrictamente los demás componentes)
  const handleFilterByTech = (tech: string) => {
    setSelectedTechFilter(tech);
    const cy = cyRef.current;
    if (!cy) return;

    // Reiniciar búsqueda específica de nodo si estaba activa
    setSelectedSearchNodeId('');
    setLineageMode('NONE');

    if (tech === 'TODOS') {
      cy.elements().show();
      cy.fit(undefined, 40);
      return;
    }

    // Mostrar todo primero para aplicar el nuevo filtro
    cy.elements().show();

    let matchingNodes = cy.nodes();

    if (tech === 'OTROS') {
      matchingNodes = matchingNodes.filter((ele) => {
        const t = ele.data('tool_type');
        return !['BIGQUERY', 'DATASTAGE', 'AIRFLOW_COMPOSER', 'CONTROL_M', 'SHELL'].includes(t);
      });
    } else {
      matchingNodes = matchingNodes.filter((ele) => ele.data('tool_type') === tech);
    }

    // Ocultar TODO lo que NO pertenezca a este tipo de elementos
    const nonMatchingNodes = cy.nodes().not(matchingNodes);
    nonMatchingNodes.hide();

    if (matchingNodes.length > 0) {
      cy.fit(matchingNodes, 50);
    }
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

      // Asegurar centrado y ajuste automático tras el cálculo del layout
      setTimeout(() => {
        if (cyRef.current) {
          cyRef.current.resize();
          cyRef.current.fit(undefined, 40);
        }
      }, 200);
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
          cyRef.current.fit(undefined, 40);
        }
      }, 200);
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

  // Función para filtrar y aislar el linaje de un componente (ocultando todo lo demás)
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

    // 3. Ocultar TODO lo que NO pertenezca al linaje seleccionado
    cy.elements().hide();
    lineageCollection.show();

    // 4. Centrar y reajustar cámara sobre el linaje visible
    cy.fit(lineageCollection, 60);

    // Seleccionar visualmente los nodos coincidentes
    targetNodes.select();
  };

  const clearLineageFilter = () => {
    const cy = cyRef.current;
    if (cy) {
      cy.elements().show();
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
        cy.nodes().not(matchingNodes).hide();
        if (matchingNodes.length > 0) {
          cy.fit(matchingNodes, 50);
        }
      } else {
        cy.fit(undefined, 40);
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

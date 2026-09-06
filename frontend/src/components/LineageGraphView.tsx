import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
// @ts-ignore
import dagre from 'cytoscape-dagre';
import { Sliders, RefreshCw, ZoomIn, ZoomOut, Maximize2, ShieldAlert } from 'lucide-react';

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

export const LineageGraphView: React.FC<LineageGraphViewProps> = ({ onSelectNode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const [minConfidence, setMinConfidence] = useState<number>(0.80);
  const [totalNodes, setTotalNodes] = useState<number>(0);
  const [totalEdges, setTotalEdges] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Cargar datos desde la API
  const fetchGraph = async (confidence: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/lineage/graph?min_confidence=${confidence}`);
      const data = await res.json();
      setTotalNodes(data.total_nodes);
      setTotalEdges(data.total_edges);
      renderCytoscape(data.nodes, data.edges);
    } catch (err) {
      console.error("Error al cargar grafo de linaje:", err);
    } finally {
      setLoading(false);
    }
  };

  const renderCytoscape = (nodes: NodeData[], edges: EdgeData[]) => {
    if (!containerRef.current) return;

    const elements: cytoscape.ElementDefinition[] = [
      ...nodes.map((n) => {
        let statusColor = '#9CA3AF'; // PENDING (Gris)
        if (n.status === 'SUCCESS') statusColor = '#2E7D32'; // OK (Verde)
        if (n.status === 'RUNNING') statusColor = '#0284C7'; // RUNNING (Azul)
        if (n.status === 'FAILED') statusColor = '#C62828';  // ERROR (Rojo)

        return {
          data: {
            id: n.id,
            label: `${n.tool_type}\n${n.name}`,
            tool_type: n.tool_type,
            statusColor: statusColor,
            nodeRaw: n,
          },
        };
      }),
      ...edges.map((e) => ({
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

    const cy = cytoscape({
      container: containerRef.current,
      elements: elements,
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
            'font-size': '11px',
            'font-weight': 'bold',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': '120px',
            'width': '140px',
            'height': '65px',
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
        rankDir: 'LR', // De izquierda a derecha
        nodeSep: 50,
        rankSep: 80,
      },
    });

    cy.on('tap', 'node', (evt) => {
      const nodeData = evt.target.data('nodeRaw');
      if (nodeData) {
        onSelectNode(nodeData);
      }
    });

    cyRef.current = cy;
  };

  // Conexión a WebSocket para telemetría en tiempo real
  useEffect(() => {
    fetchGraph(minConfidence);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'STATUS_UPDATE') {
          // Actualizar dinámicamente el color del nodo en el canvas
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
      ws.close();
      if (cyRef.current) {
        cyRef.current.destroy();
      }
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 140px)', backgroundColor: '#F8F9FA' }}>
      {/* Barra de Herramientas y Filtro de Certeza */}
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
          gap: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders size={18} color="#731853" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
            Filtro de Certeza:
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={minConfidence}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setMinConfidence(val);
              fetchGraph(val);
            }}
            style={{ accentColor: '#731853', width: '120px', cursor: 'pointer' }}
          />
          <span className="badge badge-brand" style={{ fontSize: '11px' }}>
            ≥ {Math.round(minConfidence * 100)}%
          </span>
        </div>

        <div style={{ height: '20px', width: '1px', backgroundColor: '#E5E7EB' }} />

        {/* Resumen de elementos */}
        <div style={{ fontSize: '12px', color: '#6B7280' }}>
          <b>{totalNodes}</b> componentes | <b>{totalEdges}</b> dependencias
        </div>

        {/* Controles de Vista */}
        <div style={{ display: 'flex', gap: '6px' }}>
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
            onClick={() => cyRef.current?.fit()}
            title="Ajustar pantalla"
            style={{ padding: '6px' }}
          >
            <Maximize2 size={16} />
          </button>
          <button
            className="btn-secondary"
            onClick={() => fetchGraph(minConfidence)}
            title="Refrescar"
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
      </div>

      {/* Canvas Cytoscape */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

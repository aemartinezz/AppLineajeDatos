import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
// @ts-ignore
import dagre from 'cytoscape-dagre';
import { 
  Code, Server, Layers, Cpu, Database, Cloud, 
  ZoomIn, ZoomOut, Maximize2, RefreshCw, Filter, 
  Search, ShieldAlert, X, ChevronRight, HelpCircle
} from 'lucide-react';

if (typeof cytoscape('core', 'dagre') === 'undefined') {
  cytoscape.use(dagre);
}

interface ArchNode {
  id: string;
  label: string;
  category: string;
  layer: string;
  file_path: string;
  description: string;
  guide_to_modify: string;
  color: string;
}

interface ArchEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  relation_type: string;
}

interface ArchitectureDocsViewProps {
  userRole: string;
  onChangeRole: (role: string) => void;
}

export const ArchitectureDocsView: React.FC<ArchitectureDocsViewProps> = ({ userRole, onChangeRole }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const [graphData, setGraphData] = useState<{ nodes: ArchNode[]; edges: ArchEdge[]; metadata: any } | null>(null);
  const [selectedNode, setSelectedNode] = useState<ArchNode | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  const isAuthorized = userRole === 'Developer' || userRole === 'Admin';

  const fetchArchitecture = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/architecture/graph');
      const data = await res.json();
      setGraphData(data);
      renderCytoscape(data.nodes, data.edges, activeCategory);
    } catch (err) {
      console.error("Error al cargar grafo de arquitectura:", err);
    } finally {
      setLoading(false);
    }
  };

  const renderCytoscape = (nodes: ArchNode[], edges: ArchEdge[], categoryFilter: string) => {
    if (!containerRef.current) return;

    let filteredNodes = nodes;
    if (categoryFilter !== 'ALL') {
      filteredNodes = nodes.filter(n => n.category === categoryFilter);
    }

    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

    const elements: cytoscape.ElementDefinition[] = [
      ...filteredNodes.map((n) => ({
        data: {
          id: n.id,
          label: n.label,
          color: n.color,
          nodeRaw: n,
        },
      })),
      ...filteredEdges.map((e) => ({
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
        },
      })),
    ];

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: elements,
      wheelSensitivity: 0.12,
      minZoom: 0.25,
      maxZoom: 2.2,
      style: [
        {
          selector: 'node',
          style: {
            'shape': 'round-rectangle',
            'background-color': '#FFFFFF',
            'border-width': 2.5,
            'border-color': 'data(color)',
            'label': 'data(label)',
            'color': '#111827',
            'font-size': '11px',
            'font-weight': 600,
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': '140px',
            'width': '155px',
            'height': '65px',
            'box-shadow': '0 2px 4px rgba(0,0,0,0.05)',
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
            'line-color': '#CBD5E1',
            'target-arrow-color': '#94A3B8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '9px',
            'color': '#64748B',
            'text-background-color': '#FFFFFF',
            'text-background-opacity': 0.85,
            'text-background-padding': '2px',
          },
        },
      ],
      layout: {
        name: 'dagre',
        // @ts-ignore
        rankDir: 'TB', // De arriba a abajo (Arquitectura jerárquica)
        nodeSep: 40,
        rankSep: 70,
      },
    });

    cy.on('tap', 'node', (evt) => {
      const nodeData = evt.target.data('nodeRaw');
      if (nodeData) {
        setSelectedNode(nodeData);
      }
    });

    cyRef.current = cy;
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchArchitecture();
    }
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
      }
    };
  }, [isAuthorized]);

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    if (graphData) {
      renderCytoscape(graphData.nodes, graphData.edges, cat);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    const cy = cyRef.current;
    if (!cy) return;

    if (!term.trim()) {
      cy.elements().removeClass('faded');
      cy.fit(undefined, 40);
      return;
    }

    const matchedNodes = cy.nodes().filter((ele) => {
      const raw = ele.data('nodeRaw') as ArchNode;
      return raw.label.toLowerCase().includes(term.toLowerCase()) || 
             raw.file_path.toLowerCase().includes(term.toLowerCase());
    });

    if (matchedNodes.length > 0) {
      cy.elements().addClass('faded');
      matchedNodes.removeClass('faded');
      matchedNodes.connectedEdges().removeClass('faded');
      cy.center(matchedNodes[0]);
      cy.zoom(1.2);
    }
  };

  if (!isAuthorized) {
    return (
      <div style={{ maxWidth: 800, margin: '60px auto', padding: '32px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', textAlign: 'center' }}>
        <ShieldAlert size={48} color="#731853" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
          Acceso Restringido a Roles Developer y Admin
        </h2>
        <p style={{ fontSize: '14px', color: '#4B5563', lineHeight: '1.6', marginBottom: '24px' }}>
          El mapa vivo de arquitectura de código introspecta las rutas internas de FastAPI, los servicios de backend, motores de inferencia y contratos de API. Esta vista está reservada para personal técnico.
        </p>
        <button 
          className="btn-primary"
          onClick={() => onChangeRole('Developer')}
          style={{ padding: '10px 24px', fontSize: '14px' }}
        >
          Cambiar a Rol Developer para Visualizar
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 140px)', backgroundColor: '#F8FAFC' }}>
      <style>{`
        .faded { opacity: 0.15 !important; }
      `}</style>

      {/* Barra de Controles Superior */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 10,
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        padding: '10px 16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        border: '1px solid #E2E8F0',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Code size={18} color="#731853" />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>
            Arquitectura Viva:
          </span>
          {graphData && (
            <span className="badge badge-brand" style={{ fontSize: '11px' }}>
              {graphData.total_nodes} componentes | {graphData.total_edges} flujos
            </span>
          )}
        </div>

        {/* Filtros por Capa */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { key: 'ALL', label: 'Todo' },
            { key: 'FRONTEND_VIEW', label: 'Vistas React' },
            { key: 'API_ROUTE', label: 'Endpoints API' },
            { key: 'SERVICE', label: 'Servicios' },
            { key: 'ENGINE', label: 'Motores IA' },
            { key: 'GCP_RESOURCE', label: 'GCP Cloud' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => handleCategoryChange(tab.key)}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '6px',
                border: activeCategory === tab.key ? '1px solid #731853' : '1px solid #E2E8F0',
                backgroundColor: activeCategory === tab.key ? '#FAF0F5' : '#FFFFFF',
                color: activeCategory === tab.key ? '#731853' : '#64748B',
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
          <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 8 }} />
          <input
            type="text"
            placeholder="Buscar componente o archivo..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            style={{
              padding: '5px 10px 5px 28px',
              fontSize: '12px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              width: '200px'
            }}
          />
        </div>

        {/* Botones de Navegación y Centrado */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className="btn-secondary"
            onClick={() => {
              if (cyRef.current) {
                cyRef.current.fit(undefined, 40);
                cyRef.current.center();
              }
            }}
            title="Centrar arquitectura en pantalla"
            style={{ padding: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}
          >
            <Maximize2 size={14} /> Centrar
          </button>
          <button
            className="btn-secondary"
            onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2)}
            title="Acercar zoom"
            style={{ padding: '6px' }}
          >
            <ZoomIn size={14} />
          </button>
          <button
            className="btn-secondary"
            onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)}
            title="Alejar zoom"
            style={{ padding: '6px' }}
          >
            <ZoomOut size={14} />
          </button>
          <button
            className="btn-secondary"
            onClick={fetchArchitecture}
            title="Re-inspeccionar código en vivo"
            style={{ padding: '6px' }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Canvas Cytoscape */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Drawer de Detalle del Componente Seleccionado */}
      {selectedNode && (
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 380,
          height: '100%',
          backgroundColor: '#ffffff',
          boxShadow: '-4px 0 16px rgba(0,0,0,0.1)',
          borderLeft: '1px solid #E2E8F0',
          zIndex: 20,
          padding: '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="badge" style={{ backgroundColor: selectedNode.color, color: '#fff', fontSize: '11px', fontWeight: 700 }}>
              {selectedNode.category}
            </span>
            <button 
              onClick={() => setSelectedNode(null)} 
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
            >
              <X size={20} />
            </button>
          </div>

          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
              {selectedNode.id}
            </h3>
            <p style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              📁 {selectedNode.file_path}
            </p>
          </div>

          <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
              Propósito y Responsabilidad:
            </span>
            <p style={{ fontSize: '12px', color: '#334155', lineHeight: '1.5' }}>
              {selectedNode.description}
            </p>
          </div>

          <div style={{ backgroundColor: '#FAF0F5', padding: '12px', borderRadius: '8px', border: '1px solid #F3D0E2' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#731853', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
              <ChevronRight size={14} /> Guía para Modificar o Extender:
            </span>
            <p style={{ fontSize: '12px', color: '#52113B', lineHeight: '1.5' }}>
              {selectedNode.guide_to_modify}
            </p>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #E2E8F0', fontSize: '11px', color: '#94A3B8', textAlign: 'center' }}>
            Introspección viva de código activo en FastAPI
          </div>
        </div>
      )}
    </div>
  );
};

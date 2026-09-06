import React, { useEffect, useState } from 'react';
import { X, FileCode, CheckCircle, Clock, AlertTriangle, Layers, Database } from 'lucide-react';

interface NodeInspectorProps {
  node: any | null;
  onClose: () => void;
}

export const NodeInspectorDrawer: React.FC<NodeInspectorProps> = ({ node, onClose }) => {
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (node) {
      // Extraer nombre de archivo si aplica
      const fileName = node.name.split('/').pop() || node.name;
      if (fileName.includes('.')) {
        setLoading(true);
        fetch(`/api/lineage/file-content/${fileName}`)
          .then((res) => res.json())
          .then((data) => setFileContent(data.content))
          .catch(() => setFileContent('# No se pudo cargar el archivo'))
          .finally(() => setLoading(false));
      } else {
        setFileContent('');
      }
    }
  }, [node]);

  if (!node) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 60,
        right: 0,
        width: '450px',
        height: 'calc(100vh - 60px)',
        backgroundColor: '#ffffff',
        borderLeft: '1px solid #E5E7EB',
        boxShadow: '-4px 0 15px rgba(0,0,0,0.06)',
        zIndex: 90,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header del Drawer */}
      <div
        style={{
          padding: '18px 24px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#FAF0F5',
        }}
      >
        <div>
          <span className="badge badge-brand" style={{ fontSize: '10px' }}>
            {node.tool_type}
          </span>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
            {node.name}
          </h3>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Contenido */}
      <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
        {/* Estado Operativo */}
        <div style={{ marginBottom: '20px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>
            Estado de Ejecución Hoy:
          </span>
          <div style={{ marginTop: '6px' }}>
            {node.status === 'SUCCESS' && (
              <span className="badge badge-ok">
                <CheckCircle size={12} style={{ marginRight: 4 }} /> Éxito (Terminado)
              </span>
            )}
            {node.status === 'RUNNING' && (
              <span className="badge badge-process">
                <Clock size={12} style={{ marginRight: 4 }} /> En Ejecución
              </span>
            )}
            {node.status === 'FAILED' && (
              <span className="badge badge-fail">
                <AlertTriangle size={12} style={{ marginRight: 4 }} /> Fallo
              </span>
            )}
            {node.status === 'PENDING' && (
              <span className="badge" style={{ backgroundColor: '#F3F4F6', color: '#4B5563' }}>
                Pendiente de Iniciar
              </span>
            )}
          </div>
        </div>

        {/* Metadatos */}
        <div style={{ marginBottom: '20px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>
            Detalles y Metadatos:
          </span>
          <div style={{ marginTop: '8px', backgroundColor: '#F9FAFB', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#6B7280' }}>Capa:</span>
              <span style={{ fontWeight: 600 }}>{node.layer || 'PROCESSING'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#6B7280' }}>Identificador:</span>
              <span style={{ fontWeight: 600, wordBreak: 'break-all' }}>{node.id}</span>
            </div>
            {node.metadata && Object.entries(node.metadata).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#6B7280' }}>{k}:</span>
                <span style={{ fontWeight: 600 }}>{String(v)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Visor de Código / Log Fuente */}
        {fileContent && (
          <div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>
              Archivo Procesado (Archivado en GCS):
            </span>
            <div
              style={{
                marginTop: '8px',
                backgroundColor: '#1E293B',
                color: '#E2E8F0',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: 'monospace',
                maxHeight: '300px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
              }}
            >
              {loading ? 'Cargando archivo...' : fileContent}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

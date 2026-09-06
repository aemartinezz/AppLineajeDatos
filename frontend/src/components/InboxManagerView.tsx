import React, { useEffect, useState } from 'react';
import { Search, Filter, Plus, Play, Eye, FileText, CheckCircle2 } from 'lucide-react';

interface InboxManagerViewProps {
  onOpenUpload: () => void;
}

export const InboxManagerView: React.FC<InboxManagerViewProps> = ({ onOpenUpload }) => {
  const [files, setFiles] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [processingFile, setProcessingFile] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchInbox = async () => {
    try {
      const res = await fetch('/api/lineage/inbox');
      const data = await res.json();
      setFiles(data.files || []);
    } catch (e) {
      console.error("Error al obtener archivos de inbox", e);
    }
  };

  useEffect(() => {
    fetchInbox();
  }, []);

  const handleProcess = async (fileName: string) => {
    setProcessingFile(fileName);
    try {
      const res = await fetch(`/api/lineage/process-inbox/${fileName}`, { method: 'POST' });
      if (res.ok) {
        setMessage(`Archivo ${fileName} procesado e integrado al grafo con éxito.`);
        fetchInbox();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingFile(null);
    }
  };

  const filtered = files.filter(f => f.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div style={{ padding: '24px 36px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Barra de Búsqueda y Botón Superior (Estilo exacto de Imagen 2) */}
      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} color="#9CA3AF" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Búsqueda de palabra clave en nombre de archivo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 42px',
              borderRadius: '6px',
              border: '1px solid #D1D5DB',
              fontSize: '14px',
              backgroundColor: '#ffffff',
            }}
          />
        </div>

        <button className="btn-secondary" style={{ height: '42px' }}>
          <Filter size={16} /> Filtros
        </button>

        <button className="btn-primary" onClick={onOpenUpload} style={{ height: '42px' }}>
          <Plus size={18} /> Cargar Archivo
        </button>
      </div>

      {message && (
        <div style={{ backgroundColor: '#F0FDF4', color: '#166534', padding: '12px 16px', borderRadius: '6px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={18} />
          {message}
        </div>
      )}

      {/* Tabla de Archivos (Estilo Imagen 2) */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
              <th style={{ padding: '12px 20px', fontWeight: 600, color: '#4B5563' }}>Nombre del Archivo</th>
              <th style={{ padding: '12px 20px', fontWeight: 600, color: '#4B5563' }}>Ubicación</th>
              <th style={{ padding: '12px 20px', fontWeight: 600, color: '#4B5563' }}>Estado</th>
              <th style={{ padding: '12px 20px', fontWeight: 600, color: '#4B5563', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '36px', textAlign: 'center', color: '#9CA3AF' }}>
                  No hay archivos pendientes en la bandeja de entrada (Inbox). Puedes cargar un archivo con el botón superior.
                </td>
              </tr>
            ) : (
              filtered.map((fileName, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #F3F4F6', transition: 'background 0.15s' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 600, color: '#111827' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={16} color="#731853" />
                      {fileName}
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', color: '#6B7280', fontFamily: 'monospace' }}>
                    gs://lineage-inbox/{fileName}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span className="badge badge-process">PENDIENTE DE PROCESAR</span>
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <button
                      className="btn-outline"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      onClick={() => handleProcess(fileName)}
                      disabled={processingFile === fileName}
                    >
                      <Play size={12} />
                      {processingFile === fileName ? 'Procesando...' : 'Procesar en Cascada'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Search, Filter, Plus, Play, Eye, FileText, CheckCircle2, RefreshCw, Layers, Archive, Loader2 } from 'lucide-react';

interface InboxManagerViewProps {
  onOpenUpload: () => void;
}

interface ProcessedFileItem {
  name: string;
  path: string;
  size_bytes: number;
  updated_at: string;
  status: string;
}

export const InboxManagerView: React.FC<InboxManagerViewProps> = ({ onOpenUpload }) => {
  const [activeTab, setActiveTab] = useState<'inbox' | 'processed'>('inbox');
  const [files, setFiles] = useState<string[]>([]);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFileItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [processingFile, setProcessingFile] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [inboxBucket, setInboxBucket] = useState<string>('gs://datosdeentrada');
  const [processedBucket, setProcessedBucket] = useState<string>('gs://datosprocesadosapp');

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        if (data.storage_config?.inbox_bucket) {
          setInboxBucket(data.storage_config.inbox_bucket);
        }
        if (data.storage_config?.processed_bucket) {
          setProcessedBucket(data.storage_config.processed_bucket);
        }
      }
    } catch (e) {
      console.error("Error al obtener config de storage", e);
    }
  };

  const fetchInbox = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/lineage/inbox');
      const data = await res.json();
      setFiles(data.files || []);
    } catch (e) {
      console.error("Error al obtener archivos de inbox", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchProcessed = async () => {
    try {
      const res = await fetch('/api/lineage/processed');
      if (res.ok) {
        const data = await res.json();
        setProcessedFiles(data.files || []);
      }
    } catch (e) {
      console.error("Error al obtener archivos procesados", e);
    }
  };

  const reloadAll = async () => {
    await Promise.all([fetchConfig(), fetchInbox(), fetchProcessed()]);
  };

  useEffect(() => {
    reloadAll();
    const interval = setInterval(fetchInbox, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleProcess = async (fileName: string) => {
    setProcessingFile(fileName);
    try {
      const res = await fetch(`/api/lineage/process-inbox/${fileName}`, { method: 'POST' });
      if (res.ok) {
        setMessage(`Archivo ${fileName} procesado e integrado al linaje con éxito.`);
        await reloadAll();
        setTimeout(() => setMessage(null), 4000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingFile(null);
    }
  };

  const filteredInbox = files.filter(f => f.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredProcessed = processedFiles.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div style={{ padding: '24px 36px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header y Selector de Pestañas */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: 0 }}>
            Bandeja de Archivos & Almacenamiento GCS
          </h1>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 0 0' }}>
            Monitoreo continuo en Google Cloud Storage: <code style={{ color: '#731853' }}>{inboxBucket}</code>
          </p>
        </div>

        {/* Pestañas de Vista */}
        <div style={{ display: 'flex', gap: '8px', backgroundColor: '#F3F4F6', padding: '4px', borderRadius: '8px' }}>
          <button
            onClick={() => setActiveTab('inbox')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: activeTab === 'inbox' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'inbox' ? '#731853' : '#6B7280',
              boxShadow: activeTab === 'inbox' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Layers size={15} /> Pendientes en Inbox ({files.length})
          </button>
          <button
            onClick={() => setActiveTab('processed')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: activeTab === 'processed' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'processed' ? '#731853' : '#6B7280',
              boxShadow: activeTab === 'processed' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Archive size={15} /> Histórico Procesados ({processedFiles.length})
          </button>
        </div>
      </div>

      {/* Barra de Búsqueda y Botones Superiores */}
      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} color="#9CA3AF" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Búsqueda por nombre de archivo o script..."
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

        <button 
          className="btn-secondary" 
          onClick={reloadAll}
          disabled={loading}
          style={{ height: '42px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refrescar
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

      {/* TAB 1: PENDIENTES EN INBOX */}
      {activeTab === 'inbox' && (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
                <th style={{ padding: '12px 20px', fontWeight: 600, color: '#4B5563' }}>Nombre del Archivo</th>
                <th style={{ padding: '12px 20px', fontWeight: 600, color: '#4B5563' }}>Ubicación en GCP</th>
                <th style={{ padding: '12px 20px', fontWeight: 600, color: '#4B5563' }}>Estado</th>
                <th style={{ padding: '12px 20px', fontWeight: 600, color: '#4B5563', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredInbox.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '36px', textAlign: 'center', color: '#9CA3AF' }}>
                    No hay archivos pendientes en la bandeja de entrada ({inboxBucket}). Puedes depositar archivos directamente en el bucket de GCS o cargarlos con el botón superior.
                  </td>
                </tr>
              ) : (
                filteredInbox.map((fileName, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #F3F4F6', transition: 'background 0.15s' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 600, color: '#111827' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={16} color="#731853" />
                        {fileName}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#6B7280', fontFamily: 'monospace' }}>
                      {inboxBucket}/{fileName}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span className="badge badge-process">PENDIENTE DE PROCESAR</span>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <button
                        className="btn-outline"
                        style={{ padding: '5px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => handleProcess(fileName)}
                        disabled={processingFile === fileName}
                      >
                        {processingFile === fileName ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                        {processingFile === fileName ? 'Procesando...' : 'Procesar en Cascada'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: HISTÓRICO PROCESADOS */}
      {activeTab === 'processed' && (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
                <th style={{ padding: '12px 20px', fontWeight: 600, color: '#4B5563' }}>Nombre del Archivo</th>
                <th style={{ padding: '12px 20px', fontWeight: 600, color: '#4B5563' }}>Ubicación de Archivo GCS</th>
                <th style={{ padding: '12px 20px', fontWeight: 600, color: '#4B5563' }}>Tamaño</th>
                <th style={{ padding: '12px 20px', fontWeight: 600, color: '#4B5563' }}>Fecha de Archivo</th>
                <th style={{ padding: '12px 20px', fontWeight: 600, color: '#4B5563', textAlign: 'right' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredProcessed.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '36px', textAlign: 'center', color: '#9CA3AF' }}>
                    Aún no hay archivos archivados en {processedBucket}.
                  </td>
                </tr>
              ) : (
                filteredProcessed.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #F3F4F6', transition: 'background 0.15s' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 600, color: '#111827' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Archive size={16} color="#16A34A" />
                        {item.name}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#6B7280', fontFamily: 'monospace' }}>
                      {item.path}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#4B5563' }}>
                      {(item.size_bytes / 1024).toFixed(1)} KB
                    </td>
                    <td style={{ padding: '14px 20px', color: '#6B7280' }}>
                      {new Date(item.updated_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <span className="badge" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                        PROCESADO & ARCHIVADO
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

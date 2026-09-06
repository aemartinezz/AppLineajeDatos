import React, { useState } from 'react';
import { UploadCloud, CheckCircle, AlertCircle, Cpu, Zap, X } from 'lucide-react';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/lineage/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Error al procesar el archivo');
      const data = await res.json();
      setResult(data);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="card"
        style={{
          width: '560px',
          maxWidth: '90%',
          padding: '28px',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <X size={20} color="#6B7280" />
        </button>

        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
          Cargar Archivo de Proceso o Log
        </h3>
        <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>
          El archivo será analizado mediante el pipeline en cascada (Parsers ➔ Filtro ML ➔ Gemini Flash ➔ Gemini Pro) y archivado automáticamente.
        </p>

        {/* Zona de Drop */}
        <div
          style={{
            border: '2px dashed #D1D5DB',
            borderRadius: '8px',
            padding: '30px 20px',
            textAlign: 'center',
            backgroundColor: '#F9FAFB',
            cursor: 'pointer',
            marginBottom: '20px',
          }}
          onClick={() => document.getElementById('fileInput')?.click()}
        >
          <input
            id="fileInput"
            type="file"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setFile(e.target.files[0]);
              }
            }}
          />
          <UploadCloud size={36} color="#731853" style={{ margin: '0 auto 8px auto' }} />
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
            {file ? file.name : 'Haz clic o arrastra un archivo aquí'}
          </div>
          <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>
            Scripts (.sh, .py, .sql), Logs de DataStage, XML de Control-M o Configs
          </div>
        </div>

        {error && (
          <div style={{ backgroundColor: '#FFEBEE', color: '#C62828', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {/* Resultado del Pipeline en Cascada */}
        {result && (
          <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>
              <CheckCircle size={18} />
              Procesado con Éxito
            </div>
            <div style={{ fontSize: '13px', color: '#1F2937', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div><b>Herramienta Detectada:</b> <span className="badge badge-brand">{result.detected_tool}</span></div>
              <div><b>Nivel de Cascada Alcanzado:</b> Nivel {result.cascade_level_reached} ({result.cascade_level_reached === 1 ? 'Parser AST/Regex' : 'Inferencia IA Gemini'})</div>
              <div><b>Porcentaje de Certeza:</b> <b>{Math.round(result.confidence_score * 100)}%</b></div>
              <div><b>Componentes y Aristas Extraídas:</b> {result.extracted_nodes.length} nodos, {result.extracted_edges.length} relaciones</div>
              <div><b>Tiempo de Ejecución:</b> {Math.round(result.processing_time_ms)} ms</div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn-secondary" onClick={onClose}>
            {result ? 'Cerrar' : 'Cancelar'}
          </button>
          {!result && (
            <button className="btn-primary" onClick={handleUpload} disabled={!file || loading}>
              {loading ? 'Procesando en Cascada...' : 'Procesar e Integrar al Grafo'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

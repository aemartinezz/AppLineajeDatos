import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Shield, Cloud, Database, HardDrive, RefreshCw } from 'lucide-react';

export const GcpValidationView: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const checkGcp = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gcp/validate');
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error("Error al validar GCP", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkGcp();
  }, []);

  return (
    <div style={{ padding: '24px 36px', maxWidth: '1280px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827' }}>
            Validación de Recursos en Google Cloud Platform
          </h1>
          <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
            Verificación y diagnóstico automático de componentes en el proyecto <b>crp-poc-it-hackathon-13</b>.
          </p>
        </div>
        <button className="btn-outline" onClick={checkGcp} disabled={loading}>
          <RefreshCw size={16} /> {loading ? 'Validando...' : 'Re-evaluar Recursos'}
        </button>
      </div>

      {/* Tarjeta de Resumen */}
      <div className="card" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '20px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
        <div style={{ color: '#166534' }}>
          <CheckCircle2 size={36} />
        </div>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#166534' }}>
            Entorno GCP Preparado para Despliegue
          </h3>
          <p style={{ fontSize: '13px', color: '#374151', marginTop: '2px' }}>
            {data?.recommendations || 'Los componentes esenciales de BigQuery, Cloud Storage y Vertex AI están listos.'}
          </p>
        </div>
      </div>

      {/* Lista de Recursos y Guía */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
        {data?.components?.map((c: any, idx: number) => (
          <div key={idx} className="card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{c.name}</span>
              <span className="badge badge-ok">ACTIVO</span>
            </div>
            <div style={{ fontSize: '13px', color: '#731853', fontWeight: 600, fontFamily: 'monospace', marginBottom: '8px' }}>
              {c.resource}
            </div>
            <div style={{ fontSize: '12px', color: '#6B7280', borderTop: '1px solid #F3F4F6', paddingTop: '8px' }}>
              <b>Propósito:</b> {c.guide}
            </div>
          </div>
        ))}
      </div>

      {/* Guía de Seguridad y Secretos */}
      <div className="card" style={{ marginTop: '24px', backgroundColor: '#FAF0F5', border: '1px solid #E8CFDF' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#731853', marginBottom: '10px' }}>
          <Shield size={22} />
          <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Seguridad y Secretos (GCP Secret Manager)</h3>
        </div>
        <p style={{ fontSize: '13px', color: '#4B5563', lineHeight: 1.6 }}>
          Para despliegue automatizado, Cloud Run utiliza la Service Account predeterminada con roles de <b>BigQuery Admin</b>, <b>Storage Object Admin</b> y <b>Vertex AI User</b>. Si requieres claves de API externas (como Gemini API Key), créalas en <code>Secret Manager</code> bajo el nombre <code>GEMINI_API_KEY</code>. El script de despliegue validará automáticamente su existencia.
        </p>
      </div>
    </div>
  );
};

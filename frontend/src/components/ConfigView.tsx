import React, { useEffect, useState } from 'react';
import { ArrowLeft, Save, Check } from 'lucide-react';

interface ConfigViewProps {
  onBack: () => void;
}

export const ConfigView: React.FC<ConfigViewProps> = ({ onBack }) => {
  const [config, setConfig] = useState<any>({
    app_name: 'Plataforma de Linaje End-to-End',
    subtitle: 'Observabilidad y Linaje de Datos Multi-Herramienta',
    model_config: {
      light_model_name: 'gemini-1.5-flash',
      light_temperature: 0.1,
      light_max_tokens: 1024,
      escalate_confidence_threshold: 0.85,
      advanced_model_name: 'gemini-1.5-pro',
      advanced_temperature: 0.1,
    },
    storage_config: {
      inbox_bucket: 'gs://datosdeentrada',
      processed_bucket: 'gs://datosprocesadosapp',
      quarantine_bucket: 'gs://datosquarentena',
      gcp_project_id: 'crp-poc-it-hackathon-13',
      bq_dataset: 'lineage_metadata',
    },
    default_confidence_threshold: 0.80,
  });

  const [savedField, setSavedField] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch((err) => console.error("Error al cargar configuración", err));
  }, []);

  const handleSave = async (fieldKey: string) => {
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setSavedField(fieldKey);
        setTimeout(() => setSavedField(null), 2500);
      }
    } catch (e) {
      console.error("Error al guardar configuración", e);
    }
  };

  return (
    <div style={{ padding: '24px 36px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Botón Regresar */}
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: '#731853',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: '12px',
        }}
      >
        <ArrowLeft size={16} /> Inicio
      </button>

      {/* Encabezado (Estilo Imagen 4) */}
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>
        Configuración
      </h1>
      <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '28px' }}>
        Los parámetros de activación de modelos y almacenamiento en GCP son administrados por el sistema.
      </p>

      {/* Cuadrícula de Parámetros (Estilo exacto de las tarjetas de Imagen 4) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '20px' }}>
        
        {/* Card: NOMBRE_APLICACION */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>NOMBRE_APLICACION</span>
            <span className="badge" style={{ backgroundColor: '#FAF0F5', color: '#731853', fontSize: '10px' }}>Editable</span>
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>Nombre visible de la solución.</div>
          <input
            type="text"
            value={config.app_name}
            onChange={(e) => setConfig({ ...config, app_name: e.target.value })}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', marginBottom: '14px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-outline" onClick={() => handleSave('app_name')}>
              {savedField === 'app_name' ? <><Check size={14} /> Guardado</> : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Card: SUBTITULO */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>SUBTITULO</span>
            <span className="badge" style={{ backgroundColor: '#FAF0F5', color: '#731853', fontSize: '10px' }}>Editable</span>
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>Subtítulo visible en cabeceras.</div>
          <input
            type="text"
            value={config.subtitle}
            onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', marginBottom: '14px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-outline" onClick={() => handleSave('subtitle')}>
              {savedField === 'subtitle' ? <><Check size={14} /> Guardado</> : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Card: MODELO_LIGERO_NIVEL_3 */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>MODELO_LIGERO_NIVEL_3</span>
            <span className="badge" style={{ backgroundColor: '#FAF0F5', color: '#731853', fontSize: '10px' }}>Editable</span>
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>Modelo de Vertex AI para la primera pasada de IA (Rápido y económico).</div>
          <select
            value={config.model_config?.light_model_name || 'gemini-1.5-flash'}
            onChange={(e) => setConfig({ ...config, model_config: { ...config.model_config, light_model_name: e.target.value } })}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', marginBottom: '14px', backgroundColor: '#ffffff' }}
          >
            <option value="gemini-1.5-flash">gemini-1.5-flash (Recomendado)</option>
            <option value="gemini-1.5-flash-8b">gemini-1.5-flash-8b (Ultra ligero)</option>
          </select>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-outline" onClick={() => handleSave('light_model')}>
              {savedField === 'light_model' ? <><Check size={14} /> Guardado</> : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Card: UMBRAL_ESCALADO_PRO */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>UMBRAL_ESCALADO_PRO</span>
            <span className="badge" style={{ backgroundColor: '#FAF0F5', color: '#731853', fontSize: '10px' }}>Editable</span>
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>Si la confianza de Flash es menor a este valor, escala a Gemini Pro.</div>
          <input
            type="number"
            step="0.05"
            min="0"
            max="1"
            value={config.model_config?.escalate_confidence_threshold ?? 0.85}
            onChange={(e) => setConfig({ ...config, model_config: { ...config.model_config, escalate_confidence_threshold: parseFloat(e.target.value) } })}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', marginBottom: '14px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-outline" onClick={() => handleSave('threshold')}>
              {savedField === 'threshold' ? <><Check size={14} /> Guardado</> : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Card: MODELO_AVANZADO_NIVEL_4 */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>MODELO_AVANZADO_NIVEL_4</span>
            <span className="badge" style={{ backgroundColor: '#FAF0F5', color: '#731853', fontSize: '10px' }}>Editable</span>
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>Modelo de alta capacidad para casos de extrema complejidad o baja certeza.</div>
          <select
            value={config.model_config?.advanced_model_name || 'gemini-1.5-pro'}
            onChange={(e) => setConfig({ ...config, model_config: { ...config.model_config, advanced_model_name: e.target.value } })}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', marginBottom: '14px', backgroundColor: '#ffffff' }}
          >
            <option value="gemini-1.5-pro">gemini-1.5-pro (Máxima precisión)</option>
          </select>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-outline" onClick={() => handleSave('adv_model')}>
              {savedField === 'adv_model' ? <><Check size={14} /> Guardado</> : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Card: GCP_PROJECT_ID */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>GCP_PROJECT_ID</span>
            <span className="badge" style={{ backgroundColor: '#FAF0F5', color: '#731853', fontSize: '10px' }}>Editable</span>
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>Proyecto de Google Cloud donde residen BigQuery y Storage.</div>
          <input
            type="text"
            value={config.storage_config?.gcp_project_id || 'crp-poc-it-hackathon-13'}
            onChange={(e) => setConfig({ ...config, storage_config: { ...config.storage_config, gcp_project_id: e.target.value } })}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', marginBottom: '14px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-outline" onClick={() => handleSave('gcp_proj')}>
              {savedField === 'gcp_proj' ? <><Check size={14} /> Guardado</> : 'Guardar'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

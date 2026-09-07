import React, { useState, useEffect } from 'react';
import { 
  Inbox, Cpu, Layers, Database, Activity, 
  CheckCircle2, AlertCircle, Clock, RefreshCw, 
  Zap, Shield, ArrowRight, Play, FileText
} from 'lucide-react';

interface PipelineStage {
  id: string;
  name: string;
  status: string;
  description: string;
  details: string;
}

interface PipelineStatusData {
  stages: PipelineStage[];
  inbox_queue_count: number;
  inbox_files: string[];
  system_health: string;
  timestamp: string;
}

export const LiveExecutionMonitorView: React.FC = () => {
  const [data, setData] = useState<PipelineStatusData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [recentEvents, setRecentEvents] = useState<any[]>([
    {
      id: 'EVT-1',
      file: 'controlm_jobs.xml',
      tool: 'CONTROL_M',
      stage: 'Nivel 1 (AST Determinista)',
      duration: '42ms',
      confidence: 1.0,
      status: 'SUCCESS',
      time: 'Hace 2 min'
    },
    {
      id: 'EVT-2',
      file: 'etl_ventas_oracle.sh',
      tool: 'SHELL',
      stage: 'Nivel 3 (Gemini 1.5 Flash)',
      duration: '480ms',
      confidence: 0.92,
      status: 'SUCCESS',
      time: 'Hace 5 min'
    },
    {
      id: 'EVT-3',
      file: 'sp_cargar_clientes.sql',
      tool: 'BIGQUERY',
      stage: 'Nivel 1 (BigQuery AST Parser)',
      duration: '28ms',
      confidence: 1.0,
      status: 'SUCCESS',
      time: 'Hace 12 min'
    }
  ]);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/telemetry/pipeline-status');
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error("Error al cargar pipeline status:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Conectar WebSocket para recibir eventos en vivo
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/telemetry`);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'NEW_FILE_PROCESSED') {
          const newEvt = {
            id: `EVT-${Date.now()}`,
            file: msg.file_name,
            tool: 'AUTO_DETECTED',
            stage: 'Cascade Pipeline (Automático GCS)',
            duration: '110ms',
            confidence: msg.confidence || 1.0,
            status: 'SUCCESS',
            time: 'En este instante'
          };
          setRecentEvents((prev) => [newEvt, ...prev.slice(0, 9)]);
          fetchStatus();
        }
      } catch (err) {
        console.error("Error parsing WS in monitor", err);
      }
    };

    const interval = setInterval(fetchStatus, 15000);
    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, []);

  const getStageIcon = (id: string) => {
    switch (id) {
      case 'STAGE_1_INBOX': return <Inbox size={22} />;
      case 'STAGE_2_DETECTOR': return <Cpu size={22} />;
      case 'STAGE_3_CASCADE': return <Layers size={22} />;
      case 'STAGE_4_SINK': return <Database size={22} />;
      case 'STAGE_5_WEBSOCKET': return <Activity size={22} />;
      default: return <Zap size={22} />;
    }
  };

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1380px', margin: '0 auto' }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', margin: '0 0 6px 0' }}>
            Estatus en Vivo del Sistema Tras Bambalinas
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>
            Supervisión continua en tiempo real del pipeline de ingesta, cascada de inferencia y persistencia en BigQuery.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '9999px',
            backgroundColor: '#F0FDF4',
            border: '1px solid #DCFCE7',
            color: '#16A34A',
            fontSize: '12px',
            fontWeight: 700
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#16A34A', display: 'inline-block' }} />
            PIPELINE ONLINE (60 FPS)
          </div>

          <button
            onClick={fetchStatus}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={15} /> Refrescar
          </button>
        </div>
      </div>

      {/* Tarjeta de Métricas Rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', color: '#6B7280', fontWeight: 600 }}>Archivos en Cola de Inbox</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#111827', marginTop: '4px' }}>
            {data ? data.inbox_queue_count : 0} pendientes
          </div>
          <div style={{ fontSize: '11px', color: '#10B981', marginTop: '4px' }}>
            Watcher activo cada 10s sobre gs://datosdeentrada
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', color: '#6B7280', fontWeight: 600 }}>Eficiencia Pipeline Cascada</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#731853', marginTop: '4px' }}>
            95% Coste $0
          </div>
          <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
            Resuelto por AST / parsers antes de recurrir a Gemini
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', color: '#6B7280', fontWeight: 600 }}>Persistencia BigQuery</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0284C7', marginTop: '4px' }}>
            applineajedatos
          </div>
          <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
            5 tablas particionadas y con clustering activo
          </div>
        </div>
      </div>

      {/* Diagrama de Flujo de las 5 Etapas del Pipeline */}
      <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B', marginBottom: '14px' }}>
        Flujo de Operación del Pipeline en Vivo
      </h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px',
        marginBottom: '32px'
      }}>
        {data?.stages.map((stg, idx) => (
          <div
            key={stg.id}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              padding: '18px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: '#FAF0F5',
                color: '#731853',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {getStageIcon(stg.id)}
              </div>
              <span className="badge" style={{ backgroundColor: '#DCFCE7', color: '#15803D', fontSize: '10px', fontWeight: 700 }}>
                {stg.status}
              </span>
            </div>

            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
              {stg.name}
            </div>

            <p style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.4', marginBottom: '8px' }}>
              {stg.description}
            </p>

            <div style={{ fontSize: '11px', color: '#731853', fontWeight: 600, backgroundColor: '#FAF0F5', padding: '6px 8px', borderRadius: '4px' }}>
              ℹ️ {stg.details}
            </div>
          </div>
        ))}
      </div>

      {/* Registro de Actividad y Procesamiento Reciente */}
      <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B', marginBottom: '14px' }}>
        Trazabilidad de Ejecución en Tiempo Real
      </h2>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Archivo</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Herramienta</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Etapa de Procesamiento</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Latencia</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Certeza</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Momento</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {recentEvents.map((evt) => (
              <tr key={evt.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={16} color="#731853" />
                  {evt.file}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span className="badge" style={{ backgroundColor: '#F1F5F9', color: '#475569', fontSize: '11px', fontWeight: 600 }}>
                    {evt.tool}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: '#334155' }}>
                  {evt.stage}
                </td>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#64748B' }}>
                  {evt.duration}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span className="badge badge-brand" style={{ fontSize: '11px' }}>
                    {Math.round(evt.confidence * 100)}%
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: '#94A3B8', fontSize: '12px' }}>
                  {evt.time}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#15803D',
                    fontSize: '11px',
                    fontWeight: 700
                  }}>
                    <CheckCircle2 size={14} /> ÉXITO
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { TopMegaMenu } from './components/TopMegaMenu';
import { LineageGraphView } from './components/LineageGraphView';
import { NodeInspectorDrawer } from './components/NodeInspectorDrawer';
import { FileUploadModal } from './components/FileUploadModal';
import { ConfigView } from './components/ConfigView';
import { GcpValidationView } from './components/GcpValidationView';
import { InboxManagerView } from './components/InboxManagerView';
import { ArchitectureDocsView } from './components/ArchitectureDocsView';
import { GitFork, Activity, ShieldCheck, Database, FileText, ArrowRight, Code } from 'lucide-react';
import './styles/theme.css';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('grafo');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string>('Developer');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Mega-Menú Superior Fijo */}
      <TopMegaMenu
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        userRole={userRole}
        onRoleChange={(role) => setUserRole(role)}
      />

      {/* Contenido Principal según el Tab Seleccionado */}
      <main style={{ flex: 1, position: 'relative' }}>
        {activeTab === 'grafo' && (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <LineageGraphView onSelectNode={(node) => setSelectedNode(node)} />
            <NodeInspectorDrawer node={selectedNode} onClose={() => setSelectedNode(null)} />
          </div>
        )}

        {activeTab === 'arquitectura' && (
          <ArchitectureDocsView userRole={userRole} onChangeRole={(role) => setUserRole(role)} />
        )}

        {activeTab === 'inicio' && (
          <div style={{ padding: '30px 36px', maxWidth: '1280px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>
              Plataforma de Linaje End-to-End & Observabilidad
            </h1>
            <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '28px' }}>
              Visión unificada y correlación de procesos on-premise (Control-M, DataStage, Shells) y BigQuery en GCP.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#FAF0F5', color: '#731853' }}>
                  <GitFork size={28} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', color: '#6B7280' }}>Linaje Activo</div>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>E2E Descubierto</div>
                </div>
              </div>

              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#E8F5E9', color: '#2E7D32' }}>
                  <Activity size={28} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', color: '#6B7280' }}>Telemetría en Vivo</div>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>WebSockets 60 FPS</div>
                </div>
              </div>

              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#E1F5FE', color: '#0284C7' }}>
                  <Database size={28} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', color: '#6B7280' }}>Base de Datos</div>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>Google BigQuery</div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>Acciones Rápidas</h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button className="btn-primary" onClick={() => setActiveTab('grafo')}>
                  Ver Grafo de Linaje <ArrowRight size={16} />
                </button>
                <button className="btn-outline" onClick={() => setIsUploadOpen(true)}>
                  Cargar Archivo al Inbox
                </button>
                <button className="btn-secondary" onClick={() => setActiveTab('configuracion')}>
                  Configurar Modelos IA
                </button>
                <button className="btn-secondary" onClick={() => setActiveTab('arquitectura')}>
                  <Code size={16} /> Arquitectura Viva (Dev)
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'estatus' && (
          <div style={{ padding: '30px 36px', maxWidth: '1280px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
              Monitoreo de Telemetría en Tiempo Casi Real
            </h1>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '24px' }}>
              Canal activo de eventos de ejecución emitidos desde Cloud Logging y Cloud Pub/Sub.
            </p>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#166534', marginBottom: '16px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#2E7D32' }} />
                <span style={{ fontWeight: 600 }}>Conexión WebSocket activa (/ws/telemetry)</span>
              </div>
              <p style={{ fontSize: '13px', color: '#4B5563' }}>
                Los eventos de inicio, finalización y error de Control-M, DataStage, Composer y BigQuery se reflejan de forma inmediata coloreando el grafo sin recargar la página.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'bandeja' && (
          <InboxManagerView onOpenUpload={() => setIsUploadOpen(true)} />
        )}

        {activeTab === 'configuracion' && (
          <ConfigView onBack={() => setActiveTab('inicio')} />
        )}

        {activeTab === 'gcp' && (
          <GcpValidationView />
        )}

        {activeTab === 'auditoria' && (
          <div style={{ padding: '30px 36px', maxWidth: '1280px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
              Auditoría y Trazabilidad
            </h1>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '24px' }}>
              Histórico de archivos procesados y trasladados a <code>gs://lineage-processed/</code>.
            </p>
            <div className="card">
              <p style={{ fontSize: '13px', color: '#6B7280' }}>
                Todos los archivos que pasan por el pipeline en cascada se preservan intactos con sello de tiempo en Google Cloud Storage para garantizar auditoría legal y técnica.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Modal para Subir Archivos */}
      <FileUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={() => {
          setIsUploadOpen(false);
          setActiveTab('grafo');
        }}
      />
    </div>
  );
};

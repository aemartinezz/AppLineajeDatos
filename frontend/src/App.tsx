import React, { useState } from 'react';
import { TopMegaMenu } from './components/TopMegaMenu';
import { LineageGraphView } from './components/LineageGraphView';
import { NodeInspectorDrawer } from './components/NodeInspectorDrawer';
import { FileUploadModal } from './components/FileUploadModal';
import { ConfigView } from './components/ConfigView';
import { GcpValidationView } from './components/GcpValidationView';
import { InboxManagerView } from './components/InboxManagerView';
import { ArchitectureDocsView } from './components/ArchitectureDocsView';
import { LiveExecutionMonitorView } from './components/LiveExecutionMonitorView';
import { UserManagementView } from './components/UserManagementView';
import { SimulationTestModal } from './components/SimulationTestModal';
import { GitFork, Activity, ShieldCheck, Database, FileText, ArrowRight, Code, Shield, Users } from 'lucide-react';
import './styles/theme.css';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('grafo');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);

  // Estados de Simulación y Rol
  const [userRole, setUserRole] = useState<string>('Admin');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulatedRoleName, setSimulatedRoleName] = useState<string>('');
  const [isSimulationModalOpen, setIsSimulationModalOpen] = useState<boolean>(false);

  const handleApplySimulation = (role: string, displayName: string) => {
    setUserRole(role);
    if (role === 'Admin') {
      setIsSimulating(false);
      setSimulatedRoleName('');
    } else {
      setIsSimulating(true);
      setSimulatedRoleName(displayName);
    }
  };

  const handleExitSimulation = () => {
    setUserRole('Admin');
    setIsSimulating(false);
    setSimulatedRoleName('');
  };

  // Componente de bloqueo por permisos
  const renderAccessRestricted = (requiredRole: string, reason: string) => (
    <div style={{ maxWidth: 700, margin: '60px auto', padding: '36px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: '#FAF0F5', color: '#731853', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Shield size={28} />
      </div>
      <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', marginBottom: '8px' }}>
        Acceso Restringido para el Rol {userRole.toUpperCase()}
      </h2>
      <p style={{ fontSize: '14px', color: '#4B5563', lineHeight: '1.6', marginBottom: '20px' }}>
        {reason} Requiere permisos de nivel <b>{requiredRole}</b>.
      </p>
      {isSimulating && (
        <button
          onClick={handleExitSimulation}
          className="btn-primary"
          style={{ padding: '9px 20px', fontSize: '13px' }}
        >
          Restaurar Modo Real (ADMIN_ROOT)
        </button>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Mega-Menú Superior Fijo con Banner de Simulación integrado */}
      <TopMegaMenu
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        userRole={userRole}
        isSimulating={isSimulating}
        simulatedRoleName={simulatedRoleName}
        onOpenSimulationModal={() => setIsSimulationModalOpen(true)}
        onExitSimulation={handleExitSimulation}
      />

      {/* Contenido Principal según el Tab Seleccionado */}
      <main style={{ flex: 1, position: 'relative' }}>
        {/* TAB 1: Grafo de Linaje (Visible para TODOS los roles) */}
        {activeTab === 'grafo' && (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <LineageGraphView onSelectNode={(node) => setSelectedNode(node)} />
            <NodeInspectorDrawer node={selectedNode} onClose={() => setSelectedNode(null)} />
          </div>
        )}

        {/* TAB 2: Inicio */}
        {activeTab === 'inicio' && (
          <div style={{ padding: '30px 36px', maxWidth: '1280px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', marginBottom: '6px' }}>
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
                {userRole !== 'Viewer' && (
                  <button className="btn-outline" onClick={() => setIsUploadOpen(true)}>
                    Cargar Archivo al Inbox
                  </button>
                )}
                {userRole === 'Admin' && (
                  <button className="btn-secondary" onClick={() => setActiveTab('configuracion')}>
                    Configurar Modelos IA
                  </button>
                )}
                {(userRole === 'Developer' || userRole === 'Admin') && (
                  <button className="btn-secondary" onClick={() => setActiveTab('arquitectura')}>
                    <Code size={16} /> Arquitectura Viva (Dev)
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Estatus en Vivo Tras Bambalinas */}
        {activeTab === 'estatus' && (
          userRole === 'Viewer'
            ? renderAccessRestricted('Data Engineer, Developer o Admin', 'El monitoreo de operaciones tras bambalinas no está disponible en Modo Invitado.')
            : <LiveExecutionMonitorView />
        )}

        {/* TAB 4: Bandeja Archivos (Inbox) */}
        {activeTab === 'bandeja' && (
          userRole === 'Viewer' || userRole === 'Auditor'
            ? renderAccessRestricted('Data Engineer, Developer o Admin', 'La carga e ingesta de archivos en Cloud Storage está reservada para ingenieros y administradores.')
            : <InboxManagerView onOpenUpload={() => setIsUploadOpen(true)} />
        )}

        {/* TAB 5: Configuración Dinámica (Solo Admin) */}
        {activeTab === 'configuracion' && (
          userRole !== 'Admin'
            ? renderAccessRestricted('Admin', 'La parametrización de modelos fundacionales de IA (Flash/Pro), cuotas y buckets de almacenamiento es de acceso exclusivo para administradores.')
            : <ConfigView onBack={() => setActiveTab('inicio')} />
        )}

        {/* TAB 6: Usuarios y Roles (Solo Admin) */}
        {activeTab === 'usuarios' && (
          userRole !== 'Admin'
            ? renderAccessRestricted('Admin', 'El catálogo y asignación de roles corporativos en BigQuery app_users_roles requiere permisos de Administrador.')
            : <UserManagementView userRole={userRole} />
        )}

        {/* TAB 7: Arquitectura Viva (Developer o Admin) */}
        {activeTab === 'arquitectura' && (
          <ArchitectureDocsView userRole={userRole} onChangeRole={(r) => setUserRole(r)} />
        )}

        {/* TAB 8: Validación GCP */}
        {activeTab === 'gcp' && (
          <GcpValidationView />
        )}

        {/* TAB 9: Auditoría */}
        {activeTab === 'auditoria' && (
          userRole === 'Viewer'
            ? renderAccessRestricted('Auditor o superior', 'El histórico de archivos procesados y auditoría requiere al menos el rol Auditor.')
            : (
              <div style={{ padding: '30px 36px', maxWidth: '1280px', margin: '0 auto' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', marginBottom: '8px' }}>
                  Auditoría y Trazabilidad de Procesamiento
                </h1>
                <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '24px' }}>
                  Histórico de archivos procesados y trasladados a <code>gs://datosprocesadosapp/</code>.
                </p>
                <div className="card">
                  <p style={{ fontSize: '13px', color: '#4B5563', lineHeight: '1.6' }}>
                    Todos los archivos que pasan por el pipeline en cascada se preservan intactos con sello temporal en Google Cloud Storage y registro en BigQuery <code>execution_status_daily</code> para garantizar trazabilidad legal y técnica.
                  </p>
                </div>
              </div>
            )
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

      {/* Modal de Simulación Modo Pruebas ADMIN_ROOT (Imágenes 1 y 2) */}
      <SimulationTestModal
        isOpen={isSimulationModalOpen}
        onClose={() => setIsSimulationModalOpen(false)}
        currentRole={userRole}
        onApplySimulation={handleApplySimulation}
      />
    </div>
  );
};

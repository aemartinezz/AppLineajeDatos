import React from 'react';
import { 
  Menu, Shield, FlaskConical, Home, GitFork, 
  Activity, FolderUp, Settings, FileSearch, CheckCircle2,
  Code, Users
} from 'lucide-react';
import { SimulationModeBanner } from './SimulationModeBanner';

interface TopMegaMenuProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  userRole: string;
  isSimulating: boolean;
  simulatedRoleName: string;
  onOpenSimulationModal: () => void;
  onExitSimulation: () => void;
}

export const TopMegaMenu: React.FC<TopMegaMenuProps> = ({
  activeTab,
  onTabChange,
  isMenuOpen,
  setIsMenuOpen,
  userRole,
  isSimulating,
  simulatedRoleName,
  onOpenSimulationModal,
  onExitSimulation,
}) => {
  const menuItems = [
    { id: 'inicio', title: 'Inicio', subtitle: 'Resumen y métricas', icon: Home },
    { id: 'grafo', title: 'Grafo Linaje', subtitle: 'Explorador interactivo E2E', icon: GitFork },
    { id: 'estatus', title: 'Estatus en Vivo', subtitle: 'Monitoreo tras bambalinas', icon: Activity },
    { id: 'bandeja', title: 'Bandeja Archivos', subtitle: 'Carga e inferencia (Inbox)', icon: FolderUp },
    { id: 'configuracion', title: 'Configuración', subtitle: 'Modelos IA y parámetros', icon: Settings, badge: 'ADMIN' },
    { id: 'usuarios', title: 'Usuarios y Roles', subtitle: 'Catálogo RBAC BigQuery', icon: Users, badge: 'ADMIN' },
    { id: 'arquitectura', title: 'Arquitectura Viva', subtitle: 'Grafo de código (Dev/Admin)', icon: Code, badge: 'DEV / ADMIN' },
    { id: 'auditoria', title: 'Auditoría', subtitle: 'Historial de procesamiento', icon: FileSearch },
    { id: 'gcp', title: 'Validación GCP', subtitle: 'Verificar crp-poc-it-13', icon: CheckCircle2 },
  ];

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: '#ffffff', borderBottom: '1px solid #E5E7EB' }}>
      {/* Barra Superior Principal */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 24px', height: '60px' }}>
        {/* Izquierda: Hamburguesa + Logo Escudo + Título */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              border: isMenuOpen ? '2px solid #731853' : '1px solid #D1D5DB',
              backgroundColor: isMenuOpen ? '#FAF0F5' : '#ffffff',
              color: isMenuOpen ? '#731853' : '#374151',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            title="Menú de Navegación"
          >
            <Menu size={20} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ color: '#731853', display: 'flex', alignItems: 'center' }}>
              <Shield size={24} strokeWidth={2.2} />
            </div>
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>
              Plataforma de Linaje End-to-End
            </span>
          </div>
        </div>

        {/* Derecha: Botón 'Probar como' + Badges de Simulación/Rol + Email */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Botón Probar como (Abre el modal idéntico a la imagen 1) */}
          <button
            className="btn-outline"
            onClick={onOpenSimulationModal}
            style={{
              padding: '5px 14px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '9999px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: isSimulating ? '#731853' : '#D1D5DB',
              color: isSimulating ? '#731853' : '#374151',
              backgroundColor: isSimulating ? '#FAF0F5' : '#FFFFFF',
            }}
            title="Simular permisos y roles de prueba"
          >
            <FlaskConical size={14} />
            Probar como
          </button>

          {/* Si está simulando, muestra la píldora 'Simulando' */}
          {isSimulating && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#731853',
                backgroundColor: '#FAF0F5',
                border: '1px solid #F3D0E2',
                padding: '4px 10px',
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <FlaskConical size={12} /> Simulando
            </span>
          )}

          {/* Badge del Rol Activo */}
          <span className="badge badge-brand" style={{ padding: '4px 12px', fontSize: '11px' }}>
            {isSimulating ? userRole.toUpperCase() : 'ADMIN_ROOT'}
          </span>

          {/* Email Corporativo */}
          <span style={{ fontSize: '13px', color: '#4B5563', fontWeight: 500 }}>
            aemartinezz@liverpool.com.mx
          </span>
        </div>
      </div>

      {/* Banner Transversal de Simulación (Estilo Imagen 2) */}
      <SimulationModeBanner
        isSimulating={isSimulating}
        simulatedRoleName={simulatedRoleName}
        onExitSimulation={onExitSimulation}
      />

      {/* Mega-Menú Desplegable Horizontal */}
      {isMenuOpen && (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderBottom: '2px solid #E5E7EB',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08)',
            padding: '20px 24px',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px',
              maxWidth: '1400px',
              margin: '0 auto',
            }}
          >
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    setIsMenuOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: isActive ? '1.5px solid #731853' : '1px solid transparent',
                    backgroundColor: isActive ? '#FAF0F5' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-in-out',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = '#F9FAFB';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = '#ffffff';
                  }}
                >
                  <div
                    style={{
                      color: isActive ? '#731853' : '#6B7280',
                      marginTop: '2px',
                    }}
                  >
                    <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: isActive ? 700 : 600,
                        color: isActive ? '#731853' : '#1F2937',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {item.title}
                      {item.badge && (
                        <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#731853', color: '#fff' }}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                      {item.subtitle}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};

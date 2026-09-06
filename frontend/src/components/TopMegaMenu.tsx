import React from 'react';
import { 
  Menu, Shield, FlaskConical, Home, GitFork, 
  Activity, FolderUp, Settings, FileSearch, CheckCircle2
} from 'lucide-react';

interface TopMegaMenuProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
}

export const TopMegaMenu: React.FC<TopMegaMenuProps> = ({
  activeTab,
  onTabChange,
  isMenuOpen,
  setIsMenuOpen,
}) => {
  const menuItems = [
    { id: 'inicio', title: 'Inicio', subtitle: 'Resumen y métricas', icon: Home },
    { id: 'grafo', title: 'Grafo Linaje', subtitle: 'Explorador interactivo E2E', icon: GitFork },
    { id: 'estatus', title: 'Estatus en Vivo', subtitle: 'Monitoreo de telemetría', icon: Activity },
    { id: 'bandeja', title: 'Bandeja Archivos', subtitle: 'Carga e inferencia (Inbox)', icon: FolderUp },
    { id: 'configuracion', title: 'Configuración', subtitle: 'Modelos IA y parámetros', icon: Settings },
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

        {/* Derecha: Probar como + Role Badge + Email */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            className="btn-outline"
            style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '9999px', height: '30px' }}
          >
            <FlaskConical size={14} />
            Probar como
          </button>

          <span className="badge badge-brand" style={{ padding: '4px 12px', fontSize: '11px' }}>
            ADMIN_ROOT
          </span>

          <span style={{ fontSize: '13px', color: '#4B5563', fontWeight: 500 }}>
            aemartinezz@liverpool.com.mx
          </span>
        </div>
      </div>

      {/* Mega-Menú Desplegable Horizontal (Estilo Imagen 5) */}
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
                      }}
                    >
                      {item.title}
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

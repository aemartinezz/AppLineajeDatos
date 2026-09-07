import React from 'react';
import { FlaskConical, LogOut } from 'lucide-react';

interface SimulationModeBannerProps {
  isSimulating: boolean;
  simulatedRoleName: string;
  onExitSimulation: () => void;
}

export const SimulationModeBanner: React.FC<SimulationModeBannerProps> = ({
  isSimulating,
  simulatedRoleName,
  onExitSimulation,
}) => {
  if (!isSimulating) return null;

  return (
    <div
      style={{
        width: '100%',
        backgroundColor: '#FAF0F5',
        borderBottom: '1.5px solid #F3D0E2',
        padding: '8px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
        zIndex: 90,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: '#731853',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FlaskConical size={18} />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#731853', letterSpacing: '-0.01em' }}>
            MODO PRUEBAS &nbsp;·&nbsp; Simulando: {simulatedRoleName}
          </div>
          <div style={{ fontSize: '11px', color: '#832763' }}>
            Usuario real: <b>Argos Eyra Martinez Zeferino</b> · aemartinezz@liverpool.com.mx
          </div>
        </div>
      </div>

      <button
        onClick={onExitSimulation}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 14px',
          fontSize: '12px',
          fontWeight: 600,
          borderRadius: '6px',
          border: '1px solid #731853',
          backgroundColor: '#FFFFFF',
          color: '#731853',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#731853';
          e.currentTarget.style.color = '#FFFFFF';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#FFFFFF';
          e.currentTarget.style.color = '#731853';
        }}
      >
        <LogOut size={14} />
        Salir de simulación
      </button>
    </div>
  );
};

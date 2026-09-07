import React, { useState } from 'react';
import { Shield, ShieldAlert, CheckCircle2, Clock, Sparkles, X } from 'lucide-react';

interface SimulationTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: string;
  onApplySimulation: (role: string, displayName: string) => void;
}

export const SimulationTestModal: React.FC<SimulationTestModalProps> = ({
  isOpen,
  onClose,
  currentRole,
  onApplySimulation,
}) => {
  const [selectedRole, setSelectedRole] = useState<string>(currentRole);

  if (!isOpen) return null;

  const roleOptions = [
    { value: 'Admin', label: 'Argos Eyra Martinez Zeferino · ADMIN_ROOT · Yo' },
    { value: 'Developer', label: 'Desarrollador / Developer · Arquitectura Viva + Linaje' },
    { value: 'Data Engineer', label: 'Ingeniero de Datos / Data Engineer · Ingesta + Linaje' },
    { value: 'Auditor', label: 'Auditor de Datos / Auditor · Trazabilidad + Auditoría' },
    { value: 'Viewer', label: 'Invitado / Viewer · Solo Grafo de Linaje (Modo Invitados)' },
  ];

  const handleApply = () => {
    const option = roleOptions.find((r) => r.value === selectedRole) || roleOptions[0];
    onApplySimulation(selectedRole, option.label);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '620px',
          padding: '28px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          position: 'relative',
        }}
      >
        {/* Cabecera del Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', margin: '0 0 4px 0' }}>
              Modo de pruebas ADMIN_ROOT
            </h2>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
              Simula permisos y datos sin utilizar las credenciales de otro usuario.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#9CA3AF',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tarjeta 1: Usuario Real Autenticado (Verde) */}
        <div
          style={{
            backgroundColor: '#F0FDF4',
            border: '1px solid #DCFCE7',
            borderRadius: '8px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
          }}
        >
          <div style={{ color: '#16A34A' }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Usuario real autenticado
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#15803D' }}>
              Argos Eyra Martinez Zeferino
            </div>
            <div style={{ fontSize: '12px', color: '#166534' }}>
              aemartinezz@liverpool.com.mx · ADMIN_ROOT
            </div>
          </div>
        </div>

        {/* Selector de Perfil */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>
            Probar la aplicación como
          </label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: 500,
              borderRadius: '8px',
              border: '1.5px solid #D1D5DB',
              backgroundColor: '#FFFFFF',
              color: '#111827',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {roleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Tarjeta 2: Advertencia de Identidad (Magenta Suave) */}
        <div
          style={{
            backgroundColor: '#FAF0F5',
            border: '1px solid #F3D0E2',
            borderRadius: '8px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <div style={{ color: '#731853', marginTop: '2px' }}>
            <Shield size={20} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#731853', marginBottom: '2px' }}>
              La identidad real no cambia
            </div>
            <div style={{ fontSize: '12px', color: '#52113B', lineHeight: '1.4' }}>
              Google seguirá autenticándote como <b>aemartinezz@liverpool.com.mx</b>. El backend solo cambia el contexto funcional para pruebas y conserva ambas identidades en auditoría.
            </div>
          </div>
        </div>

        {/* Nota de Expiración */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#6B7280', marginBottom: '24px' }}>
          <Clock size={14} />
          <span>La simulación expira automáticamente después de 480 minutos.</span>
        </div>

        {/* Botones de Acción */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={onClose}
            className="btn-outline"
            style={{ padding: '8px 20px', fontSize: '13px', borderRadius: '8px' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            className="btn-primary"
            style={{
              padding: '8px 22px',
              fontSize: '13px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Sparkles size={16} />
            Aplicar simulación
          </button>
        </div>
      </div>
    </div>
  );
};

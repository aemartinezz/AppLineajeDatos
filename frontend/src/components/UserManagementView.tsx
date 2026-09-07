import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, ShieldCheck, Check, AlertCircle, RefreshCw, X, Trash2 } from 'lucide-react';

interface UserRecord {
  email: str;
  name: string;
  roles: string[];
  status: string;
  created_at?: string;
  last_login?: string;
}

interface UserManagementViewProps {
  userRole: string;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({ userRole }) => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Form state
  const [newEmail, setNewEmail] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newRoles, setNewRoles] = useState<string[]>(['Viewer']);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const availableRoles = ['Admin', 'Developer', 'Data Engineer', 'Auditor', 'Viewer'];

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e) {
      console.error("Error cargando usuarios:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const emailTrim = newEmail.trim().toLowerCase();
    if (!emailTrim.endsWith('@liverpool.com.mx')) {
      setErrorMsg('Error de seguridad: Únicamente se permiten correos del dominio corporativo @liverpool.com.mx');
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': userRole 
        },
        body: JSON.stringify({
          email: emailTrim,
          name: newName.trim(),
          roles: newRoles,
          status: 'ACTIVE'
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Error al registrar usuario');
      }

      setSuccessMsg(`Colaborador ${emailTrim} guardado exitosamente en BigQuery app_users_roles.`);
      setNewEmail('');
      setNewName('');
      setNewRoles(['Viewer']);
      setShowAddModal(false);
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const toggleRole = (role: string) => {
    if (newRoles.includes(role)) {
      if (newRoles.length > 1) {
        setNewRoles(newRoles.filter(r => r !== role));
      }
    } else {
      setNewRoles([...newRoles, role]);
    }
  };

  const handleQuickRoleChange = async (user: UserRecord, targetRole: string) => {
    let updatedRoles = user.roles.includes(targetRole)
      ? user.roles.filter(r => r !== targetRole)
      : [...user.roles, targetRole];

    if (updatedRoles.length === 0) updatedRoles = ['Viewer'];

    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': userRole 
        },
        body: JSON.stringify({
          email: user.email,
          name: user.name,
          roles: updatedRoles,
          status: user.status
        })
      });
      fetchUsers();
    } catch (err) {
      console.error("Error al actualizar rol:", err);
    }
  };

  if (userRole !== 'Admin') {
    return (
      <div style={{ maxWidth: 700, margin: '60px auto', padding: '32px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E5E7EB', textAlign: 'center' }}>
        <Shield size={48} color="#731853" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', marginBottom: '8px' }}>
          Módulo Exclusivo para Rol Admin
        </h2>
        <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: '1.5' }}>
          La gestión de accesos, roles y altas corporativas en BigQuery (tabla <code>app_users_roles</code>) requiere privilegios de Administrador.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: '1380px', margin: '0 auto' }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', margin: '0 0 6px 0' }}>
            Gestión Corporativa de Usuarios y Roles (RBAC)
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>
            Control de acceso restringido a colaboradores Liverpool con persistencia en BigQuery (<code>applineajedatos.app_users_roles</code>).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchUsers}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} /> Refrescar
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <UserPlus size={16} /> Dar de Alta Colaborador
          </button>
        </div>
      </div>

      {successMsg && (
        <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #DCFCE7', color: '#15803D', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
          ✓ {successMsg}
        </div>
      )}

      {/* Tabla de Usuarios Registrados */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
              <th style={{ padding: '14px 18px', fontWeight: 600 }}>Colaborador</th>
              <th style={{ padding: '14px 18px', fontWeight: 600 }}>Correo Corporativo</th>
              <th style={{ padding: '14px 18px', fontWeight: 600 }}>Roles Asignados (Clic para alternar)</th>
              <th style={{ padding: '14px 18px', fontWeight: 600 }}>Estado</th>
              <th style={{ padding: '14px 18px', fontWeight: 600 }}>Último Acceso</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '14px 18px', fontWeight: 700, color: '#0F172A' }}>
                  {u.name}
                </td>
                <td style={{ padding: '14px 18px', fontFamily: 'monospace', color: '#475569' }}>
                  {u.email}
                </td>
                <td style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {availableRoles.map((r) => {
                      const hasRole = u.roles.includes(r);
                      return (
                        <button
                          key={r}
                          onClick={() => handleQuickRoleChange(u, r)}
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            border: hasRole ? '1px solid #731853' : '1px solid #CBD5E1',
                            backgroundColor: hasRole ? '#FAF0F5' : '#FFFFFF',
                            color: hasRole ? '#731853' : '#94A3B8',
                          }}
                          title={`Alternar rol ${r}`}
                        >
                          {hasRole && '✓ '}{r}
                        </button>
                      );
                    })}
                  </div>
                </td>
                <td style={{ padding: '14px 18px' }}>
                  <span className="badge" style={{ backgroundColor: '#DCFCE7', color: '#15803D', fontSize: '11px', fontWeight: 700 }}>
                    {u.status}
                  </span>
                </td>
                <td style={{ padding: '14px 18px', color: '#94A3B8', fontSize: '12px' }}>
                  {u.last_login ? new Date(u.last_login).toLocaleString() : 'Pendiente'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal para Dar de Alta Colaborador */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(2px)'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '520px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#111827' }}>
                Dar de Alta Colaborador Liverpool
              </h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={20} />
              </button>
            </div>

            {errorMsg && (
              <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2', color: '#DC2626', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '12px' }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveUser}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                  Correo Corporativo (Solo @liverpool.com.mx)
                </label>
                <input
                  type="email"
                  required
                  placeholder="usuario@liverpool.com.mx"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>
                  Roles a Asignar
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {availableRoles.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleRole(r)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        border: newRoles.includes(r) ? '1.5px solid #731853' : '1px solid #D1D5DB',
                        backgroundColor: newRoles.includes(r) ? '#FAF0F5' : '#FFFFFF',
                        color: newRoles.includes(r) ? '#731853' : '#4B5563'
                      }}
                    >
                      {newRoles.includes(r) && '✓ '}{r}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-outline"
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '8px 20px', fontSize: '13px' }}
                >
                  Guardar en BigQuery
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

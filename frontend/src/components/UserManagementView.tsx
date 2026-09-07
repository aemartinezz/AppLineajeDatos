import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Shield, ShieldCheck, Check, AlertCircle, RefreshCw, 
  X, Trash2, UserX, UserCheck, Loader2, AlertTriangle
} from 'lucide-react';

interface UserRecord {
  email: string;
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
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserRecord | null>(null);
  const [updatingEmail, setUpdatingEmail] = useState<string | null>(null);

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
      setTimeout(() => setSuccessMsg(null), 3500);
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
    if (updatingEmail) return; // Prevenir doble clic

    let updatedRoles = user.roles.includes(targetRole)
      ? user.roles.filter(r => r !== targetRole)
      : [...user.roles, targetRole];

    if (updatedRoles.length === 0) updatedRoles = ['Viewer'];

    try {
      setUpdatingEmail(user.email);
      const res = await fetch('/api/users', {
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

      if (res.ok) {
        setSuccessMsg(`Roles de ${user.email} actualizados a [${updatedRoles.join(', ')}] en BigQuery.`);
        setTimeout(() => setSuccessMsg(null), 3000);
        await fetchUsers();
      }
    } catch (err) {
      console.error("Error al actualizar rol:", err);
    } finally {
      setUpdatingEmail(null);
    }
  };

  const handleStatusToggle = async (user: UserRecord) => {
    if (updatingEmail) return;
    const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    try {
      setUpdatingEmail(user.email);
      const res = await fetch(`/api/users/${encodeURIComponent(user.email)}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': userRole
        },
        body: JSON.stringify({ status: nextStatus })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Error al cambiar estado');
      }

      setSuccessMsg(`Estado de ${user.email} cambiado a ${nextStatus} en BigQuery.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      await fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setUpdatingEmail(null);
    }
  };

  const handleDeleteUser = async (email: string) => {
    try {
      setUpdatingEmail(email);
      const res = await fetch(`/api/users/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: { 'x-user-role': userRole }
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Error al eliminar colaborador');
      }

      setSuccessMsg(`Colaborador ${email} eliminado definitivamente de BigQuery.`);
      setTimeout(() => setSuccessMsg(null), 3500);
      setDeleteConfirmUser(null);
      await fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setUpdatingEmail(null);
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
              <th style={{ padding: '14px 18px', fontWeight: 600, textAlign: 'center' }}>Acciones CRUD</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isRootAdmin = u.email.toLowerCase() === 'aemartinezz@liverpool.com.mx';
              const isUpdatingThis = updatingEmail === u.email;
              const isActive = u.status === 'ACTIVE';

              return (
                <tr key={u.email} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: isActive ? 'transparent' : '#FFFDF5' }}>
                  <td style={{ padding: '14px 18px', fontWeight: 700, color: '#0F172A' }}>
                    {u.name}
                    {isRootAdmin && (
                      <span className="badge" style={{ marginLeft: '8px', fontSize: '10px', backgroundColor: '#FAF0F5', color: '#731853' }}>
                        Admin Principal
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '14px 18px', fontFamily: 'monospace', color: '#475569' }}>
                    {u.email}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {availableRoles.map((r) => {
                        const hasRole = u.roles.includes(r);
                        return (
                          <button
                            key={r}
                            disabled={isUpdatingThis}
                            onClick={() => handleQuickRoleChange(u, r)}
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              cursor: isUpdatingThis ? 'not-allowed' : 'pointer',
                              border: hasRole ? '1px solid #731853' : '1px solid #CBD5E1',
                              backgroundColor: hasRole ? '#FAF0F5' : '#FFFFFF',
                              color: hasRole ? '#731853' : '#94A3B8',
                              opacity: isUpdatingThis ? 0.6 : 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                            title={`Alternar rol ${r}`}
                          >
                            {hasRole && <Check size={11} />}
                            {r}
                          </button>
                        );
                      })}
                      {isUpdatingThis && (
                        <span style={{ fontSize: '11px', color: '#731853', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Loader2 size={12} className="animate-spin" /> Guardando...
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span 
                      className="badge" 
                      style={{ 
                        backgroundColor: isActive ? '#DCFCE7' : '#FEF3C7', 
                        color: isActive ? '#15803D' : '#D97706', 
                        fontSize: '11px', 
                        fontWeight: 700 
                      }}
                    >
                      {isActive ? '● ACTIVO' : '○ INACTIVO'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', color: '#94A3B8', fontSize: '12px' }}>
                    {u.last_login ? new Date(u.last_login).toLocaleString() : 'Pendiente'}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                    {isRootAdmin ? (
                      <span style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>
                        Protegido
                      </span>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          disabled={isUpdatingThis}
                          onClick={() => handleStatusToggle(u)}
                          className="btn-secondary"
                          style={{
                            fontSize: '11px',
                            padding: '4px 8px',
                            color: isActive ? '#D97706' : '#15803D',
                            borderColor: isActive ? '#FCD34D' : '#86EFAC',
                            backgroundColor: isActive ? '#FFFBEB' : '#F0FDF4',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title={isActive ? 'Dar de baja temporalmente' : 'Reactivar acceso corporativo'}
                        >
                          {isActive ? <><UserX size={12} /> Dar de Baja</> : <><UserCheck size={12} /> Reactivar</>}
                        </button>

                        <button
                          disabled={isUpdatingThis}
                          onClick={() => setDeleteConfirmUser(u)}
                          className="btn-secondary"
                          style={{
                            fontSize: '11px',
                            padding: '4px 8px',
                            color: '#DC2626',
                            borderColor: '#FECACA',
                            backgroundColor: '#FEF2F2',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Eliminar permanentemente de BigQuery"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
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

      {/* Modal de Confirmación para Eliminar Usuario */}
      {deleteConfirmUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(3px)'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '460px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', color: '#DC2626' }}>
              <AlertTriangle size={24} />
              <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: '#111827' }}>
                ¿Eliminar Colaborador?
              </h3>
            </div>

            <p style={{ fontSize: '13px', color: '#4B5563', lineHeight: '1.5', marginBottom: '20px' }}>
              Se eliminará permanentemente a <b>{deleteConfirmUser.name}</b> (<code>{deleteConfirmUser.email}</code>) de la tabla <code>applineajedatos.app_users_roles</code> en Google BigQuery. Esta acción no se puede deshacer.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className="btn-outline"
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteUser(deleteConfirmUser.email)}
                disabled={updatingEmail === deleteConfirmUser.email}
                className="btn-primary"
                style={{ padding: '8px 20px', fontSize: '13px', backgroundColor: '#DC2626', borderColor: '#DC2626' }}
              >
                {updatingEmail === deleteConfirmUser.email ? 'Eliminando...' : 'Sí, Eliminar de BigQuery'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

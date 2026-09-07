import React, { useState, useEffect } from "react";
import { 
  AlertTriangle, CheckCircle2, Terminal, RefreshCw, Eye, 
  ShieldAlert, Check, Copy, AlertOctagon, Info, Clock, ArrowUpRight, Globe, Layers, Filter
} from "lucide-react";

interface AppErrorItem {
  error_id: string;
  error_type: string;
  message: string;
  stack_trace?: string;
  component: string;
  severity: string;
  url?: string;
  user_agent?: string;
  context_data?: any;
  occurrence_count: number;
  first_seen: string;
  last_seen: string;
  status: "OPEN" | "RESOLVED";
  resolved_at?: string;
  resolved_by?: string;
}

interface ErrorTrackingViewProps {
  userRole: string;
  userEmail: string;
  onChangeRole: (role: string) => void;
}

export const ErrorTrackingView: React.FC<ErrorTrackingViewProps> = ({ userRole, userEmail, onChangeRole }) => {
  const [errors, setErrors] = useState<AppErrorItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "RESOLVED">("ALL");
  const [severityFilter, setSeverityFilter] = useState<"ALL" | "CRITICAL" | "WARNING" | "INFO">("ALL");
  const [componentFilter, setComponentFilter] = useState<string>("ALL");
  const [activeModalError, setActiveModalError] = useState<AppErrorItem | null>(null);
  const [modalTab, setModalTab] = useState<"TRACE" | "CONTEXT">("TRACE");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const isAuthorized = userRole === "Developer" || userRole === "Admin";

  const fetchErrors = async () => {
    try {
      setLoading(true);
      const url = statusFilter === "ALL" ? "/api/errors" : `/api/errors?status=${statusFilter}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setErrors(data);
      }
    } catch (err) {
      console.error("Error al cargar lista de incidencias:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchErrors();
      const interval = setInterval(fetchErrors, 30000); // Polling cada 30s
      return () => clearInterval(interval);
    }
  }, [isAuthorized, statusFilter]);

  const handleResolve = async (errorId: string) => {
    try {
      setResolvingId(errorId);
      const res = await fetch(`/api/errors/${errorId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved_by: userEmail || "web_admin" })
      });
      if (res.ok) {
        fetchErrors();
      }
    } catch (err) {
      console.error("Error al marcar incidencia como solucionada:", err);
    } finally {
      setResolvingId(null);
    }
  };

  const handleCopyTrace = (trace: string) => {
    navigator.clipboard.writeText(trace);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isAuthorized) {
    return (
      <div style={{ maxWidth: 800, margin: "60px auto", padding: "32px", backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E7EB", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", textAlign: "center" }}>
        <ShieldAlert size={48} color="#731853" style={{ margin: "0 auto 16px" }} />
        <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#111827", marginBottom: "8px" }}>
          Acceso Restringido a Roles Developer y Admin
        </h2>
        <p style={{ fontSize: "14px", color: "#4B5563", lineHeight: "1.6", marginBottom: "24px" }}>
          La consola de gestión y trazabilidad de errores técnicos de la plataforma está restringida exclusivamente al equipo de desarrollo y administración de infraestructura.
        </p>
        <button 
          className="btn-primary"
          onClick={() => onChangeRole("Developer")}
          style={{ padding: "10px 24px", fontSize: "14px" }}
        >
          Cambiar a Rol Developer para Visualizar
        </button>
      </div>
    );
  }

  const openCount = errors.filter(e => e.status === "OPEN").length;
  const resolvedCount = errors.filter(e => e.status === "RESOLVED").length;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
      {/* Cabecera */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <AlertOctagon size={26} color="#731853" />
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#0F172A", margin: 0 }}>
              Gestión y Monitoreo de Errores en Vivo
            </h1>
          </div>
          <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>
            Centralización de excepciones en BigQuery (<code style={{ color: "#731853", fontWeight: 600 }}>app_errors_log</code>). Si un error resuelto vuelve a ocurrir, el sistema lo <b>reabre automáticamente a OPEN</b>.
          </p>
        </div>

        <button 
          className="btn-secondary"
          onClick={fetchErrors}
          disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", padding: "8px 14px" }}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {/* Tarjetas de Resumen & Filtros */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div 
          onClick={() => setStatusFilter("ALL")}
          style={{ 
            backgroundColor: "#FFFFFF", 
            padding: "16px 20px", 
            borderRadius: "10px", 
            border: statusFilter === "ALL" ? "2px solid #731853" : "1px solid #E2E8F0",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
          }}
        >
          <div style={{ fontSize: "12px", color: "#64748B", fontWeight: 600, marginBottom: "4px" }}>Total Incidencias</div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#0F172A" }}>{errors.length}</div>
          <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>Agrupadas por hash técnico</div>
        </div>

        <div 
          onClick={() => setStatusFilter("OPEN")}
          style={{ 
            backgroundColor: "#FFF5F5", 
            padding: "16px 20px", 
            borderRadius: "10px", 
            border: statusFilter === "OPEN" ? "2px solid #DC2626" : "1px solid #FECACA",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
          }}
        >
          <div style={{ fontSize: "12px", color: "#DC2626", fontWeight: 700, marginBottom: "4px" }}>Abiertas (OPEN)</div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#B91C1C" }}>{openCount}</div>
          <div style={{ fontSize: "11px", color: "#EF4444", marginTop: "4px" }}>Requieren atención o diagnóstico</div>
        </div>

        <div 
          onClick={() => setStatusFilter("RESOLVED")}
          style={{ 
            backgroundColor: "#F0FDF4", 
            padding: "16px 20px", 
            borderRadius: "10px", 
            border: statusFilter === "RESOLVED" ? "2px solid #16A34A" : "1px solid #BBF7D0",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
          }}
        >
          <div style={{ fontSize: "12px", color: "#16A34A", fontWeight: 700, marginBottom: "4px" }}>Solucionadas (RESOLVED)</div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#15803D" }}>{resolvedCount}</div>
          <div style={{ fontSize: "11px", color: "#22C55E", marginTop: "4px" }}>Reapertura automática activa</div>
        </div>
      </div>

      {/* Barra de Filtros Avanzados por Severidad y Origen de Componente */}
      <div style={{
        backgroundColor: "#FFFFFF",
        padding: "14px 18px",
        borderRadius: "10px",
        border: "1px solid #E2E8F0",
        marginBottom: "20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569", display: "flex", alignItems: "center", gap: "5px" }}>
            <Filter size={14} color="#731853" /> Severidad:
          </span>
          {(["ALL", "CRITICAL", "WARNING", "INFO"] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: "6px",
                border: severityFilter === sev ? "1px solid #731853" : "1px solid #CBD5E1",
                backgroundColor: severityFilter === sev ? "#FAF0F5" : "#FFFFFF",
                color: severityFilter === sev ? "#731853" : "#64748B",
                cursor: "pointer"
              }}
            >
              {sev === "ALL" ? "Todas" : sev}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569", display: "flex", alignItems: "center", gap: "5px" }}>
            <Layers size={14} color="#731853" /> Componente:
          </span>
          {["ALL", "FRONTEND", "BACKEND", "BIGQUERY", "GCS"].map((comp) => (
            <button
              key={comp}
              onClick={() => setComponentFilter(comp)}
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: "6px",
                border: componentFilter === comp ? "1px solid #731853" : "1px solid #CBD5E1",
                backgroundColor: componentFilter === comp ? "#FAF0F5" : "#FFFFFF",
                color: componentFilter === comp ? "#731853" : "#64748B",
                cursor: "pointer"
              }}
            >
              {comp === "ALL" ? "Todos" : comp}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Errores Filtrados */}
      {(() => {
        const displayedErrors = errors.filter(e => {
          if (severityFilter !== "ALL" && e.severity !== severityFilter) return false;
          if (componentFilter !== "ALL" && !e.component.toUpperCase().includes(componentFilter)) return false;
          return true;
        });

        if (loading && errors.length === 0) {
          return (
            <div style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px" }} />
              Cargando registro de incidencias desde BigQuery...
            </div>
          );
        }

        if (displayedErrors.length === 0) {
          return (
            <div style={{ backgroundColor: "#FFFFFF", padding: "48px", borderRadius: "12px", border: "1px solid #E2E8F0", textAlign: "center" }}>
              <CheckCircle2 size={40} color="#16A34A" style={{ margin: "0 auto 12px" }} />
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>
                Sin Incidencias para los Filtros Seleccionados
              </h3>
              <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>
                No se encontraron excepciones o advertencias en los componentes seleccionados.
              </p>
            </div>
          );
        }

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {displayedErrors.map((item) => {
              const isOpen = item.status === "OPEN";
              return (
                <div 
                  key={item.error_id}
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "10px",
                    border: isOpen ? "1px solid #FECACA" : "1px solid #E2E8F0",
                    padding: "18px 22px",
                    boxShadow: isOpen ? "0 2px 6px rgba(220, 38, 38, 0.08)" : "0 1px 3px rgba(0,0,0,0.03)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    transition: "all 0.2s ease"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span 
                        style={{
                          fontSize: "11px",
                          fontWeight: 800,
                          padding: "3px 8px",
                          borderRadius: "6px",
                          backgroundColor: isOpen ? "#FEF2F2" : "#F0FDF4",
                          color: isOpen ? "#DC2626" : "#16A34A",
                          border: isOpen ? "1px solid #FCA5A5" : "1px solid #86EFAC"
                        }}
                      >
                        {isOpen ? "● ABIERTO" : "✓ SOLUCIONADO"}
                      </span>
                      <span 
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: "6px",
                          backgroundColor: item.severity === "CRITICAL" ? "#991B1B" : item.severity === "WARNING" ? "#D97706" : "#2563EB",
                          color: "#FFFFFF"
                        }}
                      >
                        {item.severity}
                      </span>
                      <span style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: 700, color: "#64748B" }}>
                        {item.error_id}
                      </span>
                      <span style={{ fontSize: "11px", backgroundColor: "#F1F5F9", padding: "2px 8px", borderRadius: "4px", color: "#475569", fontWeight: 700 }}>
                        {item.component}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "11px", color: "#64748B", display: "flex", alignItems: "center", gap: "4px" }}>
                        <Clock size={13} /> {new Date(item.last_seen).toLocaleString()}
                      </span>
                      <span className="badge" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", color: "#334155", fontSize: "11px" }}>
                        Ocurrencias: <b>{item.occurrence_count}</b>
                      </span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>
                      {item.error_type}
                    </div>
                    <p style={{ fontSize: "13px", color: "#334155", margin: 0, lineHeight: "1.4" }}>
                      {item.message}
                    </p>
                    {item.url && (
                      <div style={{ fontSize: "11px", color: "#64748B", marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <Globe size={12} /> URL: <code>{item.url}</code>
                      </div>
                    )}
                  </div>

                  {item.status === "RESOLVED" && (
                    <div style={{ fontSize: "11px", color: "#15803D", backgroundColor: "#F0FDF4", padding: "6px 10px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <CheckCircle2 size={13} /> Marcado como solucionado por <b>{item.resolved_by || "admin"}</b> ({item.resolved_at ? new Date(item.resolved_at).toLocaleString() : "reciente"}).
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "8px", borderTop: "1px solid #F1F5F9" }}>
                    <button
                      onClick={() => {
                        setActiveModalError(item);
                        setModalTab("TRACE");
                      }}
                      className="btn-secondary"
                      style={{ fontSize: "12px", padding: "6px 12px", display: "flex", alignItems: "center", gap: "5px" }}
                    >
                      <Terminal size={14} /> Diagnóstico & Traza ("Carnita")
                    </button>

                    {isOpen && (
                      <button
                        onClick={() => handleResolve(item.error_id)}
                        disabled={resolvingId === item.error_id}
                        className="btn-primary"
                        style={{ fontSize: "12px", padding: "6px 14px", display: "flex", alignItems: "center", gap: "5px", backgroundColor: "#15803D" }}
                      >
                        <Check size={14} />
                        {resolvingId === item.error_id ? "Solucionando..." : "Marcar como Solucionado"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Modal Enriquecido de Diagnóstico Técnico ("Más Carnita") */}
      {activeModalError && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px"
          }}
          onClick={() => setActiveModalError(null)}
        >
          <div 
            style={{
              backgroundColor: "#1E293B",
              color: "#F8FAFC",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "880px",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
              border: "1px solid #334155"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#F1F5F9", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Terminal size={18} color="#38BDF8" /> {activeModalError.error_type}
                  <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "4px", backgroundColor: "#334155", color: "#38BDF8" }}>
                    {activeModalError.severity}
                  </span>
                </div>
                <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "3px" }}>
                  Firma: <code>{activeModalError.error_id}</code> | Origen: <b>{activeModalError.component}</b>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={() => {
                    const fullDiag = JSON.stringify(activeModalError, null, 2);
                    navigator.clipboard.writeText(fullDiag);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  style={{
                    backgroundColor: "#334155",
                    color: "#F8FAFC",
                    border: "none",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <Copy size={13} /> {copied ? "¡Diagnóstico Copiado!" : "Copiar JSON Completo"}
                </button>
                <button
                  onClick={() => setActiveModalError(null)}
                  style={{ backgroundColor: "transparent", border: "none", color: "#94A3B8", cursor: "pointer", fontSize: "20px", padding: "4px" }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Selector de Pestañas del Modal */}
            <div style={{ display: "flex", borderBottom: "1px solid #334155", backgroundColor: "#0F172A", padding: "0 24px" }}>
              <button
                onClick={() => setModalTab("TRACE")}
                style={{
                  padding: "10px 16px",
                  fontSize: "12px",
                  fontWeight: 600,
                  backgroundColor: "transparent",
                  border: "none",
                  borderBottom: modalTab === "TRACE" ? "2px solid #38BDF8" : "2px solid transparent",
                  color: modalTab === "TRACE" ? "#38BDF8" : "#94A3B8",
                  cursor: "pointer"
                }}
              >
                Traza Técnica (Stack Trace)
              </button>
              <button
                onClick={() => setModalTab("CONTEXT")}
                style={{
                  padding: "10px 16px",
                  fontSize: "12px",
                  fontWeight: 600,
                  backgroundColor: "transparent",
                  border: "none",
                  borderBottom: modalTab === "CONTEXT" ? "2px solid #38BDF8" : "2px solid transparent",
                  color: modalTab === "CONTEXT" ? "#38BDF8" : "#94A3B8",
                  cursor: "pointer"
                }}
              >
                Contexto de Ejecución & Entorno ("Carnita")
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              <div style={{ marginBottom: "14px", fontSize: "13px", color: "#F8FAFC", backgroundColor: "#0F172A", padding: "12px 16px", borderRadius: "8px", border: "1px solid #334155" }}>
                <b>Mensaje:</b> {activeModalError.message}
              </div>

              {modalTab === "TRACE" ? (
                <pre 
                  style={{ 
                    backgroundColor: "#0F172A", 
                    padding: "16px", 
                    borderRadius: "8px", 
                    fontSize: "12px", 
                    fontFamily: "monospace", 
                    color: "#38BDF8", 
                    overflowX: "auto", 
                    whiteSpace: "pre-wrap", 
                    margin: 0,
                    border: "1px solid #1E293B",
                    lineHeight: "1.5"
                  }}
                >
                  {activeModalError.stack_trace || "No se capturó traza técnica específica."}
                </pre>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div style={{ backgroundColor: "#0F172A", padding: "12px", borderRadius: "8px", border: "1px solid #334155" }}>
                      <span style={{ fontSize: "11px", color: "#94A3B8", display: "block" }}>Componente Emisor:</span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#38BDF8" }}>{activeModalError.component}</span>
                    </div>
                    <div style={{ backgroundColor: "#0F172A", padding: "12px", borderRadius: "8px", border: "1px solid #334155" }}>
                      <span style={{ fontSize: "11px", color: "#94A3B8", display: "block" }}>Ocurrencias Acumuladas:</span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#F8FAFC" }}>{activeModalError.occurrence_count} vez/veces</span>
                    </div>
                  </div>

                  <div style={{ backgroundColor: "#0F172A", padding: "12px", borderRadius: "8px", border: "1px solid #334155" }}>
                    <span style={{ fontSize: "11px", color: "#94A3B8", display: "block" }}>URL / Ruta donde ocurrió:</span>
                    <code style={{ fontSize: "12px", color: "#38BDF8" }}>{activeModalError.url || "Ejecución interna de backend / WebSocket"}</code>
                  </div>

                  <div style={{ backgroundColor: "#0F172A", padding: "12px", borderRadius: "8px", border: "1px solid #334155" }}>
                    <span style={{ fontSize: "11px", color: "#94A3B8", display: "block" }}>User Agent / Cliente:</span>
                    <span style={{ fontSize: "11px", color: "#E2E8F0" }}>{activeModalError.user_agent || "FastAPI Async Engine / Python 3.11"}</span>
                  </div>

                  {activeModalError.context_data && (
                    <div style={{ backgroundColor: "#0F172A", padding: "12px", borderRadius: "8px", border: "1px solid #334155" }}>
                      <span style={{ fontSize: "11px", color: "#94A3B8", display: "block", marginBottom: "4px" }}>Context Data (Payload):</span>
                      <pre style={{ margin: 0, fontSize: "11px", color: "#A7F3D0", fontFamily: "monospace" }}>
                        {JSON.stringify(activeModalError.context_data, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div style={{ backgroundColor: "#0F172A", padding: "10px", borderRadius: "6px", border: "1px solid #334155" }}>
                      <span style={{ fontSize: "10px", color: "#94A3B8" }}>Primer Registro:</span>
                      <div style={{ fontSize: "11px" }}>{new Date(activeModalError.first_seen).toLocaleString()}</div>
                    </div>
                    <div style={{ backgroundColor: "#0F172A", padding: "10px", borderRadius: "6px", border: "1px solid #334155" }}>
                      <span style={{ fontSize: "10px", color: "#94A3B8" }}>Último Registro:</span>
                      <div style={{ fontSize: "11px" }}>{new Date(activeModalError.last_seen).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0F172A" }}>
              <span style={{ fontSize: "11px", color: "#94A3B8" }}>
                💡 Si el componente vuelve a fallar, el motor reabrirá automáticamente el registro a OPEN.
              </span>
              <button
                onClick={() => setActiveModalError(null)}
                className="btn-secondary"
                style={{ fontSize: "12px", padding: "6px 16px", backgroundColor: "#334155", color: "#FFF", borderColor: "#475569" }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


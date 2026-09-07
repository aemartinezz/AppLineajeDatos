import React, { useEffect, useState } from 'react';
import { 
  ArrowLeft, Save, Check, DollarSign, AlertTriangle, RefreshCw, TrendingUp, 
  Cpu, Plus, Trash2, CheckCircle2, XCircle, Loader2, ShieldCheck, Database, Layers,
  KeyRound, ChevronDown, ChevronUp, Copy, BookOpen, Terminal
} from 'lucide-react';

interface ModelCostsData {
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_calls: number;
  budget_limit_usd: number;
  budget_consumed_percentage: number;
  alert_triggered: boolean;
  cost_by_model: { [key: string]: number };
  tokens_by_model: { [key: string]: number };
  last_updated: string;
}

interface ConfigViewProps {
  onBack: () => void;
  userRole?: string;
}

export const ConfigView: React.FC<ConfigViewProps> = ({ onBack, userRole = 'Developer' }) => {
  const [config, setConfig] = useState<any>({
    app_name: 'Plataforma de Linaje End-to-End',
    subtitle: 'Observabilidad y Linaje de Datos Multi-Herramienta',
    models_settings: {
      light_model_name: 'gemini-1.5-flash',
      light_temperature: 0.1,
      light_max_tokens: 1024,
      escalate_confidence_threshold: 0.85,
      advanced_model_name: 'gemini-1.5-pro',
      advanced_temperature: 0.1,
      monthly_budget_usd: 50.0,
      alert_threshold_pct: 80.0,
    },
    storage_config: {
      inbox_bucket: 'gs://datosdeentrada',
      processed_bucket: 'gs://datosprocesadosapp',
      quarantine_bucket: 'gs://datosquarentena',
      gcp_project_id: 'crp-poc-it-hackathon-13',
      bq_dataset: 'applineajedatos',
      monitored_projects: ['crp-poc-it-hackathon-13'],
      service_account: 'sa-applineaje-backend@crp-poc-it-hackathon-13.iam.gserviceaccount.com',
    },
    default_confidence_threshold: 0.80,
  });

  const [savedField, setSavedField] = useState<string | null>(null);
  const [costsData, setCostsData] = useState<ModelCostsData | null>(null);
  const [loadingCosts, setLoadingCosts] = useState<boolean>(false);

  // Estados para Presupuesto Editable
  const [editBudgetUsd, setEditBudgetUsd] = useState<number>(50.0);
  const [editAlertPct, setEditAlertPct] = useState<number>(80.0);
  const [savingBudget, setSavingBudget] = useState<boolean>(false);

  // Estados para Monitoreo Multi-Proyecto GCP
  const [newProjectInput, setNewProjectInput] = useState<string>('');
  const [validatingProject, setValidatingProject] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<{ [key: string]: { isValid: boolean; message: string; datasetsCount?: number; tablesCount?: number } }>({});

  // Estados para Validación de Buckets GCS
  const [validatingBucket, setValidatingBucket] = useState<string | null>(null);
  const [bucketValidationResults, setBucketValidationResults] = useState<{ [key: string]: { isValid: boolean; message: string; objectsCount?: number } }>({});

  // Estados para Validación de Dataset BigQuery y Guía IAM
  const [validatingDataset, setValidatingDataset] = useState<boolean>(false);
  const [datasetValidationResult, setDatasetValidationResult] = useState<{ isValid: boolean; message: string; tablesCount?: number } | null>(null);
  const [showIamGuide, setShowIamGuide] = useState<boolean>(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const handleValidateDataset = async (datasetName: string) => {
    try {
      setValidatingDataset(true);
      const res = await fetch('/api/gcp/validate-dataset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          dataset_name: datasetName,
          project_id: config.storage_config?.gcp_project_id
        })
      });
      const data = await res.json();
      setDatasetValidationResult({
        isValid: data.is_valid,
        message: data.message,
        tablesCount: data.tables_count
      });
    } catch (err: any) {
      setDatasetValidationResult({
        isValid: false,
        message: err.message || 'Error al conectar con Google BigQuery'
      });
    } finally {
      setValidatingDataset(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  const handleValidateBucket = async (bucketKey: string, bucketUri: string) => {
    try {
      setValidatingBucket(bucketKey);
      const res = await fetch('/api/gcp/validate-bucket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket_name: bucketUri })
      });
      const data = await res.json();
      setBucketValidationResults(prev => ({
        ...prev,
        [bucketKey]: {
          isValid: data.is_valid,
          message: data.message,
          objectsCount: data.objects_count || 0
        }
      }));
    } catch (err: any) {
      setBucketValidationResults(prev => ({
        ...prev,
        [bucketKey]: {
          isValid: false,
          message: err.message || 'Error de conexión con Google Cloud Storage'
        }
      }));
    } finally {
      setValidatingBucket(null);
    }
  };

  const isCostAuthorized = userRole === 'Admin' || userRole === 'Developer';
  const isAdmin = userRole === 'Admin';

  const fetchCosts = async () => {
    if (!isCostAuthorized) return;
    try {
      setLoadingCosts(true);
      const res = await fetch('/api/costs/summary');
      if (res.ok) {
        const data = await res.json();
        setCostsData(data);
        if (data.budget_limit_usd) {
          setEditBudgetUsd(data.budget_limit_usd);
        }
      }
    } catch (e) {
      console.error("Error al cargar costes de modelos:", e);
    } finally {
      setLoadingCosts(false);
    }
  };

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        setConfig(data);
        if (data.models_settings?.monthly_budget_usd) {
          setEditBudgetUsd(data.models_settings.monthly_budget_usd);
        }
        if (data.models_settings?.alert_threshold_pct) {
          setEditAlertPct(data.models_settings.alert_threshold_pct);
        }
      })
      .catch((err) => console.error("Error al cargar configuración", err));

    if (isCostAuthorized) {
      fetchCosts();
      const interval = setInterval(fetchCosts, 600000);
      return () => clearInterval(interval);
    }
  }, [userRole]);

  const handleSave = async (fieldKey: string, customConfig?: any) => {
    try {
      const payload = customConfig || config;
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': userRole 
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setConfig(updated);
        setSavedField(fieldKey);
        setTimeout(() => setSavedField(null), 2500);
        fetchCosts();
      }
    } catch (e) {
      console.error("Error al guardar configuración", e);
    }
  };

  const handleSaveBudget = async () => {
    setSavingBudget(true);
    const updatedConfig = {
      ...config,
      models_settings: {
        ...config.models_settings,
        monthly_budget_usd: editBudgetUsd,
        alert_threshold_pct: editAlertPct,
      }
    };
    await handleSave('budget', updatedConfig);
    setSavingBudget(false);
  };

  const handleValidateProject = async (projectId: string) => {
    try {
      setValidatingProject(projectId);
      const res = await fetch('/api/gcp/validate-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId })
      });
      const data = await res.json();
      setValidationResults(prev => ({
        ...prev,
        [projectId]: {
          isValid: data.is_valid,
          message: data.message,
          datasetsCount: data.datasets_found?.length || 0,
          tablesCount: data.tables_count || 0
        }
      }));
    } catch (err: any) {
      setValidationResults(prev => ({
        ...prev,
        [projectId]: {
          isValid: false,
          message: err.message || 'Error de conexión con GCP'
        }
      }));
    } finally {
      setValidatingProject(null);
    }
  };

  const handleAddProject = () => {
    const clean = newProjectInput.trim();
    if (!clean) return;
    const currentList: string[] = config.storage_config?.monitored_projects || [config.storage_config?.gcp_project_id || 'crp-poc-it-hackathon-13'];
    if (!currentList.includes(clean)) {
      const updated = [...currentList, clean];
      const updatedConfig = {
        ...config,
        storage_config: { ...config.storage_config, monitored_projects: updated }
      };
      setConfig(updatedConfig);
      handleSave('monitored_projects', updatedConfig);
      handleValidateProject(clean);
    }
    setNewProjectInput('');
  };

  const handleRemoveProject = (proj: string) => {
    const currentList: string[] = config.storage_config?.monitored_projects || [];
    if (currentList.length <= 1) {
      alert("Debe mantenerse al menos un proyecto monitoreado en la configuración.");
      return;
    }
    const updated = currentList.filter(p => p !== proj);
    const updatedConfig = {
      ...config,
      storage_config: { ...config.storage_config, monitored_projects: updated }
    };
    setConfig(updatedConfig);
    handleSave('monitored_projects', updatedConfig);
  };

  return (
    <div style={{ padding: '24px 36px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Botón Regresar */}
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: '#731853',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: '12px',
        }}
      >
        <ArrowLeft size={16} /> Inicio
      </button>

      {/* Encabezado (Estilo Imagen 4) */}
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>
        Configuración
      </h1>
      <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '28px' }}>
        Los parámetros de activación de modelos y almacenamiento en GCP son administrados por el sistema.
      </p>

      {/* Panel de Control de Gastos de Modelos IA (Admin & Developer) */}
      {isCostAuthorized && (
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: costsData?.alert_triggered ? '2px solid #DC2626' : '1px solid #E2E8F0',
          padding: '24px',
          marginBottom: '32px',
          boxShadow: costsData?.alert_triggered ? '0 4px 12px rgba(220, 38, 38, 0.1)' : '0 2px 6px rgba(0,0,0,0.04)'
        }}>
          {/* Header del panel */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <DollarSign size={20} color="#731853" />
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Auditoría y Control de Costes de Modelos IA
                </h2>
                {costsData?.alert_triggered ? (
                  <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '12px', backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={13} /> ¡ALERTA! Consumo ≥ 80% del presupuesto
                  </span>
                ) : (
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #86EFAC' }}>
                    ✓ Presupuesto Óptimo
                  </span>
                )}
              </div>
              <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
                Auditoría en tiempo real en BigQuery (<code style={{ color: '#731853', fontWeight: 600 }}>applineajedatos.app_model_usage_logs</code>). Refresco automático cada 10 min.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                Última sincronización: {costsData?.last_updated ? new Date(costsData.last_updated).toLocaleTimeString() : 'reciente'}
              </span>
              <button
                onClick={fetchCosts}
                disabled={loadingCosts}
                className="btn-secondary"
                style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={13} className={loadingCosts ? 'animate-spin' : ''} /> Refrescar
              </button>
            </div>
          </div>

          {/* Barra de Consumo de Presupuesto */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              <span>Presupuesto Mensual Estimado</span>
              <span>
                ${costsData?.total_cost_usd?.toFixed(4) || '0.0000'} / ${costsData?.budget_limit_usd?.toFixed(2) || '50.00'} USD ({costsData?.budget_consumed_percentage || 0}%)
              </span>
            </div>
            <div style={{ width: '100%', height: '10px', backgroundColor: '#F1F5F9', borderRadius: '5px', overflow: 'hidden' }}>
              <div 
                style={{
                  width: `${Math.min(costsData?.budget_consumed_percentage || 0, 100)}%`,
                  height: '100%',
                  backgroundColor: (costsData?.budget_consumed_percentage || 0) >= 80 ? '#DC2626' : (costsData?.budget_consumed_percentage || 0) >= 50 ? '#D97706' : '#16A34A',
                  transition: 'width 0.5s ease',
                  borderRadius: '5px'
                }}
              />
            </div>
          </div>

          {/* Tarjetas de Métricas Rápidas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Costo Total Incurrido</span>
              <span style={{ fontSize: '20px', fontWeight: 800, color: '#731853' }}>
                ${costsData?.total_cost_usd?.toFixed(4) || '0.0000'} <small style={{ fontSize: '11px', color: '#64748B' }}>USD</small>
              </span>
            </div>

            <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Tokens de Entrada</span>
              <span style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A' }}>
                {costsData?.total_input_tokens?.toLocaleString() || '0'}
              </span>
            </div>

            <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Tokens de Salida</span>
              <span style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A' }}>
                {costsData?.total_output_tokens?.toLocaleString() || '0'}
              </span>
            </div>

            <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Llamadas a Modelos</span>
              <span style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A' }}>
                {costsData?.total_calls || 0}
              </span>
            </div>
          </div>

          {/* Configuración de Presupuesto Mensual y Umbral de Alerta */}
          <div style={{ backgroundColor: '#F8FAFC', borderRadius: '8px', padding: '16px 20px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="#731853" />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>
                  Ajuste de Presupuesto y Umbral Preventivo de Alerta
                </span>
              </div>
              {savedField === 'budget' && (
                <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={14} /> Presupuesto actualizado en BigQuery
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '4px' }}>
                  Límite de Presupuesto Mensual ($ USD)
                </label>
                <input
                  type="number"
                  step="5"
                  min="5"
                  max="10000"
                  value={editBudgetUsd}
                  onChange={(e) => setEditBudgetUsd(parseFloat(e.target.value) || 0)}
                  disabled={!isAdmin && userRole !== 'Developer'}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', backgroundColor: '#FFFFFF' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '4px' }}>
                  Umbral de Alerta Temprana (% Consumo)
                </label>
                <input
                  type="number"
                  step="5"
                  min="10"
                  max="100"
                  value={editAlertPct}
                  onChange={(e) => setEditAlertPct(parseFloat(e.target.value) || 0)}
                  disabled={!isAdmin && userRole !== 'Developer'}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', backgroundColor: '#FFFFFF' }}
                />
              </div>

              <div>
                <button
                  onClick={handleSaveBudget}
                  disabled={savingBudget || (!isAdmin && userRole !== 'Developer')}
                  className="btn-primary"
                  style={{ width: '100%', padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  {savingBudget ? (
                    <><Loader2 size={14} className="animate-spin" /> Guardando...</>
                  ) : (
                    <><Save size={14} /> Guardar Presupuesto</>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Desglose por Modelo */}
          {costsData?.cost_by_model && Object.keys(costsData.cost_by_model).length > 0 && (
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '8px', padding: '14px 18px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '10px' }}>
                Consumo Detallado por Modelo:
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                {Object.entries(costsData.cost_by_model).map(([model, cost]) => (
                  <div key={model} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: '10px 14px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>{model}</div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>
                        Tokens: {costsData.tokens_by_model?.[model]?.toLocaleString() || 0}
                      </div>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#731853' }}>
                      ${cost.toFixed(4)} USD
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cuadrícula de Parámetros (Estilo exacto de las tarjetas de Imagen 4) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '20px' }}>
        
        {/* Card: NOMBRE_APLICACION */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>NOMBRE_APLICACION</span>
            <span className="badge" style={{ backgroundColor: '#FAF0F5', color: '#731853', fontSize: '10px' }}>Editable</span>
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>Nombre visible de la solución.</div>
          <input
            type="text"
            value={config.app_name}
            onChange={(e) => setConfig({ ...config, app_name: e.target.value })}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', marginBottom: '14px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-outline" onClick={() => handleSave('app_name')}>
              {savedField === 'app_name' ? <><Check size={14} /> Guardado</> : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Card: SUBTITULO */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>SUBTITULO</span>
            <span className="badge" style={{ backgroundColor: '#FAF0F5', color: '#731853', fontSize: '10px' }}>Editable</span>
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>Subtítulo visible en cabeceras.</div>
          <input
            type="text"
            value={config.subtitle}
            onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', marginBottom: '14px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-outline" onClick={() => handleSave('subtitle')}>
              {savedField === 'subtitle' ? <><Check size={14} /> Guardado</> : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Card: MODELO_LIGERO_NIVEL_3 */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>MODELO_LIGERO_NIVEL_3</span>
            <span className="badge" style={{ backgroundColor: '#FAF0F5', color: '#731853', fontSize: '10px' }}>Editable</span>
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>Modelo de Vertex AI para la primera pasada de IA (Rápido y económico).</div>
          <select
            value={config.models_settings?.light_model_name || config.model_config?.light_model_name || 'gemini-1.5-flash'}
            onChange={(e) => setConfig({ 
              ...config, 
              models_settings: { ...(config.models_settings || {}), light_model_name: e.target.value },
              model_config: { ...(config.model_config || {}), light_model_name: e.target.value } 
            })}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', marginBottom: '14px', backgroundColor: '#ffffff' }}
          >
            <option value="gemini-1.5-flash">gemini-1.5-flash (Recomendado)</option>
            <option value="gemini-1.5-flash-8b">gemini-1.5-flash-8b (Ultra ligero)</option>
          </select>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-outline" onClick={() => handleSave('light_model')}>
              {savedField === 'light_model' ? <><Check size={14} /> Guardado</> : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Card: UMBRAL_ESCALADO_PRO */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>UMBRAL_ESCALADO_PRO</span>
            <span className="badge" style={{ backgroundColor: '#FAF0F5', color: '#731853', fontSize: '10px' }}>Editable</span>
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>Si la confianza de Flash es menor a este valor, escala a Gemini Pro.</div>
          <input
            type="number"
            step="0.05"
            min="0"
            max="1"
            value={config.models_settings?.escalate_confidence_threshold ?? config.model_config?.escalate_confidence_threshold ?? 0.85}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setConfig({ 
                ...config, 
                models_settings: { ...(config.models_settings || {}), escalate_confidence_threshold: val },
                model_config: { ...(config.model_config || {}), escalate_confidence_threshold: val } 
              });
            }}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', marginBottom: '14px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-outline" onClick={() => handleSave('threshold')}>
              {savedField === 'threshold' ? <><Check size={14} /> Guardado</> : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Card: MODELO_AVANZADO_NIVEL_4 */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>MODELO_AVANZADO_NIVEL_4</span>
            <span className="badge" style={{ backgroundColor: '#FAF0F5', color: '#731853', fontSize: '10px' }}>Editable</span>
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>Modelo de alta capacidad para casos de extrema complejidad o baja certeza.</div>
          <select
            value={config.models_settings?.advanced_model_name || config.model_config?.advanced_model_name || 'gemini-1.5-pro'}
            onChange={(e) => setConfig({ 
              ...config, 
              models_settings: { ...(config.models_settings || {}), advanced_model_name: e.target.value },
              model_config: { ...(config.model_config || {}), advanced_model_name: e.target.value } 
            })}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', marginBottom: '14px', backgroundColor: '#ffffff' }}
          >
            <option value="gemini-1.5-pro">gemini-1.5-pro (Máxima precisión)</option>
          </select>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-outline" onClick={() => handleSave('adv_model')}>
              {savedField === 'adv_model' ? <><Check size={14} /> Guardado</> : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Card: GCP_PROJECT_ID */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>GCP_PROJECT_ID</span>
            <span className="badge" style={{ backgroundColor: '#FAF0F5', color: '#731853', fontSize: '10px' }}>Editable</span>
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>Proyecto primario de Google Cloud donde residen BigQuery y Storage.</div>
          <input
            type="text"
            value={config.storage_config?.gcp_project_id || 'crp-poc-it-hackathon-13'}
            onChange={(e) => setConfig({ ...config, storage_config: { ...config.storage_config, gcp_project_id: e.target.value } })}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', marginBottom: '14px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-outline" onClick={() => handleSave('gcp_proj')}>
              {savedField === 'gcp_proj' ? <><Check size={14} /> Guardado</> : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Card: BQ_DATASET (Dataset de la Aplicación) */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>BQ_DATASET (Dataset Maestro)</span>
            <span className="badge" style={{ backgroundColor: '#FAF0F5', color: '#731853', fontSize: '10px' }}>Editable</span>
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>
            Dataset de BigQuery donde se almacenan las 7 tablas maestras de linaje, usuarios y configuraciones.
          </div>
          <input
            type="text"
            value={config.storage_config?.bq_dataset || 'applineajedatos'}
            onChange={(e) => setConfig({ ...config, storage_config: { ...config.storage_config, bq_dataset: e.target.value } })}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', marginBottom: '10px' }}
          />
          {datasetValidationResult && (
            <div style={{ marginBottom: '12px', fontSize: '11px', padding: '6px 10px', borderRadius: '6px', backgroundColor: datasetValidationResult.isValid ? '#F0FDF4' : '#FEF2F2', color: datasetValidationResult.isValid ? '#16A34A' : '#DC2626', border: `1px solid ${datasetValidationResult.isValid ? '#BBF7D0' : '#FECACA'}` }}>
              {datasetValidationResult.isValid ? `✓ ${datasetValidationResult.message}` : `✕ ${datasetValidationResult.message}`}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              className="btn-outline"
              onClick={() => handleValidateDataset(config.storage_config?.bq_dataset || 'applineajedatos')}
              disabled={validatingDataset}
              style={{ fontSize: '12px' }}
            >
              {validatingDataset ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
              Validar Dataset
            </button>
            <button className="btn-outline" onClick={() => handleSave('bq_dataset')}>
              {savedField === 'bq_dataset' ? <><Check size={14} /> Guardado</> : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Card: GCP_SERVICE_ACCOUNT */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>GCP_SERVICE_ACCOUNT (Cuenta de Servicio)</span>
            <span className="badge" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', fontSize: '10px', border: '1px solid #BBF7D0' }}>
              Least Privilege
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>
            Service Account dedicada para Cloud Run Backend. Requiere permisos mínimos (sin roles Owner/Editor/BigQuery Admin).
          </div>
          <input
            type="text"
            value={config.storage_config?.service_account || ''}
            onChange={(e) => setConfig({ ...config, storage_config: { ...config.storage_config, service_account: e.target.value } })}
            placeholder="sa-applineaje-backend@tu-proyecto.iam.gserviceaccount.com"
            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '13px', marginBottom: '14px', fontFamily: 'monospace' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-outline" onClick={() => handleSave('service_account')}>
              {savedField === 'service_account' ? <><Check size={14} /> Guardado</> : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Card: BUCKET_ENTRADA_GCS */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>BUCKET_ENTRADA_GCS (Inbox)</span>
            <span className="badge" style={{ backgroundColor: '#FAF0F5', color: '#731853', fontSize: '10px' }}>Editable</span>
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>Bucket de Google Cloud Storage donde se depositan los logs y scripts para procesamiento continuo.</div>
          <input
            type="text"
            value={config.storage_config?.inbox_bucket || 'gs://datosdeentrada'}
            onChange={(e) => setConfig({ ...config, storage_config: { ...config.storage_config, inbox_bucket: e.target.value } })}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', marginBottom: '10px' }}
          />
          {bucketValidationResults['inbox'] && (
            <div style={{ marginBottom: '12px', fontSize: '11px', padding: '6px 10px', borderRadius: '6px', backgroundColor: bucketValidationResults['inbox'].isValid ? '#F0FDF4' : '#FEF2F2', color: bucketValidationResults['inbox'].isValid ? '#16A34A' : '#DC2626', border: `1px solid ${bucketValidationResults['inbox'].isValid ? '#BBF7D0' : '#FECACA'}` }}>
              {bucketValidationResults['inbox'].isValid ? `✓ ${bucketValidationResults['inbox'].message} (${bucketValidationResults['inbox'].objectsCount} objetos)` : `✕ ${bucketValidationResults['inbox'].message}`}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              className="btn-outline"
              onClick={() => handleValidateBucket('inbox', config.storage_config?.inbox_bucket || 'gs://datosdeentrada')}
              disabled={validatingBucket === 'inbox'}
              style={{ fontSize: '12px' }}
            >
              {validatingBucket === 'inbox' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Validar Bucket
            </button>
            <button className="btn-outline" onClick={() => handleSave('inbox_bucket')}>
              {savedField === 'inbox_bucket' ? <><Check size={14} /> Guardado</> : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Card: BUCKET_PROCESADOS_GCS */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>BUCKET_PROCESADOS_GCS (Archivo)</span>
            <span className="badge" style={{ backgroundColor: '#FAF0F5', color: '#731853', fontSize: '10px' }}>Editable</span>
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>Bucket donde se archivan los archivos analizados exitosamente con estructura YYYY/MM/DD.</div>
          <input
            type="text"
            value={config.storage_config?.processed_bucket || 'gs://datosprocesadosapp'}
            onChange={(e) => setConfig({ ...config, storage_config: { ...config.storage_config, processed_bucket: e.target.value } })}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', marginBottom: '10px' }}
          />
          {bucketValidationResults['processed'] && (
            <div style={{ marginBottom: '12px', fontSize: '11px', padding: '6px 10px', borderRadius: '6px', backgroundColor: bucketValidationResults['processed'].isValid ? '#F0FDF4' : '#FEF2F2', color: bucketValidationResults['processed'].isValid ? '#16A34A' : '#DC2626', border: `1px solid ${bucketValidationResults['processed'].isValid ? '#BBF7D0' : '#FECACA'}` }}>
              {bucketValidationResults['processed'].isValid ? `✓ ${bucketValidationResults['processed'].message} (${bucketValidationResults['processed'].objectsCount} objetos)` : `✕ ${bucketValidationResults['processed'].message}`}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              className="btn-outline"
              onClick={() => handleValidateBucket('processed', config.storage_config?.processed_bucket || 'gs://datosprocesadosapp')}
              disabled={validatingBucket === 'processed'}
              style={{ fontSize: '12px' }}
            >
              {validatingBucket === 'processed' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Validar Bucket
            </button>
            <button className="btn-outline" onClick={() => handleSave('processed_bucket')}>
              {savedField === 'processed_bucket' ? <><Check size={14} /> Guardado</> : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Card: BUCKET_CUARENTENA_GCS */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>BUCKET_CUARENTENA_GCS (Anomalías)</span>
            <span className="badge" style={{ backgroundColor: '#FAF0F5', color: '#731853', fontSize: '10px' }}>Editable</span>
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>Bucket destino para archivos cuyo procesamiento falle de manera irrecuperable.</div>
          <input
            type="text"
            value={config.storage_config?.quarantine_bucket || 'gs://datosquarentena'}
            onChange={(e) => setConfig({ ...config, storage_config: { ...config.storage_config, quarantine_bucket: e.target.value } })}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '14px', marginBottom: '10px' }}
          />
          {bucketValidationResults['quarantine'] && (
            <div style={{ marginBottom: '12px', fontSize: '11px', padding: '6px 10px', borderRadius: '6px', backgroundColor: bucketValidationResults['quarantine'].isValid ? '#F0FDF4' : '#FEF2F2', color: bucketValidationResults['quarantine'].isValid ? '#16A34A' : '#DC2626', border: `1px solid ${bucketValidationResults['quarantine'].isValid ? '#BBF7D0' : '#FECACA'}` }}>
              {bucketValidationResults['quarantine'].isValid ? `✓ ${bucketValidationResults['quarantine'].message} (${bucketValidationResults['quarantine'].objectsCount} objetos)` : `✕ ${bucketValidationResults['quarantine'].message}`}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              className="btn-outline"
              onClick={() => handleValidateBucket('quarantine', config.storage_config?.quarantine_bucket || 'gs://datosquarentena')}
              disabled={validatingBucket === 'quarantine'}
              style={{ fontSize: '12px' }}
            >
              {validatingBucket === 'quarantine' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Validar Bucket
            </button>
            <button className="btn-outline" onClick={() => handleSave('quarantine_bucket')}>
              {savedField === 'quarantine_bucket' ? <><Check size={14} /> Guardado</> : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Card: PROYECTOS_GCP_MONITOREADOS (Multi-Proyecto BigQuery) */}
        <div className="card" style={{ padding: '20px', gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="#731853" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>PROYECTOS_GCP_MONITOREADOS (Multi-Proyecto BigQuery)</span>
            </div>
            <span className="badge" style={{ backgroundColor: '#FAF0F5', color: '#731853', fontSize: '11px', fontWeight: 700 }}>
              Multi-Tenant / Auto-Discovery
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '16px' }}>
            Listado de proyectos de Google Cloud donde el motor de linaje escanea e indexa esquemas, datasets y tablas de BigQuery.
          </div>

          {/* Lista de proyectos configurados */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            {((config.storage_config?.monitored_projects as string[]) || ['crp-poc-it-hackathon-13']).map((proj) => {
              const res = validationResults[proj];
              const isValidating = validatingProject === proj;
              return (
                <div 
                  key={proj}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#F8FAFC',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Database size={16} color="#731853" />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
                      {proj}
                    </span>
                    {res && (
                      res.isValid ? (
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#16A34A', backgroundColor: '#F0FDF4', padding: '2px 8px', borderRadius: '12px', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={12} /> Conectado ({res.datasetsCount} datasets, {res.tablesCount} tablas)
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#DC2626', backgroundColor: '#FEF2F2', padding: '2px 8px', borderRadius: '12px', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <XCircle size={12} /> {res.message}
                        </span>
                      )
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => handleValidateProject(proj)}
                      disabled={isValidating}
                      className="btn-outline"
                      style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      {isValidating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      Validar Conectividad
                    </button>
                    <button
                      onClick={() => handleRemoveProject(proj)}
                      className="btn-outline"
                      style={{ fontSize: '11px', padding: '4px 8px', color: '#DC2626', borderColor: '#FECACA' }}
                      title="Eliminar proyecto monitoreado"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Formulario para agregar nuevo proyecto */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Ej: mi-proyecto-analytics-prod"
              value={newProjectInput}
              onChange={(e) => setNewProjectInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddProject()}
              style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '13px' }}
            />
            <button
              onClick={handleAddProject}
              className="btn-secondary"
              style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={14} /> Agregar y Validar Proyecto
            </button>
          </div>
        </div>

        {/* Panel Interactivo: Guía de Instalación IAM y Principio de Menor Privilegio */}
        <div className="card" style={{ padding: '24px', gridColumn: 'span 2', backgroundColor: '#FAFAFA', border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowIamGuide(!showIamGuide)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <KeyRound size={20} color="#731853" />
              <div>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#1E293B', display: 'block' }}>
                  Guía de Despliegue e Instalación IAM (Principio de Menor Privilegio)
                </span>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  Comandos gcloud listos para ejecutar para configurar un nuevo proyecto GCP sin roles de superadministrador.
                </span>
              </div>
            </div>
            <button
              type="button"
              className="btn-outline"
              style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}
            >
              {showIamGuide ? <><ChevronUp size={14} /> Ocultar Guía</> : <><ChevronDown size={14} /> Ver Comandos IAM</>}
            </button>
          </div>

          {showIamGuide && (
            <div style={{ marginTop: '20px', borderTop: '1px solid #E2E8F0', paddingTop: '18px' }}>
              <div style={{ marginBottom: '16px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', padding: '12px 16px', borderRadius: '8px', fontSize: '12px', color: '#166534' }}>
                <strong>Seguridad Corporativa:</strong> No utilice roles amplios como <code>roles/owner</code>, <code>roles/editor</code> ni <code>roles/bigquery.admin</code>. La Service Account únicamente requiere permisos de edición acotados al dataset de la app y lectura de objetos en los buckets específicos.
              </div>

              {/* Paso 1: Habilitar APIs */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    Paso 1: Habilitar APIs Requeridas en el Proyecto
                  </span>
                  <button
                    onClick={() => copyToClipboard(`gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com bigquery.googleapis.com storage.googleapis.com aiplatform.googleapis.com logging.googleapis.com --project="${config.storage_config?.gcp_project_id || 'crp-poc-it-hackathon-13'}"`, 'apis')}
                    className="btn-outline"
                    style={{ fontSize: '11px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Copy size={11} /> {copiedCmd === 'apis' ? '¡Copiado!' : 'Copiar'}
                  </button>
                </div>
                <pre style={{ backgroundColor: '#0F172A', color: '#F8FAFC', padding: '12px', borderRadius: '6px', fontSize: '12px', overflowX: 'auto', margin: 0, fontFamily: 'monospace' }}>
{`gcloud services enable \\
  run.googleapis.com \\
  cloudbuild.googleapis.com \\
  artifactregistry.googleapis.com \\
  bigquery.googleapis.com \\
  storage.googleapis.com \\
  aiplatform.googleapis.com \\
  logging.googleapis.com \\
  --project="${config.storage_config?.gcp_project_id || 'crp-poc-it-hackathon-13'}"`}
                </pre>
              </div>

              {/* Paso 2: Crear Service Account */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    Paso 2: Crear Service Account Dedicada
                  </span>
                  <button
                    onClick={() => copyToClipboard(`gcloud iam service-accounts create sa-applineaje-backend --display-name="SA Backend Linaje End-to-End" --project="${config.storage_config?.gcp_project_id || 'crp-poc-it-hackathon-13'}"`, 'sa_create')}
                    className="btn-outline"
                    style={{ fontSize: '11px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Copy size={11} /> {copiedCmd === 'sa_create' ? '¡Copiado!' : 'Copiar'}
                  </button>
                </div>
                <pre style={{ backgroundColor: '#0F172A', color: '#F8FAFC', padding: '12px', borderRadius: '6px', fontSize: '12px', overflowX: 'auto', margin: 0, fontFamily: 'monospace' }}>
{`gcloud iam service-accounts create sa-applineaje-backend \\
  --display-name="SA Backend Linaje End-to-End" \\
  --project="${config.storage_config?.gcp_project_id || 'crp-poc-it-hackathon-13'}"`}
                </pre>
              </div>

              {/* Paso 3: Roles Proyecto y Dataset */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    Paso 3: Asignar Roles de Mínimo Privilegio (Proyecto, Dataset y Buckets)
                  </span>
                  <button
                    onClick={() => copyToClipboard(`SA_EMAIL="${config.storage_config?.service_account || `sa-applineaje-backend@${config.storage_config?.gcp_project_id || 'crp-poc-it-hackathon-13'}.iam.gserviceaccount.com`}"
PROJECT_ID="${config.storage_config?.gcp_project_id || 'crp-poc-it-hackathon-13'}"
BQ_DATASET="${config.storage_config?.bq_dataset || 'applineajedatos'}"
INBOX_BUCKET="${(config.storage_config?.inbox_bucket || 'datosdeentrada').replace('gs://', '')}"
PROCESSED_BUCKET="${(config.storage_config?.processed_bucket || 'datosprocesadosapp').replace('gs://', '')}"

# Roles a nivel Proyecto
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA_EMAIL" --role="roles/bigquery.jobUser"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA_EMAIL" --role="roles/aiplatform.user"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA_EMAIL" --role="roles/logging.logWriter"

# Rol a nivel Dataset de la App (sin ser BigQuery Admin)
bq add-iam-policy-binding --member="serviceAccount:$SA_EMAIL" --role="roles/bigquery.dataEditor" "$PROJECT_ID:$BQ_DATASET"

# Roles a nivel Buckets (sin ser Storage Admin)
gcloud storage buckets add-iam-policy-binding "gs://$INBOX_BUCKET" --member="serviceAccount:$SA_EMAIL" --role="roles/storage.objectAdmin"
gcloud storage buckets add-iam-policy-binding "gs://$PROCESSED_BUCKET" --member="serviceAccount:$SA_EMAIL" --role="roles/storage.objectAdmin"`, 'roles')}
                    className="btn-outline"
                    style={{ fontSize: '11px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Copy size={11} /> {copiedCmd === 'roles' ? '¡Copiado!' : 'Copiar'}
                  </button>
                </div>
                <pre style={{ backgroundColor: '#0F172A', color: '#F8FAFC', padding: '12px', borderRadius: '6px', fontSize: '12px', overflowX: 'auto', margin: 0, fontFamily: 'monospace' }}>
{`SA_EMAIL="${config.storage_config?.service_account || `sa-applineaje-backend@${config.storage_config?.gcp_project_id || 'crp-poc-it-hackathon-13'}.iam.gserviceaccount.com`}"
PROJECT_ID="${config.storage_config?.gcp_project_id || 'crp-poc-it-hackathon-13'}"
BQ_DATASET="${config.storage_config?.bq_dataset || 'applineajedatos'}"
INBOX_BUCKET="${(config.storage_config?.inbox_bucket || 'datosdeentrada').replace('gs://', '')}"
PROCESSED_BUCKET="${(config.storage_config?.processed_bucket || 'datosprocesadosapp').replace('gs://', '')}"

# 1. Ejecutar consultas y llamadas a IA a nivel Proyecto
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA_EMAIL" --role="roles/bigquery.jobUser"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA_EMAIL" --role="roles/aiplatform.user"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA_EMAIL" --role="roles/logging.logWriter"

# 2. Permisos de datos únicamente sobre el Dataset de la Aplicación
bq add-iam-policy-binding --member="serviceAccount:$SA_EMAIL" --role="roles/bigquery.dataEditor" "$PROJECT_ID:$BQ_DATASET"

# 3. Permisos de archivos únicamente sobre los Buckets de la Aplicación
gcloud storage buckets add-iam-policy-binding "gs://$INBOX_BUCKET" --member="serviceAccount:$SA_EMAIL" --role="roles/storage.objectAdmin"
gcloud storage buckets add-iam-policy-binding "gs://$PROCESSED_BUCKET" --member="serviceAccount:$SA_EMAIL" --role="roles/storage.objectAdmin"`}
                </pre>
              </div>

              {/* Paso 4: Despliegue Cloud Run */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    Paso 4: Comando de Despliegue Automatizado
                  </span>
                  <button
                    onClick={() => copyToClipboard(`./deploy/deploy_gcp.sh ${config.storage_config?.gcp_project_id || 'crp-poc-it-hackathon-13'} us-central1 ${config.storage_config?.bq_dataset || 'applineajedatos'} ${(config.storage_config?.inbox_bucket || 'datosdeentrada').replace('gs://', '')} ${(config.storage_config?.processed_bucket || 'datosprocesadosapp').replace('gs://', '')} sa-applineaje-backend`, 'deploy')}
                    className="btn-outline"
                    style={{ fontSize: '11px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Copy size={11} /> {copiedCmd === 'deploy' ? '¡Copiado!' : 'Copiar'}
                  </button>
                </div>
                <pre style={{ backgroundColor: '#0F172A', color: '#F8FAFC', padding: '12px', borderRadius: '6px', fontSize: '12px', overflowX: 'auto', margin: 0, fontFamily: 'monospace' }}>
{`./deploy/deploy_gcp.sh \\
  "${config.storage_config?.gcp_project_id || 'crp-poc-it-hackathon-13'}" \\
  "us-central1" \\
  "${config.storage_config?.bq_dataset || 'applineajedatos'}" \\
  "${(config.storage_config?.inbox_bucket || 'datosdeentrada').replace('gs://', '')}" \\
  "${(config.storage_config?.processed_bucket || 'datosprocesadosapp').replace('gs://', '')}" \\
  "sa-applineaje-backend"`}
                </pre>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
};

import { useEffect, useState } from 'react';
import api from '../services/api';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Save, RefreshCw, X, Power, PowerOff, CreditCard, Phone, Star, UserRound } from 'lucide-react';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { TableSkeleton } from '../components/ui/Skeleton';

type Metodo = {
  id_metodo_pago: number;
  id_evento: number;
  nombre: string;
  tipo: string;
  activo: boolean;
  orden: number;
  color_hex?: string;
  requiere_referencia?: boolean;
  cuentas_receptoras?: CuentaPago[];
};

type CuentaPago = {
  id_cuenta_pago: number;
  nombre_titular?: string | null;
  numero_destino: string;
  activo: boolean;
  es_predeterminado: boolean;
  orden: number;
};

const COLOR_OPTIONS = [
  { value: '#a855f7', label: 'Morado (Yape)', bg: 'bg-purple-500' },
  { value: '#06b6d4', label: 'Celeste (Plin)', bg: 'bg-cyan-500' },
  { value: '#10b981', label: 'Verde (Efectivo)', bg: 'bg-emerald-500' },
  { value: '#3b82f6', label: 'Azul (Tarjetas)', bg: 'bg-blue-500' },
  { value: '#f59e0b', label: 'Ámbar / Naranja', bg: 'bg-amber-500' },
  { value: '#64748b', label: 'Gris (Default)', bg: 'bg-slate-500' },
];

const getHexColor = (val?: string) => {
  if (!val) return '#64748b';
  if (val.startsWith('#')) return val;
  if (val.includes('purple')) return '#a855f7';
  if (val.includes('cyan')) return '#06b6d4';
  if (val.includes('emerald')) return '#10b981';
  if (val.includes('blue')) return '#3b82f6';
  if (val.includes('amber')) return '#f59e0b';
  return '#64748b';
};

const esTipoTransferencia = (tipo: string) => ['TRANSFERENCIA', 'BILLETERA_DIGITAL'].includes(tipo);

export function MetodosPagoPage() {
  const [metodos, setMetodos] = useState<Metodo[]>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Metodo | null>(null);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('EFECTIVO');
  const [activo, setActivo] = useState(true);
  const [orden, setOrden] = useState<number | ''>('');
  const [colorHex, setColorHex] = useState(COLOR_OPTIONS[5].value);
  const [deleteConfirm, setDeleteConfirm] = useState<Metodo | null>(null);
  const [deleteCuentaConfirm, setDeleteCuentaConfirm] = useState<CuentaPago | null>(null);
  const [cuentasMetodo, setCuentasMetodo] = useState<Metodo | null>(null);
  const [nuevoTitular, setNuevoTitular] = useState('');
  const [nuevoNumero, setNuevoNumero] = useState('');
  const [guardandoCuenta, setGuardandoCuenta] = useState(false);

  useEffect(() => {
    fetchMetodos();
  }, []);

  const fetchMetodos = async () => {
    setLoading(true);
    try {
      const res = await api.get('/evento/metodos-pago');
      setMetodos(res.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error cargando métodos de pago');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setNombre('');
    setTipo('EFECTIVO');
    setActivo(true);
    setOrden('');
    setColorHex(COLOR_OPTIONS[5].value);
    setNuevoTitular('');
    setNuevoNumero('');
    setOpenForm(true);
  };

  const openEdit = (m: Metodo) => {
    setEditing(m);
    setNombre(m.nombre);
    setTipo(m.tipo);
    setActivo(Boolean(m.activo));
    setOrden(m.orden ?? '');
    setColorHex(m.color_hex || COLOR_OPTIONS[5].value);
    setOpenForm(true);
  };

  const save = async () => {
    if (!nombre.trim()) return toast.error('El nombre es requerido');
    if (!editing && esTipoTransferencia(tipo) && nuevoNumero.replace(/\D/g, '').length < 6) {
      return toast.error('Ingresa el número donde se recibirán las transferencias');
    }
    try {
      if (editing) {
        const res = await api.put(`/evento/metodos-pago/${editing.id_metodo_pago}`, { nombre, tipo, activo, orden: orden === '' ? 0 : Number(orden), color_hex: colorHex, requiere_referencia: false });
        setMetodos(prev => prev.map(p => p.id_metodo_pago === res.data.id_metodo_pago ? { ...res.data, cuentas_receptoras: p.cuentas_receptoras || [] } : p));
        toast.success('Método actualizado');
      } else {
        const res = await api.post('/evento/metodos-pago', {
          nombre,
          tipo,
          activo,
          orden: orden === '' ? 0 : Number(orden),
          color_hex: colorHex,
          requiere_referencia: false,
          cuenta_receptora: esTipoTransferencia(tipo) ? {
            nombre_titular: nuevoTitular.trim() || null,
            numero_destino: nuevoNumero.replace(/\D/g, ''),
          } : null,
        });
        const nuevoMetodo = { ...res.data, cuentas_receptoras: res.data.cuentas_receptoras || [] };
        setMetodos(prev => [nuevoMetodo, ...prev]);
        toast.success('Método creado');
      }
      setOpenForm(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error guardando método');
    }
  };

  const confirmarEliminar = (m: Metodo) => setDeleteConfirm(m);

  const ejecutarEliminar = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/evento/metodos-pago/${deleteConfirm.id_metodo_pago}`);
      setMetodos(prev => prev.filter(p => p.id_metodo_pago !== deleteConfirm.id_metodo_pago));
      toast.success('Método eliminado');
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error eliminando método');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const toggleEstado = async (m: Metodo) => {
    try {
      const res = await api.put(`/evento/metodos-pago/${m.id_metodo_pago}`, { 
        nombre: m.nombre, tipo: m.tipo, orden: m.orden, color_hex: m.color_hex, requiere_referencia: false,
        activo: !m.activo 
      });
      setMetodos(prev => prev.map(p => p.id_metodo_pago === res.data.id_metodo_pago ? { ...res.data, cuentas_receptoras: p.cuentas_receptoras || [] } : p));
      toast.success('Estado actualizado');
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error actualizando estado');
    }
  };

  const abrirCuentas = (metodo: Metodo) => {
    setCuentasMetodo(metodo);
    setNuevoTitular('');
    setNuevoNumero('');
  };

  const agregarCuenta = async () => {
    if (!cuentasMetodo) return;
    const numero = nuevoNumero.replace(/\D/g, '');
    if (numero.length < 6) return toast.error('Ingresa un número de destino válido');

    setGuardandoCuenta(true);
    try {
      const res = await api.post(`/evento/metodos-pago/${cuentasMetodo.id_metodo_pago}/cuentas`, {
        nombre_titular: nuevoTitular.trim() || null,
        numero_destino: numero,
        es_predeterminado: (cuentasMetodo.cuentas_receptoras || []).length === 0,
      });
      const actualizado = {
        ...cuentasMetodo,
        cuentas_receptoras: [...(cuentasMetodo.cuentas_receptoras || []), res.data],
      };
      setCuentasMetodo(actualizado);
      setMetodos(prev => prev.map(m => m.id_metodo_pago === actualizado.id_metodo_pago ? actualizado : m));
      setNuevoTitular('');
      setNuevoNumero('');
      toast.success('Cuenta receptora agregada');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'No se pudo agregar la cuenta');
    } finally {
      setGuardandoCuenta(false);
    }
  };

  const definirPredeterminada = async (cuenta: CuentaPago) => {
    if (!cuentasMetodo || cuenta.es_predeterminado) return;
    try {
      await api.put(`/evento/metodos-pago/${cuentasMetodo.id_metodo_pago}/cuentas/${cuenta.id_cuenta_pago}/predeterminada`);
      const cuentas = (cuentasMetodo.cuentas_receptoras || []).map(item => ({
        ...item,
        es_predeterminado: item.id_cuenta_pago === cuenta.id_cuenta_pago,
      }));
      const actualizado = { ...cuentasMetodo, cuentas_receptoras: cuentas };
      setCuentasMetodo(actualizado);
      setMetodos(prev => prev.map(m => m.id_metodo_pago === actualizado.id_metodo_pago ? actualizado : m));
      toast.success('Cuenta predeterminada actualizada');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'No se pudo cambiar la cuenta');
    }
  };

  const quitarCuenta = async (cuenta: CuentaPago) => {
    if (!cuentasMetodo) return;
    try {
      await api.delete(`/evento/metodos-pago/${cuentasMetodo.id_metodo_pago}/cuentas/${cuenta.id_cuenta_pago}`);
      const restantes = (cuentasMetodo.cuentas_receptoras || []).filter(item => item.id_cuenta_pago !== cuenta.id_cuenta_pago);
      if (cuenta.es_predeterminado && restantes.length > 0) restantes[0] = { ...restantes[0], es_predeterminado: true };
      const actualizado = { ...cuentasMetodo, cuentas_receptoras: restantes };
      setCuentasMetodo(actualizado);
      setMetodos(prev => prev.map(m => m.id_metodo_pago === actualizado.id_metodo_pago ? actualizado : m));
      toast.success('Cuenta eliminada');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'No se pudo eliminar la cuenta');
    } finally {
      setDeleteCuentaConfirm(null);
    }
  };

  return (
    <div className="event-admin w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="event-page-title">Métodos de pago</h1>
          <p className="event-page-description">Configura los métodos de pago disponibles en las cajas del evento.</p>
        </div>
        <div className="event-page-actions w-full sm:w-auto">
          <button type="button" onClick={fetchMetodos} disabled={loading} aria-busy={loading} className="event-action-secondary flex-1 sm:flex-none">
            <RefreshCw className={`size-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} />
            {loading ? 'Actualizando' : 'Actualizar'}
          </button>
          <button type="button" onClick={openCreate} className="event-action-primary flex-1 sm:flex-none">
            <Plus className="size-4" />
            Nuevo Método
          </button>
        </div>
      </div>

      <div className="event-table-shell">
        <div className="overflow-x-auto">
          <table className="event-data-table responsive-admin-table">
            <thead className="text-xs uppercase bg-slate-50/50 dark:bg-slate-900/20 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800/60">
              <tr>
                <th className="px-6 py-4">Orden</th>
                <th className="px-6 py-4">Nombre / Tipo</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-8"><TableSkeleton columns={4} /></td></tr>
              ) : metodos.length === 0 ? (
                <tr><td colSpan={4} className="p-6"><div className="event-empty-state min-h-48"><CreditCard className="size-8 text-primary" /><div><p className="font-bold text-slate-800 dark:text-white">Aún no hay métodos de pago</p><p className="mt-1 text-sm">Configura cómo podrán pagar los asistentes.</p></div><button type="button" onClick={openCreate} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90">Nuevo método</button></div></td></tr>
              ) : (
                metodos.map(m => (
                  <tr key={m.id_metodo_pago} className={`border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-[#050B14] transition-colors ${!m.activo ? 'opacity-50' : ''}`}>
                    <td data-label="Orden" className="px-6 py-4 font-mono text-slate-400">{m.orden}</td>
                    <td data-label="Método" className="px-6 py-4 font-semibold text-slate-900 dark:text-white flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${getHexColor(m.color_hex)}20`, color: getHexColor(m.color_hex) }}>
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-white uppercase">{m.nombre}</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md mt-0.5 w-fit text-white" style={{ backgroundColor: getHexColor(m.color_hex) }}>{m.tipo}</span>
                        {esTipoTransferencia(m.tipo) && (
                          <span className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                            {(m.cuentas_receptoras || []).length} {(m.cuentas_receptoras || []).length === 1 ? 'cuenta receptora' : 'cuentas receptoras'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="Estado" className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${m.activo ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>
                        {m.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td data-label="Acciones" className="px-6 py-4 text-right space-x-2">
                      {esTipoTransferencia(m.tipo) && (
                        <button type="button" onClick={() => abrirCuentas(m)} aria-label={`Administrar cuentas de ${m.nombre}`} title="Cuentas receptoras" className="p-2 text-slate-400 hover:text-primary transition-colors hover:bg-primary/10 rounded-lg">
                          <Phone className="size-4" />
                        </button>
                      )}
                      <button onClick={() => toggleEstado(m)} title={m.activo ? "Desactivar" : "Activar"} className={`p-2 rounded-lg transition-colors ${m.activo ? 'text-slate-400 hover:text-accent hover:bg-accent/10' : 'text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10'}`}>
                        {m.activo ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openEdit(m)} title="Editar" className="p-2 text-slate-400 hover:text-secondary transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => confirmarEliminar(m)} title="Eliminar" className="p-2 text-slate-400 hover:text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openForm && (
        <div className="event-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#0B1120] rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden relative z-10">
            <div className="h-1 w-full bg-secondary"></div>
            <div className="p-5 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/20 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{editing ? 'Editar Método' : 'Nuevo Método'}</h3>
              <button type="button" onClick={() => setOpenForm(false)} aria-label="Cerrar formulario de método de pago" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Nombre del método</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none" placeholder="Ej: Yape, Visa, Efectivo..." />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Tipo</label>
                <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none">
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TARJETA">Tarjeta</option>
                  <option value="TRANSFERENCIA">Transferencia / QR</option>
                  <option value="BILLETERA_DIGITAL">Billetera digital</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>

              {!editing && esTipoTransferencia(tipo) && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm dark:bg-slate-800">
                      <Phone className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">Cuenta donde recibirás el dinero</p>
                      <p className="mt-0.5 text-pretty text-xs text-slate-500 dark:text-slate-400">Este número aparecerá al cajero y quedará como predeterminado.</p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">Titular o alias</label>
                      <input value={nuevoTitular} onChange={e => setNuevoTitular(e.target.value)} maxLength={120} placeholder="Ej: Caja principal" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-[#0B1120] dark:text-white" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">Número receptor *</label>
                      <input value={nuevoNumero} onChange={e => setNuevoNumero(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={30} required placeholder="Ej: 987654321" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-[#0B1120] dark:text-white" />
                    </div>
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColorHex(c.value)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${c.bg} ${colorHex === c.value ? 'border-primary scale-110 shadow-md ring-2 ring-primary/20' : 'border-transparent hover:scale-105'}`}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center space-x-3 cursor-pointer p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary/50" /> 
                  <span className="text-sm font-medium dark:text-slate-300">Activo</span>
                </label>
                <div className="flex items-center">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-3">Orden</label>
                  <input type="number" value={orden as any} onChange={e => setOrden(e.target.value === '' ? '' : Number(e.target.value))} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none font-mono" placeholder="Ej: 1" />
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/50 flex justify-end space-x-3">
              <button type="button" onClick={() => setOpenForm(false)} className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold shadow-sm hover:bg-slate-50 dark:border-white/20 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Cancelar</button>
              <button onClick={save} className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-sm flex items-center transition-all hover:scale-105">
                <Save className="w-4 h-4 mr-2" />
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {cuentasMetodo && (
        <div className="event-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="relative z-10 flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#0B1120]">
            <div className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-slate-800">
              <div>
                <h3 className="text-balance text-xl font-bold text-slate-900 dark:text-white">Cuentas receptoras de {cuentasMetodo.nombre}</h3>
                <p className="mt-1 text-pretty text-sm text-slate-500 dark:text-slate-400">Este es el número que verá el cajero para recibir la transferencia.</p>
              </div>
              <button type="button" onClick={() => setCuentasMetodo(null)} aria-label="Cerrar cuentas receptoras" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto p-5">
              <div className="space-y-2">
                {(cuentasMetodo.cuentas_receptoras || []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center dark:border-slate-700">
                    <Phone className="mx-auto size-7 text-slate-400" />
                    <p className="mt-2 font-bold text-slate-800 dark:text-white">Aún no hay un número receptor</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Agrega el primer número; quedará como predeterminado.</p>
                  </div>
                ) : (cuentasMetodo.cuentas_receptoras || []).map(cuenta => (
                  <div key={cuenta.id_cuenta_pago} className={`flex items-center gap-3 rounded-xl border p-3 ${cuenta.es_predeterminado ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700'}`}>
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                      <UserRound className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-bold tabular-nums text-slate-900 dark:text-white">{cuenta.numero_destino}</p>
                        {cuenta.es_predeterminado && <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">Predeterminada</span>}
                      </div>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{cuenta.nombre_titular || 'Sin titular registrado'}</p>
                    </div>
                    <button type="button" onClick={() => definirPredeterminada(cuenta)} disabled={cuenta.es_predeterminado} aria-label={`Usar ${cuenta.numero_destino} como predeterminada`} title="Marcar como predeterminada" className="rounded-lg p-2 text-slate-400 hover:bg-amber-50 hover:text-amber-500 disabled:cursor-default disabled:text-amber-500 dark:hover:bg-amber-500/10">
                      <Star className={`size-4 ${cuenta.es_predeterminado ? 'fill-current' : ''}`} />
                    </button>
                    <button type="button" onClick={() => setDeleteCuentaConfirm(cuenta)} aria-label={`Eliminar cuenta ${cuenta.numero_destino}`} title="Eliminar cuenta" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                <h4 className="font-bold text-slate-800 dark:text-white">Agregar otro número</h4>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">Titular o alias</label>
                    <input value={nuevoTitular} onChange={e => setNuevoTitular(e.target.value)} maxLength={120} placeholder="Ej: Caja principal" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-[#0B1120] dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">Número de destino</label>
                    <input value={nuevoNumero} onChange={e => setNuevoNumero(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={30} placeholder="Ej: 987654321" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-[#0B1120] dark:text-white" />
                  </div>
                </div>
                <button type="button" onClick={agregarCuenta} disabled={guardandoCuenta} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60">
                  <Plus className="size-4" />
                  {guardandoCuenta ? 'Agregando...' : 'Agregar cuenta receptora'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={ejecutarEliminar}
        title="Eliminar Método de Pago"
        message={`¿Estás seguro que deseas eliminar el método "${deleteConfirm?.nombre}"? Esta acción no se puede deshacer.`}
        isDestructive={true}
      />
      <ConfirmModal
        isOpen={!!deleteCuentaConfirm}
        onClose={() => setDeleteCuentaConfirm(null)}
        onConfirm={async () => { if (deleteCuentaConfirm) await quitarCuenta(deleteCuentaConfirm); }}
        title="Eliminar cuenta receptora"
        message={`¿Deseas retirar el número ${deleteCuentaConfirm?.numero_destino || ''}? Las ventas anteriores conservarán este dato.`}
        isDestructive={true}
      />
    </div>
  );
}

import { useEffect, useState } from 'react';
import api from '../services/api';
import { toast } from 'sonner';
import { Plus, Edit2, KeyRound, Power, PowerOff, Save, RefreshCw, X, Users, Eye, EyeOff } from 'lucide-react';
import { TableSkeleton } from '../components/ui/Skeleton';

type Cajero = {
  id_cajero_evento: number;
  id_evento: number;
  nombre: string;
  pin?: string;
  estado: boolean;
  fecha_creacion: string;
};

export function CajerosPage() {
  const [cajeros, setCajeros] = useState<Cajero[]>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Cajero | null>(null);
  const [nombre, setNombre] = useState('');
  const [pin, setPin] = useState('');
  const [openReset, setOpenReset] = useState(false);
  const [resetPinValue, setResetPinValue] = useState('');
  const [cajeroToReset, setCajeroToReset] = useState<Cajero | null>(null);
  
  // States for PIN visibility
  const [showPins, setShowPins] = useState<Record<number, boolean>>({});
  const [showModalPin, setShowModalPin] = useState(false);

  const togglePin = (id: number) => setShowPins(prev => ({ ...prev, [id]: !prev[id] }));

  const fetchCajeros = async () => {
    setLoading(true);
    try {
      const res = await api.get('/cajeros');
      setCajeros(res.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error cargando cajeros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCajeros();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setNombre('');
    setPin('');
    setOpenForm(true);
  };

  const openEdit = (c: Cajero) => {
    setEditing(c);
    setNombre(c.nombre);
    setPin('');
    setOpenForm(true);
  };

  const saveCajero = async () => {
    if (!nombre.trim()) return toast.error('El nombre es requerido');
    if (!editing && (!pin || pin.length < 4)) return toast.error('El PIN debe tener al menos 4 caracteres');
    try {
      if (editing) {
        const res = await api.put(`/cajeros/${editing.id_cajero_evento}`, { nombre, pin: pin || undefined });
        setCajeros(prev => prev.map(p => p.id_cajero_evento === res.data.id_cajero_evento ? res.data : p));
        toast.success('Cajero actualizado');
      } else {
        const res = await api.post('/cajeros', { nombre, pin });
        setCajeros(prev => [res.data, ...prev]);
        toast.success('Cajero creado');
      }
      setOpenForm(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error guardando cajero');
    }
  };

  const toggleEstado = async (c: Cajero) => {
    try {
      const res = await api.put(`/cajeros/${c.id_cajero_evento}`, { estado: !c.estado });
      setCajeros(prev => prev.map(p => p.id_cajero_evento === res.data.id_cajero_evento ? res.data : p));
      toast.success('Estado actualizado');
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error actualizando estado');
    }
  };

  const openResetModal = (c: Cajero) => {
    setCajeroToReset(c);
    setResetPinValue('');
    setOpenReset(true);
  };

  const submitReset = async () => {
    if (!cajeroToReset) return;
    if (!resetPinValue || resetPinValue.length < 4) return toast.error('El PIN debe tener al menos 4 caracteres');
    try {
      await api.post(`/cajeros/${cajeroToReset.id_cajero_evento}/reset-pin`, { nuevo_pin: resetPinValue });
      toast.success('PIN reseteado');
      setOpenReset(false);
      fetchCajeros();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error reseteando PIN');
    }
  };

  return (
    <div className="event-admin w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="event-page-title">Cajeros</h1>
          <p className="event-page-description">Administra el personal, sus accesos y el estado de cada caja.</p>
        </div>
        <div className="event-page-actions w-full sm:w-auto">
          <button type="button" onClick={fetchCajeros} disabled={loading} aria-busy={loading} className="event-action-secondary flex-1 sm:flex-none">
            <RefreshCw className={`size-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} />
            {loading ? 'Actualizando' : 'Actualizar'}
          </button>
          <button type="button" onClick={openCreate} className="event-action-primary flex-1 sm:flex-none">
            <Plus className="size-4" />
            Nuevo cajero
          </button>
        </div>
      </div>

      <div className="event-table-shell">
        <div className="overflow-x-auto">
          <table className="event-data-table responsive-admin-table">
            <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4 rounded-tl-xl">Nombre</th>
                <th className="px-6 py-4">PIN</th>
                <th className="px-6 py-4">Fecha Creación</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right rounded-tr-xl">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8"><TableSkeleton columns={5} /></td></tr>
              ) : cajeros.length === 0 ? (
                <tr><td colSpan={5} className="p-6"><div className="event-empty-state min-h-48"><Users className="size-8 text-primary" /><div><p className="font-bold text-slate-800 dark:text-white">Aún no hay cajeros</p><p className="mt-1 text-sm">Registra al personal que atenderá las ventas del evento.</p></div><button type="button" onClick={openCreate} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90">Nuevo cajero</button></div></td></tr>
              ) : (
                cajeros.map(c => (
                  <tr key={c.id_cajero_evento} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                    <td data-label="Nombre" className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{c.nombre}</td>
                    <td data-label="PIN" className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <code className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-primary font-mono font-bold tracking-wider">
                          {c.pin ? (showPins[c.id_cajero_evento] ? c.pin : '****') : '****'}
                        </code>
                        <button type="button" onClick={() => togglePin(c.id_cajero_evento)} disabled={!c.pin} aria-label={showPins[c.id_cajero_evento] ? `Ocultar PIN de ${c.nombre}` : `Mostrar PIN de ${c.nombre}`} title={showPins[c.id_cajero_evento] ? 'Ocultar PIN' : 'Mostrar PIN'} className="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-primary/15">
                          {showPins[c.id_cajero_evento] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </td>
                    <td data-label="Creación" className="px-6 py-4 text-slate-500">{new Date(c.fecha_creacion).toLocaleString()}</td>
                    <td data-label="Estado" className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${c.estado ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>
                        {c.estado ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td data-label="Acciones" className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => toggleEstado(c)} title={c.estado ? "Desactivar" : "Activar"} className={`p-2 rounded-lg transition-colors ${c.estado ? 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10' : 'text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10'}`}>
                        {c.estado ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openResetModal(c)} title="Resetear PIN" className="p-2 text-slate-400 hover:text-primary transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEdit(c)} title="Editar" className="p-2 text-slate-400 hover:text-primary transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form modal */}
      {openForm && (
        <div className="event-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute top-1/3 left-1/4 w-[30rem] h-[30rem] bg-primary/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen hidden dark:block"></div>
          <div className="absolute bottom-1/3 right-1/4 w-[30rem] h-[30rem] bg-accent/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen hidden dark:block"></div>
          
          <div className="w-full max-w-md bg-white dark:bg-[#0B1120] rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden relative z-10">
            {/* Gradient Top Bar */}
            <div className="h-1 w-full bg-secondary"></div>
            
            <div className="p-6 border-b border-slate-100/50 dark:border-slate-800/50 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{editing ? 'Editar Cajero' : 'Nuevo Cajero'}</h3>
              <button type="button" onClick={() => setOpenForm(false)} aria-label="Cerrar formulario de cajero" className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors bg-slate-100 dark:bg-slate-800 p-2 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Nombre del Cajero</label>
                  <input value={nombre} onChange={e => setNombre(e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none" placeholder="Ej. Juan Pérez" />
              </div>
              <div className="relative">
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">PIN de Acceso {editing ? '(solo para cambiar)' : ''}</label>
                <div className="relative">
                  <input value={pin} onChange={e => setPin(e.target.value.slice(0, 4))} type={showModalPin ? "text" : "password"} maxLength={4} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none tracking-[0.5em] font-mono text-center text-xl pr-12" placeholder="••••" />
                  <button type="button" onClick={() => setShowModalPin(!showModalPin)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-primary transition-colors">
                    {showModalPin ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/50 flex justify-end space-x-3">
              <button type="button" onClick={() => setOpenForm(false)} className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold shadow-sm hover:bg-slate-50 dark:border-white/20 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Cancelar</button>
              <button onClick={saveCajero} className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-sm flex items-center transition-all hover:scale-105">
                <Save className="w-4 h-4 mr-2" />
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset PIN modal */}
      {openReset && cajeroToReset && (
        <div className="event-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute top-1/3 left-1/4 w-[30rem] h-[30rem] bg-secondary/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen hidden dark:block"></div>
          <div className="absolute bottom-1/3 right-1/4 w-[30rem] h-[30rem] bg-accent/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen hidden dark:block"></div>
          
          <div className="w-full max-w-md bg-white dark:bg-[#0B1120] rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden relative z-10">
            <div className="h-1 w-full bg-secondary"></div>
            
            <div className="p-6 border-b border-slate-100/50 dark:border-slate-800/50 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Resetear PIN</h3>
              <button type="button" onClick={() => setOpenReset(false)} aria-label="Cerrar cambio de PIN" className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors bg-slate-100 dark:bg-slate-800 p-2 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Establece un nuevo código PIN de acceso rápido para el cajero <strong className="text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{cajeroToReset.nombre}</strong>.</p>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Nuevo PIN</label>
                <input value={resetPinValue} onChange={(e) => setResetPinValue(e.target.value)} type="text" className="w-full border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all dark:text-white outline-none font-mono tracking-widest" placeholder="****" />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100/50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-800/30 flex justify-end space-x-3">
              <button onClick={() => setOpenReset(false)} className="px-5 py-2.5 rounded-xl bg-slate-500 text-white font-bold shadow-lg shadow-slate-500/30 transition-all hover:scale-105">Cancelar</button>
              <button onClick={submitReset} className="px-5 py-2.5 rounded-xl bg-secondary text-white font-bold shadow-sm flex items-center transition-all hover:scale-105">
                <Save className="w-4 h-4 mr-2" />
                Resetear
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

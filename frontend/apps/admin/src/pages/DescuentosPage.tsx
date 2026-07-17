import { useEffect, useState } from 'react';
import api from '../services/api';
import { toast } from 'sonner';
import { Plus, Edit2, Power, PowerOff, Save, RefreshCw, X, Trash2, Tag } from 'lucide-react';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { TableSkeleton } from '../components/ui/Skeleton';

type Producto = {
  id_producto: number;
  nombre: string;
};

type Descuento = {
  id_descuento: number;
  id_evento: number;
  id_producto: number;
  nombre: string;
  cantidad_minima: number;
  tipo_descuento: 'PORCENTAJE' | 'MONTO_FIJO' | 'PRECIO_ESPECIAL';
  valor_descuento: number;
  activo: boolean;
};

export function DescuentosPage() {
  const [descuentos, setDescuentos] = useState<Descuento[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  
  const [editing, setEditing] = useState<Descuento | null>(null);
  const [idProducto, setIdProducto] = useState<number | ''>('');
  const [nombre, setNombre] = useState('');
  const [cantidadMinima, setCantidadMinima] = useState<number | ''>('');
  const [tipoDescuento, setTipoDescuento] = useState<'PORCENTAJE' | 'MONTO_FIJO' | 'PRECIO_ESPECIAL'>('PORCENTAJE');
  const [valorDescuento, setValorDescuento] = useState<number | ''>('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const fetchDatos = async () => {
    setLoading(true);
    try {
      const [resDesc, resProd] = await Promise.all([
        api.get('/evento/descuentos'),
        api.get('/productos')
      ]);
      setDescuentos(resDesc.data || []);
      setProductos(resProd.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Error cargando descuentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatos();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setIdProducto('');
    setNombre('');
    setCantidadMinima('');
    setTipoDescuento('PORCENTAJE');
    setValorDescuento('');
    setOpenForm(true);
  };

  const openEdit = (d: Descuento) => {
    setEditing(d);
    setIdProducto(d.id_producto);
    setNombre(d.nombre);
    setCantidadMinima(d.cantidad_minima);
    setTipoDescuento(d.tipo_descuento);
    setValorDescuento(d.valor_descuento);
    setOpenForm(true);
  };

  const saveDescuento = async () => {
    if (!idProducto) return toast.error('Selecciona un producto');
    if (!nombre.trim()) return toast.error('El nombre es requerido');
    if (!cantidadMinima || Number(cantidadMinima) <= 0) return toast.error('Cantidad mínima inválida');
    if (!valorDescuento || Number(valorDescuento) <= 0) return toast.error('Valor de descuento inválido');

    const payload = {
      id_producto: Number(idProducto),
      nombre,
      cantidad_minima: Number(cantidadMinima),
      tipo_descuento: tipoDescuento,
      valor_descuento: Number(valorDescuento)
    };

    try {
      if (editing) {
        const res = await api.put(`/descuentos/${editing.id_descuento}`, payload);
        setDescuentos(prev => prev.map(p => p.id_descuento === res.data.id_descuento ? res.data : p));
        toast.success('Descuento actualizado');
      } else {
        const res = await api.post('/descuentos', payload);
        setDescuentos(prev => [res.data, ...prev]);
        toast.success('Descuento creado');
      }
      setOpenForm(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error guardando descuento');
    }
  };

  const toggleEstado = async (d: Descuento) => {
    try {
      const res = await api.put(`/descuentos/${d.id_descuento}`, { activo: !d.activo });
      setDescuentos(prev => prev.map(p => p.id_descuento === res.data.id_descuento ? res.data : p));
      toast.success('Estado actualizado');
    } catch (err: any) {
      console.error(err);
      toast.error('Error actualizando estado');
    }
  };

  const confirmDelete = (id: number) => setDeleteConfirm(id);

  const ejecutarDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/descuentos/${deleteConfirm}`);
      setDescuentos(prev => prev.filter(p => p.id_descuento !== deleteConfirm));
      toast.success('Descuento eliminado');
    } catch (err: any) {
      console.error(err);
      toast.error('Error eliminando descuento');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const getProductoNombre = (id: number) => {
    return productos.find(p => p.id_producto === id)?.nombre || `Producto #${id}`;
  };

  return (
    <div className="event-admin w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="event-page-title">Descuentos por cantidad</h1>
          <p className="event-page-description">Configura reglas de descuento automático para las ventas del evento.</p>
        </div>
        <div className="event-page-actions w-full sm:w-auto">
          <button type="button" onClick={fetchDatos} disabled={loading} aria-busy={loading} className="event-action-secondary flex-1 sm:flex-none">
            <RefreshCw className={`size-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} />
            {loading ? 'Actualizando' : 'Actualizar'}
          </button>
          <button type="button" onClick={openCreate} className="event-action-primary flex-1 sm:flex-none">
            <Plus className="size-4" />
            Nuevo descuento
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4 rounded-tl-xl">Nombre / Producto</th>
                <th className="px-6 py-4">Condición</th>
                <th className="px-6 py-4">Regla de Descuento</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right rounded-tr-xl">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8"><TableSkeleton columns={5} /></td></tr>
              ) : descuentos.length === 0 ? (
                <tr><td colSpan={5} className="p-6"><div className="event-empty-state min-h-48"><Tag className="size-8 text-primary" /><div><p className="font-bold text-slate-800 dark:text-white">Aún no hay descuentos</p><p className="mt-1 text-sm">Crea una regla de descuento cuando la necesites.</p></div><button type="button" onClick={openCreate} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90">Nuevo descuento</button></div></td></tr>
              ) : (
                descuentos.map(d => (
                  <tr key={d.id_descuento} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 dark:text-white">{d.nombre}</div>
                      <div className="text-xs text-slate-500 mt-1">{getProductoNombre(d.id_producto)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-accent/10 text-accent px-2 py-1 rounded-md font-medium text-xs">
                        Min. {d.cantidad_minima} unids.
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-accent">
                        {d.tipo_descuento === 'PORCENTAJE' ? `${d.valor_descuento}% de dcto.` : 
                         d.tipo_descuento === 'MONTO_FIJO' ? `- S/ ${Number(d.valor_descuento).toFixed(2)}` : 
                         `S/ ${Number(d.valor_descuento).toFixed(2)} cada uno`}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${d.activo ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>
                        {d.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-1">
                      <button onClick={() => toggleEstado(d)} title={d.activo ? "Desactivar" : "Activar"} className={`p-2 rounded-lg transition-colors ${d.activo ? 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10' : 'text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10'}`}>
                        {d.activo ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openEdit(d)} title="Editar" className="p-2 text-slate-400 hover:text-secondary transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => confirmDelete(d.id_descuento)} title="Eliminar" className="p-2 text-slate-400 hover:text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg">
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
          <div className="absolute top-1/4 left-1/4 w-[30rem] h-[30rem] bg-primary/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen hidden dark:block"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-accent/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen hidden dark:block"></div>
          
          <div className="w-full max-w-lg bg-white dark:bg-[#0B1120] rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden max-h-[90vh] relative z-10">
            <div className="h-1 w-full bg-secondary"></div>
            <div className="p-5 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/20 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{editing ? 'Editar Descuento' : 'Nuevo Descuento'}</h3>
              <button type="button" onClick={() => setOpenForm(false)} aria-label="Cerrar formulario de descuento" className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors bg-slate-100 dark:bg-slate-800 p-2 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Nombre del Descuento</label>
                  <input value={nombre} onChange={e => setNombre(e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none" placeholder="Ej. VIP10" />
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Producto a Aplicar</label>
                    <select value={idProducto} onChange={e => setIdProducto(e.target.value ? Number(e.target.value) : '')} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none">
                  <option value="" disabled>Selecciona un producto...</option>
                  {productos.map(p => <option key={p.id_producto} value={p.id_producto}>{p.nombre}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Cantidad Mínima</label>
                  <input type="number" value={cantidadMinima as any} onChange={e => setCantidadMinima(e.target.value === '' ? '' : Number(e.target.value))} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none font-mono" placeholder="Ej. 10" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Tipo de Descuento</label>
                  <select value={tipoDescuento} onChange={(e: any) => setTipoDescuento(e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all dark:text-white outline-none">
                    <option value="PORCENTAJE">Porcentaje (%)</option>
                    <option value="MONTO_FIJO">Monto Fijo (- S/)</option>
                    <option value="PRECIO_ESPECIAL">Precio Especial (S/ ea)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Valor</label>
                <input type="number" min="0" step="0.01" value={valorDescuento} onChange={(e) => setValorDescuento(e.target.value ? Number(e.target.value) : '')} className="w-full border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all dark:text-white outline-none font-mono" placeholder={tipoDescuento === 'PORCENTAJE' ? 'Ej. 10' : 'Ej. 5.00'} />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/50 flex justify-end space-x-3">
              <button type="button" onClick={() => setOpenForm(false)} className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold shadow-sm hover:bg-slate-50 dark:border-white/20 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Cancelar</button>
              <button onClick={saveDescuento} className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-sm flex items-center transition-all hover:scale-105">
                <Save className="w-4 h-4 mr-2" />
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={ejecutarDelete}
        title="Eliminar descuento"
        message="¿Estás seguro que deseas eliminar este descuento? Ya no se aplicará automáticamente en las ventas."
        isDestructive={true}
      />
    </div>
  );
}

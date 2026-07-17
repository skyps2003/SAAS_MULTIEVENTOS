import React, { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { toast } from 'sonner';
import { Plus, Minus, RefreshCw, X, Save, Image as ImageIcon, Trash2, Power, PowerOff, Edit2, Boxes, Package, UploadCloud, AlertCircle } from 'lucide-react';
import { CardSkeleton } from '../components/ui/Skeleton';
import { resolveAssetUrl } from '../lib/assetUrl';
import { ConfirmModal } from '../components/ui/ConfirmModal';

type Producto = {
  id_producto: number;
  nombre: string;
  precio: number;
  precio_venta?: number;
  stock?: number;
  stock_actual?: number;
  imagen_url?: string | null;
};

type ComboProducto = {
  id_producto: number;
  cantidad: number;
  nombre?: string;
  stock_actual?: number;
  precio_venta?: number;
  imagen_url?: string | null;
};

type Combo = {
  id_combo: number;
  nombre: string;
  descripcion?: string;
  precio_combo: number;
  imagen_url?: string;
  activo?: boolean;
  productos?: ComboProducto[];
  capacidad_disponible?: number;
};

export function CombosPage() {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(false);

  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState<Combo | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio] = useState<number | ''>('');
  const [imagenDataUrl, setImagenDataUrl] = useState<string | null>(null);
  const [imageChanged, setImageChanged] = useState(false);
  const [comboProductos, setComboProductos] = useState<ComboProducto[]>([]);
  const [saving, setSaving] = useState(false);
  const [comboToDelete, setComboToDelete] = useState<Combo | null>(null);
  const saveLockRef = useRef(false);

  useEffect(() => {
    fetchCombos();
    fetchProductos();
  }, []);

  const fetchCombos = async () => {
    setLoading(true);
    try {
      const res = await api.get('/combos');
      setCombos(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error cargando combos');
    } finally {
      setLoading(false);
    }
  };

  const fetchProductos = async () => {
    try {
      const res = await api.get('/productos');
      setProductos(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenNew = () => {
    setEditing(null);
    setNombre('');
    setDescripcion('');
    setPrecio('');
    setImagenDataUrl(null);
    setImageChanged(false);
    setComboProductos([]);
    setOpenModal(true);
  };

  const handleOpenEdit = (combo: Combo) => {
    setEditing(combo);
    setNombre(combo.nombre);
    setDescripcion(combo.descripcion || '');
    setPrecio(Number(combo.precio_combo));
    setImagenDataUrl(combo.imagen_url || null);
    setImageChanged(false);
    setComboProductos((combo.productos || []).map((p) => ({ ...p, cantidad: Number(p.cantidad) })));
    setOpenModal(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImagenDataUrl(String(reader.result));
      setImageChanged(true);
    };
    reader.readAsDataURL(file);
  };

  const addProductToCombo = (id_producto: number) => {
    if (!id_producto) return;
    const prod = productos.find(p => p.id_producto === id_producto);
    if (!prod) return;
    
    setComboProductos(prev => {
      const exists = prev.find(p => p.id_producto === id_producto);
      if (exists) {
        return prev.map(p => p.id_producto === id_producto ? { ...p, cantidad: p.cantidad + 1 } : p);
      }
      return [...prev, { id_producto, cantidad: 1, nombre: prod.nombre }];
    });
  };

  const removeProductFromCombo = (id_producto: number) => {
    setComboProductos(prev => prev.filter(p => p.id_producto !== id_producto));
  };

  const updateProductQuantity = (id_producto: number, cantidad: number) => {
    if (cantidad <= 0) return;
    setComboProductos(prev => prev.map(p => p.id_producto === id_producto ? { ...p, cantidad } : p));
  };

  const productFor = (idProducto: number) => productos.find((p) => p.id_producto === idProducto);
  const stockFor = (item: ComboProducto) => Number(item.stock_actual ?? productFor(item.id_producto)?.stock_actual ?? productFor(item.id_producto)?.stock ?? 0);
  const priceFor = (item: ComboProducto) => Number(item.precio_venta ?? productFor(item.id_producto)?.precio_venta ?? productFor(item.id_producto)?.precio ?? 0);
  const capacidadSeleccionada = comboProductos.length > 0
    ? Math.min(...comboProductos.map((item) => Math.floor(stockFor(item) / Math.max(1, Number(item.cantidad)))))
    : 0;
  const costoProductos = comboProductos.reduce((total, item) => total + priceFor(item) * Number(item.cantidad), 0);

  const handleSave = async () => {
    if (saveLockRef.current) return;
    if (!nombre.trim()) return toast.error('El nombre es requerido');
    if (!precio || Number(precio) <= 0) return toast.error('El precio debe ser mayor a 0');
    if (comboProductos.length === 0) return toast.error('Debe agregar al menos un producto al combo');

    saveLockRef.current = true;
    setSaving(true);
    try {
      const payload: any = {
        nombre,
        descripcion,
        precio_combo: Number(precio),
        precio_original: costoProductos,
        tipo_combo: 'PACK',
        productos: comboProductos.map(p => ({ id_producto: p.id_producto, cantidad: p.cantidad }))
      };
      if (!editing || imageChanged) payload.imagen_url = imagenDataUrl;
      
      if (editing) {
        await api.put(`/combos/${editing.id_combo}`, payload);
        toast.success('Combo actualizado correctamente');
      } else {
        await api.post('/combos', payload);
        toast.success('Combo creado exitosamente');
      }
      await fetchCombos();
      setOpenModal(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Error al guardar el combo');
    } finally {
      saveLockRef.current = false;
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!comboToDelete) return;
    try {
      await api.delete(`/combos/${comboToDelete.id_combo}`);
      setCombos((current) => current.filter((combo) => combo.id_combo !== comboToDelete.id_combo));
      toast.success('Combo eliminado correctamente');
    } catch (err: any) {
      const message = err.response?.data?.error || 'No se pudo eliminar el combo';
      toast.error(message);
      throw err;
    }
  };

  const toggleEstado = async (combo: any) => {
    try {
      await api.patch(`/combos/${combo.id_combo}/estado`, { activo: !combo.activo });
      toast.success('Estado actualizado');
      fetchCombos();
    } catch (err) {
      toast.error('Error al cambiar estado');
    }
  };

  return (
    <div className="event-admin w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="event-page-title">Combos</h1>
          <p className="event-page-description">Crea paquetes de productos y controla automáticamente el stock de sus componentes.</p>
        </div>
        <div className="event-page-actions w-full sm:w-auto">
          <button type="button" onClick={fetchCombos} disabled={loading} aria-busy={loading} className="event-action-secondary flex-1 sm:flex-none">
            <RefreshCw className={`size-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} />
            {loading ? 'Actualizando' : 'Actualizar'}
          </button>
          <button type="button" onClick={handleOpenNew} className="event-action-primary flex-1 sm:flex-none">
            <Plus className="size-4" />
            Nuevo combo
          </button>
        </div>
      </div>

      <div className="bg-transparent">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : combos.length === 0 ? (
          <div className="event-empty-state"><ImageIcon className="size-8 text-primary" /><div><p className="font-bold text-slate-800 dark:text-white text-balance">Aún no hay combos</p><p className="mt-1 text-sm text-pretty">Agrupa productos y ofrece una opción especial para el evento.</p></div><button type="button" onClick={handleOpenNew} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90">Nuevo combo</button></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {combos.map(combo => (
              <article key={combo.id_combo} className="event-card group flex flex-col p-5">
                  <div className="flex items-start gap-4">
                  <div className={`relative size-16 shrink-0 overflow-hidden rounded-2xl border-2 border-slate-100 bg-slate-50 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${combo.activo === false ? 'opacity-60 grayscale' : ''}`}>
                    {combo.imagen_url ? (
                      <img src={resolveAssetUrl(combo.imagen_url)} alt={combo.nombre} className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-slate-400">
                        <ImageIcon className="size-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate text-lg font-bold text-slate-900 dark:text-white">{combo.nombre}</h3>
                      <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold uppercase ${combo.activo !== false ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>
                        {combo.activo !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400 text-pretty">{combo.descripcion || 'Sin descripción'}</p>
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                      <Boxes className="size-4 text-primary" />
                      {Number(combo.capacidad_disponible || 0)} disponibles
                    </div>
                  </div>
                  </div>
                    
                    <div className="mt-5 flex-1">
                      {combo.productos && combo.productos.length > 0 ? (
                        <div className="space-y-1.5">
                          <div className="mb-2 text-[10px] font-bold uppercase text-slate-400">Incluye</div>
                          {combo.productos.slice(0, 3).map((p, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 px-2.5 py-2 rounded-lg border border-slate-100 dark:border-white/10">
                              <div className="flex min-w-0 items-center">
                              <span className="font-extrabold text-primary mr-2 bg-primary/10 px-1.5 py-0.5 rounded">{p.cantidad}x</span>
                              <span className="truncate">{p.nombre}</span>
                              </div>
                              <span className="shrink-0 text-slate-400 tabular-nums">Stock {stockFor(p)}</span>
                            </div>
                          ))}
                          {combo.productos.length > 3 && <p className="pt-1 text-xs font-semibold text-slate-400">+{combo.productos.length - 3} productos más</p>}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic">No hay productos vinculados.</div>
                      )}
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                      <div><p className="text-[10px] font-bold uppercase text-slate-400">Precio del combo</p><span className={`text-2xl font-extrabold tabular-nums ${combo.activo !== false ? 'text-primary' : 'text-slate-400 line-through'}`}>S/ {Number(combo.precio_combo).toFixed(2)}</span></div>
                      <div className="flex space-x-1">
                        <button type="button" onClick={() => handleOpenEdit(combo)} aria-label={`Editar ${combo.nombre}`} title="Editar" className="p-2 rounded-lg text-slate-400 hover:bg-primary/10 hover:text-primary"><Edit2 className="size-4" /></button>
                        <button type="button" onClick={() => toggleEstado(combo)} aria-label={`${combo.activo !== false ? 'Desactivar' : 'Activar'} ${combo.nombre}`} title={combo.activo !== false ? 'Desactivar' : 'Activar'} className={`p-2 rounded-lg transition-colors ${combo.activo !== false ? 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10' : 'text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10'}`}>
                          {combo.activo !== false ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                        </button>
                        <button type="button" onClick={() => setComboToDelete(combo)} aria-label={`Eliminar ${combo.nombre}`} title="Eliminar" className="p-2 rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {openModal && (
        <div className="event-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute top-1/4 left-1/4 w-[30rem] h-[30rem] bg-primary/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen hidden dark:block"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-accent/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen hidden dark:block"></div>
          
          <div className="w-full max-w-5xl bg-white dark:bg-[#0B1120] rounded-2xl shadow-xl border border-slate-200 dark:border-white/20 flex flex-col max-h-[92vh] overflow-hidden relative z-10">
            <div className="h-1 w-full bg-secondary"></div>
            <div className="p-5 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/20 flex justify-between items-center">
              <div><h3 className="text-xl font-bold text-slate-900 dark:text-white">{editing ? 'Editar combo' : 'Nuevo combo'}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Define sus productos y revisa cuántas unidades puedes vender con el stock actual.</p></div>
              <button type="button" onClick={() => setOpenModal(false)} aria-label="Cerrar formulario de combo" className="inline-flex size-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white">
                <X className="size-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-8">
              <div className="space-y-5">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-white/10"><Package className="size-4 text-primary" /><h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Datos generales</h4></div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Nombre</label>
                  <input value={nombre} onChange={e => setNombre(e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Descripción</label>
                  <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none" rows={3}></textarea>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Precio especial</label>
                  <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">S/</span><input type="number" min="0" step="0.01" value={precio as any} onChange={e => setPrecio(e.target.value === '' ? '' : Number(e.target.value))} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] dark:text-white outline-none font-mono tabular-nums" placeholder="0.00" /></div>
                  {comboProductos.length > 0 && <div className="mt-2 flex justify-between text-xs"><span className="text-slate-500 dark:text-slate-400">Valor de productos: S/ {costoProductos.toFixed(2)}</span><span className="font-semibold text-primary">Ahorro: S/ {Math.max(0, costoProductos - Number(precio || 0)).toFixed(2)}</span></div>}
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Imagen</label>
                  <label htmlFor="combo-imagen" className="event-file-picker justify-start">
                    {imagenDataUrl ? <img src={resolveAssetUrl(imagenDataUrl)} alt="Vista previa del combo" className="size-20 rounded-xl border border-slate-200 object-cover dark:border-white/20" /> : <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><UploadCloud className="size-5" /></span>}
                    <span><span className="block text-sm font-semibold text-slate-800 dark:text-white">{imagenDataUrl ? 'Cambiar imagen' : 'Seleccionar imagen'}</span><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">PNG, JPG o WebP</span></span>
                  </label>
                  <input id="combo-imagen" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageChange} className="sr-only" />
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 dark:border-white/10"><div className="flex items-center gap-2"><Boxes className="size-4 text-primary" /><h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Productos del combo</h4></div><span className="text-xs font-semibold text-slate-400 tabular-nums">{comboProductos.length} productos</span></div>

                <div className={`rounded-2xl border p-4 ${capacidadSeleccionada > 0 ? 'border-primary/20 bg-primary/5' : 'border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'}`}>
                  <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Capacidad con el stock actual</p><p className="mt-1 text-2xl font-black text-slate-900 dark:text-white tabular-nums">{capacidadSeleccionada} <span className="text-sm font-semibold text-slate-500">combos</span></p></div>{capacidadSeleccionada > 0 ? <Boxes className="size-8 text-primary" /> : <AlertCircle className="size-8 text-amber-500" />}</div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Se calcula usando el producto que alcanza para menos unidades.</p>
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Agregar Producto</label>
                  <select 
                    onChange={e => addProductToCombo(Number(e.target.value))}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all dark:text-white outline-none"
                    value=""
                  >
                    <option value="" disabled>Seleccione un producto...</option>
                    {productos.map(p => <option key={p.id_producto} value={p.id_producto}>{p.nombre} · Stock {Number(p.stock_actual ?? p.stock)} · S/ {Number(p.precio_venta ?? p.precio).toFixed(2)}</option>)}
                  </select>
                </div>

                <div className="mt-4 border border-slate-200 dark:border-white/15 rounded-xl overflow-hidden bg-white dark:bg-slate-900/30">
                  <div className="bg-slate-50 dark:bg-slate-900 px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 grid grid-cols-[1fr_auto_auto] gap-4 border-b border-slate-100 dark:border-white/10">
                    <span>Producto y stock</span>
                    <span>Cantidad</span>
                    <span>Capacidad</span>
                  </div>
                  <div className="divide-y divide-slate-100/50 dark:divide-slate-700/50 max-h-60 overflow-y-auto">
                    {comboProductos.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-400 font-medium">Aún no hay productos añadidos</div>
                    ) : (
                      comboProductos.map(cp => {
                        const product = productFor(cp.id_producto);
                        const capacidadProducto = Math.floor(stockFor(cp) / Math.max(1, Number(cp.cantidad)));
                        return (
                        <div key={cp.id_producto} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 p-3 hover:bg-slate-50/70 dark:hover:bg-white/5">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="size-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-white/15 dark:bg-slate-800">{product?.imagen_url ? <img src={resolveAssetUrl(product.imagen_url)} alt="" className="size-full object-cover" /> : <Package className="m-2.5 size-4 text-slate-400" />}</div>
                            <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800 dark:text-white">{cp.nombre}</p><p className="mt-0.5 text-xs text-slate-400 tabular-nums">Stock {stockFor(cp)} · S/ {priceFor(cp).toFixed(2)}</p></div>
                          </div>
                          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-white/15 dark:bg-slate-950">
                            <button type="button" onClick={() => updateProductQuantity(cp.id_producto, Math.max(1, cp.cantidad - 1))} aria-label={`Reducir cantidad de ${cp.nombre}`} className="inline-flex size-7 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-primary dark:hover:bg-white/10"><Minus className="size-3.5" /></button>
                            <span className="min-w-8 text-center text-sm font-black text-slate-800 dark:text-white tabular-nums">{cp.cantidad}</span>
                            <button type="button" onClick={() => updateProductQuantity(cp.id_producto, cp.cantidad + 1)} aria-label={`Aumentar cantidad de ${cp.nombre}`} className="inline-flex size-7 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-primary dark:hover:bg-white/10"><Plus className="size-3.5" /></button>
                          </div>
                          <div className="flex items-center gap-2"><span className={`min-w-12 rounded-lg px-2 py-1.5 text-center text-xs font-black tabular-nums ${capacidadProducto > 0 ? 'bg-primary/10 text-primary' : 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400'}`}>{capacidadProducto}</span><button type="button" onClick={() => removeProductFromCombo(cp.id_producto)} aria-label={`Quitar ${cp.nombre} del combo`} className="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"><Trash2 className="size-4" /></button></div>
                        </div>
                      )})
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-5 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/50 flex justify-end space-x-3">
              <button type="button" onClick={() => setOpenModal(false)} disabled={saving} className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Cancelar</button>
              <button type="button" onClick={handleSave} disabled={saving} aria-busy={saving} className="px-5 py-2.5 rounded-xl bg-primary text-white font-semibold shadow-sm flex items-center hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70">
                {saving ? <RefreshCw className="size-4 mr-2 animate-spin motion-reduce:animate-none" /> : <Save className="size-4 mr-2" />}
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear combo'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(comboToDelete)}
        onClose={() => setComboToDelete(null)}
        onConfirm={handleDelete}
        title="Eliminar combo"
        message={`¿Deseas eliminar “${comboToDelete?.nombre || ''}”? Esta acción no se puede deshacer.`}
        details={['El combo y su configuración de productos']}
        confirmText="Eliminar combo"
        isDestructive
      />
    </div>
  );
}

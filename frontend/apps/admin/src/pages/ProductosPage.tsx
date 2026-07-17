import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { toast } from 'sonner';
import { Plus, Minus, RefreshCw, AlertTriangle, Edit2, FileText, Trash2, X, Save, Image as ImageIcon, UploadCloud, Package, ArrowDown, ArrowUp, Clock3 } from 'lucide-react';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { TableSkeleton } from '../components/ui/Skeleton';
import { resolveAssetUrl } from '../lib/assetUrl';

type Producto = {
  id_producto: number;
  nombre: string;
  descripcion?: string;
  precio?: number;
  precio_venta?: number;
  stock?: number;
  stock_actual?: number;
  stock_min?: number;
  stock_minimo?: number;
  categoria_id?: number | null;
  id_categoria?: number | null;
  categoria_nombre?: string;
  imagen_url?: string | null;
  destacado?: boolean;
};

type Categoria = { id_categoria: number; nombre: string };

export function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Producto | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio] = useState<number | ''>('');
  const [stock, setStock] = useState<number | ''>('');
  const [stockMin, setStockMin] = useState<number | ''>('');
  const [categoriaId, setCategoriaId] = useState<number | ''>('');
  const [imagenDataUrl, setImagenDataUrl] = useState<string | null>(null);
  const [imageChanged, setImageChanged] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [filtroCategoria, setFiltroCategoria] = useState<string>('');
  const [soloStockBajo, setSoloStockBajo] = useState(false);

  // Stock adjust modal
  const [openStock, setOpenStock] = useState(false);
  const [stockCantidad, setStockCantidad] = useState<number | ''>('');
  const [stockMotivo, setStockMotivo] = useState('');
  const [productoParaStock, setProductoParaStock] = useState<Producto | null>(null);
  const [adjustingProductId, setAdjustingProductId] = useState<number | null>(null);

  // Kardex modal
  const [openKardex, setOpenKardex] = useState(false);
  const [productoParaKardex, setProductoParaKardex] = useState<Producto | null>(null);
  const [kardex, setKardex] = useState<any[]>([]);
  const [kardexLoading, setKardexLoading] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<Producto | null>(null);

  useEffect(() => {
    fetchProductos();
    fetchCategorias();
  }, []);

  const fetchProductos = async () => {
    setLoading(true);
    try {
      const res = await api.get('/productos');
      setProductos(res.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error cargando productos');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategorias = async () => {
    try {
      const res = await api.get('/categorias');
      setCategorias(res.data || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setNombre('');
    setDescripcion('');
    setPrecio('');
    setStock('');
    setStockMin('');
    setCategoriaId('');
    setImagenDataUrl(null);
    setImageChanged(false);
    setOpenForm(true);
  };

  const openEdit = (p: Producto) => {
    setEditing(p);
    setNombre(p.nombre || '');
    setDescripcion(p.descripcion || '');
    setPrecio((p.precio_venta ?? p.precio) || '');
    setStock((p.stock_actual ?? p.stock) || '');
    setStockMin((p.stock_minimo ?? p.stock_min) || '');
    setCategoriaId((p.id_categoria ?? p.categoria_id) ?? '');
    setImagenDataUrl(p.imagen_url || null);
    setImageChanged(false);
    setOpenForm(true);
  };

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const dataUrl = await fileToDataUrl(f);
      setImagenDataUrl(dataUrl);
      setImageChanged(true);
    } catch (err) {
      console.error(err);
      toast.error('Error leyendo la imagen');
    }
  };

  const saveProducto = async () => {
    if (!nombre.trim()) return toast.error('El nombre es requerido');
    if (!precio || Number(precio) <= 0) return toast.error('El precio debe ser mayor a 0');
    try {
      if (editing) {
        const payload: any = { nombre, descripcion, precio: Number(precio), precio_venta: Number(precio), stock_min: Number(stockMin || 0), stock_minimo: Number(stockMin || 0), categoria_id: categoriaId || null, id_categoria: categoriaId || null };
        if (imageChanged && imagenDataUrl) payload.imagen_url = imagenDataUrl;
        const res = await api.put(`/productos/${editing.id_producto}`, payload);
        setProductos(prev => prev.map(p => (p.id_producto === res.data.id_producto ? res.data : p)));
        toast.success('Producto actualizado');
      } else {
        const payload: any = { nombre, descripcion, precio: Number(precio), precio_venta: Number(precio), stock: Number(stock || 0), stock_actual: Number(stock || 0), stock_min: Number(stockMin || 0), stock_minimo: Number(stockMin || 0), categoria_id: categoriaId || null, id_categoria: categoriaId || null };
        if (imagenDataUrl) payload.imagen_url = imagenDataUrl;
        const res = await api.post('/productos', payload);
        setProductos(prev => [res.data, ...prev]);
        toast.success('Producto creado');
      }
      setOpenForm(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error guardando producto');
    }
  };

  const confirmarEliminar = (p: Producto) => setDeleteConfirm(p);

  const ejecutarEliminar = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/productos/${deleteConfirm.id_producto}`);
      setProductos(prev => prev.filter(x => x.id_producto !== deleteConfirm.id_producto));
      toast.success('Producto eliminado');
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error eliminando producto');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const openStockModal = (p: Producto) => {
    setProductoParaStock(p);
    setStockCantidad('');
    setStockMotivo('');
    setOpenStock(true);
  };

  const quickAdjustStock = async (p: Producto, delta: 1 | -1) => {
    if (adjustingProductId) return;
    setAdjustingProductId(p.id_producto);
    try {
      const res = await api.patch(`/productos/${p.id_producto}/stock`, {
        cantidad: delta,
        motivo: delta > 0 ? 'Ingreso rápido desde productos' : 'Salida rápida desde productos',
      });
      const nuevoStock = Number(res.data?.nuevo_stock);
      setProductos((current) => current.map((item) => (
        item.id_producto === p.id_producto
          ? { ...item, stock: nuevoStock, stock_actual: nuevoStock }
          : item
      )));
      toast.success(delta > 0 ? 'Se agregó una unidad' : 'Se descontó una unidad');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'No se pudo ajustar el stock');
    } finally {
      setAdjustingProductId(null);
    }
  };

  const submitStock = async () => {
    if (!productoParaStock) return;
    if (!stockCantidad) return toast.error('Ingrese la cantidad a ajustar');
    try {
      await api.patch(`/productos/${productoParaStock.id_producto}/stock`, { cantidad: Number(stockCantidad), motivo: stockMotivo || 'Ajuste manual' });
      toast.success('Stock ajustado');
      setOpenStock(false);
      fetchProductos();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error ajustando stock');
    }
  };

  const openKardexModal = async (p: Producto) => {
    setProductoParaKardex(p);
    setKardex([]);
    setOpenKardex(true);
    setKardexLoading(true);
    try {
      const res = await api.get(`/productos/${p.id_producto}/kardex`);
      setKardex(res.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Error cargando kardex');
    } finally {
      setKardexLoading(false);
    }
  };

  const tieneStockBajo = (producto: Producto) =>
    Number(producto.stock_actual ?? producto.stock ?? 0) <= Number(producto.stock_minimo ?? producto.stock_min ?? 0);
  const cantidadStockBajo = productos.filter(tieneStockBajo).length;
  const productosFiltrados = productos.filter((producto) => {
    const coincideCategoria = !filtroCategoria || (producto.id_categoria ?? producto.categoria_id) === Number(filtroCategoria);
    const coincideStock = !soloStockBajo || tieneStockBajo(producto);
    return coincideCategoria && coincideStock;
  });

  const getCategoriaNombre = (id?: number | null | string) => {
    if (!id) return '-';
    return categorias.find(c => Number(c.id_categoria) === Number(id))?.nombre || '-';
  };

  return (
    <div className="event-admin w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="event-page-title">Productos</h1>
          <p className="event-page-description">Gestiona precios, existencias y detalles de cada producto del evento.</p>
        </div>
        <div className="event-page-actions w-full sm:w-auto">
          <button type="button" onClick={() => setSoloStockBajo((activo) => !activo)} aria-pressed={soloStockBajo} className={`${soloStockBajo ? 'event-action-warning' : 'event-action-secondary'} flex-1 sm:flex-none`}>
            <AlertTriangle className="size-4" />
            Stock bajo
            <span className="min-w-5 rounded-md bg-amber-400/20 px-1.5 py-0.5 text-center text-xs font-black tabular-nums">{cantidadStockBajo}</span>
            <span aria-hidden="true" className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 ${soloStockBajo ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <span className={`size-4 rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none ${soloStockBajo ? 'translate-x-4' : 'translate-x-0'}`} />
            </span>
          </button>
          <button type="button" onClick={fetchProductos} disabled={loading} aria-busy={loading} className="event-action-secondary flex-1 sm:flex-none">
            <RefreshCw className={`size-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} />
            {loading ? 'Actualizando' : 'Actualizar'}
          </button>
          <button type="button" onClick={openCreate} className="event-action-primary flex-1 sm:flex-none">
            <Plus className="size-4" />
            Nuevo producto
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Filtrar por categoría:</label>
        <select 
          value={filtroCategoria} 
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 sm:w-auto dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          <option value="">Todas</option>
          {categorias.map(c => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}
        </select>
      </div>

      <div className="event-table-shell">
        <div className="overflow-x-auto">
          <table className="event-data-table responsive-admin-table">
            <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4">Imagen</th>
                <th className="px-6 py-4">Nombre</th>
                <th className="px-6 py-4">Categoría</th>
                <th className="px-6 py-4">Precio</th>
                <th className="px-6 py-4 text-center">Stock / Ajuste</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8"><TableSkeleton columns={6} /></td></tr>
              ) : productos.length === 0 ? (
                <tr><td colSpan={6} className="p-6"><div className="event-empty-state min-h-48"><ImageIcon className="size-8 text-primary" /><div><p className="font-bold text-slate-800 dark:text-white">Aún no hay productos</p><p className="mt-1 text-sm">Agrega el primer producto para comenzar el inventario.</p></div><button type="button" onClick={openCreate} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90">Nuevo producto</button></div></td></tr>
              ) : (
                productosFiltrados.map(p => (
                  <tr key={p.id_producto} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                    <td data-label="Imagen" className="px-6 py-4">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-900 rounded-lg flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700">
                        {p.imagen_url ? (
                          <img src={resolveAssetUrl(p.imagen_url)} alt={p.nombre} className="size-full object-cover" />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </td>
                    <td data-label="Nombre" className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{p.nombre}</td>
                    <td data-label="Categoría" className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {p.categoria_nombre || getCategoriaNombre(p.id_categoria ?? p.categoria_id)}
                      </span>
                    </td>
                    <td data-label="Precio" className="px-6 py-4 font-extrabold text-primary">S/ {(Number(p.precio_venta ?? p.precio) || 0).toFixed(2)}</td>
                    <td data-label="Stock" className="px-6 py-4">
                      <div className="mx-auto flex w-fit items-center rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-white/15 dark:bg-slate-900/60">
                        <button type="button" onClick={() => quickAdjustStock(p, -1)} disabled={adjustingProductId === p.id_producto || Number(p.stock_actual ?? p.stock) <= 0} aria-label={`Restar una unidad a ${p.nombre}`} className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-35 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-red-400">
                          <Minus className="size-4" />
                        </button>
                        <button type="button" onClick={() => openStockModal(p)} aria-label={`Abrir ajuste avanzado de stock para ${p.nombre}`} className={`min-w-12 rounded-lg px-2 py-1.5 text-center text-sm font-black tabular-nums ${Number(p.stock_actual ?? p.stock) <= Number(p.stock_minimo ?? p.stock_min) ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' : 'bg-white text-slate-800 dark:bg-white/10 dark:text-white'}`}>
                          {Number(p.stock_actual ?? p.stock)}
                        </button>
                        <button type="button" onClick={() => quickAdjustStock(p, 1)} disabled={adjustingProductId === p.id_producto} aria-label={`Agregar una unidad a ${p.nombre}`} className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-primary disabled:cursor-not-allowed disabled:opacity-35 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-primary">
                          <Plus className="size-4" />
                        </button>
                      </div>
                    </td>
                    <td data-label="Acciones" className="px-6 py-4 text-right space-x-1 whitespace-nowrap">
                      <button type="button" onClick={() => openEdit(p)} aria-label={`Editar ${p.nombre}`} title="Editar" className="p-2 text-slate-400 hover:text-primary transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => openKardexModal(p)} aria-label={`Ver Kardex de ${p.nombre}`} title="Kardex" className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                        <FileText className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => confirmarEliminar(p)} aria-label={`Eliminar ${p.nombre}`} title="Eliminar" className="p-2 text-slate-400 hover:text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg">
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

      {/* Form modal */}
      {openForm && (
        <div className="event-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute top-1/3 left-1/4 w-[30rem] h-[30rem] bg-primary/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen hidden dark:block"></div>
          <div className="absolute bottom-1/3 right-1/4 w-[30rem] h-[30rem] bg-accent/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen hidden dark:block"></div>
          
          <div className="w-full max-w-3xl bg-white dark:bg-[#0B1120] rounded-2xl shadow-xl border border-slate-200 dark:border-white/20 flex flex-col overflow-hidden relative z-10">
            <div className="h-1 w-full bg-secondary"></div>
            <div className="p-5 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/20 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{editing ? 'Editar producto' : 'Nuevo producto'}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{editing ? 'Actualiza los datos del catálogo. El stock se gestiona desde la tabla.' : 'Completa los datos para agregarlo al catálogo del evento.'}</p>
              </div>
              <button type="button" onClick={() => setOpenForm(false)} aria-label="Cerrar formulario de producto" className="inline-flex size-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white">
                <X className="size-5" />
              </button>
            </div>
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Nombre</label>
                  <input value={nombre} onChange={e => setNombre(e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Categoría</label>
                  <select value={categoriaId} onChange={e => setCategoriaId(e.target.value ? Number(e.target.value) : '')} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none">
                    <option value="">-- Sin categoría --</option>
                    {categorias.map(c => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Precio</label>
                  <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">S/</span><input type="number" min="0" step="0.01" value={precio as any} onChange={e => setPrecio(e.target.value === '' ? '' : Number(e.target.value))} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] dark:text-white outline-none font-mono tabular-nums" placeholder="0.00" /></div>
                </div>
                {!editing ? (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Stock inicial</label>
                    <input type="number" min="0" value={stock as any} onChange={e => setStock(e.target.value === '' ? '' : Number(e.target.value))} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] dark:text-white outline-none font-mono tabular-nums" placeholder="0" />
                  </div>
                ) : (
                  <div>
                    <span className="block text-xs font-bold uppercase mb-2 text-slate-500 dark:text-slate-400">Stock actual</span>
                    <div className="flex min-h-11 items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 text-sm">
                      <span className="text-slate-600 dark:text-slate-300">Se ajusta desde la tabla</span>
                      <strong className="text-lg text-primary tabular-nums">{Number(editing.stock_actual ?? editing.stock)}</strong>
                    </div>
                  </div>
                )}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Descripción</label>
                  <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none" rows={3}></textarea>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Stock mínimo (Alertas)</label>
                  <input type="number" value={stockMin as any} onChange={e => setStockMin(e.target.value === '' ? '' : Number(e.target.value))} className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none font-mono" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Imagen</label>
                  <label htmlFor="producto-imagen" className="event-file-picker justify-start">
                    {imagenDataUrl ? (
                      <img src={resolveAssetUrl(imagenDataUrl)} alt="Vista previa del producto" className="size-20 rounded-xl border border-slate-200 object-cover dark:border-white/20" />
                    ) : (
                      <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><UploadCloud className="size-5" /></span>
                    )}
                    <span>
                      <span className="block text-sm font-semibold text-slate-800 dark:text-white">{imagenDataUrl ? 'Cambiar imagen' : 'Seleccionar imagen'}</span>
                      <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">La imagen actual se conserva si no eliges otra.</span>
                    </span>
                  </label>
                  <input id="producto-imagen" type="file" accept="image/png,image/jpeg,image/webp" onChange={onFileChange} className="sr-only" />
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/50 flex justify-end space-x-3">
              <button type="button" onClick={() => setOpenForm(false)} className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold shadow-sm hover:bg-slate-50 dark:border-white/20 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Cancelar</button>
              <button type="button" onClick={saveProducto} className="px-5 py-2.5 rounded-xl bg-primary text-white font-semibold shadow-sm flex items-center hover:bg-primary/90">
                <Save className="w-4 h-4 mr-2" />
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock modal */}
      {openStock && productoParaStock && (
        <div className="event-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute top-1/3 left-1/4 w-[30rem] h-[30rem] bg-accent/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen hidden dark:block"></div>
          <div className="absolute bottom-1/3 right-1/4 w-[30rem] h-[30rem] bg-secondary/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen hidden dark:block"></div>
          
          <div className="w-full max-w-md bg-white dark:bg-[#0B1120] rounded-2xl shadow-xl border border-slate-200 dark:border-white/20 flex flex-col overflow-hidden relative z-10">
            <div className="h-1 w-full bg-secondary"></div>
            <div className="p-5 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/20 flex justify-between items-center">
              <div><h3 className="text-xl font-bold text-slate-900 dark:text-white">Ajustar stock</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{productoParaStock.nombre}</p></div>
              <button type="button" onClick={() => setOpenStock(false)} aria-label="Cerrar ajuste de stock" className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors bg-slate-100 dark:bg-slate-800 p-2 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/15 dark:bg-slate-900/60">
                <span className="text-sm text-slate-500 dark:text-slate-400">Stock disponible</span>
                <strong className="text-2xl text-slate-900 dark:text-white tabular-nums">{Number(productoParaStock.stock_actual ?? productoParaStock.stock)}</strong>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
                <button type="button" onClick={() => setStockCantidad(-Math.max(1, Math.abs(Number(stockCantidad) || 1)))} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold ${Number(stockCantidad) < 0 ? 'bg-white text-red-600 shadow-sm dark:bg-white/10 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}><Minus className="size-4" /> Salida</button>
                <button type="button" onClick={() => setStockCantidad(Math.max(1, Math.abs(Number(stockCantidad) || 1)))} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold ${Number(stockCantidad) > 0 ? 'bg-white text-primary shadow-sm dark:bg-white/10' : 'text-slate-500 dark:text-slate-400'}`}><Plus className="size-4" /> Ingreso</button>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">
                  Cantidad a mover
                </label>
                <input 
                  type="number" 
                  value={stockCantidad as any} 
                  onChange={e => setStockCantidad(e.target.value === '' ? '' : Number(e.target.value))} 
                  placeholder="Selecciona ingreso o salida"
                  className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none font-mono" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">
                  Motivo
                </label>
                <input 
                  type="text" 
                  value={stockMotivo} 
                  onChange={e => setStockMotivo(e.target.value)} 
                  placeholder="Ej: Ingreso de mercadería, Merma..."
                  className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none" 
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100/50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-800/30 flex justify-end space-x-3">
              <button type="button" onClick={() => setOpenStock(false)} className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold shadow-sm hover:bg-slate-50 dark:border-white/20 dark:bg-slate-800 dark:text-slate-200">Cancelar</button>
              <button type="button" onClick={submitStock} className="px-5 py-2.5 rounded-xl bg-primary text-white font-semibold shadow-sm flex items-center hover:bg-primary/90">
                <Save className="w-4 h-4 mr-2" />
                Ajustar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kardex modal */}
      {openKardex && productoParaKardex && (
        <div className="event-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-slate-500/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen hidden dark:block"></div>
          
          <div className="w-full max-w-4xl bg-white dark:bg-[#0B1120] rounded-2xl shadow-xl border border-slate-200 dark:border-white/20 flex flex-col overflow-hidden relative z-10">
            <div className="h-1 w-full bg-secondary"></div>
            <div className="p-6 border-b border-slate-100 dark:border-white/10 flex justify-between items-center">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Package className="size-5" /></span>
                <div className="min-w-0"><h3 className="text-xl font-bold text-slate-900 dark:text-white">Kardex de inventario</h3><p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">{productoParaKardex.nombre}</p></div>
              </div>
              <button type="button" onClick={() => setOpenKardex(false)} aria-label="Cerrar kardex" className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors bg-slate-100 dark:bg-slate-800 p-2 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-6">
              <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/15 dark:bg-slate-900/60"><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Stock actual</p><p className="mt-2 text-2xl font-black text-slate-900 dark:text-white tabular-nums">{Number(productoParaKardex.stock_actual ?? productoParaKardex.stock)}</p></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/15 dark:bg-slate-900/60"><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Movimientos</p><p className="mt-2 text-2xl font-black text-slate-900 dark:text-white tabular-nums">{kardex.length}</p></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/15 dark:bg-slate-900/60"><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Última actualización</p><p className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200"><Clock3 className="size-4 text-primary" />{kardex[0]?.fecha_hora ? new Date(kardex[0].fecha_hora).toLocaleDateString('es-PE') : 'Sin movimientos'}</p></div>
              </div>
              {kardexLoading ? (
                <div className="space-y-3">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800" />)}</div>
              ) : kardex.length === 0 ? (
                <div className="event-empty-state min-h-48"><FileText className="size-8 text-primary" /><div><p className="font-bold text-slate-800 dark:text-white">Sin movimientos todavía</p><p className="mt-1 text-sm">Los ingresos, salidas y ventas aparecerán aquí.</p></div></div>
              ) : productosFiltrados.length === 0 ? (
                <tr><td colSpan={6} className="p-6"><div className="event-empty-state min-h-48"><AlertTriangle className="size-8 text-amber-500" /><div><p className="font-bold text-slate-800 dark:text-white text-balance">{soloStockBajo ? 'No hay productos con stock bajo' : 'No hay productos en esta categoría'}</p><p className="mt-1 text-sm text-pretty">{soloStockBajo ? 'Todos los productos tienen existencias por encima de su stock mínimo.' : 'Prueba seleccionando otra categoría o quita el filtro actual.'}</p></div><button type="button" onClick={() => soloStockBajo ? setSoloStockBajo(false) : setFiltroCategoria('')} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">{soloStockBajo ? 'Ver todos los productos' : 'Quitar filtro'}</button></div></td></tr>
              ) : (
                <div className="event-table-shell"><table className="event-data-table table-auto">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    <tr className="text-left">
                      <th className="p-4">Movimiento</th>
                      <th className="p-4">Cambio</th>
                      <th className="p-4">Existencias</th>
                      <th className="p-4">Motivo</th>
                      <th className="p-4">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kardex.map((k:any) => {
                      const esIngreso = k.tipo_movimiento === 'INGRESO';
                      return (
                      <tr key={k.id_movimiento} className="border-t border-slate-100 dark:border-white/10 hover:bg-slate-50/70 dark:hover:bg-white/5">
                        <td className="p-4 font-semibold">
                          <span className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold ${esIngreso ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'}`}>
                            {esIngreso ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}{esIngreso ? 'Ingreso' : 'Salida'}
                          </span>
                        </td>
                        <td className={`p-4 font-black tabular-nums ${esIngreso ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{esIngreso ? '+' : '−'}{Number(k.cantidad)}</td>
                        <td className="p-4 font-semibold tabular-nums"><span className="text-slate-400">{k.stock_antes}</span><span className="mx-2">→</span><span className="text-slate-900 dark:text-white">{k.stock_despues}</span></td>
                        <td className="p-4"><p className="font-medium text-slate-700 dark:text-slate-200">{k.motivo || 'Sin motivo'}</p>{k.referencia && <p className="mt-1 text-xs text-slate-400">{k.referencia}</p>}</td>
                        <td className="p-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{new Date(k.fecha_hora).toLocaleString('es-PE')}</td>
                      </tr>
                    )})}
                  </tbody>
                </table></div>
              )}
            </div>
            <div className="p-5 border-t border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
              <button type="button" onClick={() => setOpenKardex(false)} className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/20 dark:bg-slate-800 dark:text-slate-200">Cerrar Kardex</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={ejecutarEliminar}
        title="Eliminar producto"
        message={`¿Estás seguro que deseas eliminar el producto "${deleteConfirm?.nombre}"? Esta acción no se puede deshacer.`}
        isDestructive={true}
      />

    </div>
  );
}

import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, RefreshCw, X, Save, Image as ImageIcon, UploadCloud } from 'lucide-react';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Skeleton } from '../components/ui/Skeleton';

type Categoria = {
  id_categoria: number;
  id_evento: number;
  nombre: string;
  imagen_url?: string;
  orden?: number;
  estado?: boolean;
  total_productos?: number;
};

export function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Categoria | null>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formOrden, setFormOrden] = useState<number | undefined>(undefined);
  const [formImagen, setFormImagen] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Categoria | null>(null);

  const fetchCategorias = async () => {
    setLoading(true);
    try {
      const res = await api.get('/categorias');
      setCategorias(res.data);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error cargando categorías');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategorias();
  }, []);

  const onOpenCreate = () => {
    setEditing(null);
    setFormNombre('');
    setFormOrden(undefined);
    setFormImagen(null);
    setFormError('');
    setOpenCreate(true);
  };

  const onEdit = (c: Categoria) => {
    setEditing(c);
    setFormNombre(c.nombre);
    setFormOrden(c.orden || undefined);
    setFormImagen(c.imagen_url || null);
    setFormError('');
    setOpenCreate(true);
  };

  const onSave = async () => {
    try {
      if (!formNombre.trim()) {
        setFormError('Ingresa un nombre para la categoría.');
        return;
      }
      setFormError('');
      if (editing) {
        const res = await api.put(`/categorias/${editing.id_categoria}`, { nombre: formNombre, orden: formOrden, imagen_url: formImagen });
        setCategorias(prev => prev.map(p => p.id_categoria === res.data.id_categoria ? res.data : p));
        toast.success('Categoría actualizada');
      } else {
        const res = await api.post('/categorias', { nombre: formNombre, orden: formOrden, imagen_url: formImagen });
        setCategorias(prev => [res.data, ...prev]);
        toast.success('Categoría creada');
      }
      setOpenCreate(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error guardando categoría');
    }
  };

  const onDelete = (cat: Categoria) => setDeleteConfirm(cat);

  const ejecutarDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/categorias/${deleteConfirm.id_categoria}`);
      setCategorias(prev => prev.filter(p => p.id_categoria !== deleteConfirm.id_categoria));
      toast.success('Categoría desactivada');
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error desactivando categoría');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFormImagen(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="event-admin w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="event-page-title">Categorías</h1>
            {!loading && <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary tabular-nums">{categorias.length}</span>}
          </div>
          <p className="event-page-description">Organiza el catálogo del evento para que los productos sean más fáciles de encontrar.</p>
        </div>
        <div className="event-page-actions w-full sm:w-auto">
          <button type="button" onClick={fetchCategorias} disabled={loading} aria-busy={loading} className="event-action-secondary flex-1 sm:flex-none">
            <RefreshCw className={`size-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} />
            {loading ? 'Actualizando' : 'Actualizar'}
          </button>
          <button type="button" onClick={onOpenCreate} className="event-action-primary flex-1 sm:flex-none">
            <Plus className="size-4" />
            Nueva categoría
          </button>
        </div>
      </div>

      <div className="bg-transparent">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="event-card p-6 flex items-center gap-4">
                <Skeleton className="w-16 h-16 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categorias.length === 0 && (
              <div className="event-empty-state col-span-full">
                <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <ImageIcon className="size-6" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 dark:text-white">Aún no hay categorías</p>
                  <p className="mt-1 text-sm text-pretty">Crea la primera categoría para organizar los productos del evento.</p>
                </div>
                <button type="button" onClick={onOpenCreate} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90">
                  <Plus className="size-4" /> Nueva categoría
                </button>
              </div>
            )}
            {categorias.map(cat => (
              <article key={cat.id_categoria} className="event-card p-5 group relative flex flex-col">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-slate-100 dark:border-slate-800 shadow-sm group-hover:border-primary/30 transition-colors shrink-0">
                    {cat.imagen_url && (cat.imagen_url.startsWith('http') || cat.imagen_url.startsWith('data:image')) ? (
                      <img src={cat.imagen_url} alt={cat.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg truncate">{cat.nombre}</h3>
                    <div className="flex items-center mt-1 space-x-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        Orden: {cat.orden ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                  <div className="flex items-center text-slate-500 dark:text-slate-400">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                    </div>
                    <span className="text-sm font-semibold"><span className="text-primary">{cat.total_productos || 0}</span> Productos</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button onClick={() => onEdit(cat)} aria-label={`Editar ${cat.nombre}`} title="Editar" className="p-2 text-slate-400 hover:text-primary transition-colors bg-slate-50 hover:bg-primary/10 dark:bg-slate-800 dark:hover:bg-primary/20 rounded-xl">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => onDelete(cat)} aria-label={`Desactivar ${cat.nombre}`} title="Desactivar" className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-slate-50 hover:bg-red-50 dark:bg-slate-800 dark:hover:bg-red-500/20 rounded-xl">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {openCreate && (
        <div className="event-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-[#0B1120] rounded-2xl shadow-xl border border-slate-200 dark:border-white/20 flex flex-col overflow-hidden relative z-10">
            <div className="h-1 w-full bg-secondary"></div>
            <div className="p-5 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/20 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{editing ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
              <button type="button" onClick={() => setOpenCreate(false)} aria-label="Cerrar formulario" className="inline-flex size-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white">
                <X className="size-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Nombre</label>
                <input autoFocus value={formNombre} onChange={(e) => { setFormNombre(e.target.value); setFormError(''); }} aria-invalid={!!formError} className="w-full border border-slate-200 dark:border-white/20 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] dark:text-white outline-none" placeholder="Ej. Bebidas" />
                {formError && <p className="mt-2 text-xs font-medium text-red-500">{formError}</p>}
                </div>
                <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Orden (opcional)</label>
                <input value={formOrden ?? ''} onChange={(e) => setFormOrden(e.target.value ? Number(e.target.value) : undefined)} type="number" min="0" className="w-full border border-slate-200 dark:border-white/20 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] dark:text-white outline-none font-mono tabular-nums" placeholder="0" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Imagen</label>
                <label htmlFor="categoria-imagen" className="event-file-picker">
                  {formImagen ? (
                    <img src={formImagen} alt="Vista previa de la categoría" className="size-20 rounded-xl object-cover border border-slate-200 dark:border-white/20" />
                  ) : (
                    <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><UploadCloud className="size-5" /></span>
                  )}
                  <span>
                    <span className="block text-sm font-semibold text-slate-800 dark:text-white">{formImagen ? 'Cambiar imagen' : 'Seleccionar imagen'}</span>
                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">PNG, JPG o WebP</span>
                  </span>
                </label>
                <input id="categoria-imagen" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageChange} className="sr-only" />
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/50 flex justify-end space-x-3">
              <button type="button" onClick={() => setOpenCreate(false)} className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold shadow-sm hover:bg-slate-50 dark:border-white/20 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Cancelar</button>
              <button type="button" onClick={onSave} className="px-5 py-2.5 rounded-xl bg-primary text-white font-semibold shadow-sm flex items-center hover:bg-primary/90">
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
        title="Desactivar Categoría"
        message={`¿Estás seguro que deseas desactivar la categoría "${deleteConfirm?.nombre}"? Los productos que la usan podrían quedar sin categoría visible.`}
        isDestructive={true}
      />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { paletaService } from '../services/paletaService';
import type { Paleta } from '../services/paletaService';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ConfirmModal } from '../components/ui/ConfirmModal';

const paletaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  color_primario_base: z.string().min(7, 'Color requerido'),
  color_secundario_base: z.string().min(7, 'Color requerido'),
  color_acento_base: z.string().min(7, 'Color requerido'),
});

type PaletaForm = z.infer<typeof paletaSchema>;

export function PaletasPage() {
  const [paletas, setPaletas] = useState<Paleta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPaleta, setEditingPaleta] = useState<Paleta | null>(null);
  
  // Estados para Modal de Confirmación
  const [confirmState, setConfirmState] = useState<{isOpen: boolean, idToDelete: number | null}>({ isOpen: false, idToDelete: null });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<PaletaForm>({
    resolver: zodResolver(paletaSchema),
  });

  const fetchPaletas = async () => {
    try {
      setIsLoading(true);
      const data = await paletaService.getPaletas();
      setPaletas(data);
    } catch (error) {
      toast.error('Error al cargar paletas');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPaletas();
  }, []);

  const openNewModal = () => {
    setEditingPaleta(null);
    reset({
      nombre: '',
      color_primario_base: '#172B4D',
      color_secundario_base: '#4A5568',
      color_acento_base: '#D4AF37',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (paleta: Paleta) => {
    setEditingPaleta(paleta);
    reset({
      nombre: paleta.nombre,
      color_primario_base: paleta.color_primario_base,
      color_secundario_base: paleta.color_secundario_base,
      color_acento_base: paleta.color_acento_base,
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: PaletaForm) => {
    try {
      if (editingPaleta) {
        await paletaService.actualizarPaleta(editingPaleta.id_paleta, data);
        toast.success('Paleta actualizada con éxito');
      } else {
        await paletaService.crearPaleta(data);
        toast.success('Paleta creada con éxito');
      }
      setIsModalOpen(false);
      fetchPaletas();
    } catch (error) {
      toast.error('Error al guardar paleta');
    }
  };

  const handleDelete = (id: number) => {
    setConfirmState({ isOpen: true, idToDelete: id });
  };

  const confirmDelete = async () => {
    if (confirmState.idToDelete !== null) {
      try {
        await paletaService.eliminarPaleta(confirmState.idToDelete);
        toast.success('Paleta eliminada');
        fetchPaletas();
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Error al eliminar');
      }
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-balance text-primary">Gestión de Paletas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Crea y administra los colores corporativos para los eventos.</p>
        </div>
        <Button onClick={openNewModal} className="bg-primary hover:bg-primary/90 text-white shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 font-medium rounded-xl px-4 py-2 flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Paleta
        </Button>
      </div>

      <div className="bg-white dark:bg-[#0B1120] rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="text-xs uppercase bg-slate-50/50 dark:bg-slate-900/20 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800/60">
              <tr>
                <th className="px-6 py-4 rounded-tl-2xl">ID</th>
                <th className="px-6 py-4">Nombre</th>
                <th className="px-6 py-4">Colores Base</th>
                <th className="px-6 py-4 text-right rounded-tr-2xl">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8"><TableSkeleton columns={4} /></td>
                </tr>
              ) : paletas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center">
                    <p className="mb-4 text-sm text-slate-500">Todavía no hay paletas registradas.</p>
                    <Button onClick={openNewModal}><Plus className="mr-2 size-4" />Crear la primera</Button>
                  </td>
                </tr>
              ) : (
                paletas.map((paleta) => (
                  <tr key={paleta.id_paleta} className="border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-[#050B14] transition-colors">
                    <td className="px-6 py-4 font-medium">#{paleta.id_paleta}</td>
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{paleta.nombre}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-full shadow-sm border border-slate-200 dark:border-slate-700" style={{ backgroundColor: paleta.color_primario_base }} title="Primario"></div>
                        <div className="w-6 h-6 rounded-full shadow-sm border border-slate-200 dark:border-slate-700" style={{ backgroundColor: paleta.color_secundario_base }} title="Secundario"></div>
                        <div className="w-6 h-6 rounded-full shadow-sm border border-slate-200 dark:border-slate-700" style={{ backgroundColor: paleta.color_acento_base }} title="Acento"></div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => openEditModal(paleta)} aria-label={`Editar paleta ${paleta.nombre}`} className="p-2 text-slate-400 hover:text-secondary transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(paleta.id_paleta)} aria-label={`Eliminar paleta ${paleta.nombre}`} className="p-2 text-slate-400 hover:text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
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

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={editingPaleta ? 'Editar Paleta' : 'Nueva Paleta'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Nombre de la Paleta</Label>
            <Input 
              {...register('nombre')} 
              placeholder="Ej: Tema Corporativo Oscuro" 
              error={errors.nombre?.message}
              className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-3 flex flex-col items-center">
              <Label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400 text-center">Primario</Label>
              <div className="relative group">
                <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 shadow-sm group-hover:border-primary transition-colors relative">
                  <input 
                    type="color" 
                    value={watch('color_primario_base')}
                    onChange={(e) => setValue('color_primario_base', e.target.value)}
                    className="absolute -top-4 -left-4 w-24 h-24 cursor-pointer"
                  />
                </div>
              </div>
              <Input 
                {...register('color_primario_base')} 
                placeholder="#000000"
                className="w-full text-center text-xs font-mono uppercase border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none"
                maxLength={7}
              />
            </div>
            
            <div className="space-y-3 flex flex-col items-center">
              <Label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400 text-center">Secundario</Label>
              <div className="relative group">
                <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 shadow-sm group-hover:border-primary transition-colors relative">
                  <input 
                    type="color" 
                    value={watch('color_secundario_base')}
                    onChange={(e) => setValue('color_secundario_base', e.target.value)}
                    className="absolute -top-4 -left-4 w-24 h-24 cursor-pointer"
                  />
                </div>
              </div>
              <Input 
                {...register('color_secundario_base')} 
                placeholder="#000000"
                className="w-full text-center text-xs font-mono uppercase border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none"
                maxLength={7}
              />
            </div>

            <div className="space-y-3 flex flex-col items-center">
              <Label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400 text-center">Acento</Label>
              <div className="relative group">
                <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 shadow-sm group-hover:border-primary transition-colors relative">
                  <input 
                    type="color" 
                    value={watch('color_acento_base')}
                    onChange={(e) => setValue('color_acento_base', e.target.value)}
                    className="absolute -top-4 -left-4 w-24 h-24 cursor-pointer"
                  />
                </div>
              </div>
              <Input 
                {...register('color_acento_base')} 
                placeholder="#000000"
                className="w-full text-center text-xs font-mono uppercase border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none"
                maxLength={7}
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-sm flex items-center hover:bg-primary/90 disabled:opacity-50">
              {isSubmitting ? 'Guardando...' : 'Guardar Paleta'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState({ isOpen: false, idToDelete: null })}
        onConfirm={confirmDelete}
        title="Eliminar Paleta"
        message="¿Estás seguro de que deseas eliminar esta paleta? Esta acción no se puede deshacer."
        confirmText="Sí, eliminar"
        isDestructive={true}
      />
    </div>
  );
}

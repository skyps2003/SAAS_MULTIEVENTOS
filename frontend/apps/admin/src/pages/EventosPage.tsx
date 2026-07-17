import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit2, Trash2, Power, Users } from 'lucide-react';
import { toast } from 'sonner';
import { eventoService } from '../services/eventoService';
import type { Evento } from '../services/eventoService';
import { paletaService } from '../services/paletaService';
import type { Paleta } from '../services/paletaService';
import { usuarioService } from '../services/usuarioService';
import type { Usuario } from '../services/usuarioService';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ConfirmModal } from '../components/ui/ConfirmModal';

const eventoSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  id_admin: z.coerce.number().min(1, 'Selecciona un administrador'),
  id_paleta: z.coerce.number().min(1, 'Selecciona una paleta'),
  fecha_evento: z.string().min(1, 'La fecha es requerida'),
  codigo_caja: z.string().optional(),
  slug: z.string().optional(),
});

type EventoForm = z.infer<typeof eventoSchema>;

export function EventosPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [paletas, setPaletas] = useState<Paleta[]>([]);
  const [administradores, setAdministradores] = useState<Usuario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvento, setEditingEvento] = useState<Evento | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  // Estados de confirmación
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: number | null}>({ isOpen: false, id: null });
  const [statusConfirm, setStatusConfirm] = useState<{isOpen: boolean, id: number | null, nuevoEstado: string}>({ isOpen: false, id: null, nuevoEstado: '' });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.input<typeof eventoSchema>, unknown, EventoForm>({
    resolver: zodResolver(eventoSchema),
  });

  const fetchDatos = async () => {
    try {
      setIsLoading(true);
      const [evts, pals, admins] = await Promise.all([
        eventoService.getEventos(),
        paletaService.getPaletas(),
        usuarioService.getAdministradores(),
      ]);
      setEventos(evts);
      setPaletas(pals);
      setAdministradores(admins);
    } catch (error) {
      toast.error('Error al cargar datos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDatos();
  }, []);

  const openNewModal = () => {
    setEditingEvento(null);
    setLogoBase64(null);
    reset({
      nombre: '',
      id_admin: administradores.length > 0 ? administradores[0].id_usuario : 0,
      id_paleta: paletas.length > 0 ? paletas[0].id_paleta : 0,
      fecha_evento: new Date().toISOString().split('T')[0],
      codigo_caja: '',
      slug: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (evento: Evento) => {
    setEditingEvento(evento);
    setLogoBase64(evento.logo_url || null);
    reset({
      nombre: evento.nombre,
      id_admin: evento.id_admin || 0,
      id_paleta: evento.id_paleta,
      fecha_evento: new Date(evento.fecha_evento).toISOString().split('T')[0],
      codigo_caja: evento.codigo_caja || '',
      slug: evento.slug || '',
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: EventoForm) => {
    try {
      if (editingEvento) {
        await eventoService.actualizarEvento(editingEvento.id_evento, {
          nombre: data.nombre,
          fecha_evento: data.fecha_evento,
          id_admin: Number(data.id_admin),
          id_paleta: Number(data.id_paleta),
          logo_url: logoBase64 || null,
          codigo_caja: data.codigo_caja || null,
          slug: data.slug || null
        });
        toast.success('Evento actualizado con éxito');
      } else {
        const payload = {
          ...data,
          logo_url: logoBase64,
        };
        await eventoService.crearEvento(payload);
        toast.success('Evento creado con éxito. Revisa el correo del Admin.');
      }
      setIsModalOpen(false);
      fetchDatos();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al guardar evento');
    }
  };

  const handleDelete = (id: number) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    if (deleteConfirm.id !== null) {
      try {
        await eventoService.eliminarEvento(deleteConfirm.id);
        toast.success('Evento eliminado por completo');
        fetchDatos();
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Error al eliminar');
      }
    }
  };

  const handleToggleEstado = (id: number, estadoActual: string) => {
    const nuevoEstado = estadoActual === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    setStatusConfirm({ isOpen: true, id, nuevoEstado });
  };

  const confirmToggleStatus = async () => {
    if (statusConfirm.id !== null) {
      try {
        await eventoService.actualizarEstado(statusConfirm.id, statusConfirm.nuevoEstado);
        toast.success('Estado actualizado');
        fetchDatos();
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Error al cambiar estado');
      }
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoBase64(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-primary">Gestión de Eventos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Administra los eventos, sus administradores y sus estados.</p>
        </div>
        <Button onClick={openNewModal} className="bg-primary hover:bg-primary/90 text-white shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 font-medium rounded-xl px-4 py-2 flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Evento
        </Button>
      </div>

      <div className="bg-white dark:bg-[#0B1120] rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="text-xs uppercase bg-slate-50/50 dark:bg-slate-900/20 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800/60">
              <tr>
                <th className="px-6 py-4 rounded-tl-2xl">Evento</th>
                <th className="px-6 py-4">Administrador</th>
                <th className="px-6 py-4">Paleta</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right rounded-tr-2xl">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8"><TableSkeleton columns={5} /></td>
                </tr>
              ) : eventos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">No hay eventos registrados</td>
                </tr>
              ) : (
                eventos.map((evento) => (
                  <tr key={evento.id_evento} className="border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-[#050B14] transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900 dark:text-white">{evento.nombre}</p>
                      <p className="text-xs text-slate-400">ID: {evento.id_evento} | {new Date(evento.fecha_evento).toLocaleDateString()}</p>
                      {/* Mostrar código de caja si está disponible y botón para copiar */}
                      {evento.codigo_caja && (
                        <div className="mt-2 flex items-center text-xs text-slate-500">
                          <span className="mr-3 font-medium">Código caja:</span>
                          <code className="px-2 py-1 bg-slate-100 rounded-md">{evento.codigo_caja}</code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(String(evento.codigo_caja));
                              toast.success('Código copiado al portapapeles');
                            }}
                            className="ml-2 text-sm text-secondary hover:underline"
                          >
                            Copiar
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-slate-600 dark:text-slate-300">
                        <Users className="w-4 h-4 mr-2 text-secondary" />
                        {evento.admin_nombre || evento.admin_email || 'Sin Asignar'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex -space-x-1 mr-3">
                          <div className="w-4 h-4 rounded-full border border-white dark:border-slate-800" style={{ backgroundColor: evento.color_primario_base || '#ccc' }} />
                          <div className="w-4 h-4 rounded-full border border-white dark:border-slate-800" style={{ backgroundColor: evento.color_secundario_base || '#ccc' }} />
                          <div className="w-4 h-4 rounded-full border border-white dark:border-slate-800" style={{ backgroundColor: evento.color_acento_base || '#ccc' }} />
                        </div>
                        <span className="text-slate-600 dark:text-slate-300">
                          {evento.paleta_nombre || `Paleta #${evento.id_paleta}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                        evento.estado === 'ACTIVO' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 
                        evento.estado === 'FINALIZADO' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400' : 
                        'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                      }`}>
                        {evento.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button 
                        onClick={() => handleToggleEstado(evento.id_evento, evento.estado)} 
                        className="p-2 text-slate-400 hover:text-accent transition-colors hover:bg-accent/10 rounded-lg"
                        title={evento.estado === 'ACTIVO' ? 'Desactivar Evento' : 'Activar Evento'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEditModal(evento)} title="Editar" className="p-2 text-slate-400 hover:text-secondary transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(evento.id_evento)} title="Eliminar" className="p-2 text-slate-400 hover:text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
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
        title={editingEvento ? 'Editar Evento' : 'Nuevo Evento'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Nombre del Evento</Label>
            <Input 
              {...register('nombre')} 
              placeholder="Ej: Tomorrowland 2026" 
              error={errors.nombre?.message}
              className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Código de Caja (Opcional)</Label>
                <Input 
                  {...register('codigo_caja')} 
                  placeholder="Ej: TML26" 
                  className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Slug (Opcional)</Label>
                <Input 
                  {...register('slug')} 
                  placeholder="Ej: tomorrowland-2026" 
                  className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Administrador Asignado</Label>
              <select 
                {...register('id_admin')}
                className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none"
              >
                {administradores.map(a => (
                  <option key={a.id_usuario} value={a.id_usuario}>{a.nombre} ({a.email})</option>
                ))}
              </select>
              {errors.id_admin && <p className="text-xs text-red-500 mt-1">{errors.id_admin.message}</p>}
            </div>

            <div className="space-y-2">
              <Label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Paleta de Colores</Label>
              <select 
                {...register('id_paleta')}
                className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none"
              >
                {paletas.map(p => (
                  <option key={p.id_paleta} value={p.id_paleta}>{p.nombre}</option>
                ))}
              </select>
              {errors.id_paleta && <p className="text-xs text-red-500 mt-1">{errors.id_paleta.message}</p>}
            </div>

            <div className="space-y-2">
              <Label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Logo del Evento</Label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleLogoChange}
                className="w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 transition-all dark:file:bg-slate-800 dark:file:text-white dark:hover:file:bg-slate-700 cursor-pointer"
              />
              {logoBase64 && (
                <div className="mt-2 w-24 h-24 rounded overflow-hidden border border-slate-200 dark:border-slate-700">
                  <img src={logoBase64} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

          <div className="space-y-2">
            <Label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Fecha del Evento</Label>
            <Input 
              {...register('fecha_evento')} 
              type="date"
              error={errors.fecha_evento?.message}
              className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none"
            />
          </div>

          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl bg-secondary text-white font-bold shadow-sm transition-all hover:scale-105">
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-sm flex items-center transition-all hover:scale-105">
              {isSubmitting ? 'Guardando...' : 'Guardar Evento'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
        onConfirm={confirmDelete}
        title="⚠️ Eliminar Evento Completo"
        message="¿Estás SEGURO? Esta acción es IRREVERSIBLE y no se puede deshacer."
        details={[
          'Todos los cajeros del evento',
          'Todas las sesiones de caja abiertas o cerradas',
          'Todas las ventas y sus detalles de productos',
          'Todos los movimientos de inventario',
          'Todos los productos, categorías y combos',
          'Todos los métodos de pago configurados',
          'Todos los descuentos configurados',
        ]}
        confirmText="Sí, eliminar todo"
        cancelText="Cancelar"
        isDestructive={true}
      />

      <ConfirmModal 
        isOpen={statusConfirm.isOpen}
        onClose={() => setStatusConfirm({ isOpen: false, id: null, nuevoEstado: '' })}
        onConfirm={confirmToggleStatus}
        title="Cambiar Estado"
        message={`¿Estás seguro de que deseas cambiar el estado del evento a ${statusConfirm.nuevoEstado}?`}
        confirmText="Sí, cambiar estado"
        isDestructive={false}
      />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit2, Trash2, Shield, User, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { usuarioService } from '../services/usuarioService';
import type { Usuario } from '../services/usuarioService';
import { Modal } from '../components/ui/Modal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { TableSkeleton } from '../components/ui/Skeleton';

const adminSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('Email inválido'),
  password: z.string().optional(),
});

type AdminForm = z.infer<typeof adminSchema>;

export function AdministradoresPage() {
  const [administradores, setAdministradores] = useState<Usuario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Usuario | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: number | null}>({ isOpen: false, id: null });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AdminForm>({
    resolver: zodResolver(adminSchema),
  });

  const fetchAdministradores = async () => {
    try {
      setIsLoading(true);
      const data = await usuarioService.getAdministradores();
      setAdministradores(data);
    } catch (error) {
      toast.error('Error al cargar administradores');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdministradores();
  }, []);

  const openNewModal = () => {
    setEditingAdmin(null);
    reset({
      nombre: '',
      email: '',
      password: '',
    });
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const openEditModal = (admin: Usuario) => {
    setEditingAdmin(admin);
    reset({
      nombre: admin.nombre,
      email: admin.email,
      password: '', // En edición es opcional
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: AdminForm) => {
    try {
      if (editingAdmin) {
        await usuarioService.actualizarAdministrador(editingAdmin.id_usuario, data);
        toast.success('Administrador actualizado con éxito');
      } else {
        if (!data.password) {
          toast.error('La contraseña es requerida para nuevos administradores');
          return;
        }
        await usuarioService.crearAdministrador(data);
        toast.success('Administrador creado con éxito');
      }
      setIsModalOpen(false);
      fetchAdministradores();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al guardar administrador');
    }
  };

  const handleDelete = (id: number) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    if (deleteConfirm.id !== null) {
      try {
        await usuarioService.eliminarAdministrador(deleteConfirm.id);
        toast.success('Administrador eliminado');
        fetchAdministradores();
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Error al eliminar');
      }
    }
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-balance text-primary">Gestión de Administradores</h1>
          <p className="text-sm text-pretty text-slate-500 dark:text-slate-400 mt-1">Crea y administra a las personas que gestionarán los eventos.</p>
        </div>
        <Button onClick={openNewModal} className="bg-primary hover:bg-primary/90 text-white shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 font-medium rounded-xl px-4 py-2 flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Administrador
        </Button>
      </div>

      <div className="bg-white dark:bg-[#0B1120] rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="text-xs uppercase bg-slate-50/50 dark:bg-slate-900/20 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800/60">
              <tr>
                <th className="px-6 py-4 rounded-tl-2xl">Usuario</th>
                <th className="px-6 py-4">Rol / ID</th>
                <th className="px-6 py-4 text-right rounded-tr-2xl">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8"><TableSkeleton columns={3} /></td>
                </tr>
              ) : administradores.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center">
                    <p className="mb-4 text-sm text-slate-500">Todavía no hay administradores registrados.</p>
                    <Button onClick={openNewModal}><Plus className="mr-2 size-4" />Crear el primero</Button>
                  </td>
                </tr>
              ) : (
                administradores.map((admin) => (
                  <tr key={admin.id_usuario} className="border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-[#050B14] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mr-3 text-secondary">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{admin.nombre}</p>
                          <p className="text-xs text-slate-400">{admin.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-slate-600 dark:text-slate-300">
                        <Shield className="w-4 h-4 mr-2 text-secondary" />
                        <span className="font-medium text-xs bg-accent/10 text-accent px-2 py-1 rounded">
                          {admin.rol.replace('_', ' ')}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => openEditModal(admin)} aria-label={`Editar a ${admin.nombre}`} className="p-2 text-slate-400 hover:text-secondary transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        <Edit2 className="size-4" />
                      </button>
                      <button onClick={() => handleDelete(admin.id_usuario)} aria-label={`Eliminar a ${admin.nombre}`} className="p-2 text-slate-400 hover:text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                        <Trash2 className="size-4" />
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
        title={editingAdmin ? 'Editar Administrador' : 'Nuevo Administrador'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Nombre Completo</Label>
            <Input 
              {...register('nombre')} 
              placeholder="Ej: Carlos Gómez" 
              error={errors.nombre?.message}
              className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none"
            />
          </div>

          <div className="space-y-2">
            <Label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">Correo Electrónico</Label>
            <Input 
              {...register('email')} 
              type="email"
              placeholder="admin@empresa.com" 
              error={errors.email?.message}
              className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none"
            />
          </div>

          <div className="space-y-2 relative">
            <Label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">
              Contraseña {editingAdmin && <span className="text-slate-400 font-normal text-xs normal-case tracking-normal">(Dejar en blanco para mantener actual)</span>}
            </Label>
            <div className="relative">
              <Input 
                {...register('password')} 
                type={showPassword ? "text" : "password"}
                placeholder={editingAdmin ? "••••••••" : "Asigna una contraseña segura"} 
                error={errors.password?.message}
                className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-[#0B1120] transition-all dark:text-white outline-none pr-10"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 top-[1px] bottom-[1px]"
                style={{ height: '40px' }}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-sm flex items-center hover:bg-primary/90 disabled:opacity-50">
              {isSubmitting ? 'Guardando...' : 'Guardar Administrador'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
        onConfirm={confirmDelete}
        title="Eliminar Administrador"
        message="¿Estás seguro de que deseas eliminar a este administrador? Solo podrá ser eliminado si no tiene eventos asignados a su cargo."
        confirmText="Sí, eliminar"
        isDestructive={true}
      />
    </div>
  );
}

import { useState } from 'react';
import { Eye, EyeOff, Palette, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { usuarioService } from '../services/usuarioService';
import { paletaService } from '../services/paletaService';

export type QuickCreateType = 'admin' | 'palette' | null;

interface SuperAdminQuickCreateProps {
  type: QuickCreateType;
  onClose: () => void;
  onCreated?: () => void;
}

const initialPalette = {
  nombre: '',
  color_primario_base: '#2563EB',
  color_secundario_base: '#0F172A',
  color_acento_base: '#16A34A',
};

export function SuperAdminQuickCreate({ type, onClose, onCreated }: SuperAdminQuickCreateProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [admin, setAdmin] = useState({ nombre: '', email: '', password: '' });
  const [palette, setPalette] = useState(initialPalette);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const close = (force = false) => {
    if (isSubmitting && !force) return;
    setErrors({});
    setAdmin({ nombre: '', email: '', password: '' });
    setPalette(initialPalette);
    setShowPassword(false);
    onClose();
  };

  const submitAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (admin.nombre.trim().length < 2) nextErrors.nombre = 'Ingresa el nombre completo.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin.email)) nextErrors.email = 'Ingresa un correo válido.';
    if (admin.password.length < 8) nextErrors.password = 'Usa al menos 8 caracteres.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      setIsSubmitting(true);
      await usuarioService.crearAdministrador({
        nombre: admin.nombre.trim(),
        email: admin.email.trim().toLowerCase(),
        password: admin.password,
      });
      toast.success('Administrador creado correctamente');
      onCreated?.();
      close(true);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'No se pudo crear el administrador');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitPalette = async (event: React.FormEvent) => {
    event.preventDefault();
    if (palette.nombre.trim().length < 2) {
      setErrors({ nombre: 'Asigna un nombre a la paleta.' });
      return;
    }

    try {
      setIsSubmitting(true);
      await paletaService.crearPaleta({ ...palette, nombre: palette.nombre.trim() });
      toast.success('Paleta creada correctamente');
      onCreated?.();
      close(true);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'No se pudo crear la paleta');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (type === 'admin') {
    return (
      <Modal isOpen onClose={close} title="Nuevo administrador">
        <form onSubmit={submitAdmin} className="space-y-5">
          <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm text-slate-600 dark:text-slate-300">
            <ShieldCheck className="mb-2 size-5 text-primary" />
            Este usuario podrá administrar únicamente los eventos que le asigne el Super Admin.
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-admin-name">Nombre completo</Label>
            <Input id="quick-admin-name" value={admin.nombre} onChange={(e) => setAdmin({ ...admin, nombre: e.target.value })} error={errors.nombre} autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-admin-email">Correo electrónico</Label>
            <Input id="quick-admin-email" type="email" value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} error={errors.email} autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-admin-password">Contraseña temporal</Label>
            <div className="relative">
              <Input id="quick-admin-password" type={showPassword ? 'text' : 'password'} value={admin.password} onChange={(e) => setAdmin({ ...admin, password: e.target.value })} error={errors.password} autoComplete="new-password" className="pr-11" />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-2 top-1.5 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => close()}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creando...' : 'Crear administrador'}</Button>
          </div>
        </form>
      </Modal>
    );
  }

  if (type === 'palette') {
    const colors = [
      ['Primario', 'color_primario_base'],
      ['Secundario', 'color_secundario_base'],
      ['Acento', 'color_acento_base'],
    ] as const;

    return (
      <Modal isOpen onClose={close} title="Nueva paleta" maxWidth="max-w-xl">
        <form onSubmit={submitPalette} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="quick-palette-name">Nombre de la paleta</Label>
            <Input id="quick-palette-name" value={palette.nombre} onChange={(e) => setPalette({ ...palette, nombre: e.target.value })} error={errors.nombre} placeholder="Ej. Festival de verano" autoFocus />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {colors.map(([label, key]) => (
              <label key={key} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <span className="mb-3 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
                <div className="flex items-center gap-3">
                  <input type="color" value={palette[key]} onChange={(e) => setPalette({ ...palette, [key]: e.target.value })} aria-label={`Color ${label.toLowerCase()}`} className="size-10 cursor-pointer rounded-lg border-0 bg-transparent" />
                  <code className="text-xs tabular-nums text-slate-500">{palette[key].toUpperCase()}</code>
                </div>
              </label>
            ))}
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="h-16" style={{ backgroundColor: palette.color_primario_base }} />
            <div className="flex items-center justify-between bg-white p-4 dark:bg-slate-900">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Vista previa del evento</p>
                <p className="text-sm text-slate-500">Botones, indicadores y acentos</p>
              </div>
              <span className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white" style={{ backgroundColor: palette.color_acento_base }}>Activo</span>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => close()}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}><Palette className="mr-2 size-4" />{isSubmitting ? 'Creando...' : 'Crear paleta'}</Button>
          </div>
        </form>
      </Modal>
    );
  }

  return null;
}

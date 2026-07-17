import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Calendar, Type, Hash, Link as LinkIcon, Building2, Palette, UserCircle, Loader2, ChevronDown, Image as ImageIcon, Upload, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { eventoService } from '../services/eventoService';
import { paletaService } from '../services/paletaService';
import { usuarioService } from '../services/usuarioService';
import { removeImageBackground } from '../lib/removeImageBackground';

const eventoSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  id_admin: z.coerce.number().min(1, 'Selecciona un administrador'),
  id_paleta: z.coerce.number().min(1, 'Selecciona una paleta'),
  fecha_evento: z.string().min(1, 'La fecha es requerida'),
  codigo_caja: z.string().optional(),
  slug: z.string().optional(),
});

type EventoForm = z.infer<typeof eventoSchema>;

interface NuevoEventoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  eventoToEdit?: any;
}

export function NuevoEventoModal({ isOpen, onClose, onSuccess, eventoToEdit }: NuevoEventoModalProps) {
  const [paletas, setPaletas] = useState<any[]>([]);
  const [administradores, setAdministradores] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [originalLogo, setOriginalLogo] = useState<string | null>(null);
  const [processedLogo, setProcessedLogo] = useState<string | null>(null);
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const [backgroundRemoved, setBackgroundRemoved] = useState(false);

  const [isPaletaDropdownOpen, setIsPaletaDropdownOpen] = useState(false);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<z.input<typeof eventoSchema>, unknown, EventoForm>({
    resolver: zodResolver(eventoSchema),
    defaultValues: {
      fecha_evento: new Date().toISOString().split('T')[0]
    }
  });

  useEffect(() => {
    if (isOpen) {
      fetchFormData();
      if (eventoToEdit) {
        setLogoPreview(eventoToEdit.logo_url || null);
        setOriginalLogo(eventoToEdit.logo_url || null);
        setProcessedLogo(null);
        setBackgroundRemoved(false);
        reset({
          nombre: eventoToEdit.nombre || '',
          id_admin: eventoToEdit.id_admin || 0,
          id_paleta: eventoToEdit.id_paleta || 0,
          fecha_evento: eventoToEdit.fecha_evento ? new Date(eventoToEdit.fecha_evento).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          codigo_caja: eventoToEdit.codigo_caja || '',
          slug: eventoToEdit.slug || '',
        });
      } else {
        setLogoPreview(null);
        setOriginalLogo(null);
        setProcessedLogo(null);
        setBackgroundRemoved(false);
        reset({
          nombre: '',
          id_admin: 0,
          id_paleta: 0,
          fecha_evento: new Date().toISOString().split('T')[0],
          codigo_caja: '',
          slug: '',
        });
      }
      setIsPaletaDropdownOpen(false);
    }
  }, [isOpen, eventoToEdit, reset]);

  const selectedPaletaId = watch('id_paleta');
  const selectedPaleta = paletas.find(p => p.id_paleta === selectedPaletaId);

  const fetchFormData = async () => {
    setLoadingData(true);
    try {
      const [pals, admins] = await Promise.all([
        paletaService.getPaletas(),
        usuarioService.getAdministradores()
      ]);
      setPaletas(pals);
      setAdministradores(admins);
    } catch (error) {
      toast.error('Error al cargar opciones del formulario');
    } finally {
      setLoadingData(false);
    }
  };

  const onSubmit = async (data: EventoForm) => {
    try {
      const payload = { ...data, logo_url: logoPreview };
      if (eventoToEdit) {
        await eventoService.actualizarEvento(eventoToEdit.id_evento, payload);
        toast.success('¡Evento actualizado exitosamente!');
      } else {
        await eventoService.crearEvento(payload);
        toast.success('¡Evento creado exitosamente!');
      }
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(`Error al ${eventoToEdit ? 'actualizar' : 'crear'} el evento`);
    }
  };

  const handleLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona un archivo de imagen válido');
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error('La imagen no debe superar los 6 MB');
      return;
    }

    try {
      setIsProcessingLogo(true);
      const result = await removeImageBackground(file);
      setOriginalLogo(result.original);
      setProcessedLogo(result.removed ? result.processed : null);
      setLogoPreview(result.processed);
      setBackgroundRemoved(result.removed);
      toast.success(result.removed ? 'Fondo eliminado automáticamente' : 'Imagen cargada; no se detectó un fondo uniforme');
    } catch {
      toast.error('No se pudo procesar la imagen');
    } finally {
      setIsProcessingLogo(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal Box */}
      <div role="dialog" aria-modal="true" aria-labelledby="evento-modal-title" className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col h-full max-h-[90vh]">
          {/* Header */}
          <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-sm">
                <Building2 className="size-6" />
              </div>
              <div>
                <h2 id="evento-modal-title" className="text-xl font-bold text-balance text-slate-800 dark:text-white">{eventoToEdit ? 'Editar Evento' : 'Crear Nuevo Evento'}</h2>
                <p className="text-sm text-pretty text-slate-500 font-medium">Configura una nueva unidad de negocio</p>
              </div>
            </div>
            <button 
              type="button"
              onClick={onClose}
              aria-label="Cerrar formulario de evento"
              className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-8 overflow-y-auto custom-scrollbar">
            {loadingData ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-blue-600">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="font-medium text-slate-500">Cargando opciones...</p>
              </div>
            ) : (
              <form id="eventoForm" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                
                {/* Nombre y Fecha */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Nombre del Evento *</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Type className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      <input
                        type="text"
                        {...register('nombre')}
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                        placeholder="Ej. Cachimbo 2026"
                      />
                    </div>
                    {errors.nombre && <p className="text-xs text-red-500 ml-1 font-medium">{errors.nombre.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Fecha de Ejecución *</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Calendar className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      <input
                        type="date"
                        {...register('fecha_evento')}
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                      />
                    </div>
                    {errors.fecha_evento && <p className="text-xs text-red-500 ml-1 font-medium">{errors.fecha_evento.message}</p>}
                  </div>
                </div>

                {/* Admin y Paleta */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Administrador Asignado *</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <UserCircle className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      <select
                        {...register('id_admin')}
                        className="w-full pl-11 pr-10 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-white appearance-none focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                      >
                        <option value="">Seleccione un administrador...</option>
                        {administradores.map(admin => (
                          <option key={admin.id_usuario} value={admin.id_usuario}>{admin.nombre} ({admin.email})</option>
                        ))}
                      </select>
                    </div>
                    {errors.id_admin && <p className="text-xs text-red-500 ml-1 font-medium">{errors.id_admin.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Paleta de Colores *</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                        <Palette className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      
                      {/* Custom Select Button */}
                      <button
                        type="button"
                        onClick={() => setIsPaletaDropdownOpen(!isPaletaDropdownOpen)}
                        className={`w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950 border ${isPaletaDropdownOpen ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200 dark:border-slate-700'} rounded-xl text-sm font-medium text-slate-800 dark:text-white flex items-center justify-between transition-colors`}
                      >
                        {selectedPaleta ? (
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: selectedPaleta.color_primario_base }}></div>
                            <span>{selectedPaleta.nombre}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">Seleccione una paleta...</span>
                        )}
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isPaletaDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Dropdown Menu */}
                      {isPaletaDropdownOpen && (
                        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto py-1 custom-scrollbar">
                          {paletas.map(paleta => (
                            <button
                              key={paleta.id_paleta}
                              type="button"
                              onClick={() => {
                                setValue('id_paleta', paleta.id_paleta, { shouldValidate: true });
                                setIsPaletaDropdownOpen(false);
                              }}
                              className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                              <div className="w-5 h-5 rounded-full shadow-sm border border-slate-200" style={{ backgroundColor: paleta.color_primario_base }}></div>
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{paleta.nombre}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {/* Hidden input for React Hook Form */}
                      <input type="hidden" {...register('id_paleta')} />
                    </div>
                    {errors.id_paleta && <p className="text-xs text-red-500 ml-1 font-medium">{errors.id_paleta.message}</p>}
                  </div>
                </div>

                {/* Logo o imagen del evento */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-700 dark:bg-slate-950/40">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Vista previa del logo del evento" className="size-full object-contain p-2" />
                      ) : (
                        <ImageIcon className="size-8 text-slate-300 dark:text-slate-600" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-white">Logo o imagen del evento</h3>
                      <p className="mt-1 text-xs text-pretty text-slate-500 dark:text-slate-400">
                        Se intentará quitar automáticamente un fondo uniforme. PNG, JPG o WebP, máximo 6 MB.
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90">
                          {isProcessingLogo ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                          {isProcessingLogo ? 'Quitando fondo...' : logoPreview ? 'Cambiar imagen' : 'Subir imagen'}
                          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoChange} disabled={isProcessingLogo} className="hidden" />
                        </label>

                        {originalLogo && processedLogo && (
                          <button
                            type="button"
                            onClick={() => {
                              const useOriginal = logoPreview === processedLogo;
                              setLogoPreview(useOriginal ? originalLogo : processedLogo);
                              setBackgroundRemoved(!useOriginal);
                            }}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <RefreshCw className="size-4" />
                            {logoPreview === processedLogo ? 'Usar original' : 'Usar sin fondo'}
                          </button>
                        )}

                        {logoPreview && (
                          <button
                            type="button"
                            onClick={() => {
                              setLogoPreview(null);
                              setOriginalLogo(null);
                              setProcessedLogo(null);
                              setBackgroundRemoved(false);
                            }}
                            aria-label="Quitar imagen del evento"
                            className="inline-flex size-9 items-center justify-center rounded-xl border border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>

                      {logoPreview && (
                        <p className={`mt-3 text-xs font-medium ${backgroundRemoved ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {backgroundRemoved ? 'Fondo eliminado. Puedes comparar con la imagen original.' : 'Se conservará la imagen original.'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Códigos (Opcionales) */}
                <div className="p-6 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Opciones Avanzadas (Opcional)</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Código de Caja</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Hash className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                          type="text"
                          {...register('codigo_caja')}
                          className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors uppercase"
                          placeholder="Ej. CACH2026"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Slug URL</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <LinkIcon className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                          type="text"
                          {...register('slug')}
                          className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors lowercase"
                          placeholder="ej. cachimbo-2026"
                        />
                      </div>
                    </div>
                  </div>
                </div>

              </form>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="eventoForm"
              disabled={isSubmitting || loadingData}
              className="px-8 py-3 rounded-xl font-bold text-sm text-white bg-primary hover:bg-primary/90 shadow-sm disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {eventoToEdit ? 'Actualizando...' : 'Creando...'}
                </>
              ) : (eventoToEdit ? 'Actualizar Evento' : 'Crear Evento')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

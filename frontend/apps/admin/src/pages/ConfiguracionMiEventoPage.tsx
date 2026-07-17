import React, { useEffect, useState } from 'react';
import { useEventStore } from '../stores/eventStore';
import { Upload, Users, DollarSign, Calendar, CheckCircle2, Building2 } from 'lucide-react';
import api from '../services/api';
import { toast } from 'sonner';
import { removeImageBackground } from '../lib/removeImageBackground';
import { TransparentLogo } from '../components/ui/TransparentLogo';

export function ConfiguracionMiEventoPage() {
  const { currentEvent, fetchCurrentEvent } = useEventStore();
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchCurrentEvent();
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentEvent) return;

    try {
      setIsUploading(true);
      const image = await removeImageBackground(file);
      await api.post('/evento/configuracion/logo', { logo_base64: image.processed });
      toast.success(image.removed ? 'Logo actualizado y fondo eliminado' : 'Logo actualizado exitosamente');
      fetchCurrentEvent();
    } catch (error) {
      toast.error('Error al actualizar el logo');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  if (!currentEvent) {
    return <div className="p-8 text-center text-slate-500">Cargando información del evento...</div>;
  }

  return (
    <div className="event-admin w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="event-page-title">Mi evento</h1>
          <p className="event-page-description">Revisa la identidad, configuración y estado general del evento.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-2 rounded-xl border border-slate-100 bg-white px-4 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Estado:</span>
            <span className={`px-2 py-1 text-xs font-bold rounded-lg ${currentEvent.estado === 'ACTIVO' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-700'}`}>
              {currentEvent.estado}
            </span>
          </div>
        </div>
      </div>

      {/* Grid de Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#0B1120] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-white/15 flex items-center space-x-4">
          <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <DollarSign className="size-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Ingresos Totales</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">S/ {currentEvent.stats?.ingresos.toLocaleString() || '0'}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#0B1120] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-white/15 flex items-center space-x-4">
          <div className="size-14 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
            <Users className="size-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Cajeros Activos</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{currentEvent.stats?.cajeros || 0}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#0B1120] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-white/15 flex items-center space-x-4">
          <div className="size-14 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
            <CheckCircle2 className="size-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Órdenes Completadas</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{currentEvent.stats?.ordenes || 0}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info Principal */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0B1120] rounded-2xl shadow-sm border border-slate-200 dark:border-white/15 overflow-hidden">
          <div className="p-6 border-b border-slate-100/50 dark:border-slate-800/50">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Detalles del Evento</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nombre del Evento</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{currentEvent.nombre}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Código de Caja</p>
              <div className="flex items-center space-x-2">
                <code className="bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-lg text-primary font-mono text-sm font-bold border border-slate-200 dark:border-slate-700 shadow-sm">
                  {currentEvent.codigo_caja}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(currentEvent.codigo_caja);
                    toast.success('Código copiado al portapapeles');
                  }}
                  className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                  aria-label="Copiar código de caja"
                  title="Copiar código"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fecha Programada</p>
              <div className="flex items-center text-slate-700 dark:text-slate-300">
                <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                {new Date(currentEvent.fecha_evento).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0B1120] rounded-2xl shadow-sm border border-slate-200 dark:border-white/15 p-6 flex flex-col items-center justify-center text-center">
          <div className="size-24 rounded-2xl border border-slate-200 dark:border-white/20 bg-slate-50 dark:bg-slate-900/60 p-2 flex items-center justify-center">
            {currentEvent.logo_url ? (
              <TransparentLogo src={currentEvent.logo_url} alt={`Logo de ${currentEvent.nombre}`} className="size-full object-contain" />
            ) : (
              <Building2 className="size-9 text-slate-400" />
            )}
          </div>
          <h2 className="mt-4 font-bold text-slate-900 dark:text-white">Identidad del evento</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">El logo aparece en el panel y en el punto de venta.</p>
          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90">
            <Upload className="size-4" /> {isUploading ? 'Procesando...' : 'Cambiar logo'}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handleLogoUpload} disabled={isUploading} />
          </label>
        </div>

      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  DollarSign, 
  ShoppingCart, 
  CreditCard, 
  Activity, 
  Building2,
  Package
} from 'lucide-react';
import api from '../services/api';
import { TransparentLogo } from '../components/ui/TransparentLogo';
import { toast } from 'sonner';

export function SuperAdminEventDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [evento, setEvento] = useState<any>(null);
  const [resumen, setResumen] = useState<any>(null);
  const [estadisticas, setEstadisticas] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchEventData();
    }
  }, [id]);

  const fetchEventData = async () => {
    setLoading(true);
    try {
      const [evtRes, resumenRes, statsRes] = await Promise.all([
        api.get(`/eventos/${id}`),
        api.get(`/dashboard/superadmin/evento/${id}/resumen`),
        api.get(`/dashboard/superadmin/evento/${id}/estadisticas`)
      ]);
      setEvento(evtRes.data);
      setResumen(resumenRes.data);
      setEstadisticas(statsRes.data);
    } catch (error) {
      console.error('Error al cargar detalles del evento', error);
      toast.error('Error al cargar datos del evento');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-primary">
        <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!evento) {
    return (
      <div className="text-center mt-20">
        <h2 className="text-2xl font-bold text-slate-800">Evento no encontrado</h2>
        <button onClick={() => navigate('/dashboard')} className="mt-4 text-primary font-medium hover:underline">Volver al Dashboard Global</button>
      </div>
    );
  }

  return (
    <div 
      className="w-full space-y-6 pb-12"
      style={{
        '--event-primary': evento.color_primario_base || undefined,
        '--event-secondary': evento.color_secundario_base || undefined,
        '--event-accent': evento.color_acento_base || undefined,
      } as React.CSSProperties}
    >
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="w-14 h-14 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center p-1 shadow-sm overflow-hidden">
             {evento.logo_url ? (
                <TransparentLogo src={evento.logo_url} alt="Logo Evento" className="size-full object-contain" />
             ) : (
                <Building2 className="w-6 h-6 text-slate-400" />
             )}
          </div>
          <div>
            <h1 className="text-3xl font-black text-primary tracking-tight">{evento.nombre}</h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-2 font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                 <span className="uppercase text-[11px] tracking-wider text-slate-500">Código Caja:</span>
                 <span className="font-mono text-primary font-bold">{evento.codigo_caja || 'N/A'}</span>
                 {evento.codigo_caja && (
                   <button 
                     onClick={() => {
                       navigator.clipboard.writeText(evento.codigo_caja);
                       toast.success('Código copiado');
                     }}
                     className="ml-1 text-slate-400 hover:text-primary transition-colors cursor-pointer"
                     title="Copiar código"
                   >
                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                   </button>
                 )}
              </span>
              <span>•</span>
              <span>Administrador: {evento.admin_email || 'Sin Asignar'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#0B1120] rounded-[2rem] p-6 shadow-sm border border-slate-200/60 dark:border-slate-800/60 relative overflow-hidden group hover:shadow-lg transition-all duration-300">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 group-hover:opacity-20 transition-all">
             <DollarSign className="w-24 h-24 text-secondary" />
           </div>
           <div className="flex items-center gap-4 relative z-10 mb-4">
             <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center">
               <DollarSign className="w-6 h-6 text-secondary" />
             </div>
             <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ingresos Totales</h3>
           </div>
           <p className="text-4xl font-black text-accent relative z-10">
             S/ {resumen?.total_ingresos?.toFixed(2) || '0.00'}
           </p>
        </div>

        <div className="bg-white dark:bg-[#0B1120] rounded-[2rem] p-6 shadow-sm border border-slate-200/60 dark:border-slate-800/60 relative overflow-hidden group hover:shadow-lg transition-all duration-300">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 group-hover:opacity-20 transition-all">
             <Activity className="w-24 h-24 text-secondary" />
           </div>
           <div className="flex items-center gap-4 relative z-10 mb-4">
             <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center">
               <CreditCard className="w-6 h-6 text-secondary" />
             </div>
             <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Transacciones</h3>
           </div>
           <p className="text-4xl font-black text-accent relative z-10">
             {resumen?.transacciones || 0}
           </p>
        </div>

        <div className="bg-white dark:bg-[#0B1120] rounded-[2rem] p-6 shadow-sm border border-slate-200/60 dark:border-slate-800/60 relative overflow-hidden group hover:shadow-lg transition-all duration-300">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 group-hover:opacity-20 transition-all">
             <ShoppingCart className="w-24 h-24 text-secondary" />
           </div>
           <div className="flex items-center gap-4 relative z-10 mb-4">
             <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center">
               <Package className="w-6 h-6 text-secondary" />
             </div>
             <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Productos Vendidos</h3>
           </div>
           <p className="text-4xl font-black text-accent relative z-10">
             {resumen?.productos_vendidos || 0}
           </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pagos por Método */}
        <div className="bg-white dark:bg-[#0B1120] rounded-[2rem] p-8 shadow-sm border border-slate-200/60 dark:border-slate-800/60">
          <h2 className="text-xl font-bold text-primary mb-6">Ingresos por Método de Pago</h2>
          {resumen?.ventas_por_metodo && resumen.ventas_por_metodo.length > 0 ? (
            <div className="space-y-4">
              {resumen.ventas_por_metodo.map((metodo: any, i: number) => {
                const colorClass = metodo.color_hex || 'bg-white text-slate-500 dark:bg-slate-700 dark:text-slate-300';
                return (
                  <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${colorClass}`}>
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{metodo.metodo}</span>
                    </div>
                    <span className="font-black text-lg text-slate-900 dark:text-white">S/ {metodo.total.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">No hay registros de pago</p>
          )}
        </div>

        {/* Top Productos */}
        <div className="bg-white dark:bg-[#0B1120] rounded-[2rem] p-8 shadow-sm border border-slate-200/60 dark:border-slate-800/60">
          <h2 className="text-xl font-bold text-primary mb-6">Top Productos Vendidos</h2>
          {estadisticas?.top_productos && estadisticas.top_productos.length > 0 ? (
            <div className="space-y-4">
              {estadisticas.top_productos.map((prod: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm">
                      {i + 1}
                    </div>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{prod.nombre}</span>
                  </div>
                  <div className="text-right">
                    <span className="block font-black text-slate-900 dark:text-white">{prod.cantidad} unid.</span>
                    <span className="block text-xs font-semibold text-slate-500">S/ {prod.total.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">No hay ventas registradas</p>
          )}
        </div>
      </div>
    </div>
  );
}

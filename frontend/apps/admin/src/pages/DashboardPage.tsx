import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEventStore } from '../stores/eventStore';
import { useAuthStore } from '../stores/authStore';
import { Upload, Users, DollarSign, Calendar, Edit2, CheckCircle2, Package, Layers, ShoppingCart, Activity, ChevronRight, Settings, Building2, MoreVertical, Trash2, Plus, UserPlus, Palette, Copy, RefreshCw, Clock3, WalletCards, TrendingUp } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_TOOLTIP_CONTENT_STYLE, CHART_TOOLTIP_ITEM_STYLE, CHART_TOOLTIP_LABEL_STYLE } from '../lib/chartTheme';
import api from '../services/api';
import { toast } from 'sonner';
import { NuevoEventoModal } from '../components/NuevoEventoModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { eventoService } from '../services/eventoService';
import { SuperAdminQuickCreate } from '../components/SuperAdminQuickCreate';
import type { QuickCreateType } from '../components/SuperAdminQuickCreate';
import { TransparentLogo } from '../components/ui/TransparentLogo';
import { removeImageBackground } from '../lib/removeImageBackground';

const PAYMENT_METHOD_COLORS = {
  yape: '#a855f7',
  plin: '#06b6d4',
  efectivo: '#10b981',
  tarjeta: '#3b82f6',
} as const;

const getPaymentMethodColor = (method: string, configuredColor?: string) => {
  if (configuredColor && /^#[0-9a-f]{6}$/i.test(configuredColor)) return configuredColor;

  const legacyColor = configuredColor?.toLowerCase() || '';
  if (legacyColor.includes('purple')) return PAYMENT_METHOD_COLORS.yape;
  if (legacyColor.includes('cyan')) return PAYMENT_METHOD_COLORS.plin;
  if (legacyColor.includes('emerald')) return PAYMENT_METHOD_COLORS.efectivo;
  if (legacyColor.includes('blue')) return PAYMENT_METHOD_COLORS.tarjeta;
  if (legacyColor.includes('amber')) return '#f59e0b';

  const normalizedMethod = method.toLowerCase();
  const matchingMethod = Object.entries(PAYMENT_METHOD_COLORS).find(([name]) => normalizedMethod.includes(name));
  return matchingMethod?.[1] || '#64748b';
};

const getReadableTextColor = (hexColor: string) => {
  const [red, green, blue] = hexColor.slice(1).match(/.{2}/g)!.map(value => Number.parseInt(value, 16));
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance > 150 ? '#0f172a' : '#ffffff';
};

const getSaleCashier = (sale: any) => sale.cajero_nombre || sale.usuario_nombre || 'Administrador';

const filterSalesByCashier = (sales: any[], cashier: string) => cashier === 'TODOS'
  ? sales
  : sales.filter((sale) => getSaleCashier(sale) === cashier);

function ChartCashierFilter({ value, onChange, label, cashiers }: { value: string; onChange: (value: string) => void; label: string; cashiers: string[] }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} className="h-9 max-w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
      <option value="TODOS">Todos los cajeros</option>
      {cashiers.map((cashier) => <option key={cashier} value={cashier}>{cashier}</option>)}
    </select>
  );
}

export function DashboardPage() {
  const { currentEvent, fetchCurrentEvent } = useEventStore();
  const { user } = useAuthStore();
  const [isUploading, setIsUploading] = useState(false);
  const [globalStats, setGlobalStats] = useState<any[]>([]);
  const [globalMetrics, setGlobalMetrics] = useState({ ventas: 0, productos: 0 });
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);
  const [eventoToEdit, setEventoToEdit] = useState<any>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: number | null}>({ isOpen: false, id: null });
  const [ventasEvento, setVentasEvento] = useState<any[]>([]);
  const [eventSummary, setEventSummary] = useState<any>({ total_ingresos: 0, transacciones: 0, productos_vendidos: 0, ventas_por_metodo: [] });
  const [loadingEventDashboard, setLoadingEventDashboard] = useState(false);
  const [lastDashboardUpdate, setLastDashboardUpdate] = useState<Date | null>(null);
  const [hourlyCashier, setHourlyCashier] = useState('TODOS');
  const [paymentCashier, setPaymentCashier] = useState('TODOS');
  const [productCashier, setProductCashier] = useState('TODOS');
  const [comboCashier, setComboCashier] = useState('TODOS');
  const [quickCreate, setQuickCreate] = useState<QuickCreateType>(null);
  const navigate = useNavigate();

  const fetchEventDashboard = async (silent = false) => {
    if (!silent) setLoadingEventDashboard(true);
    try {
      const [summaryResponse, salesResponse] = await Promise.all([
        api.get('/dashboard/resumen'),
        api.get('/ventas'),
      ]);
      setEventSummary(summaryResponse.data || {});
      setVentasEvento(salesResponse.data || []);
      setLastDashboardUpdate(new Date());
    } catch (err) {
      console.error('Error al cargar el dashboard del evento', err);
      if (!silent) toast.error('No se pudieron actualizar las métricas del evento');
    } finally {
      if (!silent) setLoadingEventDashboard(false);
    }
  };

  useEffect(() => {
    if (user?.rol === 'SUPER_ADMIN') {
      fetchGlobalDashboard();
    } else {
      fetchCurrentEvent();
      fetchEventDashboard();
      const refreshInterval = window.setInterval(() => {
        fetchCurrentEvent();
        fetchEventDashboard(true);
      }, 15_000);
      const refreshOnFocus = () => {
        fetchCurrentEvent();
        fetchEventDashboard(true);
      };
      window.addEventListener('focus', refreshOnFocus);
      return () => {
        window.clearInterval(refreshInterval);
        window.removeEventListener('focus', refreshOnFocus);
      };
    }
  }, [user, fetchCurrentEvent]);

  const ventasRecientes = useMemo(() => ventasEvento.slice(0, 5), [ventasEvento]);

  const cashierOptions = useMemo(() => Array.from(new Set(ventasEvento.map(getSaleCashier))).sort((a, b) => a.localeCompare(b, 'es')), [ventasEvento]);

  const allCashierPerformance = useMemo(() => {
    const cashiers = new Map<string, { nombre: string; total: number; ventas: number }>();
    ventasEvento.forEach((sale) => {
      const nombre = sale.cajero_nombre || sale.usuario_nombre || 'Administrador';
      const current = cashiers.get(nombre) || { nombre, total: 0, ventas: 0 };
      current.total += Number(sale.total || sale.monto || sale.importe || 0);
      current.ventas += 1;
      cashiers.set(nombre, current);
    });
    return Array.from(cashiers.values()).sort((a, b) => b.total - a.total);
  }, [ventasEvento]);

  const hourlySales = useMemo(() => {
    const peruvianHour = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Lima', hour: '2-digit', hourCycle: 'h23' });
    const hours = new Map<number, { hora: string; total: number; ventas: number }>();
    filterSalesByCashier(ventasEvento, hourlyCashier).forEach((sale) => {
      const saleDate = new Date(sale.fecha_hora || sale.created_at || sale.fecha || '');
      if (Number.isNaN(saleDate.getTime())) return;
      const hour = Number(peruvianHour.format(saleDate));
      const current = hours.get(hour) || { hora: `${String(hour).padStart(2, '0')}:00`, total: 0, ventas: 0 };
      current.total += Number(sale.total || sale.monto || sale.importe || 0);
      current.ventas += 1;
      hours.set(hour, current);
    });
    return Array.from(hours.entries()).sort(([firstHour], [secondHour]) => firstHour - secondHour).map(([, value]) => value);
  }, [ventasEvento, hourlyCashier]);

  const paymentSales = useMemo(() => {
    const methods = new Map<string, { name: string; value: number; color: string }>();
    filterSalesByCashier(ventasEvento, paymentCashier).forEach((sale) => {
      const name = sale.metodo_pago || 'Sin método';
      const current = methods.get(name) || { name, value: 0, color: getPaymentMethodColor(name, sale.metodo_pago_color) };
      current.value += Number(sale.total || sale.monto || sale.importe || 0);
      methods.set(name, current);
    });
    return Array.from(methods.values()).sort((a, b) => b.value - a.value);
  }, [ventasEvento, paymentCashier]);

  const topProducts = useMemo(() => {
    const products = new Map<string, { nombre: string; cantidad: number; total: number }>();
    filterSalesByCashier(ventasEvento, productCashier).forEach((sale) => {
      (sale.detalles || sale.detalles_venta || sale.items || []).filter((detail: any) => !detail.es_parte_combo).forEach((detail: any) => {
        const key = String(detail.id_producto || detail.producto_nombre || detail.nombre);
        const current = products.get(key) || { nombre: detail.producto_nombre || detail.nombre || 'Producto', cantidad: 0, total: 0 };
        current.cantidad += Number(detail.cantidad || 0);
        current.total += Number(detail.subtotal || (Number(detail.precio_unitario || 0) * Number(detail.cantidad || 0)));
        products.set(key, current);
      });
    });
    return Array.from(products.values()).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);
  }, [ventasEvento, productCashier]);

  const topCombos = useMemo(() => {
    const combos = new Map<string, { nombre: string; cantidad: number; total: number }>();
    filterSalesByCashier(ventasEvento, comboCashier).forEach((sale) => {
      (sale.combos || []).forEach((combo: any) => {
        const key = String(combo.id_combo || combo.combo_nombre || combo.nombre);
        const current = combos.get(key) || { nombre: combo.combo_nombre || combo.nombre || 'Combo', cantidad: 0, total: 0 };
        current.cantidad += Number(combo.cantidad || 0);
        current.total += Number(combo.subtotal_combo || (Number(combo.precio_unitario_combo || 0) * Number(combo.cantidad || 0)));
        combos.set(key, current);
      });
    });
    return Array.from(combos.values()).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);
  }, [ventasEvento, comboCashier]);

  const fetchGlobalDashboard = async () => {
    setLoadingGlobal(true);
    try {
      const res = await api.get('/superadmin/dashboard');
      setGlobalStats(res.data.eventos || []);
      setGlobalMetrics({
        ventas: res.data.ventasTotales || 0,
        productos: res.data.productosVendidosTotales || 0
      });
    } catch (err) {
      console.error('Error al cargar dashboard global', err);
      toast.error('Error cargando estadísticas globales');
    } finally {
      setLoadingGlobal(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await eventoService.eliminarEvento(deleteConfirm.id);
      toast.success('Evento eliminado correctamente');
      fetchGlobalDashboard();
    } catch {
      toast.error('Error al eliminar el evento');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentEvent) return;

    try {
      setIsUploading(true);
      const image = await removeImageBackground(file);
      await api.post('/evento/configuracion/logo', { logo_base64: image.processed });
      toast.success(image.removed ? 'Logo actualizado y fondo eliminado' : 'Logo actualizado exitosamente');
      fetchCurrentEvent();
    } catch {
      toast.error('Error al actualizar el logo');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const copyCashCode = async () => {
    if (!currentEvent?.codigo_caja) return toast.error('Este evento no tiene código de caja');
    try {
      await navigator.clipboard.writeText(currentEvent.codigo_caja);
      toast.success('Código de caja copiado');
    } catch {
      toast.error('No se pudo copiar el código de caja');
    }
  };
  if (user?.rol === 'SUPER_ADMIN') {
    return (
      <div className="w-full space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4">
          <div>
            <h1 className="text-[2rem] font-bold text-balance text-primary">Dashboard Global</h1>
            <p className="text-sm text-pretty text-slate-500 mt-1 font-medium">Supervisión general y analítica de todos los eventos del sistema.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => { setEventoToEdit(null); setIsNewEventModalOpen(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90">
              <Plus className="size-4" /> Crear evento
            </button>
            <button onClick={() => setQuickCreate('admin')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-secondary/30 bg-secondary/10 px-4 py-2.5 text-sm font-semibold text-secondary shadow-sm hover:bg-secondary/15 dark:border-secondary/40 dark:bg-secondary/15 dark:hover:bg-secondary/25">
              <UserPlus className="size-4" /> Crear administrador
            </button>
            <button onClick={() => setQuickCreate('palette')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm font-semibold text-accent shadow-sm hover:bg-accent/15 dark:border-accent/40 dark:bg-accent/15 dark:hover:bg-accent/25">
              <Palette className="size-4" /> Crear paleta
            </button>
            <button onClick={() => navigate('/eventos')} aria-label="Abrir gestión de eventos" className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
              <Settings className="size-4" />
            </button>
          </div>
        </div>

        {loadingGlobal ? (
          <div className="flex items-center justify-center p-20 text-primary">
            <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Event Cards */}
            {globalStats.map((evt) => {
              const colorBase = evt.color_primario_base || '#3b82f6';
              return (
              <div 
                key={evt.id_evento} 
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 flex flex-col hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700 transition-colors duration-200 relative group"
                style={{ '--tw-shadow-color': `${colorBase}30`, shadowColor: `${colorBase}30` } as React.CSSProperties}
              >
                {/* Subtle Decorative Gradient on Hover */}
                <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none" style={{ backgroundImage: `linear-gradient(to bottom left, ${colorBase}, transparent)` }}></div>

                <div className="flex items-start justify-between mb-6 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700 overflow-hidden p-1.5">
                      {evt.logo_url ? (
                        <TransparentLogo src={evt.logo_url} alt="Logo" className="size-full object-contain" />
                      ) : (
                        <Building2 className="w-6 h-6 text-slate-400 group-hover:opacity-80 transition-opacity" style={{ color: colorBase }} />
                      )}
                    </div>
                    <div className="flex flex-col items-start">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-[13px] uppercase" style={{ color: colorBase }}>{evt.nombre}</h3>
                      <span className={`text-[9px] font-black tracking-widest uppercase mt-1 px-3 py-1 rounded-full`} style={{ backgroundColor: `${colorBase}20`, color: colorBase }}>
                        {evt.codigo_caja || 'S/C'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <button 
                      onClick={() => setOpenMenuId(openMenuId === evt.id_evento ? null : evt.id_evento)} 
                      aria-label={`Abrir acciones de ${evt.nombre}`}
                      aria-expanded={openMenuId === evt.id_evento}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <MoreVertical className="size-5" />
                    </button>
                  </div>
                </div>

                {openMenuId === evt.id_evento && (
                  <div className="relative z-10 mb-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-950/50">
                    <button
                      type="button"
                      onClick={() => { setEventoToEdit(evt); setIsNewEventModalOpen(true); setOpenMenuId(null); }}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <Edit2 className="size-4 text-secondary" /> Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDeleteConfirm({ isOpen: true, id: evt.id_evento }); setOpenMenuId(null); }}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm font-bold text-red-600 shadow-sm hover:bg-red-50 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="size-4" /> Eliminar
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
                  <div className="rounded-xl p-4 flex flex-col items-center justify-center border border-slate-100 dark:border-slate-800">
                    <Users className="w-5 h-5 text-slate-400 mb-2 transition-colors duration-300" style={{ color: colorBase }} strokeWidth={1.5} />
                    <span className="text-2xl font-bold text-slate-800 dark:text-white leading-none tabular-nums">{evt.total_cajeros || 0}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2 transition-colors" style={{ color: colorBase }}>Cajeros</span>
                  </div>
                  <div className="rounded-xl p-4 flex flex-col items-center justify-center border border-slate-100 dark:border-slate-800">
                    <Package className="w-5 h-5 text-slate-400 mb-2 transition-colors duration-300" style={{ color: colorBase }} strokeWidth={1.5} />
                    <span className="text-2xl font-bold text-slate-800 dark:text-white leading-none tabular-nums">{evt.total_cajas || 0}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2 transition-colors" style={{ color: colorBase }}>Cajas</span>
                  </div>
                  <div className="rounded-xl p-4 flex flex-col items-center justify-center border border-slate-100 dark:border-slate-800">
                    <ShoppingCart className="w-5 h-5 text-slate-400 mb-2 transition-colors duration-300" style={{ color: colorBase }} strokeWidth={1.5} />
                    <span className="text-2xl font-bold text-slate-800 dark:text-white leading-none tabular-nums">{evt.total_productos || 0}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2 transition-colors" style={{ color: colorBase }}>Productos</span>
                  </div>
                  <div className="rounded-xl p-4 flex flex-col items-center justify-center border border-slate-100 dark:border-slate-800">
                    <Layers className="w-5 h-5 text-slate-400 mb-2 transition-colors duration-300" style={{ color: colorBase }} strokeWidth={1.5} />
                    <span className="text-2xl font-bold text-slate-800 dark:text-white leading-none tabular-nums">{evt.total_categorias || 0}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2 transition-colors" style={{ color: colorBase }}>Categorías</span>
                  </div>
                </div>

                <div className="mt-auto relative z-10">
                  <button 
                    onClick={() => navigate(`/eventos/${evt.id_evento}/dashboard`)}
                    className="w-full py-3 rounded-xl border border-slate-200 text-slate-500 font-bold text-xs transition-all duration-300 flex items-center justify-center gap-1 shadow-sm hover:shadow-md"
                    style={{ backgroundColor: colorBase, color: 'white', borderColor: colorBase }}
                  >
                    Gestionar Detalles
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
              )
            })}

            {/* Crear Nuevo Evento Card */}
            <button
              type="button"
              onClick={() => { setEventoToEdit(null); setIsNewEventModalOpen(true); }}
              className="min-h-[380px] h-full rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/40 p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 dark:hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="size-12 rounded-full bg-slate-200/60 flex items-center justify-center mb-5 text-slate-600">
                <Plus className="size-5" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white text-[15px] mb-2">Crear Nuevo Evento</h3>
              <p className="text-[11px] text-slate-500 max-w-[200px] leading-relaxed font-medium">Configura una nueva unidad de negocio o evento temporal en el sistema.</p>
            </button>

            {/* Rendimiento Consolidado */}
            <div className="col-span-1 lg:col-span-3 bg-[#131B2B] rounded-xl p-8 flex justify-between items-center relative overflow-hidden shadow-lg mt-2">
              <div className="relative z-10">
                <p className="text-white text-xs font-bold mb-6 tracking-widest">RENDIMIENTO CONSOLIDADO</p>
                <div className="flex gap-12 sm:gap-16">
                  <div>
                    <p className="text-white/50 text-[10px] font-bold uppercase tracking-wider mb-2">Ventas Totales</p>
                    <p className="text-3xl sm:text-4xl font-black text-white">S/ {globalMetrics.ventas.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-[10px] font-bold uppercase tracking-wider mb-2">Productos Vendidos</p>
                    <p className="text-3xl sm:text-4xl font-black text-white">{globalMetrics.productos}</p>
                  </div>
                </div>
              </div>
              <Activity className="w-48 h-48 text-white/5 absolute -right-6 top-1/2 -translate-y-1/2" strokeWidth={1} />
            </div>


          </div>
        )}

        <NuevoEventoModal 
          isOpen={isNewEventModalOpen} 
          onClose={() => { setIsNewEventModalOpen(false); setEventoToEdit(null); }} 
          onSuccess={fetchGlobalDashboard} 
          eventoToEdit={eventoToEdit}
        />

        <SuperAdminQuickCreate
          type={quickCreate}
          onClose={() => setQuickCreate(null)}
          onCreated={fetchGlobalDashboard}
        />

        <ConfirmModal
          isOpen={deleteConfirm.isOpen}
          onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
          onConfirm={handleDelete}
          title="Eliminar Evento"
          message="¿Estás seguro de que deseas eliminar este evento? Esta acción no se puede deshacer y eliminará todas las cajas, productos y ventas asociadas."
          isDestructive={true}
          confirmText="Sí, Eliminar"
        />
      </div>
    );
  }

  // --- DASHBOARD ADMIN EVENTO ---
  if (!currentEvent) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full"></div>
        <p className="text-slate-500 font-medium tracking-wide">Cargando información de tu evento...</p>
      </div>
    );
  }

  return (
    <div className="event-admin w-full space-y-8 pb-10">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div>
          <h1 className="event-page-title">Dashboard de Evento</h1>
          <p className="event-page-description">Visualiza las métricas y gestiona {currentEvent.nombre} en tiempo real.</p>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm dark:border-white/20 dark:bg-[#0B1120]">
            <span className={`size-2.5 rounded-full ${currentEvent.estado === 'ACTIVO' ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">{currentEvent.estado}</span>
            <span className="hidden text-xs text-slate-400 sm:inline">· actualización automática</span>
          </div>
          <button
            type="button"
            onClick={() => Promise.all([fetchCurrentEvent(), fetchEventDashboard()])}
            disabled={loadingEventDashboard}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-[#0B1120] dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`size-4 ${loadingEventDashboard ? 'animate-spin' : ''}`} />
            {loadingEventDashboard ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Información principal del evento */}
      <section className="event-card relative flex w-full flex-col overflow-hidden">
        <div className="h-28 bg-secondary sm:h-32" />
        <div className="relative flex flex-1 flex-col p-5 pt-0 sm:p-8 sm:pt-0">
          <div className="group relative -mt-10 mb-6 flex size-20 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-white p-1.5 shadow-md dark:border-white/30 dark:bg-[#0B1120]">
            {currentEvent.logo_url ? (
              <TransparentLogo src={currentEvent.logo_url} alt={`Logo de ${currentEvent.nombre}`} className="size-full object-contain" />
            ) : (
              <div className="flex size-full items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                <Building2 className="size-8 text-slate-300" />
              </div>
            )}
            <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <Upload className="mb-1 size-5" />
              <span className="text-xs font-bold">Cambiar logo</span>
              <input type="file" className="sr-only" accept="image/*" onChange={handleLogoUpload} disabled={isUploading} aria-label="Cambiar logo del evento" />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-bold uppercase text-slate-400">Nombre del evento</p>
              <p className="truncate text-lg font-black uppercase text-slate-900 dark:text-white" title={currentEvent.nombre}>{currentEvent.nombre}</p>
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-bold uppercase text-slate-400">Código de caja</p>
              <button type="button" onClick={copyCashCode} className="inline-flex max-w-full items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-primary hover:bg-primary/15" title="Copiar código de caja">
                <code className="truncate text-sm font-bold">{currentEvent.codigo_caja || 'Sin código'}</code>
                <Copy className="size-4 shrink-0" />
                <span className="sr-only">Copiar código de caja</span>
              </button>
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-bold uppercase text-slate-400">Fecha programada</p>
              <div className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300">
                <Calendar className="mr-2 size-4 shrink-0 text-primary" />
                <span className="truncate">{new Date(currentEvent.fecha_evento).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center border-t border-slate-100 pt-5 dark:border-white/10">
            <span className="text-xs text-slate-400">Última actualización: {lastDashboardUpdate ? lastDashboardUpdate.toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'pendiente'}</span>
          </div>
        </div>
      </section>

      <section className="event-card p-6" aria-labelledby="dashboard-quick-actions-title">
        <h2 id="dashboard-quick-actions-title" className="mb-4 text-balance text-sm font-black text-slate-800 dark:text-white">Acciones rápidas</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <button type="button" onClick={() => navigate('/reportes')} className="group flex w-full items-center justify-between rounded-xl border border-slate-100 p-3 text-left hover:border-primary/40 hover:shadow-sm dark:border-white/10">
            <span className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Activity className="size-5" /></span><span className="min-w-0"><span className="block truncate text-xs font-bold text-slate-800 dark:text-white">Generar reporte</span><span className="mt-0.5 block truncate text-xs text-slate-400">Consultar e imprimir ventas</span></span></span><ChevronRight className="size-4 shrink-0 text-slate-300 group-hover:text-primary" />
          </button>
          <button type="button" onClick={() => navigate('/cajeros')} className="group flex w-full items-center justify-between rounded-xl border border-slate-100 p-3 text-left hover:border-primary/40 hover:shadow-sm dark:border-white/10">
            <span className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Users className="size-5" /></span><span className="min-w-0"><span className="block truncate text-xs font-bold text-slate-800 dark:text-white">Asignar personal</span><span className="mt-0.5 block truncate text-xs text-slate-400">Vincular nuevos cajeros</span></span></span><ChevronRight className="size-4 shrink-0 text-slate-300 group-hover:text-primary" />
          </button>
          <button type="button" onClick={() => navigate('/productos')} className="group flex w-full items-center justify-between rounded-xl border border-slate-100 p-3 text-left hover:border-primary/40 hover:shadow-sm dark:border-white/10">
            <span className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Edit2 className="size-5" /></span><span className="min-w-0"><span className="block truncate text-xs font-bold text-slate-800 dark:text-white">Editar precios</span><span className="mt-0.5 block truncate text-xs text-slate-400">Modificar costos de productos</span></span></span><ChevronRight className="size-4 shrink-0 text-slate-300 group-hover:text-primary" />
          </button>
        </div>
      </section>

      {/* Grid de Stats - Top Metrics (Wireframe Style) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Card 1: Ingresos (Dark theme) */}
        <div className="event-card event-stat-card p-5 flex flex-col justify-between group">
          <div className="event-stat-icon mb-4">
            <DollarSign className="size-4" />
          </div>
          <div>
            <p className="event-stat-label">Ingresos Totales</p>
            <p className="event-stat-value tabular-nums">S/ {Number(eventSummary.total_ingresos || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
        
        {/* Card 2: Órdenes Pagadas */}
        <div className="event-card event-stat-card p-5 flex flex-col justify-between group">
          <div className="event-stat-icon mb-4">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <p className="event-stat-label">Ventas Registradas</p>
            <p className="event-stat-value tabular-nums">{Number(eventSummary.transacciones || 0)}</p>
          </div>
        </div>
        
        {/* Card 3: Ticket Promedio */}
        <div className="event-card event-stat-card p-5 flex flex-col justify-between group">
          <div className="event-stat-icon mb-4">
            <DollarSign className="size-4" />
          </div>
          <div>
            <p className="event-stat-label">Ticket Promedio</p>
            <p className="event-stat-value tabular-nums">S/ {eventSummary.transacciones ? (Number(eventSummary.total_ingresos) / Number(eventSummary.transacciones)).toFixed(2) : '0.00'}</p>
          </div>
        </div>
        
        {/* Card 4: Cajeros con ventas */}
        <div className="event-card event-stat-card p-5 flex flex-col justify-between group">
          <div className="event-stat-icon mb-4">
            <Users className="size-4" />
          </div>
          <div>
            <p className="event-stat-label">Cajeros con Ventas</p>
            <p className="event-stat-value tabular-nums">{allCashierPerformance.length}</p>
          </div>
        </div>
        
        {/* Card 5: Unidades vendidas */}
        <div className="event-card event-stat-card p-5 flex flex-col justify-between group">
          <div className="event-stat-icon mb-4">
            <ShoppingCart className="size-4" />
          </div>
          <div>
            <p className="event-stat-label">Unidades Vendidas</p>
            <p className="event-stat-value tabular-nums">{Number(eventSummary.productos_vendidos || 0)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="event-card p-5 lg:col-span-2" aria-labelledby="hourly-sales-title">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="event-stat-icon flex size-10 shrink-0 items-center justify-center rounded-xl"><TrendingUp className="size-5" /></div>
              <div>
                <h2 id="hourly-sales-title" className="text-balance text-sm font-black text-slate-800 dark:text-white">Ingresos por hora</h2>
                <p className="mt-0.5 text-pretty text-xs text-slate-400">Evolución de todas las ventas del evento</p>
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
              <ChartCashierFilter value={hourlyCashier} onChange={setHourlyCashier} label="Filtrar ingresos por cajero" cashiers={cashierOptions} />
              <p className="text-xs font-semibold text-slate-400">Hora de Perú</p>
            </div>
          </div>
          <div className="h-72 min-w-0">
            {hourlySales.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlySales} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
                  <XAxis dataKey="hora" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(value) => `S/${value}`} />
                  <Tooltip formatter={(value) => [`S/ ${Number(value).toFixed(2)}`, 'Ingresos']} labelFormatter={(label) => `${label} (Perú)`} contentStyle={CHART_TOOLTIP_CONTENT_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} />
                  <Area type="monotone" dataKey="total" stroke="var(--event-primary)" fill="var(--event-primary)" fillOpacity={0.14} strokeWidth={3} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center text-slate-400"><Clock3 className="mb-3 size-8" /><p className="font-bold">Aún no hay ventas por hora</p><p className="mt-1 text-sm">El gráfico aparecerá con la primera venta.</p></div>
            )}
          </div>
        </section>

        <section className="event-card p-5" aria-labelledby="payment-sales-title">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="event-stat-icon flex size-10 shrink-0 items-center justify-center rounded-xl"><WalletCards className="size-5" /></div>
              <div>
                <h2 id="payment-sales-title" className="text-balance text-sm font-black text-slate-800 dark:text-white">Métodos de pago</h2>
                <p className="mt-0.5 text-pretty text-xs text-slate-400">Distribución de ingresos</p>
              </div>
            </div>
            <ChartCashierFilter value={paymentCashier} onChange={setPaymentCashier} label="Filtrar métodos de pago por cajero" cashiers={cashierOptions} />
          </div>
          <div className="h-72">
            {paymentSales.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentSales} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={4}>
                    {paymentSales.map((entry: any) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(value) => `S/ ${Number(value).toFixed(2)}`} contentStyle={CHART_TOOLTIP_CONTENT_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center text-slate-400"><WalletCards className="mb-3 size-8" /><p className="font-bold">Sin métodos utilizados</p><p className="mt-1 text-sm">Aquí verás cómo pagan tus clientes.</p></div>
            )}
          </div>
          <div className="space-y-2">
            {paymentSales.map((method: any) => (
              <div key={method.name} className="flex items-center justify-between gap-3 text-xs"><span className="flex min-w-0 items-center gap-2 font-bold text-slate-600 dark:text-slate-300"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: method.color }} /><span className="truncate">{method.name}</span></span><span className="shrink-0 font-black tabular-nums text-slate-800 dark:text-white">S/ {method.value.toFixed(2)}</span></div>
            ))}
          </div>
        </section>

        <section className="event-card p-5 lg:col-span-3" aria-labelledby="cashier-performance-title">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="event-stat-icon flex size-10 shrink-0 items-center justify-center rounded-xl"><Users className="size-5" /></div>
              <div>
                <h2 id="cashier-performance-title" className="text-balance text-sm font-black text-slate-800 dark:text-white">Ventas por cajero</h2>
                <p className="mt-0.5 text-pretty text-xs text-slate-400">Monto y cantidad de ventas registradas por cada persona</p>
              </div>
            </div>
          </div>
          <div className="h-72 min-w-0">
            {allCashierPerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={allCashierPerformance} layout="vertical" margin={{ top: 0, right: 16, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(value) => `S/${value}`} />
                  <YAxis type="category" dataKey="nombre" width={90} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip formatter={(value, name) => name === 'total' ? [`S/ ${Number(value).toFixed(2)}`, 'Ingresos'] : [value, 'Ventas']} contentStyle={CHART_TOOLTIP_CONTENT_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} />
                  <Bar dataKey="total" fill="var(--event-primary)" radius={[0, 8, 8, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center text-slate-400"><Users className="mb-3 size-8" /><p className="font-bold">Sin actividad de cajeros</p><p className="mt-1 text-sm">Los montos se separarán por cajero.</p></div>
            )}
          </div>
          {allCashierPerformance.length > 0 && (
            <div className="mt-4 grid max-h-40 grid-cols-1 gap-2 overflow-y-auto border-t border-slate-100 pt-4 sm:grid-cols-2 dark:border-slate-800">
              {allCashierPerformance.map((cashier) => (
                <div key={cashier.nombre} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-900/60">
                  <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">{cashier.nombre}</p><p className="mt-0.5 text-xs tabular-nums text-slate-400">{cashier.ventas} {cashier.ventas === 1 ? 'venta' : 'ventas'}</p></div>
                  <p className="shrink-0 text-sm font-black tabular-nums text-primary">S/ {cashier.total.toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 gap-6 lg:col-span-3 md:grid-cols-2">
          <section className="event-card p-5" aria-labelledby="top-products-title">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3"><div className="event-stat-icon flex size-10 shrink-0 items-center justify-center rounded-xl"><Package className="size-5" /></div><div><h2 id="top-products-title" className="text-balance text-sm font-black text-slate-800 dark:text-white">Productos más vendidos</h2><p className="mt-0.5 text-pretty text-xs text-slate-400">Top por unidades vendidas</p></div></div>
              <ChartCashierFilter value={productCashier} onChange={setProductCashier} label="Filtrar productos por cajero" cashiers={cashierOptions} />
            </div>
            <div className="space-y-4">
              {topProducts.length > 0 ? topProducts.map((product, index) => {
                const percentage = (product.cantidad / Math.max(1, topProducts[0].cantidad)) * 100;
                return <div key={product.nombre}><div className="mb-2 flex items-center justify-between gap-3"><span className="truncate text-sm font-bold text-slate-700 dark:text-slate-200">#{index + 1} {product.nombre}</span><span className="shrink-0 text-xs font-black tabular-nums text-primary">{product.cantidad} uds.</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} /></div><p className="mt-1.5 text-right text-xs font-semibold tabular-nums text-slate-400">S/ {product.total.toFixed(2)}</p></div>;
              }) : <div className="flex min-h-56 flex-col items-center justify-center text-center text-slate-400"><Package className="mb-3 size-8" /><p className="font-bold">Sin productos vendidos</p><p className="mt-1 text-sm">No hay productos para el cajero seleccionado.</p></div>}
            </div>
          </section>

          <section className="event-card p-5" aria-labelledby="top-combos-title">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3"><div className="event-stat-icon flex size-10 shrink-0 items-center justify-center rounded-xl"><Layers className="size-5" /></div><div><h2 id="top-combos-title" className="text-balance text-sm font-black text-slate-800 dark:text-white">Combos más vendidos</h2><p className="mt-0.5 text-pretty text-xs text-slate-400">Cada combo cuenta como una unidad</p></div></div>
              <ChartCashierFilter value={comboCashier} onChange={setComboCashier} label="Filtrar combos por cajero" cashiers={cashierOptions} />
            </div>
            <div className="space-y-4">
              {topCombos.length > 0 ? topCombos.map((combo, index) => {
                const percentage = (combo.cantidad / Math.max(1, topCombos[0].cantidad)) * 100;
                return <div key={combo.nombre}><div className="mb-2 flex items-center justify-between gap-3"><span className="truncate text-sm font-bold text-slate-700 dark:text-slate-200">#{index + 1} {combo.nombre}</span><span className="shrink-0 text-xs font-black tabular-nums text-primary">{combo.cantidad} uds.</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} /></div><p className="mt-1.5 text-right text-xs font-semibold tabular-nums text-slate-400">S/ {combo.total.toFixed(2)}</p></div>;
              }) : <div className="flex min-h-56 flex-col items-center justify-center text-center text-slate-400"><Layers className="mb-3 size-8" /><p className="font-bold">Sin combos vendidos</p><p className="mt-1 text-sm">No hay combos para el cajero seleccionado.</p></div>}
            </div>
          </section>
        </div>
      </div>

      <div className="hidden">
        {/* Acciones Rápidas */}
        <div className="event-card flex flex-col p-6">
          <h3 className="text-sm font-black text-slate-800 dark:text-white mb-4">Acciones Rápidas</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            
            <button type="button" onClick={() => navigate('/reportes')} className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-white/10 hover:border-accent/40 hover:shadow-sm transition-all group">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                  <Activity className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-800 dark:text-white">Generar Reporte</p>
                  <p className="text-[10px] text-slate-400">PDF consolidado de ventas</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
            </button>
            
            <button type="button" onClick={() => navigate('/cajeros')} className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-white/10 hover:border-secondary/40 hover:shadow-sm transition-all group">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                  <Users className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-800 dark:text-white">Asignar Personal</p>
                  <p className="text-[10px] text-slate-400">Vincular nuevos cajeros</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
            </button>
            
            <button type="button" onClick={() => navigate('/productos')} className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-white/10 hover:border-primary/40 hover:shadow-sm transition-all group">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-800 dark:text-white">Editar Precios</p>
                  <p className="text-[10px] text-slate-400">Modificar costos de productos</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
            </button>

          </div>
        </div>
      </div>
      
      {/* Ventas Recientes Table */}
      <div className="hidden">
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-white/10 shrink-0">
          <h3 className="text-sm font-black text-slate-800 dark:text-white">Ventas Recientes</h3>
          <button className="text-slate-400 hover:text-slate-600 transition-colors">
            <Activity className="w-4 h-4" />
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="event-data-table responsive-admin-table md:min-w-[700px]">
            <thead className="bg-slate-50 dark:bg-[#0B1120] border-b border-slate-100 dark:border-white/10">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">ID Pedido</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Nombre del Cajero</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Productos</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Método</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {ventasRecientes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <p className="text-sm text-slate-400 font-medium">Aún no hay ventas recientes en este evento.</p>
                  </td>
                </tr>
              ) : (
                ventasRecientes.map((venta, idx) => {
                  const saleNumber = venta.numero_venta || (ventasRecientes.length - idx);
                  const total = Number(venta.total || venta.monto || venta.importe || 0);
                  const metodo = (venta.metodo_pago || 'EFECTIVO').toUpperCase();
                  const metodoColor = getPaymentMethodColor(metodo, venta.metodo_pago_color);
                  
                  const detalles = venta.detalles || venta.detalles_venta || venta.items || [];
                  const detallesStr = detalles.map((d: any) => `${d.cantidad}x ${d.producto_nombre || d.nombre}`).join(', ') || 'Productos Varios';
                  
                  const cajeroNombre = venta.cajero_nombre || venta.usuario_nombre || 'Cajero';
                  const iniciales = cajeroNombre.substring(0,2).toUpperCase();

                  return (
                    <tr key={venta.id_venta ?? idx} className="border-b border-slate-50 dark:border-white/10 hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors">
                      <td data-label="Pedido" className="px-6 py-4">
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200">#ORD-{new Date().getFullYear()}-{String(saleNumber).padStart(3, '0')}</span>
                      </td>
                      <td data-label="Cajero" className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[9px] font-bold">
                            {iniciales}
                          </div>
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{cajeroNombre}</span>
                        </div>
                      </td>
                      <td data-label="Productos" className="px-4 py-4 max-w-[200px]">
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">{detallesStr}</span>
                      </td>
                      <td data-label="Método" className="px-4 py-4">
                        <span
                          className="inline-flex rounded-full px-2 py-0.5 text-[9px] font-black uppercase"
                          style={{ backgroundColor: metodoColor, color: getReadableTextColor(metodoColor) }}
                        >
                          {metodo}
                        </span>
                      </td>
                      <td data-label="Monto" className="px-6 py-4 text-right">
                        <span className="text-sm font-black text-slate-800 dark:text-white">S/ {total.toFixed(2)}</span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}

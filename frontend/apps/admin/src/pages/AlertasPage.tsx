import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Bell,
  BellRing,
  Boxes,
  CheckCircle2,
  Package,
  RefreshCw,
  Search,
  Settings2,
} from 'lucide-react';
import { resolveAssetUrl } from '../lib/assetUrl';
import { useInventoryAlertStore } from '../stores/inventoryAlertStore';

type Filter = 'all' | 'critical' | 'warning' | 'product' | 'combo';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'critical', label: 'Críticas' },
  { value: 'warning', label: 'Stock bajo' },
  { value: 'product', label: 'Productos' },
  { value: 'combo', label: 'Combos' },
];

export function AlertasPage() {
  const navigate = useNavigate();
  const { alerts, isLoading, lastUpdated, error, fetchAlerts } = useInventoryAlertStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => (
    typeof Notification === 'undefined' ? 'denied' : Notification.permission
  ));

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  const criticalCount = alerts.filter((alert) => alert.severity === 'critical').length;
  const lowStockCount = alerts.filter((alert) => alert.severity === 'warning' && alert.kind === 'product').length;
  const affectedCombos = alerts.filter((alert) => alert.kind === 'combo').length;

  const visibleAlerts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');
    return alerts.filter((alert) => {
      const matchesFilter = filter === 'all' || alert.severity === filter || alert.kind === filter;
      const matchesSearch = !term || alert.name.toLocaleLowerCase('es').includes(term)
        || alert.message.toLocaleLowerCase('es').includes(term)
        || alert.affectedBy?.toLocaleLowerCase('es').includes(term);
      return matchesFilter && matchesSearch;
    });
  }, [alerts, filter, search]);

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') {
      toast.error('Este navegador no admite notificaciones del sistema.');
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      toast.success('Notificaciones de inventario activadas.');
      new Notification('Alertas de inventario activadas', {
        body: 'Te avisaremos cuando aparezca una alerta nueva o el stock empeore.',
      });
    } else {
      toast.error('No se concedió permiso para enviar notificaciones.');
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary">
            <BellRing className="size-5" />
            <span className="text-sm font-bold">Inventario en tiempo real</span>
          </div>
          <h1 className="text-balance text-3xl font-black text-slate-900 dark:text-white sm:text-4xl">
            Alertas de inventario
          </h1>
          <p className="mt-2 max-w-2xl text-pretty text-sm text-slate-500 dark:text-slate-400">
            Revisa productos por agotarse y combos afectados antes de que se detengan las ventas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {notificationPermission !== 'granted' && (
            <button
              type="button"
              onClick={enableNotifications}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/25 bg-white px-4 text-sm font-bold text-primary shadow-sm hover:bg-primary/5 dark:bg-slate-900"
            >
              <Bell className="size-4" />
              Activar notificaciones
            </button>
          )}
          <button
            type="button"
            onClick={() => void fetchAlerts()}
            disabled={isLoading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className="size-4" />
            Actualizar
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div><strong>No pudimos sincronizar el inventario.</strong><p className="text-pretty">{error}</p></div>
        </div>
      )}

      <section aria-label="Resumen de alertas" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Alertas activas', value: alerts.length, icon: BellRing, tone: 'text-primary bg-primary/10' },
          { label: 'Críticas', value: criticalCount, icon: AlertTriangle, tone: 'text-red-600 bg-red-50 dark:bg-red-500/15 dark:text-red-400' },
          { label: 'Stock bajo', value: lowStockCount, icon: Package, tone: 'text-amber-600 bg-amber-50 dark:bg-amber-500/15 dark:text-amber-400' },
          { label: 'Combos afectados', value: affectedCombos, icon: Boxes, tone: 'text-sky-600 bg-sky-50 dark:bg-sky-500/15 dark:text-sky-400' },
        ].map((stat) => (
          <article key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-5">
            <div className={`mb-4 flex size-10 items-center justify-center rounded-xl ${stat.tone}`}><stat.icon className="size-5" /></div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{stat.label}</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-slate-900 dark:text-white">{stat.value}</p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="border-b border-slate-100 p-4 dark:border-white/10 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-balance text-lg font-black text-slate-900 dark:text-white">Alertas activas</h2>
              <p className="mt-1 text-pretty text-xs text-slate-500 dark:text-slate-400">
                {lastUpdated
                  ? `Actualizado ${lastUpdated.toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                  : 'Sincronizando inventario…'}
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row">
              <label className="relative min-w-0 lg:w-72">
                <span className="sr-only">Buscar alerta</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar producto o combo"
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                />
              </label>
              <label className="relative min-w-0 lg:w-48">
                <span className="sr-only">Filtrar alertas</span>
                <Settings2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as Filter)}
                  className="min-h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-8 text-sm font-semibold text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200"
                >
                  {FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {isLoading && alerts.length === 0 ? (
            <div className="space-y-3" aria-label="Cargando alertas">
              {[1, 2, 3].map((item) => <div key={item} className="h-28 rounded-2xl bg-slate-100 dark:bg-slate-800" />)}
            </div>
          ) : visibleAlerts.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-4 text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                <CheckCircle2 className="size-7" />
              </div>
              <h3 className="text-balance text-lg font-black text-slate-900 dark:text-white">
                {alerts.length === 0 ? 'Inventario bajo control' : 'No hay coincidencias'}
              </h3>
              <p className="mt-2 max-w-md text-pretty text-sm text-slate-500 dark:text-slate-400">
                {alerts.length === 0
                  ? 'Todos los productos están por encima de su mínimo y los combos tienen disponibilidad suficiente.'
                  : 'Cambia el filtro o limpia la búsqueda para ver otras alertas.'}
              </p>
              <button type="button" onClick={() => alerts.length === 0 ? navigate('/productos') : (setSearch(''), setFilter('all'))} className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white">
                {alerts.length === 0 ? 'Revisar inventario' : 'Limpiar filtros'}
              </button>
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {visibleAlerts.map((alert) => (
                <article key={alert.id} className={`flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center ${alert.severity === 'critical' ? 'border-red-200 bg-red-50/60 dark:border-red-500/25 dark:bg-red-500/5' : 'border-amber-200 bg-amber-50/60 dark:border-amber-500/25 dark:bg-amber-500/5'}`}>
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {alert.imageUrl ? (
                      <img src={resolveAssetUrl(alert.imageUrl)} alt="" className="size-14 shrink-0 rounded-xl border border-white bg-white object-cover shadow-sm dark:border-white/10 dark:bg-slate-800" />
                    ) : (
                      <div className={`flex size-14 shrink-0 items-center justify-center rounded-xl ${alert.severity === 'critical' ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400'}`}>
                        {alert.kind === 'combo' ? <Boxes className="size-6" /> : <Package className="size-6" />}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${alert.severity === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'}`}>
                          {alert.severity === 'critical' ? 'CRÍTICA' : 'STOCK BAJO'}
                        </span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{alert.kind === 'combo' ? 'Combo' : 'Producto'}</span>
                      </div>
                      <h3 className="truncate text-base font-black text-slate-900 dark:text-white">{alert.name}</h3>
                      <p className="mt-1 text-pretty text-sm text-slate-600 dark:text-slate-300">{alert.message}</p>
                      {alert.affectedBy && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Componente limitante: <strong>{alert.affectedBy}</strong></p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-slate-200/70 pt-3 sm:min-w-36 sm:flex-col sm:items-end sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 dark:border-white/10">
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{alert.kind === 'combo' ? 'DISPONIBLES' : 'STOCK ACTUAL'}</p>
                      <p className="text-xl font-black tabular-nums text-slate-900 dark:text-white">{alert.currentStock}</p>
                    </div>
                    <button type="button" onClick={() => navigate(alert.href)} className="rounded-lg border border-primary/25 bg-white px-3 py-2 text-xs font-bold text-primary hover:bg-primary/5 dark:bg-slate-900">
                      Gestionar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

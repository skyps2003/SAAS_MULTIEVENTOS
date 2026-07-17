import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { useEventStore } from '../../stores/eventStore';
import { useInventoryAlertStore } from '../../stores/inventoryAlertStore';
import { inventoryAlertFingerprint } from '../../lib/inventoryAlerts';
import { TransparentLogo } from '../ui/TransparentLogo';
import { toast } from 'sonner';
import { 
  LayoutDashboard, 
  Settings, 
  Package, 
  Layers, 
  BarChart3,
  LogOut,
  Moon,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Users,
  Menu,
  X,
  BellRing,
} from 'lucide-react';

export function Sidebar() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { currentEvent } = useEventStore();
  const inventoryAlerts = useInventoryAlertStore((state) => state.alerts);
  const fetchInventoryAlerts = useInventoryAlertStore((state) => state.fetchAlerts);
  const { isDarkMode, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    catalogos: true,
    inventario: true,
    configuracion: false,
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleMenu = (menu: string) => {
    setOpenMenus(prev => ({ ...prev, [menu]: !prev[menu] }));
  };

  const superAdminLinks = [
    { name: 'Dashboard Global', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Administradores', href: '/administradores', icon: Users },
    { 
      name: 'Catálogos', 
      icon: Layers, 
      key: 'catalogos',
      children: [
        { name: 'Paletas', href: '/paletas' },
        { name: 'Eventos', href: '/eventos' },
      ]
    },
  ];

  const adminEventoLinks = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    {
      name: 'Inventario',
      icon: Package,
      key: 'inventario',
      children: [
        { name: 'Categorías', href: '/categorias' },
        { name: 'Productos', href: '/productos' },
        { name: 'Combos', href: '/combos' },
        { name: 'Alertas', href: '/alertas', badge: inventoryAlerts.length },
      ]
    },
    {
      name: 'Configuración',
      icon: Settings,
      key: 'configuracion',
      children: [
        { name: 'Cajeros', href: '/cajeros' },
        { name: 'Métodos de Pago', href: '/metodos-pago' },
      ]
    },
    { name: 'Reportes', href: '/reportes', icon: BarChart3 },
  ];

  const links = user?.rol === 'SUPER_ADMIN' ? superAdminLinks : adminEventoLinks;

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (user?.rol !== 'ADMIN_EVENTO') return;
    void fetchInventoryAlerts();
    const intervalId = window.setInterval(() => void fetchInventoryAlerts(), 20_000);
    return () => window.clearInterval(intervalId);
  }, [fetchInventoryAlerts, user?.rol, currentEvent?.id_evento]);

  useEffect(() => {
    if (user?.rol !== 'ADMIN_EVENTO' || inventoryAlerts.length === 0) return;

    const storageKey = `inventory-alerts-${currentEvent?.id_evento ?? 'current'}`;
    const currentFingerprints = inventoryAlerts.map(inventoryAlertFingerprint);
    let previousFingerprints: string[] = [];
    try {
      previousFingerprints = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
    } catch {
      previousFingerprints = [];
    }
    const newAlerts = inventoryAlerts.filter((alert) => !previousFingerprints.includes(inventoryAlertFingerprint(alert)));
    sessionStorage.setItem(storageKey, JSON.stringify(currentFingerprints));
    if (newAlerts.length === 0) return;

    const criticalCount = newAlerts.filter((alert) => alert.severity === 'critical').length;
    toast.warning(`${newAlerts.length} alerta${newAlerts.length === 1 ? '' : 's'} nueva${newAlerts.length === 1 ? '' : 's'} de inventario`, {
      description: criticalCount > 0
        ? `${criticalCount} requiere${criticalCount === 1 ? '' : 'n'} atención inmediata.`
        : 'Hay productos o combos con pocas unidades disponibles.',
      action: { label: 'Ver alertas', onClick: () => navigate('/alertas') },
    });

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Alerta de inventario', {
        body: criticalCount > 0
          ? `${criticalCount} alerta${criticalCount === 1 ? '' : 's'} crítica${criticalCount === 1 ? '' : 's'} en ${currentEvent?.nombre || 'el evento'}.`
          : `${newAlerts.length} artículo${newAlerts.length === 1 ? '' : 's'} con stock bajo.`,
      });
    }
  }, [currentEvent?.id_evento, currentEvent?.nombre, inventoryAlerts, navigate, user?.rol]);

  return (
    <>
      {!isMobileOpen && (
        <button type="button" onClick={() => { setIsCollapsed(false); setIsMobileOpen(true); }} aria-label="Abrir menú de administración" className="fixed left-3 top-3 z-30 flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden dark:border-slate-700 dark:bg-[#0B1120] dark:text-white">
          <Menu className="size-5" />
        </button>
      )}
      {isMobileOpen && <button type="button" onClick={() => setIsMobileOpen(false)} aria-label="Cerrar menú de administración" className="fixed inset-0 z-20 bg-black/50 lg:hidden" />}

      <aside className={`fixed left-0 top-0 z-30 flex h-dvh w-72 flex-shrink-0 flex-col rounded-r-3xl border-r border-accent/20 bg-white shadow-lg transition-transform duration-200 dark:border-accent/30 dark:bg-[#0B1120] lg:translate-x-0 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} ${isCollapsed ? 'lg:w-20' : 'lg:w-72'}`}>
        <button type="button" onClick={() => setIsMobileOpen(false)} aria-label="Cerrar menú" className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:hidden dark:hover:bg-slate-800 dark:hover:text-white">
          <X className="size-5" />
        </button>
        
        {/* Botón Colapsar (Estilo Solapa) */}
        <button 
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
          className="absolute -right-[23px] top-1/2 z-30 hidden h-20 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-r-2xl border-y border-r border-accent/30 bg-white text-accent shadow-sm hover:bg-accent/10 lg:flex dark:bg-[#0B1120] dark:hover:bg-accent/15"
          style={{ clipPath: 'inset(-10px -10px -10px 0)' }}
        >
          {/* El borde izquierdo se oculta con el clip-path y posición para crear continuidad */}
          <div className="absolute left-[-2px] top-0 bottom-0 w-[4px] bg-white dark:bg-[#0B1120]"></div>
          {isCollapsed ? <ChevronRight className="size-4 ml-1" /> : <ChevronLeft className="size-4 ml-1" />}
        </button>
        {/* Logo / Event Header */}
        <div className="flex flex-col pt-8 pb-6 px-4 border-b border-slate-100/50 dark:border-white/10 flex-shrink-0 relative">
          <div className="flex flex-col justify-center items-center">
            {!isCollapsed && (
              <>
                <div className="flex items-center justify-center mb-3">
                  {user?.rol === 'SUPER_ADMIN' ? (
                     <TransparentLogo src="/logo-empresa.png" alt="SaaS Eventos" className="size-16 object-contain" />
                  ) : currentEvent?.logo_url ? (
                    <TransparentLogo src={currentEvent.logo_url} alt="Logo Evento" className="size-16 object-contain" />
                  ) : (
                    <div className="size-16 rounded-xl bg-primary flex items-center justify-center shadow-sm">
                      <span className="font-black text-white text-xl">EV</span>
                    </div>
                  )}
                </div>
                <div className="text-center w-full px-2">
                  <h2 className="text-slate-900 dark:text-white font-black text-sm uppercase tracking-wider truncate">
                    {user?.rol === 'SUPER_ADMIN' ? 'SaaS Eventos' : (currentEvent?.nombre || 'Mi Evento')}
                  </h2>
                </div>
              </>
            )}
            {isCollapsed && (
              <div className="flex items-center justify-center w-full">
                {user?.rol === 'SUPER_ADMIN' ? (
                  <TransparentLogo src="/logo-empresa.png" alt="SaaS Eventos" className="size-10 object-contain" />
                ) : currentEvent?.logo_url ? (
                  <TransparentLogo src={currentEvent.logo_url} alt="Logo Evento" className="size-10 object-contain" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm">
                    <span className="font-black text-white text-xs">
                      {user?.rol === 'SUPER_ADMIN' ? 'SE' : 'EV'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
          {links.map((link) => {
            if (link.children) {
              const isOpen = openMenus[link.key];
              const isActiveChild = link.children.some(child => pathname === child.href || pathname.startsWith(child.href + '/'));
              
              return (
                <div key={link.name} className="mb-2">
                  <button
                    onClick={() => {
                      if (isCollapsed) setIsCollapsed(false);
                      toggleMenu(link.key);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-3.5 rounded-2xl transition-colors duration-200
                      ${isActiveChild ? 'bg-accent/10 border border-accent/20 text-accent shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-accent/5 dark:hover:bg-accent/10'}`}
                  >
                    <div className="flex items-center">
                      <link.icon className={`size-5 flex-shrink-0 text-accent ${isCollapsed ? 'mx-auto' : 'mr-3'}`} />
                      {!isCollapsed && <span className="text-sm">{link.name}</span>}
                    </div>
                    {!isCollapsed && (
                      <ChevronDown className={`size-4 text-accent/70 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    )}
                  </button>
                  
                  {!isCollapsed && isOpen && (
                    <div className="mt-1 ml-4 pl-4 border-l-2 border-accent/20 space-y-1">
                      {link.children.map(child => {
                        const badge = 'badge' in child ? Number(child.badge || 0) : 0;
                        return (
                          <NavLink
                            key={child.name}
                            to={child.href}
                            className={({ isActive }) => `flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg transition-colors duration-200 ${
                              isActive 
                                ? 'text-accent font-bold bg-accent/10 border-l-2 border-accent' 
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              {child.href === '/alertas' && <BellRing className="size-4 shrink-0 text-accent" />}
                              <span className="truncate">{child.name}</span>
                            </span>
                            {badge > 0 && <span className="min-w-6 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-black tabular-nums text-white">{badge > 99 ? '99+' : badge}</span>}
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={link.name}
                to={link.href!}
                className={({ isActive }) => `w-full flex items-center px-3 py-3 rounded-xl transition-colors duration-200 mb-2 ${
                  isActive 
                    ? 'text-white font-bold bg-accent shadow-lg shadow-accent/20' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <link.icon className={`size-5 flex-shrink-0 text-inherit ${isCollapsed ? 'mx-auto' : 'mr-3'}`} />
                {!isCollapsed && <span className="text-sm">{link.name}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer (Usuario + Modo Oscuro & Salir) */}
        <div className="p-4 border-t border-slate-100/50 dark:border-white/10 flex-shrink-0 space-y-2">

          {/* Tarjeta de usuario */}
          {!isCollapsed && user && (
            <div className="flex items-center gap-3 px-3 py-3 mb-1 bg-accent/5 dark:bg-accent/10 rounded-2xl border border-accent/20 dark:border-accent/30">
              <div className="size-9 rounded-full bg-accent flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-sm">
                {user.nombre?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-slate-800 dark:text-white truncate leading-tight">{user.nombre}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{(user.rol || '').replace('_', ' ')}</span>
              </div>
            </div>
          )}
          {isCollapsed && user && (
            <div className="flex justify-center mb-1">
              <div className="size-9 rounded-full bg-accent flex items-center justify-center text-white font-black text-sm shadow-sm" title={user.nombre}>
                {user.nombre?.charAt(0).toUpperCase() || 'U'}
              </div>
            </div>
          )}

          {!isCollapsed && (
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-300">
                <Moon className="size-4 mr-3 text-accent" />
                Modo Oscuro
              </div>
              {/* Toggle Switch */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={isDarkMode ? 'Desactivar modo oscuro' : 'Activar modo oscuro'}
                aria-pressed={isDarkMode}
                className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${isDarkMode ? 'bg-accent' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${isDarkMode ? 'right-1 translate-x-0' : 'left-1'}`}></div>
              </button>
            </div>
          )}
          
          <button 
            onClick={handleLogout}
            className={`w-full flex items-center px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 ${isCollapsed ? 'justify-center' : ''}`}
          >
            <LogOut className={`w-5 h-5 flex-shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
            {!isCollapsed && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Espaciador para no solapar el contenido */}
      <div className={`hidden flex-shrink-0 lg:block ${isCollapsed ? 'w-20' : 'w-72'}`}></div>
    </>
  );
}

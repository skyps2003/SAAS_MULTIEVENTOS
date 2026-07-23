import { useEffect, useState, useMemo, useRef } from 'react';
import api from '../services/api';
import { toast } from 'sonner';
import { ShoppingCart, CreditCard, Trash2, Search, X, Image as ImageIcon, Plus, Minus, RefreshCw, LayoutGrid, LogOut, Clock, FileText, Layers, CheckCircle2, Menu, Moon, ChevronRight, ChevronLeft, TrendingUp, Download, CalendarDays, Trophy, WalletCards, FilterX, Phone, Star, Copy } from 'lucide-react';
import { Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { useAuthStore } from '../stores/authStore';
import { useEventStore } from '../stores/eventStore';
import { useThemeStore } from '../stores/themeStore';
import { TransparentLogo } from '../components/ui/TransparentLogo';
import { resolveAssetUrl } from '../lib/assetUrl';

type Producto = {
  id_producto: number;
  nombre: string;
  descripcion?: string;
  precio: number;
  precio_venta?: number;
  stock?: number;
  stock_actual?: number;
  stock_minimo?: number;
  imagen_url?: string | null;
  categoria_nombre?: string | null;
  id_categoria?: number | null;
  categoria_id?: number | null;
};

type Combo = {
  id_combo: number;
  nombre: string;
  descripcion?: string | null;
  precio_combo: number;
  activo?: boolean;
  fecha_inicio?: string;
  fecha_fin?: string | null;
  imagen_url?: string | null;
  capacidad_disponible?: number;
  productos?: Array<{
    id_producto: number;
    nombre: string;
    cantidad: number;
    stock_actual: number;
    imagen_url?: string | null;
  }>;
};

type Linea =
  | { tipo: 'producto'; producto: Producto; cantidad: number }
  | { tipo: 'combo'; combo: Combo; cantidad: number };

const normalizeCombo = (rawCombo: Combo): Combo => {
  const productos = Array.isArray(rawCombo.productos) ? rawCombo.productos : [];
  const capacidadCalculada = productos.length > 0
    ? Math.min(...productos.map((producto) => Math.floor(Number(producto.stock_actual) / Math.max(1, Number(producto.cantidad)))))
    : 0;

  return {
    ...rawCombo,
    productos,
    capacidad_disponible: Number(rawCombo.capacidad_disponible ?? capacidadCalculada),
  };
};

const getSaleDate = (sale: any) => new Date(sale.fecha_hora || sale.created_at || sale.fecha || 0);

const PERU_TIME_ZONE = 'America/Lima';
const peruDateFormatter = new Intl.DateTimeFormat('es-PE', {
  timeZone: PERU_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
const peruCsvDateFormatter = new Intl.DateTimeFormat('es-PE', {
  timeZone: PERU_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const peruTimeFormatter = new Intl.DateTimeFormat('es-PE', {
  timeZone: PERU_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
});
const peruTimeWithSecondsFormatter = new Intl.DateTimeFormat('es-PE', {
  timeZone: PERU_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});
const peruDateKeyFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: PERU_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const getPeruDateKey = (date: Date) => {
  const parts = Object.fromEntries(
    peruDateKeyFormatter.formatToParts(date).map(({ type, value }) => [type, value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const getSaleDetails = (sale: any) => {
  const products = (sale.detalles || sale.detalles_venta || sale.items || [])
    .filter((detail: any) => !detail.es_parte_combo)
    .map((detail: any) => `${detail.cantidad}x ${detail.producto_nombre || detail.nombre || `Producto #${detail.id_producto}`}`);
  const combos = (sale.combos || [])
    .map((combo: any) => `${combo.cantidad}x Combo: ${combo.combo_nombre || combo.nombre || `#${combo.id_combo}`}`);
  return [...products, ...combos].join(' · ');
};

const getPaymentColor = (method: string, configuredColor?: string) => {
  if (configuredColor && /^#[0-9a-f]{6}$/i.test(configuredColor)) return configuredColor;
  const normalized = `${configuredColor || ''} ${method}`.toLowerCase();
  if (normalized.includes('yape') || normalized.includes('purple')) return '#a855f7';
  if (normalized.includes('plin') || normalized.includes('cyan')) return '#06b6d4';
  if (normalized.includes('efectivo') || normalized.includes('emerald')) return '#10b981';
  if (normalized.includes('tarjeta') || normalized.includes('blue')) return '#3b82f6';
  if (normalized.includes('amber')) return '#f59e0b';
  return '#64748b';
};

export function PosPage() {
  const { logout, user } = useAuthStore();
  const { currentEvent } = useEventStore();
  const [activeTab, setActiveTab] = useState<'pos' | 'historial'>('pos');
  const [activeSection, setActiveSection] = useState<'combos' | 'productos'>('combos');

  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { isDarkMode, toggleTheme } = useThemeStore();

  // Pos State
  const [productos, setProductos] = useState<Producto[]>([]);
  const [lastStockUpdate, setLastStockUpdate] = useState<Date | null>(null);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<Linea[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [, setLoadingCombos] = useState(false);

  const [codigoCaja, setCodigoCaja] = useState<string>('');
  const [needCodigo, setNeedCodigo] = useState(false);
  const [ventas, setVentas] = useState<any[]>([]);
  const [loadingVentas, setLoadingVentas] = useState(false);
  const [salesSearch, setSalesSearch] = useState('');
  const [salesCashier, setSalesCashier] = useState('TODOS');
  const [salesMethod, setSalesMethod] = useState('TODOS');
  const [salesItemType, setSalesItemType] = useState('TODOS');
  const [salesItemId, setSalesItemId] = useState('TODOS');
  const [salesDateFrom, setSalesDateFrom] = useState('');
  const [salesDateTo, setSalesDateTo] = useState('');

  // Pago State
  const [metodosPago, setMetodosPago] = useState<any[]>([]);
  const [loadingMetodos, setLoadingMetodos] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedMetodo, setSelectedMetodo] = useState<number | null>(null);
  const [selectedCuentaPago, setSelectedCuentaPago] = useState<number | null>(null);
  const [showNuevaCuenta, setShowNuevaCuenta] = useState(false);
  const [nuevoTitularCuenta, setNuevoTitularCuenta] = useState('');
  const [nuevoNumeroCuenta, setNuevoNumeroCuenta] = useState('');
  const [savingCuenta, setSavingCuenta] = useState(false);
  const [processingSale, setProcessingSale] = useState(false);
  const processingSaleRef = useRef(false);

  const isCajero = user?.rol === 'CAJERO';
  const colorPrimary = currentEvent?.paleta?.color_primario_base || 'var(--event-primary, #526FDF)';
  const colorSecondary = currentEvent?.paleta?.color_secundario_base || 'var(--event-secondary, #D67A50)';
  const colorAccent = currentEvent?.paleta?.color_acento_base || 'var(--event-accent, #5A9B74)';

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedCodigo = localStorage.getItem('codigo_caja');

    if (isCajero) {
      if (savedCodigo) {
        setCodigoCaja(savedCodigo);
        fetchProductos(savedCodigo);
        fetchVentas();
      } else if (token) {
        fetchProductos();
        fetchVentas();
      } else {
        setNeedCodigo(true);
      }
    } else {
      setNeedCodigo(false);
      fetchProductos();
      fetchCategorias();
      fetchCombos();
      fetchMetodosPago();
    }

    if (token && isCajero) {
      fetchMetodosPago();
      fetchCategorias();
      fetchCombos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCajero]);

  const fetchCategorias = async () => {
    try {
      const url = isCajero ? '/caja/categorias' : '/categorias';
      const res = await api.get(url);
      setCategorias(res.data || []);
    } catch (err) {
      console.error('Error fetching categories', err);
    }
  };
 
  const fetchProductos = async (codigo?: string) => {
    setLoading(true);
    try {
      if (codigo && isCajero) {
        // Fetch event info (logo, paleta, nombre) to populate currentEvent
        const resValidacion = await api.post('/caja/validar-codigo', { codigo_evento: codigo });
        if (resValidacion.data?.evento) {
          useEventStore.getState().setCurrentEvent({
            ...resValidacion.data.evento,
            paleta: resValidacion.data.evento.paleta ?? resValidacion.data.paleta ?? null,
          });
        }
      }

      const base = isCajero ? '/caja/productos' : '/productos';
      const url = codigo ? `${base}?codigo_evento=${encodeURIComponent(codigo)}` : base;
      const res = await api.get(url);
      setProductos(res.data || []);
      setLastStockUpdate(new Date());

      if (codigo) {
        localStorage.setItem('codigo_caja', codigo);
        setNeedCodigo(false);
      }
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 401) {
        setNeedCodigo(true);
        toast.error('Acceso no autorizado. Ingresa el código de caja.');
      } else {
        toast.error(err.response?.data?.error || 'Error cargando productos');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (needCodigo) return;

    const refreshStock = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const productUrl = isCajero ? '/caja/productos' : '/productos';
        const comboUrl = isCajero ? '/caja/combos' : '/combos';
        const [productResult, comboResult] = await Promise.allSettled([
          api.get(productUrl),
          api.get(comboUrl),
        ]);

        if (productResult.status === 'fulfilled') setProductos(productResult.value.data || []);
        if (comboResult.status === 'fulfilled') {
          setCombos((comboResult.value.data || []).map(normalizeCombo));
        }
        if (productResult.status === 'fulfilled' || comboResult.status === 'fulfilled') {
          setLastStockUpdate(new Date());
        }
      } catch (error) {
        console.error('Error sincronizando stock del catálogo:', error);
      }
    };

    const intervalId = window.setInterval(refreshStock, 5000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshStock();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isCajero, needCodigo]);

  const fetchMetodosPago = async () => {
    setLoadingMetodos(true);
    try {
      const url = isCajero ? '/caja/metodos-pago' : '/evento/metodos-pago';
      const res = await api.get(url);
      const metodos = Array.isArray(res.data) ? res.data : [];
      setMetodosPago(metodos);
      return metodos;
    } catch (err: any) {
      console.error('Error cargando métodos de pago:', err);
      toast.error(err.response?.data?.error || 'No se pudieron cargar los métodos de pago');
      return [];
    } finally {
      setLoadingMetodos(false);
    }
  };

  const fetchCombos = async () => {
    setLoadingCombos(true);
    try {
      const url = isCajero ? '/caja/combos' : '/combos';
      const res = await api.get(url);
      setCombos((res.data || []).map(normalizeCombo));
    } catch (err: any) {
      console.error('Error cargando combos:', err);
    } finally {
      setLoadingCombos(false);
    }
  };
 
  const fetchVentas = async () => {
    setLoadingVentas(true);
    try {
      const res = await api.get('/ventas');
      setVentas(res.data || []);
    } catch (err: any) {
      console.error('Error cargando ventas:', err);
      toast.error(err.response?.data?.error || 'No se pudieron cargar los movimientos del evento');
    } finally {
      setLoadingVentas(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'historial' || needCodigo) return;

    const intervalId = window.setInterval(fetchVentas, 10000);
    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, needCodigo]);

  const exportarVentas = () => {
    if (ventasFiltradas.length === 0) return toast.info('No hay movimientos para exportar');

    const escapeCsv = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = ventasFiltradas.map((venta) => {
      const fecha = getSaleDate(venta);

      return [
        venta.numero_venta || venta.id_venta,
        Number.isNaN(fecha.getTime()) ? '' : peruCsvDateFormatter.format(fecha),
        Number.isNaN(fecha.getTime()) ? '' : peruTimeFormatter.format(fecha),
        ...(!isCajero ? [venta.cajero_nombre || 'Administrador'] : []),
        getSaleDetails(venta),
        Number(venta.total || 0).toFixed(2),
        venta.cuenta_destino || '',
        venta.cuenta_titular || '',
        venta.metodo_pago || 'Sin método',
      ].map(escapeCsv).join(',');
    });
    const headers = ['N°', 'Fecha', 'Hora', ...(!isCajero ? ['Cajero'] : []), 'Detalle', 'Total', 'Cuenta destino', 'Titular', 'Método'];
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `movimientos-evento-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
 
  const addProductToCart = (p: Producto) => {
    const stock = Number(p.stock_actual ?? p.stock ?? 0);
    if (typeof stock === 'number' && stock <= 0) {
      return toast.error('Producto sin stock disponible');
    }

    const cantidadEnCarrito = cart.find((linea) => linea.tipo === 'producto' && linea.producto.id_producto === p.id_producto)?.cantidad || 0;
    if (cantidadEnCarrito >= stock) {
      return toast.error(`Solo quedan ${stock} unidades de ${p.nombre}`);
    }

    setCart((prev) => {
      const existing = prev.find(l => l.tipo === 'producto' && l.producto.id_producto === p.id_producto);
      if (existing) {
        return prev.map(l => l.tipo === 'producto' && l.producto.id_producto === p.id_producto ? { ...l, cantidad: l.cantidad + 1 } : l);
      }
      return [{ tipo: 'producto', producto: p, cantidad: 1 }, ...prev];
    });
  };

  const addComboToCart = (combo: Combo) => {
    const capacidad = Number(combo.capacidad_disponible ?? 0);
    if (capacidad <= 0) return toast.error('Este combo no tiene stock disponible');

    const cantidadEnCarrito = cart.find((linea) => linea.tipo === 'combo' && linea.combo.id_combo === combo.id_combo)?.cantidad || 0;
    if (cantidadEnCarrito >= capacidad) {
      return toast.error(`Solo se pueden preparar ${capacidad} combos de ${combo.nombre}`);
    }

    setCart((prev) => {
      const existing = prev.find(l => l.tipo === 'combo' && l.combo.id_combo === combo.id_combo);
      if (existing) {
        return prev.map(l => l.tipo === 'combo' && l.combo.id_combo === combo.id_combo ? { ...l, cantidad: l.cantidad + 1 } : l);
      }
      return [{ tipo: 'combo', combo, cantidad: 1 }, ...prev];
    });
  };

  const changeQty = (type: 'producto' | 'combo', id: number, qty: number) => {
    if (type === 'producto') {
      const productoActual = productos.find((producto) => producto.id_producto === id);
      const stockDisponible = Number(productoActual?.stock_actual ?? productoActual?.stock ?? 0);
      const cantidadActual = cart.find((linea) => linea.tipo === 'producto' && linea.producto.id_producto === id)?.cantidad || 0;
      if (qty > cantidadActual && qty > stockDisponible) {
        toast.error(`Solo quedan ${stockDisponible} unidades disponibles`);
        return;
      }
    }

    if (type === 'combo') {
      const comboActual = combos.find((combo) => combo.id_combo === id);
      const capacidadDisponible = Number(comboActual?.capacidad_disponible ?? 0);
      const cantidadActual = cart.find((linea) => linea.tipo === 'combo' && linea.combo.id_combo === id)?.cantidad || 0;
      if (qty > cantidadActual && qty > capacidadDisponible) {
        toast.error(`Solo se pueden preparar ${capacidadDisponible} combos`);
        return;
      }
    }

    setCart(prev => prev.map(l => {
      if (type === 'producto' && l.tipo === 'producto' && l.producto.id_producto === id) {
        return { ...l, cantidad: Math.max(1, qty) };
      }
      if (type === 'combo' && l.tipo === 'combo' && l.combo.id_combo === id) {
        return { ...l, cantidad: Math.max(1, qty) };
      }
      return l;
    }));
  };
 
  const removeLine = (type: 'producto' | 'combo', id: number) => setCart(prev => prev.filter(l => {
    if (type === 'producto' && l.tipo === 'producto') {
      return l.producto.id_producto !== id;
    }
    if (type === 'combo' && l.tipo === 'combo') {
      return l.combo.id_combo !== id;
    }
    return true;
  }));
 
  const subtotal = cart.reduce((s, l) => {
    if (l.tipo === 'producto') {
      return s + (Number(l.producto.precio_venta ?? l.producto.precio) * l.cantidad);
    }
    return s + (Number(l.combo.precio_combo) * l.cantidad);
  }, 0);

  const cashierOptions = useMemo(() => Array.from(new Set(
    ventas.map((sale) => sale.cajero_nombre || 'Administrador')
  )).sort((a, b) => a.localeCompare(b, 'es')), [ventas]);

  const paymentOptions = useMemo(() => Array.from(new Set(
    ventas.map((sale) => sale.metodo_pago || sale.nombre_metodo || sale.metodo || 'Efectivo')
  )).sort((a, b) => a.localeCompare(b, 'es')), [ventas]);

  const productFilterOptions = useMemo(() => {
    const options = new Map<string, string>();
    productos.forEach((product) => options.set(String(product.id_producto), product.nombre));
    ventas.forEach((sale) => {
      (sale.detalles || sale.detalles_venta || sale.items || []).forEach((detail: any) => {
        if (!detail.es_parte_combo) {
          options.set(String(detail.id_producto), detail.producto_nombre || detail.nombre || `Producto #${detail.id_producto}`);
        }
      });
    });
    return Array.from(options, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [productos, ventas]);

  const comboFilterOptions = useMemo(() => {
    const options = new Map<string, string>();
    combos.forEach((combo) => options.set(String(combo.id_combo), combo.nombre));
    ventas.forEach((sale) => {
      (sale.combos || []).forEach((combo: any) => {
        options.set(String(combo.id_combo), combo.combo_nombre || combo.nombre || `Combo #${combo.id_combo}`);
      });
    });
    return Array.from(options, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [combos, ventas]);

  const ventasFiltradas = useMemo(() => {
    const query = salesSearch.trim().toLocaleLowerCase('es');

    return ventas.filter((sale) => {
      const cashier = sale.cajero_nombre || 'Administrador';
      const method = sale.metodo_pago || sale.nombre_metodo || sale.metodo || 'Efectivo';
      const status = (sale.estado || sale.estado_venta || 'COMPLETADO').toUpperCase();
      const hasProducts = (sale.detalles || sale.detalles_venta || sale.items || []).some((detail: any) => !detail.es_parte_combo);
      const hasCombos = (sale.combos || []).length > 0;
      const date = getSaleDate(sale);
      const dateKey = Number.isFinite(date.getTime()) ? getPeruDateKey(date) : '';
      const searchableText = [
        sale.numero_venta,
        sale.id_venta,
        cashier,
        method,
        status,
        sale.referencia_pago,
        getSaleDetails(sale),
      ].join(' ').toLocaleLowerCase('es');

      if (query && !searchableText.includes(query)) return false;
      if (salesCashier !== 'TODOS' && cashier !== salesCashier) return false;
      if (salesMethod !== 'TODOS' && method !== salesMethod) return false;
      if (salesItemType === 'PRODUCTOS' && !hasProducts) return false;
      if (salesItemType === 'COMBOS' && !hasCombos) return false;
      if (salesItemType === 'PRODUCTOS' && salesItemId !== 'TODOS') {
        const matchesProduct = (sale.detalles || sale.detalles_venta || sale.items || [])
          .some((detail: any) => !detail.es_parte_combo && String(detail.id_producto) === salesItemId);
        if (!matchesProduct) return false;
      }
      if (salesItemType === 'COMBOS' && salesItemId !== 'TODOS') {
        const matchesCombo = (sale.combos || []).some((combo: any) => String(combo.id_combo) === salesItemId);
        if (!matchesCombo) return false;
      }
      if (salesDateFrom && (!dateKey || dateKey < salesDateFrom)) return false;
      if (salesDateTo && (!dateKey || dateKey > salesDateTo)) return false;
      return true;
    });
  }, [ventas, salesSearch, salesCashier, salesMethod, salesItemType, salesItemId, salesDateFrom, salesDateTo]);

  const clearSalesFilters = () => {
    setSalesSearch('');
    setSalesCashier('TODOS');
    setSalesMethod('TODOS');
    setSalesItemType('TODOS');
    setSalesItemId('TODOS');
    setSalesDateFrom('');
    setSalesDateTo('');
  };

  const hasSalesFilters = Boolean(
    salesSearch || salesCashier !== 'TODOS' || salesMethod !== 'TODOS' ||
    salesItemType !== 'TODOS' || salesItemId !== 'TODOS' || salesDateFrom || salesDateTo
  );

  const totalVentasValor = useMemo(() => ventasFiltradas.reduce(
    (sum, sale) => sum + Number(sale.total || sale.monto || sale.importe || 0), 0
  ), [ventasFiltradas]);
  const transaccionesTotales = ventasFiltradas.length;

  const ventasPorMetodo = useMemo(() => {
    const data: Record<string, { value: number; color: string }> = {};
    ventasFiltradas.forEach(v => {
      const metodo = v.metodo_pago || v.nombre_metodo || v.metodo || 'Otros';
      const monto = Number(v.total || v.monto || v.importe || 0);
      
      if (!data[metodo]) {
        // Buscar el color real desde los metodos de pago
        const found = metodosPago.find(m => m.nombre?.toLowerCase() === metodo.toLowerCase());
        let hex = '#64748b';
        const val = found?.color_hex || v.metodo_pago_color;
        if (val) {
          if (val.startsWith('#')) hex = val;
          else if (val.includes('purple')) hex = '#a855f7';
          else if (val.includes('cyan')) hex = '#06b6d4';
          else if (val.includes('emerald')) hex = '#10b981';
          else if (val.includes('blue')) hex = '#3b82f6';
          else if (val.includes('amber')) hex = '#f59e0b';
        }
        data[metodo] = { value: 0, color: hex };
      }
      data[metodo].value += monto;
    });
    return Object.entries(data).map(([name, item]) => ({ name, ...item })).sort((a, b) => b.value - a.value);
  }, [ventasFiltradas, metodosPago]);

  const ventasPorCategoria = useMemo(() => {
    const data: Record<string, { value: number; color: string }> = {};
    const colores = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    let colorIdx = 0;

    const addCategoryValue = (categoryName: string, amount: number) => {
      if (amount <= 0) return;
      if (!data[categoryName]) {
        data[categoryName] = { value: 0, color: colores[colorIdx % colores.length] };
        colorIdx++;
      }
      data[categoryName].value += amount;
    };
    
    ventasFiltradas.forEach(v => {
      const detalles = v.detalles || v.detalles_venta || v.items || [];
      detalles.forEach((d: any) => {
        if (d.es_parte_combo) return;
        const cant = Number(d.cantidad || 0);
        let id_categoria = d.id_categoria || d.categoria_id;
        let nombreCategoria = d.categoria_nombre || 'Sin categoría';
        
        if (!id_categoria || nombreCategoria === 'Sin categoría') {
          const prodObj = productos.find(p => p.id_producto === d.id_producto);
          if (prodObj) {
            id_categoria = prodObj.id_categoria ?? prodObj.categoria_id;
            nombreCategoria = prodObj.categoria_nombre || categorias.find(c => Number(c.id_categoria) === Number(id_categoria))?.nombre || 'Sin categoría';
          }
        }
        
        const montoDetalle = Number(d.subtotal || (Number(d.precio_unitario || d.precio || 0) * cant));
        
        addCategoryValue(nombreCategoria, montoDetalle);
      });

      const combosVenta = v.combos || [];
      combosVenta.forEach((combo: any) => {
        const amount = Number(combo.subtotal_combo || (Number(combo.precio_unitario_combo || 0) * Number(combo.cantidad || 0)));
        const comboCategories = Array.isArray(combo.categorias) ? combo.categorias : [];

        if (comboCategories.length === 0) {
          addCategoryValue('Sin categoría', amount);
          return;
        }

        const valueWeight = comboCategories.reduce((sum: number, category: any) => sum + Number(category.valor_componentes || 0), 0);
        const quantityWeight = comboCategories.reduce((sum: number, category: any) => sum + Number(category.cantidad_componentes || 0), 0);

        comboCategories.forEach((category: any) => {
          const weight = valueWeight > 0
            ? Number(category.valor_componentes || 0) / valueWeight
            : Number(category.cantidad_componentes || 0) / Math.max(1, quantityWeight);
          addCategoryValue(category.categoria_nombre || 'Sin categoría', amount * weight);
        });
      });
    });
    return Object.entries(data).map(([name, item]) => ({ name, ...item })).sort((a, b) => b.value - a.value);
  }, [ventasFiltradas, productos, categorias]);

  const productosTop = useMemo(() => {
    const data: Record<string, { nombre: string; cantidad: number; image?: string }> = {};
    ventasFiltradas.forEach(v => {
      const detalles = v.detalles || v.detalles_venta || v.items || [];
      detalles.forEach((d: any) => {
        if (d.es_parte_combo) return;
        const id = d.id_producto;
        const key = `producto-${id}`;
        const nombre = d.producto_nombre || d.nombre || `Producto #${id}`;
        const cant = Number(d.cantidad || 0);
        
        if (!data[key]) {
          const prodObj = productos.find(p => p.id_producto === id);
          const image = prodObj?.imagen_url || d.imagen_url || d.imagen || undefined;
          data[key] = { nombre, cantidad: 0, image };
        }
        
        data[key].cantidad += cant;
      });

      (v.combos || []).forEach((comboSale: any) => {
        const id = comboSale.id_combo;
        const key = `combo-${id}`;
        const comboInfo = combos.find(combo => Number(combo.id_combo) === Number(id));
        const nombre = `Combo: ${comboSale.combo_nombre || comboSale.nombre || comboInfo?.nombre || `#${id}`}`;
        if (!data[key]) {
          data[key] = { nombre, cantidad: 0, image: comboInfo?.imagen_url || undefined };
        }
        data[key].cantidad += Number(comboSale.cantidad || 0);
      });
    });
    const totalUnidades = Object.values(data).reduce((sum, product) => sum + product.cantidad, 0);
    return Object.values(data)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 3)
      .map(product => ({
        ...product,
        porcentaje: totalUnidades > 0 ? (product.cantidad / totalUnidades) * 100 : 0,
      }));
  }, [ventasFiltradas, productos, combos]);

  const topPaymentMethod = ventasPorMetodo[0];
  const topProduct = productosTop[0];
  const categorySalesTotal = ventasPorCategoria.reduce((sum, category) => sum + category.value, 0);
  const metodoPagoSeleccionado = metodosPago.find(m => m.id_metodo_pago === selectedMetodo);
  const cuentasPagoSeleccionadas = metodoPagoSeleccionado?.cuentas_receptoras || [];
  const cuentaPagoSeleccionada = cuentasPagoSeleccionadas.find((cuenta: any) => cuenta.id_cuenta_pago === selectedCuentaPago);
  const esTransferenciaSeleccionada = ['TRANSFERENCIA', 'BILLETERA_DIGITAL'].includes(metodoPagoSeleccionado?.tipo);

  const openPayment = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Debes iniciar sesión en caja para procesar pagos');
      return;
    }

    const metodosDisponibles = metodosPago.length > 0 ? metodosPago : await fetchMetodosPago();
    if (metodosDisponibles.length === 0) {
      toast.error('No hay métodos de pago configurados');
      return;
    }

    const metodoInicial = metodosDisponibles[0];
    const cuentaInicial = (metodoInicial?.cuentas_receptoras || []).find((cuenta: any) => cuenta.es_predeterminado)
      || metodoInicial?.cuentas_receptoras?.[0];
    setSelectedMetodo(metodoInicial?.id_metodo_pago ?? null);
    setSelectedCuentaPago(cuentaInicial?.id_cuenta_pago ?? null);
    setShowNuevaCuenta(false);
    setNuevoTitularCuenta('');
    setNuevoNumeroCuenta('');
    setShowPaymentModal(true);
  };

  const seleccionarMetodoPago = (metodo: any) => {
    const cuenta = (metodo.cuentas_receptoras || []).find((item: any) => item.es_predeterminado)
      || metodo.cuentas_receptoras?.[0];
    setSelectedMetodo(metodo.id_metodo_pago);
    setSelectedCuentaPago(cuenta?.id_cuenta_pago ?? null);
    setShowNuevaCuenta(false);
  };

  const agregarCuentaDesdeCaja = async () => {
    const metodo = metodosPago.find(m => m.id_metodo_pago === selectedMetodo);
    const numero = nuevoNumeroCuenta.replace(/\D/g, '');
    if (!metodo) return;
    if (numero.length < 6) return toast.error('Ingresa un número receptor válido');

    setSavingCuenta(true);
    try {
      const base = isCajero ? '/caja/metodos-pago' : '/evento/metodos-pago';
      const res = await api.post(`${base}/${metodo.id_metodo_pago}/cuentas`, {
        nombre_titular: nuevoTitularCuenta.trim() || null,
        numero_destino: numero,
        es_predeterminado: (metodo.cuentas_receptoras || []).length === 0,
      });
      const cuentas = [...(metodo.cuentas_receptoras || []), res.data];
      setMetodosPago(prev => prev.map(item => item.id_metodo_pago === metodo.id_metodo_pago ? { ...item, cuentas_receptoras: cuentas } : item));
      setSelectedCuentaPago(res.data.id_cuenta_pago);
      setNuevoTitularCuenta('');
      setNuevoNumeroCuenta('');
      setShowNuevaCuenta(false);
      toast.success('Número receptor agregado');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'No se pudo agregar el número');
    } finally {
      setSavingCuenta(false);
    }
  };

  const marcarCuentaPredeterminada = async () => {
    const metodo = metodosPago.find(m => m.id_metodo_pago === selectedMetodo);
    if (!metodo || !selectedCuentaPago) return;
    const cuenta = (metodo.cuentas_receptoras || []).find((item: any) => item.id_cuenta_pago === selectedCuentaPago);
    if (cuenta?.es_predeterminado) return;

    try {
      const base = isCajero ? '/caja/metodos-pago' : '/evento/metodos-pago';
      await api.put(`${base}/${metodo.id_metodo_pago}/cuentas/${selectedCuentaPago}/predeterminada`);
      setMetodosPago(prev => prev.map(item => item.id_metodo_pago === metodo.id_metodo_pago ? {
        ...item,
        cuentas_receptoras: (item.cuentas_receptoras || []).map((account: any) => ({
          ...account,
          es_predeterminado: account.id_cuenta_pago === selectedCuentaPago,
        })),
      } : item));
      toast.success('Número predeterminado actualizado');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'No se pudo cambiar el número predeterminado');
    }
  };

  const procesarCobro = async () => {
    if (processingSaleRef.current) return;
    if (!selectedMetodo) return toast.error('Selecciona un método de pago');
    const metodoElegido = metodosPago.find(m => m.id_metodo_pago === selectedMetodo);

    if (['TRANSFERENCIA', 'BILLETERA_DIGITAL'].includes(metodoElegido?.tipo) && !selectedCuentaPago) {
      return toast.error('Selecciona o agrega el número que recibirá la transferencia');
    }

    processingSaleRef.current = true;
    setProcessingSale(true);

    const payload: any = {
      id_metodo_pago: selectedMetodo,
      id_cuenta_pago: selectedCuentaPago,
      detalles: cart
        .filter(l => l.tipo === 'producto')
        .map(l => ({ id_producto: l.producto.id_producto, cantidad: l.cantidad })),
      combos: cart
        .filter(l => l.tipo === 'combo')
        .map(l => ({ id_combo: l.combo.id_combo, cantidad: l.cantidad })),
    };

    try {
      await api.post('/ventas', payload);
      toast.success('Venta registrada correctamente');
      setCart([]);
      setShowPaymentModal(false);
      const savedCodigo = localStorage.getItem('codigo_caja');
      fetchProductos(savedCodigo || undefined);
      fetchCombos();
      fetchVentas();
    } catch (err: any) {
      console.error('Error procesando venta:', err);
      toast.error(err.response?.data?.error || 'Error al procesar la venta');
    } finally {
      processingSaleRef.current = false;
      setProcessingSale(false);
    }
  };

  const filteredProducts = useMemo(() => {
    let filtered = productos;
    if (selectedCategory !== 'Todas') {
      filtered = filtered.filter(p => p.categoria_nombre === selectedCategory);
    }
    if (searchQuery.trim()) {
      filtered = filtered.filter(p => p.nombre.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return filtered;
  }, [productos, selectedCategory, searchQuery]);

  const filteredCombos = useMemo(() => {
    if (!searchQuery.trim()) return combos;
    return combos.filter(c => c.nombre.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [combos, searchQuery]);

  return (
    <div className="event-pos-palette-scope flex h-dvh bg-slate-50 dark:bg-[#050B14] overflow-hidden font-sans relative">
      
      {/* Overlay Nav */}
      {isNavOpen && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setIsNavOpen(false)} />
      )}

      {/* Sidebar POS (Drawer) */}
      <aside className={`fixed left-0 top-0 z-50 flex h-dvh flex-shrink-0 flex-col rounded-r-3xl border-r border-slate-100 bg-white transition-transform duration-200 dark:border-slate-800 dark:bg-[#0B1120] ${isCollapsed ? 'w-20' : 'w-72'} ${isNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        
        {/* Botón Colapsar (Estilo Solapa) */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-[23px] top-1/2 -translate-y-1/2 w-6 h-20 bg-white dark:bg-[#0B1120] rounded-r-2xl border-y border-r border-slate-100 dark:border-slate-800 flex items-center justify-center cursor-pointer z-30 group shadow-[4px_0_15px_-3px_rgba(0,0,0,0.05)] dark:shadow-[4px_0_15px_-3px_rgba(0,0,0,0.4)] hidden lg:flex"
          style={{ clipPath: 'inset(-10px -10px -10px 0)' }}
        >
          {/* El borde izquierdo se oculta con el clip-path y posición para crear continuidad */}
          <div className="absolute left-[-2px] top-0 bottom-0 w-[4px] bg-white dark:bg-[#0B1120]"></div>
          {isCollapsed ? <ChevronRight className="size-4 ml-1" style={{ color: colorAccent }} /> : <ChevronLeft className="size-4 ml-1" style={{ color: colorAccent }} />}
        </button>

        {/* Botón Cerrar Drawer (Mobile) */}
        <button 
          onClick={() => setIsNavOpen(false)}
          className="lg:hidden absolute -right-12 top-4 bg-white dark:bg-[#0B1120] rounded-xl p-2 shadow-lg text-slate-500"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Logo / Event Header */}
        <div className="flex flex-col pt-8 pb-6 px-4 border-b border-slate-100/50 dark:border-slate-800/50 flex-shrink-0 relative">
          <div className="flex flex-col justify-center items-center">
            {!isCollapsed && (
              <>
                <div className="flex items-center justify-center mb-3">
                  {currentEvent?.logo_url ? (
                    <TransparentLogo src={currentEvent.logo_url} alt="Logo Evento" className="size-16 object-contain" />
                  ) : (
                    <div className="size-16 rounded-xl p-0.5 shadow-lg" style={{ backgroundColor: colorSecondary }}>
                      <div className="w-full h-full bg-white dark:bg-[#0B1120] rounded-[10px] flex items-center justify-center">
                        <span className="font-black text-xl" style={{ color: colorPrimary }}>EV</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-center w-full px-2">
                  <h2 className="text-slate-900 dark:text-white font-black text-sm uppercase tracking-wider truncate">
                    {currentEvent?.nombre || 'Punto de Venta'}
                  </h2>
                </div>
              </>
            )}
            {isCollapsed && (
              <div className="flex items-center justify-center w-full">
                {currentEvent?.logo_url ? (
                  <TransparentLogo src={currentEvent.logo_url} alt="Logo Evento" className="size-10 object-contain" />
                ) : (
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: colorPrimary }}>
                    <span className="font-black text-white text-xs">EV</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Navegación */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2 custom-scrollbar">
          <button 
            onClick={() => setActiveTab('pos')}
            className={`w-full flex items-center px-3 py-3 rounded-xl transition-colors duration-200 ${activeTab === 'pos' ? 'text-white font-bold shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'}`}
            style={activeTab === 'pos' ? { backgroundColor: colorAccent } : {}}
            title="Punto de Venta"
          >
            <ShoppingCart className={`w-5 h-5 flex-shrink-0 ${isCollapsed ? 'mx-auto' : 'mr-3'} ${activeTab === 'pos' ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
            {!isCollapsed && <span className="text-sm">Punto de Venta</span>}
          </button>
          
          <button 
            onClick={() => setActiveTab('historial')}
            className={`w-full flex items-center px-3 py-3 rounded-xl transition-colors duration-200 ${activeTab === 'historial' ? 'text-white font-bold shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'}`}
            style={activeTab === 'historial' ? { backgroundColor: colorAccent } : {}}
            title="Historial de Ventas"
          >
            <Clock className={`w-5 h-5 flex-shrink-0 ${isCollapsed ? 'mx-auto' : 'mr-3'} ${activeTab === 'historial' ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
            {!isCollapsed && <span className="text-sm">Movimientos</span>}
          </button>
        </nav>
        
        {/* Footer (Usuario, Modo Oscuro & Salir) */}
        <div className="p-4 border-t border-slate-100/50 dark:border-slate-800 flex-shrink-0 space-y-2">
          
          {!isCollapsed && (
            <div className="px-3 py-3 mb-2 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800/60">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black shadow-sm" style={{ backgroundColor: colorAccent }}>
                {user?.nombre?.charAt(0).toUpperCase() || 'C'}
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-bold text-slate-800 dark:text-white truncate leading-tight">{user?.nombre || 'Cajero'}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{(user?.rol || 'CAJERO').replace('_', ' ')}</span>
              </div>
            </div>
          )}

          {!isCollapsed && (
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-300">
                <Moon className="w-4 h-4 mr-3 text-slate-400 dark:text-slate-500" />
                Modo Oscuro
              </div>
              {/* Toggle Switch */}
              <div 
                onClick={toggleTheme}
                className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${isDarkMode ? 'bg-accent' : 'bg-slate-300'}`}
                style={isDarkMode ? { backgroundColor: colorAccent } : {}}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${isDarkMode ? 'right-1 translate-x-0' : 'left-1'}`}></div>
              </div>
            </div>
          )}
          
          <button 
            onClick={() => logout()}
            className={`w-full flex items-center px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 ${isCollapsed ? 'justify-center' : ''}`}
            title="Cerrar Sesión"
          >
            <LogOut className={`w-5 h-5 flex-shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
            {!isCollapsed && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Espaciador para no solapar el contenido */}
      <div className={`hidden flex-shrink-0 lg:block ${isCollapsed ? 'w-20' : 'w-72'}`}></div>

      {/* Contenido Principal */}
      <main className="flex-1 flex flex-col overflow-hidden w-full min-h-0 relative">
        {needCodigo ? (
          <div className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-slate-50/90 dark:bg-[#050B14]/90 backdrop-blur-sm animate-in fade-in duration-300">
             <div className="max-w-md w-full bg-white dark:bg-[#0B1120] rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.2)] overflow-hidden border border-slate-200 dark:border-slate-800">
               <div className="h-40 flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: colorSecondary }}>
                  <div className="absolute inset-0 bg-black/10 mix-blend-overlay"></div>
                  {currentEvent?.logo_url ? (
                    <TransparentLogo src={currentEvent.logo_url} alt="Logo Evento" className="h-24 max-w-[80%] object-contain relative z-10" />
                  ) : (
                    <LayoutGrid className="w-16 h-16 text-white relative z-10 opacity-90 drop-shadow-lg" />
                  )}
               </div>
               <div className="p-8">
                 <div className="text-center mb-8">
                   <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Acceso a Caja</h2>
                   <p className="text-sm text-slate-500 font-medium">Ingresa tu código asignado para este evento.</p>
                 </div>
                 
                 <div className="space-y-6">
                   <div>
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block text-center">Código de Caja</label>
                     <input 
                       type="text"
                       placeholder="Ej: CAJA-01" 
                       value={codigoCaja} 
                       onChange={e => setCodigoCaja(e.target.value)} 
                       onKeyDown={e => e.key === 'Enter' && fetchProductos(codigoCaja)}
                       className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-transparent transition-all font-black text-2xl text-center tracking-widest text-slate-800 dark:text-white"
                       style={{ '--tw-ring-color': colorPrimary, '--tw-ring-offset-width': '0px', '--tw-ring-width': '2px', boxShadow: 'var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000)' } as any}
                     />
                   </div>
                   <button 
                     onClick={() => fetchProductos(codigoCaja)} 
                     className="w-full py-4 text-white font-black rounded-2xl hover:-translate-y-1 transition-all shadow-lg text-lg flex items-center justify-center gap-2 group" 
                     style={{ backgroundColor: colorAccent, boxShadow: `0 10px 25px -5px ${colorAccent}50` }}
                   >
                     Entrar al POS
                     <RefreshCw className={`size-5 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} />
                   </button>
                   <button 
                     onClick={() => logout()} 
                     className="w-full py-2 text-slate-400 hover:text-red-500 font-bold transition-colors text-xs uppercase tracking-widest mt-2 flex items-center justify-center gap-1.5" 
                   >
                     <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión
                   </button>
                 </div>
               </div>
             </div>
          </div>
        ) : activeTab === 'pos' ? (
          <>
            {/* Grid de Productos y Filtros */}
            <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-slate-50/50 p-3 sm:p-4 lg:p-8 dark:bg-transparent">
              {/* Header POS Corporativo */}
              <div className="flex flex-col xl:flex-row xl:items-start justify-between mb-6 gap-6 shrink-0">
                <div className="flex items-center gap-4">
                  <button onClick={() => setIsNavOpen(true)} className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-slate-900 transition-colors lg:hidden">
                    <Menu className="w-6 h-6" />
                  </button>
                   <div>
                     <h1 className="text-balance text-2xl font-bold leading-tight sm:text-3xl" style={{ color: colorSecondary }}>Catálogo de Productos</h1>
                     <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium hidden sm:block">Seleccione un producto para añadirlo a la orden activa.</p>
                     <div className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400" aria-live="polite">
                       <span className="size-2 rounded-full bg-emerald-500"></span>
                       Stock en vivo
                       {lastStockUpdate && <span className="font-normal tabular-nums">· actualizado {peruTimeWithSecondsFormatter.format(lastStockUpdate)}</span>}
                     </div>
                  </div>
                </div>
                
                <div className="flex w-full shrink-0 flex-col items-stretch gap-4 xl:w-auto xl:items-end">
                  {/* Combos vs Productos Toggle */}
                  <div className="grid w-full grid-cols-2 items-center rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700/50 dark:bg-slate-800/80 xl:w-auto">
                    <button
                      onClick={() => setActiveSection("combos")}
                      className={`min-w-0 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${activeSection === "combos" ? "bg-white dark:bg-[#0B1120] text-slate-800 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                      <span className="block truncate">Paquetes / Combos</span>
                    </button>
                    <button
                      onClick={() => setActiveSection("productos")}
                      className={`min-w-0 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${activeSection === "productos" ? "bg-white dark:bg-[#0B1120] text-slate-800 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                      <span className="block truncate">Productos Unitarios</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Categorías y Búsqueda */}
              {activeSection === 'productos' && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  {categorias.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto custom-scrollbar shrink-0 pr-4 pb-2 md:pb-0">
                      <button 
                        onClick={() => setSelectedCategory('Todas')} 
                        className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${selectedCategory === 'Todas' ? 'shadow-sm' : 'hover:opacity-80'}`}
                        style={selectedCategory === 'Todas' ? { backgroundColor: colorAccent, color: '#ffffff' } : { backgroundColor: `${colorAccent}10`, color: colorAccent }}
                      >
                        Todas las Categorías
                      </button>
                      {categorias.map(c => (
                        <button 
                          key={c.id_categoria}
                          onClick={() => setSelectedCategory(c.nombre)} 
                          className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${selectedCategory === c.nombre ? 'shadow-sm' : 'hover:opacity-80'}`}
                          style={selectedCategory === c.nombre ? { backgroundColor: colorAccent, color: '#ffffff' } : { backgroundColor: `${colorAccent}10`, color: colorAccent }}
                        >
                          {c.nombre}
                        </button>
                      ))}
                    </div>
                  ) : <div></div>}
                  
                  <div className="flex min-w-0 items-center gap-3 border-slate-200 md:shrink-0 md:border-l md:pl-4 dark:border-slate-800">
                    <div className="relative min-w-0 flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colorSecondary }} />
                      <input
                        type="text"
                        placeholder="Buscar producto..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-transparent py-1.5 pl-9 pr-4 text-sm font-semibold text-slate-700 outline-none placeholder:font-medium placeholder:text-slate-400 md:w-48 dark:text-white"
                      />
                    </div>
                    <button onClick={() => { fetchProductos(codigoCaja); fetchCombos(); }} className="text-slate-400 hover:text-slate-600 transition-colors p-1" title="Actualizar">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
  
              {activeSection === 'combos' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                    {filteredCombos.length > 0 ? filteredCombos.map(combo => {
                      const capacidad = Number(combo.capacidad_disponible ?? 0);
                      const agotado = combo.activo === false || capacidad <= 0;
                      const capacidadNumero = capacidad > 99 ? '99+' : capacidad;

                      return (
                      <article key={combo.id_combo} className={`bg-white dark:bg-[#0B1120] border rounded-2xl flex flex-col overflow-hidden shadow-sm transition-shadow duration-200 ${agotado ? 'border-red-200 dark:border-red-500/30 opacity-75' : 'border-slate-200 dark:border-slate-800 hover:shadow-md'}`}>
                        <div className="aspect-[1.55] bg-slate-100 dark:bg-slate-900 flex items-center justify-center overflow-hidden relative border-b border-slate-100 dark:border-slate-800/50">
                          {combo.imagen_url ? (
                            <img src={resolveAssetUrl(combo.imagen_url)} alt={combo.nombre} loading="lazy" className="size-full object-cover" />
                          ) : (
                            <Layers className="size-12 text-slate-300 dark:text-slate-700" />
                          )}

                          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
                            <div
                              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-[11px] font-semibold shadow-sm ${agotado ? 'border-red-200 bg-red-50/95 text-red-700 dark:border-red-500/30 dark:bg-red-950/90 dark:text-red-300' : capacidad <= 5 ? 'border-amber-200 bg-amber-50/95 text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/90 dark:text-amber-200' : 'border-emerald-200 bg-emerald-50/95 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/90 dark:text-emerald-200'}`}
                            >
                              <Layers className="size-3.5 shrink-0" aria-hidden="true" />
                              {agotado ? (
                                <span>Agotado</span>
                              ) : (
                                <span><strong className="font-black tabular-nums">{capacidadNumero}</strong> disponibles</span>
                              )}
                            </div>
                            <div className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide shadow-sm" style={{ backgroundColor: colorSecondary, color: '#ffffff' }}>
                              Combo
                            </div>
                          </div>
                        </div>

                        <div className="flex-1 p-5 flex flex-col">
                          <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight line-clamp-2">{combo.nombre}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
                            {combo.descripcion || 'Combo listo para añadir a la orden.'}
                          </p>

                          <div className="mt-4 space-y-1.5" aria-label="Productos incluidos">
                            <p className="text-[10px] font-bold uppercase text-slate-400">Incluye</p>
                            {combo.productos && combo.productos.length > 0 ? (
                              <>
                                {combo.productos.slice(0, 2).map((producto) => (
                                  <div key={producto.id_producto} className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-900/70 px-2.5 py-2 text-[11px]">
                                    <span className="shrink-0 rounded-md px-1.5 py-0.5 font-bold tabular-nums" style={{ backgroundColor: `${colorPrimary}12`, color: colorPrimary }}>
                                      {producto.cantidad}x
                                    </span>
                                    <span className="min-w-0 flex-1 truncate font-semibold text-slate-600 dark:text-slate-300">{producto.nombre}</span>
                                    <span className="shrink-0 text-slate-400">
                                      Stock <strong className="font-bold tabular-nums" style={{ color: colorPrimary }}>{Number(producto.stock_actual)}</strong>
                                    </span>
                                  </div>
                                ))}
                                {combo.productos.length > 2 && (
                                  <p className="px-1 text-[10px] font-semibold text-slate-400">
                                    +<span className="tabular-nums" style={{ color: colorPrimary }}>{combo.productos.length - 2}</span> productos más
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="rounded-lg bg-slate-50 dark:bg-slate-900/70 px-3 py-2 text-[11px] font-semibold text-slate-400">
                                Sin productos configurados
                              </p>
                            )}
                          </div>

                          <div className="mt-auto flex items-end justify-between gap-4 pt-4">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Precio</span>
                              <div className="text-xl font-bold tabular-nums" style={{ color: colorPrimary }}>S/ {Number(combo.precio_combo).toFixed(2)}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => addComboToCart(combo)}
                              disabled={agotado}
                              aria-label={agotado ? `${combo.nombre} agotado` : `Añadir ${combo.nombre} a la orden`}
                              className="h-11 rounded-xl px-4 flex items-center justify-center gap-2 text-sm font-bold text-white shadow-sm transition-transform enabled:hover:scale-[1.02] enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
                              style={agotado ? undefined : { backgroundColor: colorAccent, boxShadow: `0 4px 12px ${colorAccent}35` }}
                            >
                              <Plus className="size-5" />
                              <span>{agotado ? 'Agotado' : 'Agregar'}</span>
                            </button>
                          </div>
                        </div>
                      </article>
                      );
                    }) : (
                      <div className="col-span-full rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#050B14] p-12 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                        <Layers className="w-12 h-12 mb-4 opacity-20" />
                        <p className="font-bold text-lg">No se encontraron combos.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
  
              {activeSection === 'productos' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-6">
                  {loading ? (
                    <div className="h-full flex items-center justify-center text-primary"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 gap-4 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#050B14]">
                      <FileText className="w-12 h-12 opacity-20" />
                      <p className="font-bold text-lg">No se encontraron productos.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                      {filteredProducts.map(p => {
                        const stockCount = Number(p.stock_actual ?? p.stock ?? 0);
                        const minStock = Number(p.stock_minimo ?? 0);
                        const agotado = stockCount <= 0;
                        const stockBajo = !agotado && stockCount <= minStock;
                        const stockNumero = stockCount > 99 ? '99+' : stockCount;

                        return (
                        <article key={p.id_producto} className={`bg-white dark:bg-[#0B1120] border rounded-2xl flex flex-col shadow-sm overflow-hidden ${agotado ? 'border-red-200 dark:border-red-500/30 opacity-75' : 'border-slate-200 dark:border-slate-800 hover:shadow-md'}`}>
                          <div className="aspect-[1.55] bg-slate-100 dark:bg-slate-900 flex items-center justify-center overflow-hidden relative border-b border-slate-100 dark:border-slate-800/50">
                            {p.imagen_url ? (
                              <img src={resolveAssetUrl(p.imagen_url)} alt={p.nombre} loading="lazy" className="size-full object-cover" />
                            ) : (
                              <ImageIcon className="size-12 text-slate-300 dark:text-slate-700" />
                            )}

                            <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
                              <div
                                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-[11px] font-semibold shadow-sm ${agotado ? 'border-red-200 bg-red-50/95 text-red-700 dark:border-red-500/30 dark:bg-red-950/90 dark:text-red-300' : stockBajo ? 'border-amber-200 bg-amber-50/95 text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/90 dark:text-amber-200' : 'border-emerald-200 bg-emerald-50/95 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/90 dark:text-emerald-200'}`}
                              >
                                <Layers className="size-3.5 shrink-0" aria-hidden="true" />
                                {agotado ? (
                                  <span>Agotado</span>
                                ) : (
                                  <span>{stockBajo ? 'Solo ' : ''}<strong className="font-black tabular-nums">{stockNumero}</strong> disponibles</span>
                                )}
                              </div>
                              {p.categoria_nombre && (
                                <span className="max-w-[45%] truncate rounded-lg px-2.5 py-1 text-[10px] font-black uppercase text-white shadow-sm" style={{ backgroundColor: colorSecondary }}>
                                  {p.categoria_nombre}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex-1 p-5 flex flex-col">
                            <h3 className="text-balance font-bold text-slate-900 dark:text-white text-base leading-tight line-clamp-2">{p.nombre}</h3>
                            <p className="text-pretty text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
                              {p.descripcion || "Producto registrado en el sistema."}
                            </p>
                            
                            <div className="mt-auto flex items-end justify-between gap-4 pt-5">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Precio</span>
                                <div className="text-xl font-bold flex items-baseline gap-1 tabular-nums" style={{ color: colorPrimary }}>
                                  <span className="text-sm font-semibold">S/</span>
                                  <span>{(Number(p.precio_venta || p.precio) || 0).toFixed(2)}</span>
                                </div>
                              </div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); addProductToCart(p); }}
                                disabled={agotado}
                                aria-label={agotado ? `${p.nombre} agotado` : `Agregar ${p.nombre} al carrito`}
                                className="h-11 rounded-xl px-4 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none dark:disabled:bg-slate-700 dark:disabled:text-slate-400" 
                                style={agotado ? undefined : { backgroundColor: colorAccent }}
                              >
                                <Plus className="size-5" />
                                {agotado ? 'Agotado' : 'Agregar'}
                              </button>
                            </div>
                          </div>
                        </article>
                      )})}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Botón Flotante del Carrito */}
            {activeTab === 'pos' && (
              <button 
                onClick={() => setIsCartOpen(true)}
                aria-label={`Abrir carrito${cart.length > 0 ? `, ${cart.length} líneas` : ''}`}
                className="fixed bottom-4 right-4 z-30 flex items-center justify-center rounded-full border-2 border-transparent p-4 text-white shadow-xl sm:bottom-8 sm:right-8"
                style={{ backgroundColor: colorAccent }}
              >
                <div className="relative">
                  <ShoppingCart className="w-7 h-7" />
                  {cart.length > 0 && (
                    <span 
                      className="absolute -top-2 -right-2 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white"
                      style={{ backgroundColor: colorAccent }}
                    >
                      {cart.length}
                    </span>
                  )}
                </div>
                
                <div 
                  className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-3 py-1.5 text-white text-xs font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap hidden sm:block shadow-lg"
                  style={{ backgroundColor: colorAccent }}
                >
                  Ver carrito de compra
                  <div className="absolute top-1/2 -right-1 -translate-y-1/2 border-4 border-transparent" style={{ borderLeftColor: colorAccent }}></div>
                </div>
              </button>
            )}

            {/* Overlay Cart */}
            {isCartOpen && (
              <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={() => setIsCartOpen(false)} aria-hidden="true" />
            )}

            {/* Sidebar Carrito (Drawer) */}
            <aside className={`fixed right-0 top-0 z-50 flex h-dvh w-full shrink-0 flex-col border-l border-slate-200/60 bg-white shadow-2xl transition-transform duration-200 sm:w-[420px] dark:border-slate-800/60 dark:bg-[#0B1120] ${isCartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-4 sm:p-6 dark:border-slate-800/50">
                <div>
                  <h2 className="text-2xl font-black text-balance flex items-center gap-2" style={{ color: colorSecondary }}>
                    Orden Actual
                    {cart.length > 0 && <span className="flex items-center justify-center text-white text-xs rounded-full w-6 h-6" style={{ backgroundColor: colorAccent }}>{cart.length}</span>}
                  </h2>
                </div>
                <button onClick={() => setIsCartOpen(false)} aria-label="Cerrar carrito" className="flex size-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300">
                  <X className="size-6" />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/30 p-4 sm:p-6 custom-scrollbar dark:bg-transparent">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-5 opacity-60">
                    <div className="w-32 h-32 rounded-full bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center">
                      <ShoppingCart className="w-12 h-12 text-slate-300 dark:bg-slate-600" />
                    </div>
                    <p className="font-bold text-lg">Tu orden está vacía</p>
                  </div>
                ) : (
                  cart.map((line, index) => {
                    const isProduct = line.tipo === 'producto';
                    const itemId = isProduct ? line.producto.id_producto : line.combo.id_combo;
                    const itemName = isProduct ? line.producto.nombre : line.combo.nombre;
                    const itemPrice = isProduct ? Number(line.producto.precio_venta ?? line.producto.precio) : Number(line.combo.precio_combo);
                    const itemImage = isProduct ? line.producto.imagen_url : line.combo.imagen_url;
                    const itemTypeLabel = isProduct ? 'Producto' : 'Combo';
                    
                    return (
                      <div key={`${line.tipo}-${itemId}-${index}`} className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-[#0B1120]">
                        <div className="flex gap-3">
                          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                            {itemImage ? (
                              <img src={resolveAssetUrl(itemImage)} alt={itemName} loading="lazy" className="size-full object-cover" />
                            ) : isProduct ? (
                              <ImageIcon className="size-7 text-slate-400" />
                            ) : (
                              <Layers className="size-7 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-300">{itemTypeLabel}</span>
                                <p className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-slate-900 dark:text-white">{itemName}</p>
                              </div>
                              <button type="button" onClick={() => removeLine(line.tipo, itemId)} aria-label={`Quitar ${itemName} de la orden`} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10">
                                <X className="size-4" />
                              </button>
                            </div>
                            <p className="mt-1 text-xs font-medium tabular-nums text-slate-400">S/ {itemPrice.toFixed(2)} por unidad</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                          <div>
                            <p className="text-[10px] font-bold uppercase text-slate-400">Subtotal</p>
                            <p className="text-lg font-black tabular-nums" style={{ color: colorPrimary }}>S/ {(itemPrice * line.cantidad).toFixed(2)}</p>
                          </div>
                          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/60">
                            <button type="button" onClick={() => changeQty(line.tipo, itemId, line.cantidad - 1)} disabled={line.cantidad <= 1} aria-label={`Disminuir cantidad de ${itemName}`} className="flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-slate-700 dark:hover:text-white"><Minus className="size-4" /></button>
                            <span className="w-10 text-center text-sm font-black tabular-nums text-slate-900 dark:text-white">{line.cantidad}</span>
                            <button type="button" onClick={() => changeQty(line.tipo, itemId, line.cantidad + 1)} aria-label={`Aumentar cantidad de ${itemName}`} className="flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-white"><Plus className="size-4" /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="shrink-0 border-t border-slate-200/60 p-4 sm:p-6 dark:border-slate-800/50">
                <div className="flex justify-between items-end mb-6">
                  <span className="font-bold uppercase tracking-wider text-xs text-slate-500 dark:text-slate-400">Total a cobrar</span>
                  <span className="text-3xl font-black tabular-nums sm:text-4xl" style={{ color: colorPrimary }}>S/ {subtotal.toFixed(2)}</span>
                </div>
                <button
                  disabled={cart.length === 0}
                  onClick={openPayment}
                  className={`w-full py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2 shadow-lg ${
                    cart.length > 0 
                    ? 'hover:-translate-y-1' 
                    : 'opacity-50 cursor-not-allowed'
                  }`}
                  style={cart.length > 0 ? { backgroundColor: colorAccent, color: 'white', boxShadow: `0 10px 25px -5px ${colorAccent}50` } : { backgroundColor: '#cbd5e1', color: '#64748b' }}
                >
                  <CreditCard className="w-6 h-6" />
                  Procesar Pago
                </button>
                
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="w-full mt-4 py-3 text-sm font-bold text-slate-500 hover:text-red-500 transition-colors uppercase tracking-wider flex items-center justify-center gap-1.5">
                    <Trash2 className="w-4 h-4" /> Vaciar Carrito
                  </button>
                )}
              </div>
            </aside>
          </>
        ) : (
          <div className="flex-1 p-5 flex flex-col gap-4 bg-slate-50/50 dark:bg-[#050B14] overflow-y-auto custom-scrollbar">

            {/* ── Header ─────────────────────────────── */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0">
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${colorPrimary}14`, color: colorPrimary }}>
                  <TrendingUp className="size-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-balance text-[2rem] font-bold leading-tight" style={{ color: colorSecondary }}>Movimientos del Evento</h1>
                  <p className="mt-1 text-pretty text-sm text-slate-500 dark:text-slate-400">
                    {isCajero ? 'Consulta las ventas registradas en tu sesión de caja.' : 'Consulta y analiza todas las ventas registradas en el evento.'}
                  </p>
                </div>
              </div>
              <button
                onClick={fetchVentas}
                disabled={loadingVentas}
                className="flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1120] enabled:hover:bg-slate-50 dark:enabled:hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCw className={`size-4 ${loadingVentas ? 'animate-spin' : ''}`} /> {loadingVentas ? 'Actualizando' : 'Actualizar'}
              </button>
            </div>

            {/* ── Layout Principal: Dashboard ── */}
            <div className="flex flex-col gap-6 pb-10">

              {/* Tarjetas métricas superiores */}
              <div className="order-1 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {/* Total Ventas */}
                <div className="bg-white dark:bg-[#0B1120] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col justify-between gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex size-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${colorPrimary}14`, color: colorPrimary }}>
                      <CreditCard className="size-5" />
                    </div>
                    <span className="text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1" style={{ backgroundColor: `${colorPrimary}12`, color: colorPrimary }}>
                      <TrendingUp className="size-3" /> {isCajero ? 'Mi sesión' : 'Evento completo'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400 mb-1">{isCajero ? 'Ventas de mi sesión' : 'Ventas del evento'}</p>
                    <p className="text-3xl font-black leading-none tabular-nums" style={{ color: colorPrimary }}>S/ {totalVentasValor.toFixed(2)}</p>
                  </div>
                </div>

                {/* Transacciones */}
                <div className="bg-white dark:bg-[#0B1120] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col justify-between gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex size-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${colorPrimary}14`, color: colorPrimary }}>
                      <Layers className="size-5" />
                    </div>
                    <span className="text-xs font-bold text-slate-400">Historial completo</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400 mb-1">Movimientos</p>
                    <p className="text-3xl font-black leading-none tabular-nums" style={{ color: colorPrimary }}>{transaccionesTotales}</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#0B1120] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col justify-between gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex size-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${colorPrimary}14`, color: colorPrimary }}>
                      <Trophy className="size-5" />
                    </div>
                    {topProduct && <span className="text-xs font-bold tabular-nums text-slate-400">{topProduct.porcentaje.toFixed(1)}% de unidades</span>}
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400 mb-1">Producto o combo más vendido</p>
                    <p className="truncate text-xl font-black text-slate-800 dark:text-white">{topProduct?.nombre || 'Sin datos'}</p>
                    <p className="mt-1 text-sm font-bold tabular-nums" style={{ color: colorPrimary }}>{topProduct ? `${topProduct.cantidad} unidades` : '0 unidades'}</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#0B1120] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col justify-between gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex size-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${colorPrimary}14`, color: colorPrimary }}>
                      <WalletCards className="size-5" />
                    </div>
                    {topPaymentMethod && <span className="text-xs font-bold tabular-nums text-slate-400">S/ {topPaymentMethod.value.toFixed(2)}</span>}
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400 mb-1">Método principal</p>
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: topPaymentMethod?.color || '#94a3b8' }} />
                      <p className="truncate text-xl font-black text-slate-800 dark:text-white">{topPaymentMethod?.name || 'Sin datos'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gráficos */}
              <div className="order-3 grid grid-cols-1 gap-6 lg:grid-cols-2">
                
                {/* Ventas por Método de Pago */}
                <div className="bg-white dark:bg-[#0B1120] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${colorPrimary}14`, color: colorPrimary }}>
                      <WalletCards className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-balance text-sm font-black text-slate-800 dark:text-white">Métodos de Pago</h3>
                      <p className="mt-0.5 text-pretty text-xs text-slate-400">Distribución de ingresos</p>
                    </div>
                  </div>
                  <div className="flex-1 min-h-[250px]">
                    {ventasPorMetodo.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={ventasPorMetodo}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {ventasPorMetodo.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(value) => `S/ ${Number(value ?? 0).toFixed(2)}`} />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600">
                        <CreditCard className="w-8 h-8 mb-2" />
                        <p className="text-sm font-medium">Sin datos de métodos</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ventas por Categoría */}
                <div className="bg-white dark:bg-[#0B1120] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${colorPrimary}14`, color: colorPrimary }}>
                        <LayoutGrid className="size-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-white">Ventas por Categoría</h3>
                        <p className="mt-0.5 text-xs text-slate-400">Participación sobre los ingresos filtrados</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-400">Total categorizado</p>
                      <p className="mt-0.5 text-lg font-black tabular-nums" style={{ color: colorPrimary }}>S/ {categorySalesTotal.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="min-h-[250px] flex-1">
                    {ventasPorCategoria.length > 0 ? (
                      <div className="max-h-[300px] space-y-4 overflow-y-auto pr-1 custom-scrollbar">
                        {ventasPorCategoria.map((category, index) => {
                          const percentage = categorySalesTotal > 0 ? (category.value / categorySalesTotal) * 100 : 0;
                          return (
                            <div key={category.name} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                              <div className="mb-2 flex items-center justify-between gap-4">
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-black tabular-nums text-slate-400 shadow-sm dark:bg-slate-800">{index + 1}</span>
                                  <span className="truncate text-sm font-bold text-slate-700 dark:text-slate-200">{category.name}</span>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-sm font-black tabular-nums text-slate-800 dark:text-white">S/ {category.value.toFixed(2)}</p>
                                  <p className="text-xs font-bold tabular-nums text-slate-400">{percentage.toFixed(1)}%</p>
                                </div>
                              </div>
                              <div
                                role="progressbar"
                                aria-label={`${category.name}: ${percentage.toFixed(1)}% de las ventas categorizadas`}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={Number(percentage.toFixed(1))}
                                className="h-2.5 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800"
                              >
                                <div className="h-full rounded-full" style={{ width: `${Math.max(2, percentage)}%`, backgroundColor: colorPrimary }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex h-full min-h-[250px] flex-col items-center justify-center text-slate-300 dark:text-slate-600">
                        <LayoutGrid className="mb-2 size-8" />
                        <p className="text-sm font-medium">Sin datos de categorías</p>
                        <p className="mt-1 text-xs">Registra una venta para ver la distribución.</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Productos Top y Transacciones */}
              <div className="order-2 flex flex-col gap-6">
                
                {/* Productos Top */}
                <div className="order-2 bg-white dark:bg-[#0B1120] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${colorPrimary}14`, color: colorPrimary }}>
                      <Trophy className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-balance text-sm font-black text-slate-800 dark:text-white">Top 3 productos y combos</h3>
                      <p className="mt-1 text-pretty text-xs text-slate-400">Cada combo cuenta como un artículo independiente, sin sumar sus componentes otra vez.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {productosTop.length > 0 ? productosTop.map((p, idx) => {
                      const widthPercent = `${Math.min(100, Math.max(3, p.porcentaje))}%`;
                      return (
                        <div key={idx} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex-shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-700 overflow-hidden">
                            {p.image ? <img src={p.image} alt={p.nombre} className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-slate-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="truncate pr-2 text-sm font-bold text-slate-800 dark:text-white"><span className="mr-1 text-slate-400">#{idx + 1}</span>{p.nombre}</span>
                              <span className="flex-shrink-0 text-xs font-black tabular-nums" style={{ color: colorPrimary }}>{p.porcentaje.toFixed(1)}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: widthPercent, backgroundColor: colorSecondary }}></div>
                            </div>
                            <p className="mt-1.5 text-xs font-medium tabular-nums text-slate-400">{p.cantidad} unidades vendidas</p>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="flex flex-col items-center justify-center py-8 text-slate-300 dark:text-slate-600 md:col-span-3">
                        <Layers className="w-8 h-8 mb-2" />
                        <p className="text-sm font-medium">Sin ventas</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Transacciones */}
                <div className="order-1 bg-white dark:bg-[#0B1120] rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col overflow-hidden">
                  <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800/60 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${colorPrimary}14`, color: colorPrimary }}>
                        <FileText className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <h3 className="text-balance text-sm font-black text-slate-800 dark:text-white">Movimientos del Evento</h3>
                          <span className="rounded-full px-2.5 py-1 text-xs font-black tabular-nums" style={{ backgroundColor: `${colorPrimary}14`, color: colorPrimary }}>{ventasFiltradas.length}</span>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-400">Mostrando {ventasFiltradas.length} de {ventas.length} movimientos</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={exportarVentas} disabled={ventasFiltradas.length === 0} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                        <Download className="size-4" /> Exportar
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 border-b border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800/60 dark:bg-slate-900/30 md:grid-cols-2 xl:grid-cols-4">
                    <label className="xl:col-span-2">
                      <span className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">Buscar movimiento</span>
                      <span className="relative block">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="search"
                          value={salesSearch}
                          onChange={(event) => setSalesSearch(event.target.value)}
                          placeholder={isCajero ? 'N.º, producto, combo o cuenta' : 'N.º, producto, cuenta o cajero'}
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        />
                      </span>
                    </label>

                    <label>
                      <span className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">Desde</span>
                      <span className="relative block">
                        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                        <input type="date" value={salesDateFrom} max={salesDateTo || undefined} onChange={(event) => setSalesDateFrom(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                      </span>
                    </label>

                    <label>
                      <span className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">Hasta</span>
                      <span className="relative block">
                        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                        <input type="date" value={salesDateTo} min={salesDateFrom || undefined} onChange={(event) => setSalesDateTo(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                      </span>
                    </label>

                    {!isCajero && (
                      <label>
                        <span className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">Cajero</span>
                        <select value={salesCashier} onChange={(event) => setSalesCashier(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          <option value="TODOS">Todos los cajeros</option>
                          {cashierOptions.map((cashier) => <option key={cashier} value={cashier}>{cashier}</option>)}
                        </select>
                      </label>
                    )}

                    <label>
                      <span className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">Método de pago</span>
                      <select value={salesMethod} onChange={(event) => setSalesMethod(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        <option value="TODOS">Todos los métodos</option>
                        {paymentOptions.map((method) => <option key={method} value={method}>{method}</option>)}
                      </select>
                    </label>

                    <label>
                      <span className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">Productos y combos</span>
                      <select value={salesItemType} onChange={(event) => { setSalesItemType(event.target.value); setSalesItemId('TODOS'); }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        <option value="TODOS">Productos y combos</option>
                        <option value="PRODUCTOS">Solo productos</option>
                        <option value="COMBOS">Solo combos</option>
                      </select>
                    </label>

                    {salesItemType === 'PRODUCTOS' && (
                      <label>
                        <span className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">Producto específico</span>
                        <select value={salesItemId} onChange={(event) => setSalesItemId(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          <option value="TODOS">Todos los productos</option>
                          {productFilterOptions.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                        </select>
                      </label>
                    )}

                    {salesItemType === 'COMBOS' && (
                      <label>
                        <span className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">Combo específico</span>
                        <select value={salesItemId} onChange={(event) => setSalesItemId(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          <option value="TODOS">Todos los combos</option>
                          {comboFilterOptions.map((combo) => <option key={combo.id} value={combo.id}>{combo.name}</option>)}
                        </select>
                      </label>
                    )}

                    <div className="flex items-end">
                      <button type="button" onClick={clearSalesFilters} disabled={!hasSalesFilters} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
                        <FilterX className="size-4" /> Limpiar filtros
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 lg:hidden dark:divide-slate-800/60">
                    {ventasFiltradas.length === 0 ? (
                      <div className="flex flex-col items-center px-5 py-12 text-center">
                        <FileText className="size-10 text-slate-300 dark:text-slate-600" />
                        <p className="mt-3 text-balance font-bold text-slate-600 dark:text-slate-300">{ventas.length === 0 ? 'Sin transacciones' : 'Sin resultados'}</p>
                        <p className="mt-1 text-pretty text-sm text-slate-400">{ventas.length === 0 ? 'Las ventas aparecerán aquí.' : 'Prueba cambiando o limpiando los filtros.'}</p>
                        {ventas.length > 0 && <button type="button" onClick={clearSalesFilters} className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">Limpiar filtros</button>}
                      </div>
                    ) : ventasFiltradas.map((venta, index) => {
                      const total = Number(venta.total || venta.monto || venta.importe || 0);
                      const fechaObj = getSaleDate(venta);
                      const fecha = !Number.isNaN(fechaObj.getTime()) ? peruDateFormatter.format(fechaObj) : '-';
                      const hora = !Number.isNaN(fechaObj.getTime()) ? peruTimeFormatter.format(fechaObj) : '-';
                      const metodo = venta.metodo_pago || venta.nombre_metodo || venta.metodo || 'Efectivo';
                      const saleNumber = venta.numero_venta || (ventasFiltradas.length - index);
                      const detalle = getSaleDetails(venta);
                      const metodoBg = getPaymentColor(metodo, venta.metodo_pago_color);

                      return (
                        <article key={`mobile-sale-${venta.id_venta ?? index}`} className="min-w-0 p-4 sm:p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-mono text-sm font-black tabular-nums" style={{ color: colorPrimary }}>#{String(saleNumber).padStart(4, '0')}</p>
                              <p className="mt-1 text-xs font-medium text-slate-400">{fecha} · {hora}</p>
                            </div>
                            <p className="shrink-0 text-lg font-black tabular-nums" style={{ color: colorPrimary }}>S/ {total.toFixed(2)}</p>
                          </div>

                          <p className="mt-3 line-clamp-2 text-pretty text-sm font-semibold text-slate-700 dark:text-slate-200" title={detalle || '-'}>{detalle || '-'}</p>

                          <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 dark:bg-slate-900/50">
                            <div className="min-w-0">
                              <p className="text-xs font-bold uppercase text-slate-400">Método</p>
                              <div className="mt-1.5 flex min-w-0 items-center gap-2">
                                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: metodoBg }} />
                                <span className="truncate text-sm font-bold text-slate-700 dark:text-slate-200">{metodo}</span>
                              </div>
                            </div>
                            <div className="min-w-0 border-t border-slate-200 pt-3 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0 dark:border-slate-700">
                              <p className="text-xs font-bold uppercase text-slate-400">Cuenta</p>
                              {venta.cuenta_destino ? (
                                <>
                                  <p className="mt-1 truncate font-mono text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">{venta.cuenta_destino}</p>
                                  <p className="truncate text-xs text-slate-400">{venta.cuenta_titular || 'Sin titular'}</p>
                                </>
                              ) : <p className="mt-1 text-sm text-slate-400">—</p>}
                            </div>
                          </div>

                          {!isCajero && <p className="mt-3 truncate text-xs text-slate-400">Cajero: <span className="font-semibold text-slate-600 dark:text-slate-300">{venta.cajero_nombre || 'Administrador'}</span></p>}
                        </article>
                      );
                    })}
                  </div>

                  <div className="hidden flex-1 overflow-x-auto lg:block">
                    <table className="w-full min-w-[980px] text-left">
                      <thead className="bg-slate-50 dark:bg-[#0B1120] border-b border-slate-100 dark:border-slate-800/60">
                        <tr>
                          <th className="px-5 py-4 text-[10px] font-black uppercase text-slate-400">#</th>
                          <th className="px-4 py-4 text-[10px] font-black uppercase text-slate-400">Fecha</th>
                          <th className="px-4 py-4 text-[10px] font-black uppercase text-slate-400">Hora</th>
                          <th className="px-4 py-4 text-[10px] font-black uppercase text-slate-400">Detalle</th>
                          {!isCajero && <th className="px-4 py-4 text-[10px] font-black uppercase text-slate-400">Cajero</th>}
                          <th className="px-4 py-4 text-[10px] font-black uppercase text-slate-400">Monto</th>
                          <th className="px-4 py-4 text-[10px] font-black uppercase text-slate-400">Método</th>
                          <th className="px-4 py-4 text-[10px] font-black uppercase text-slate-400">Cuenta receptora</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ventasFiltradas.length === 0 ? (
                          <tr>
                            <td colSpan={isCajero ? 7 : 8} className="py-16 text-center">
                              <div className="flex flex-col items-center text-slate-300 dark:text-slate-600">
                                <FileText className="w-12 h-12 mb-3" />
                                <p className="text-base font-bold text-slate-500 dark:text-slate-400">{ventas.length === 0 ? 'Sin transacciones' : 'Sin resultados'}</p>
                                <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">{ventas.length === 0 ? 'Las ventas aparecerán aquí.' : 'Prueba cambiando o limpiando los filtros.'}</p>
                                {ventas.length > 0 && <button type="button" onClick={clearSalesFilters} className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">Limpiar filtros</button>}
                              </div>
                            </td>
                          </tr>
                        ) : (
                          ventasFiltradas.map((venta, index) => {
                            const total = Number(venta.total || venta.monto || venta.importe || 0);
                            const fechaObj = getSaleDate(venta);
                            const fecha = !Number.isNaN(fechaObj.getTime()) ? peruDateFormatter.format(fechaObj) : '-';
                            const hora = !Number.isNaN(fechaObj.getTime()) ? peruTimeFormatter.format(fechaObj) : '-';
                            const metodo = (venta.metodo_pago || venta.nombre_metodo || venta.metodo || 'Efectivo');
                            const saleNumber = venta.numero_venta || (ventasFiltradas.length - index);
                            
                            const detallesStr = getSaleDetails(venta);

                            const metodoBg = getPaymentColor(metodo, venta.metodo_pago_color);

                            return (
                              <tr key={venta.id_venta ?? index} className="border-b border-slate-50 dark:border-slate-800/40 hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors group">
                                <td className="px-5 py-4">
                                  <span className="text-sm font-black font-mono tabular-nums" style={{ color: colorPrimary }}>#{String(saleNumber).padStart(4, '0')}</span>
                                </td>
                                <td className="px-4 py-4">
                                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">{fecha}</span>
                                </td>
                                <td className="px-4 py-4">
                                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{hora}</span>
                                </td>
                                <td className="px-4 py-4 max-w-[280px]">
                                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300 truncate block" title={detallesStr || '-'}>{detallesStr || '-'}</span>
                                </td>
                                {!isCajero && (
                                  <td className="px-4 py-4">
                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{venta.cajero_nombre || 'Administrador'}</span>
                                  </td>
                                )}
                                <td className="px-4 py-4">
                                  <span className="text-sm font-black tabular-nums whitespace-nowrap" style={{ color: colorPrimary }}>S/ {total.toFixed(2)}</span>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-2">
                                    <div className="size-2.5 rounded-full" style={{ backgroundColor: metodoBg }}></div>
                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300 capitalize">{metodo}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  {venta.cuenta_destino ? (
                                    <div className="max-w-[190px] min-w-0">
                                      <span className="block truncate font-mono text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200" title={venta.cuenta_destino}>{venta.cuenta_destino}</span>
                                      <span className="mt-0.5 block truncate text-xs font-medium text-slate-400" title={venta.cuenta_titular || 'Sin titular registrado'}>{venta.cuenta_titular || 'Sin titular registrado'}</span>
                                    </div>
                                  ) : (
                                    <span className="text-sm text-slate-400">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {ventasFiltradas.length > 0 && (
                    <div className="flex shrink-0 flex-col gap-1 bg-slate-50/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:bg-[#050B14]/30">
                      <span className="text-xs font-bold text-slate-400">{ventasFiltradas.length} ventas {isCajero ? 'de mi sesión' : 'del evento'}</span>
                      <span className="text-xs font-bold tabular-nums" style={{ color: colorPrimary }}>Total S/ {totalVentasValor.toFixed(2)}</span>
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal de cobro */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6">
          <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:max-h-[calc(100dvh-3rem)] dark:border-slate-800 dark:bg-[#0B1120]">
            
            {/* Header Limpio */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-6 dark:border-slate-800 dark:bg-[#0B1120]">
              <h3 className="flex items-center gap-3 text-balance text-lg font-bold text-slate-800 dark:text-white">
                <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  <CreditCard className="size-4" />
                </div>
                Pagar Orden
              </h3>
              <button type="button" onClick={() => setShowPaymentModal(false)} disabled={processingSale} aria-label="Cerrar confirmación de pago" className="flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:cursor-wait disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-slate-300">
                <X className="size-5" />
              </button>
            </div>
            
            <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 custom-scrollbar">
              {loadingMetodos ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-4 text-slate-500">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  <span className="font-semibold text-sm">Cargando métodos...</span>
                </div>
              ) : (
                <div className="grid min-w-0 gap-5 lg:grid-cols-2 lg:gap-6">
                  <div className="min-w-0 space-y-4">
                  <section aria-labelledby="payment-order-summary" className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/30">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h4 id="payment-order-summary" className="text-sm font-black text-slate-800 dark:text-white">Artículos de la venta</h4>
                        <p className="mt-0.5 text-xs text-slate-400">Verifica la orden antes de cobrar.</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                        {cart.reduce((sum, line) => sum + line.cantidad, 0)} unidades
                      </span>
                    </div>
                    <div className="max-h-48 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                      {cart.map((line) => {
                        const isProduct = line.tipo === 'producto';
                        const itemId = isProduct ? line.producto.id_producto : line.combo.id_combo;
                        const itemName = isProduct ? line.producto.nombre : line.combo.nombre;
                        const itemImage = isProduct ? line.producto.imagen_url : line.combo.imagen_url;
                        const unitPrice = isProduct ? Number(line.producto.precio_venta ?? line.producto.precio) : Number(line.combo.precio_combo);
                        return (
                          <div key={`payment-${line.tipo}-${itemId}`} className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/50">
                            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                              {itemImage ? (
                                <img src={resolveAssetUrl(itemImage)} alt={itemName} loading="lazy" className="size-full object-cover" />
                              ) : isProduct ? (
                                <ImageIcon className="size-5 text-slate-400" />
                              ) : (
                                <Layers className="size-5 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="rounded bg-white px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-400 dark:bg-slate-700 dark:text-slate-300">{isProduct ? 'Producto' : 'Combo'}</span>
                                <p className="truncate text-sm font-bold text-slate-800 dark:text-white">{itemName}</p>
                              </div>
                              <p className="mt-1 text-xs tabular-nums text-slate-400">{line.cantidad} × S/ {unitPrice.toFixed(2)}</p>
                            </div>
                            <p className="shrink-0 text-sm font-black tabular-nums text-slate-800 dark:text-white">S/ {(unitPrice * line.cantidad).toFixed(2)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* Total Block Corporativo */}
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-[#f8fafc] px-5 py-4 dark:border-slate-800 dark:bg-[#050B14]">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500">Total a cobrar</span>
                      <p className="mt-1 text-xs text-slate-400">{cart.length} {cart.length === 1 ? 'artículo' : 'artículos'} en la orden</p>
                    </div>
                    <span className="text-3xl font-black tabular-nums text-slate-900 dark:text-white">S/ {subtotal.toFixed(2)}</span>
                  </div>
                  </div>

                  <div className="min-w-0 space-y-4">

                  <div>
                    <p className="mb-3 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Seleccionar método de pago</p>
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                      {metodosPago.map(m => {
                        const isSelected = selectedMetodo === m.id_metodo_pago;
                        const hasTailwindColor = m.color_hex && !m.color_hex.startsWith('#');
                        
                        // Default styles if no specific color is provided
                        let selectedStyle = {};
                        let badgeStyle = {};
                        let badgeClassName = "max-w-full truncate text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ";

                        if (!hasTailwindColor && m.color_hex) {
                          if (isSelected) {
                            selectedStyle = { 
                              borderColor: m.color_hex, 
                              color: m.color_hex, 
                              backgroundColor: `${m.color_hex}10` 
                            };
                            badgeStyle = {
                              backgroundColor: `${m.color_hex}20`,
                              color: m.color_hex
                            };
                          } else {
                            badgeStyle = {
                              backgroundColor: `${m.color_hex}15`,
                              color: m.color_hex
                            };
                          }
                        } else if (hasTailwindColor) {
                          badgeClassName += m.color_hex;
                        } else {
                          // Fallback to primary color if no color at all
                          if (isSelected) {
                            selectedStyle = { borderColor: colorAccent, color: colorAccent, backgroundColor: `${colorAccent}10` };
                          }
                          badgeClassName += 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
                        }

                        return (
                          <button
                            key={m.id_metodo_pago}
                            onClick={() => seleccionarMetodoPago(m)}
                            className={`min-w-0 rounded-xl border-2 px-3 py-3 text-sm transition-colors flex flex-col items-center text-center gap-1.5 ${
                              isSelected 
                              ? `shadow-md` 
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120] hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            } ${isSelected && hasTailwindColor ? m.color_hex : ''}`}
                            style={selectedStyle}
                          >
                            <span className={`truncate w-full font-bold ${isSelected ? '' : 'text-slate-700 dark:text-slate-300'}`}>{m.nombre}</span>
                            <span 
                              className={badgeClassName}
                              style={badgeStyle}
                            >
                              {m.tipo === 'BILLETERA_DIGITAL' ? 'Billetera' : m.tipo === 'TRANSFERENCIA' ? 'Transferencia' : m.tipo}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {esTransferenciaSeleccionada && (
                    <section className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Phone className="size-4 text-primary" />
                            <h4 className="text-balance text-base font-black text-slate-900 dark:text-white">Depositar a este número</h4>
                          </div>
                          <p className="mt-1 text-pretty text-sm leading-5 text-slate-500 dark:text-slate-400">Indica al cliente este número antes de confirmar el pago.</p>
                        </div>
                        <button type="button" onClick={() => setShowNuevaCuenta(value => !value)} className="self-start shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:border-primary hover:text-primary dark:border-slate-700 dark:bg-[#0B1120] dark:text-slate-300">
                          <Plus className="mr-1 inline size-3.5" /> Otro número
                        </button>
                      </div>

                      {cuentasPagoSeleccionadas.length > 0 ? (
                        <div className="mt-3 space-y-3">
                          <select value={selectedCuentaPago ?? ''} onChange={e => setSelectedCuentaPago(Number(e.target.value))} className="block w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold tabular-nums text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-[#0B1120] dark:text-white">
                            {cuentasPagoSeleccionadas.map((cuenta: any) => (
                              <option key={cuenta.id_cuenta_pago} value={cuenta.id_cuenta_pago}>
                                {cuenta.numero_destino}{cuenta.nombre_titular ? ` — ${cuenta.nombre_titular}` : ''}{cuenta.es_predeterminado ? ' (predeterminado)' : ''}
                              </option>
                            ))}
                          </select>
                          {cuentaPagoSeleccionada && (
                            <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-primary/20 bg-white p-4 dark:bg-[#0B1120]">
                              <div className="min-w-0">
                                <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Número receptor</p>
                                <p className="mt-1 truncate text-2xl font-black tabular-nums text-slate-900 dark:text-white">{cuentaPagoSeleccionada.numero_destino}</p>
                                <p className="mt-0.5 truncate text-sm font-semibold text-slate-600 dark:text-slate-300">{cuentaPagoSeleccionada.nombre_titular || 'Sin titular registrado'}</p>
                              </div>
                              <div className="flex gap-1">
                                <button type="button" onClick={() => navigator.clipboard.writeText(cuentaPagoSeleccionada.numero_destino).then(() => toast.success('Número copiado'))} aria-label="Copiar número receptor" title="Copiar número" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-primary dark:hover:bg-slate-800">
                                  <Copy className="size-4" />
                                </button>
                                <button type="button" onClick={marcarCuentaPredeterminada} disabled={cuentaPagoSeleccionada.es_predeterminado} aria-label="Marcar como número predeterminado" title="Usar como predeterminado" className="rounded-lg p-2 text-slate-400 hover:bg-amber-50 hover:text-amber-500 disabled:text-amber-500 dark:hover:bg-amber-500/10">
                                  <Star className={`size-4 ${cuentaPagoSeleccionada.es_predeterminado ? 'fill-current' : ''}`} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : !showNuevaCuenta ? (
                        <button type="button" onClick={() => setShowNuevaCuenta(true)} className="mt-3 w-full rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-700 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                          Agregar el primer número receptor
                        </button>
                      ) : null}

                      {showNuevaCuenta && (
                        <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
                          <input value={nuevoTitularCuenta} onChange={e => setNuevoTitularCuenta(e.target.value)} maxLength={120} placeholder="Titular o alias" aria-label="Titular o alias de la cuenta" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-[#0B1120] dark:text-white" />
                          <input value={nuevoNumeroCuenta} onChange={e => setNuevoNumeroCuenta(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={30} placeholder="Número receptor" aria-label="Nuevo número receptor" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm tabular-nums outline-none focus:border-primary dark:border-slate-700 dark:bg-[#0B1120] dark:text-white" />
                          <button type="button" onClick={agregarCuentaDesdeCaja} disabled={savingCuenta} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60 sm:col-span-2">
                            {savingCuenta ? '...' : 'Agregar'}
                          </button>
                        </div>
                      )}
                    </section>
                  )}

                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-white px-4 py-4 sm:flex-row sm:justify-end sm:px-6 dark:border-slate-800 dark:bg-[#0B1120]">
              <button type="button" onClick={() => setShowPaymentModal(false)} disabled={processingSale} className="rounded-xl border border-slate-200 px-5 py-3 text-center text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50 sm:w-32 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Cancelar</button>
              <button 
                type="button"
                onClick={procesarCobro} 
                disabled={processingSale}
                aria-busy={processingSale}
                className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-sm hover:opacity-95 disabled:cursor-wait disabled:opacity-70 sm:min-w-64"
                style={{ backgroundColor: colorAccent }}
              >
                {processingSale ? <RefreshCw className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {processingSale ? 'Registrando venta…' : 'Confirmar y Cobrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

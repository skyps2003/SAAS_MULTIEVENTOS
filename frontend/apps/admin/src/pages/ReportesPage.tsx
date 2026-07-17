import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_TOOLTIP_CONTENT_STYLE, CHART_TOOLTIP_ITEM_STYLE, CHART_TOOLTIP_LABEL_STYLE } from '../lib/chartTheme';
import { ArrowDownRight, ArrowUpRight, CalendarDays, Download, FilterX, Landmark, RefreshCw, Search, WalletCards } from 'lucide-react';
import type { jsPDF } from 'jspdf';
import api from '../services/api';
import { toast } from 'sonner';
import { useEventStore } from '../stores/eventStore';
import { resolveAssetUrl } from '../lib/assetUrl';

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  yape: '#a855f7',
  plin: '#06b6d4',
  efectivo: '#10b981',
  tarjeta: '#3b82f6',
};

const PERU_TIME_ZONE = 'America/Lima';
const peruDateFormatter = new Intl.DateTimeFormat('es-PE', { timeZone: PERU_TIME_ZONE, day: '2-digit', month: 'short', year: 'numeric' });
const peruTimeFormatter = new Intl.DateTimeFormat('es-PE', { timeZone: PERU_TIME_ZONE, hour: '2-digit', minute: '2-digit' });
const peruDateKeyFormatter = new Intl.DateTimeFormat('en-US', { timeZone: PERU_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

const getSaleDate = (sale: any) => new Date(sale.fecha_hora || sale.created_at || sale.fecha || 0);
const getPeruDateKey = (date: Date) => {
  const parts = Object.fromEntries(peruDateKeyFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const getSaleCashier = (sale: any) => sale.cajero_nombre || sale.usuario_nombre || 'Administrador';
const getSaleMethod = (sale: any) => sale.metodo_pago || sale.nombre_metodo || sale.metodo || 'Efectivo';
const getSaleReference = (sale: any) => sale.referencia || sale.numero_referencia || sale.referencia_pago || sale.numero_operacion || '';

const getSaleDetails = (sale: any) => {
  const products = (sale.detalles || sale.detalles_venta || sale.items || [])
    .filter((detail: any) => !detail.es_parte_combo)
    .map((detail: any) => `${detail.cantidad}x ${detail.producto_nombre || detail.nombre || 'Producto'}`);
  const combos = (sale.combos || []).map((combo: any) => `${combo.cantidad}x Combo: ${combo.combo_nombre || combo.nombre || 'Combo'}`);
  return [...products, ...combos].join(' · ') || 'Sin detalle';
};

const getPaymentMethodColor = (method: string, configuredColor?: string) => {
  if (configuredColor && /^#[0-9a-f]{6}$/i.test(configuredColor)) return configuredColor;
  const normalized = `${configuredColor || ''} ${method}`.toLowerCase();
  return Object.entries(PAYMENT_METHOD_COLORS).find(([name]) => normalized.includes(name))?.[1] || '#64748b';
};

const getReadableTextColor = (hexColor: string) => {
  const [red, green, blue] = hexColor.slice(1).match(/.{2}/g)!.map(value => Number.parseInt(value, 16));
  return (red * 299 + green * 587 + blue * 114) / 1000 > 150 ? '#0f172a' : '#ffffff';
};

const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

type PdfChartPoint = { label: string; value: number };

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#15803d';
  return [Number.parseInt(normalized.slice(1, 3), 16), Number.parseInt(normalized.slice(3, 5), 16), Number.parseInt(normalized.slice(5, 7), 16)];
};

const loadImageAsDataUrl = async (source: string) => {
  const response = await fetch(source);
  if (!response.ok) throw new Error('No se pudo cargar el logo');
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};

const drawPdfLetterhead = (doc: jsPDF, options: { eventName: string; primary: [number, number, number]; secondary: [number, number, number]; accent: [number, number, number]; logo?: string; logoFormat?: string; section: string }) => {
  const { eventName, primary, secondary, accent, logo, logoFormat, section } = options;
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  doc.setFillColor(255, 255, 255); doc.rect(0, 0, width, height, 'F');

  // Firma visual limpia: una franja superior segmentada con los colores del evento.
  doc.setFillColor(...primary); doc.rect(0, 0, width, 3, 'F');
  doc.setFillColor(...secondary); doc.rect(width - 82, 0, 54, 3, 'F');
  doc.setFillColor(...accent); doc.rect(width - 28, 0, 28, 3, 'F');

  doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240); doc.roundedRect(10, 8, 18, 18, 3, 3, 'FD');
  if (logo && logoFormat) {
    try { doc.addImage(logo, logoFormat, 12, 10, 14, 14); } catch { /* El membrete conserva el nombre si el formato no es compatible. */ }
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(15, 23, 42); doc.text(eventName, 33, 14.5, { maxWidth: width - 118 });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139); doc.text(section, 33, 20.5, { maxWidth: width - 118 });

  doc.setFillColor(248, 250, 252); doc.roundedRect(width - 77, 8, 67, 18, 3, 3, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...primary); doc.text('INFORME DEL EVENTO', width - 72, 13);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(30, 41, 59); doc.text('Reporte de ventas', width - 72, 18);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(100, 116, 139);
  doc.text(new Date().toLocaleString('es-PE', { timeZone: PERU_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' }), width - 72, 22.5);

  doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.25); doc.line(10, 30, width - 10, 30);
  doc.setDrawColor(...primary); doc.setLineWidth(0.7); doc.line(10, 30, 38, 30);

  doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.25); doc.line(10, height - 10, width - 10, height - 10);
  doc.setFillColor(...primary); doc.roundedRect(10, height - 7.6, 2.4, 2.4, 0.6, 0.6, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(71, 85, 105); doc.text('Hecho en sistema TUPOS', 15, height - 5.7);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139); doc.text('terateniete@gmail.com', 48, height - 5.7);
};

const drawPdfMetric = (doc: jsPDF, bounds: { x: number; y: number; width: number }, label: string, value: string, color: [number, number, number]) => {
  const { x, y, width } = bounds;
  doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240); doc.roundedRect(x, y, width, 16, 2.5, 2.5, 'FD');
  doc.setFillColor(...color); doc.roundedRect(x, y, 2, 16, 1, 1, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(100, 116, 139); doc.text(label.toUpperCase(), x + 6, y + 5.5);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(15, 23, 42); doc.text(value, x + 6, y + 12);
};

const drawPdfChartFrame = (doc: jsPDF, x: number, y: number, width: number, height: number, title: string, subtitle: string, legend: string, color: [number, number, number]) => {
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, width, height, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(title, x + 5, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(subtitle, x + 5, y + 12, { maxWidth: width - 10 });
  doc.setFillColor(...color);
  doc.rect(x + width - 35, y + 5, 3, 3, 'F');
  doc.setTextColor(71, 85, 105);
  doc.text(legend, x + width - 30, y + 7.8, { maxWidth: 27 });
};

const drawPdfBarChart = (doc: jsPDF, bounds: { x: number; y: number; width: number; height: number }, title: string, subtitle: string, legend: string, data: PdfChartPoint[], color: [number, number, number], currency = true) => {
  const { x, y, width, height } = bounds;
  drawPdfChartFrame(doc, x, y, width, height, title, subtitle, legend, color);
  const visible = data.slice(0, 6);
  if (visible.length === 0) {
    doc.setFontSize(8); doc.setTextColor(148, 163, 184); doc.text('Sin datos disponibles', x + width / 2, y + height / 2, { align: 'center' }); return;
  }
  const max = Math.max(...visible.map((item) => item.value), 1);
  const chartTop = y + 20;
  const rowHeight = (height - 25) / visible.length;
  visible.forEach((item, index) => {
    const rowY = chartTop + index * rowHeight;
    const label = item.label.length > 22 ? `${item.label.slice(0, 21)}…` : item.label;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(71, 85, 105); doc.text(label, x + 5, rowY + 3);
    doc.setFillColor(241, 245, 249); doc.roundedRect(x + 43, rowY, width - 68, 4, 1, 1, 'F');
    doc.setFillColor(...color); doc.roundedRect(x + 43, rowY, Math.max(1, ((width - 68) * item.value) / max), 4, 1, 1, 'F');
    doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59); doc.text(currency ? `S/ ${item.value.toFixed(2)}` : String(item.value), x + width - 4, rowY + 3, { align: 'right' });
  });
};

const drawPdfLineChart = (doc: jsPDF, bounds: { x: number; y: number; width: number; height: number }, title: string, subtitle: string, legend: string, data: PdfChartPoint[], color: [number, number, number]) => {
  const { x, y, width, height } = bounds;
  drawPdfChartFrame(doc, x, y, width, height, title, subtitle, legend, color);
  if (data.length === 0) {
    doc.setFontSize(8); doc.setTextColor(148, 163, 184); doc.text('Sin datos disponibles', x + width / 2, y + height / 2, { align: 'center' }); return;
  }
  const chartX = x + 12; const chartY = y + 20; const chartWidth = width - 18; const chartHeight = height - 30;
  const max = Math.max(...data.map((item) => item.value), 1);
  doc.setDrawColor(226, 232, 240); doc.line(chartX, chartY + chartHeight, chartX + chartWidth, chartY + chartHeight); doc.line(chartX, chartY, chartX, chartY + chartHeight);
  doc.setDrawColor(...color); doc.setLineWidth(0.8);
  data.forEach((item, index) => {
    const pointX = chartX + (data.length === 1 ? chartWidth / 2 : (index * chartWidth) / (data.length - 1));
    const pointY = chartY + chartHeight - (item.value / max) * chartHeight;
    if (index > 0) {
      const previous = data[index - 1];
      const previousX = chartX + ((index - 1) * chartWidth) / (data.length - 1);
      const previousY = chartY + chartHeight - (previous.value / max) * chartHeight;
      doc.line(previousX, previousY, pointX, pointY);
    }
    doc.setFillColor(...color); doc.circle(pointX, pointY, 1, 'F');
  });
  const labelIndexes = Array.from(new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]));
  doc.setFontSize(6); doc.setTextColor(100, 116, 139);
  labelIndexes.forEach((index) => {
    const pointX = chartX + (data.length === 1 ? chartWidth / 2 : (index * chartWidth) / (data.length - 1));
    doc.text(data[index].label, pointX, chartY + chartHeight + 5, { align: 'center' });
  });
  doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59); doc.text(`Máx. S/ ${max.toFixed(2)}`, chartX, chartY - 2);
};

export function ReportesPage() {
  const { currentEvent } = useEventStore();
  const [ventas, setVentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [cashier, setCashier] = useState('TODOS');
  const [method, setMethod] = useState('TODOS');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [exportingPdf, setExportingPdf] = useState(false);
  const pageSize = 10;

  const fetchSales = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get('/ventas');
      setVentas(response.data || []);
      setLastUpdate(new Date());
      setLoadError('');
    } catch {
      setLoadError('No se pudieron cargar las ventas del evento.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
    const refreshInterval = window.setInterval(() => fetchSales(true), 15_000);
    return () => window.clearInterval(refreshInterval);
  }, []);

  const cashierOptions = useMemo(() => Array.from(new Set(ventas.map(getSaleCashier))).sort((a, b) => a.localeCompare(b, 'es')), [ventas]);
  const methodOptions = useMemo(() => Array.from(new Set(ventas.map(getSaleMethod))).sort((a, b) => a.localeCompare(b, 'es')), [ventas]);

  const filteredSales = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return ventas.filter((sale) => {
      const saleDate = getSaleDate(sale);
      const dateKey = Number.isNaN(saleDate.getTime()) ? '' : getPeruDateKey(saleDate);
      const cashierName = getSaleCashier(sale);
      const methodName = getSaleMethod(sale);
      const searchable = [sale.numero_venta, sale.id_venta, cashierName, methodName, sale.cuenta_destino, sale.cuenta_titular, getSaleReference(sale), getSaleDetails(sale)].join(' ').toLowerCase();
      return (!normalizedSearch || searchable.includes(normalizedSearch))
        && (cashier === 'TODOS' || cashierName === cashier)
        && (method === 'TODOS' || methodName === method)
        && (!dateFrom || dateKey >= dateFrom)
        && (!dateTo || dateKey <= dateTo);
    });
  }, [ventas, search, cashier, method, dateFrom, dateTo]);

  const filteredTotalAmount = useMemo(() => filteredSales.reduce((sum, sale) => sum + Number(sale.total || sale.monto || sale.importe || 0), 0), [filteredSales]);
  const saleAmounts = useMemo(() => ventas.map((sale) => Number(sale.total || sale.monto || sale.importe || 0)), [ventas]);
  const highestSale = saleAmounts.length > 0 ? Math.max(...saleAmounts) : 0;
  const lowestSale = saleAmounts.length > 0 ? Math.min(...saleAmounts) : 0;
  const receivingAmount = useMemo(() => ventas.filter((sale) => Boolean(sale.cuenta_destino)).reduce((sum, sale) => sum + Number(sale.total || sale.monto || sale.importe || 0), 0), [ventas]);

  const cumulativeSales = useMemo(() => {
    let accumulated = 0;
    return [...ventas]
      .sort((first, second) => getSaleDate(first).getTime() - getSaleDate(second).getTime())
      .map((sale, index) => {
        accumulated += Number(sale.total || sale.monto || sale.importe || 0);
        const date = getSaleDate(sale);
        return { orden: index + 1, hora: Number.isNaN(date.getTime()) ? `Venta ${index + 1}` : peruTimeFormatter.format(date), acumulado: accumulated };
      });
  }, [ventas]);

  const accountPerformance = useMemo(() => {
    const accounts = new Map<string, { cuenta: string; titular: string; etiqueta: string; total: number; ventas: number }>();
    ventas.filter((sale) => Boolean(sale.cuenta_destino)).forEach((sale) => {
      const cuenta = String(sale.cuenta_destino);
      const titular = sale.cuenta_titular || 'Sin titular';
      const current = accounts.get(cuenta) || { cuenta, titular, etiqueta: `${titular} · ${cuenta}`, total: 0, ventas: 0 };
      current.total += Number(sale.total || sale.monto || sale.importe || 0);
      current.ventas += 1;
      accounts.set(cuenta, current);
    });
    return Array.from(accounts.values()).sort((first, second) => second.total - first.total);
  }, [ventas]);

  const amountRanges = useMemo(() => {
    const ranges = [
      { rango: 'S/ 0–49', min: 0, max: 50, ventas: 0 },
      { rango: 'S/ 50–99', min: 50, max: 100, ventas: 0 },
      { rango: 'S/ 100–199', min: 100, max: 200, ventas: 0 },
      { rango: 'S/ 200+', min: 200, max: Number.POSITIVE_INFINITY, ventas: 0 },
    ];
    ventas.forEach((sale) => {
      const total = Number(sale.total || sale.monto || sale.importe || 0);
      const range = ranges.find((item) => total >= item.min && total < item.max);
      if (range) range.ventas += 1;
    });
    return ranges;
  }, [ventas]);

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleSales = filteredSales.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasFilters = Boolean(search || cashier !== 'TODOS' || method !== 'TODOS' || dateFrom || dateTo);

  const clearFilters = () => {
    setSearch('');
    setCashier('TODOS');
    setMethod('TODOS');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const exportCsv = () => {
    if (filteredSales.length === 0) return toast.info('No hay ventas para exportar');
    const header = ['Venta', 'Fecha', 'Hora', 'Cajero', 'Productos y combos', 'Método', 'Cuenta receptora', 'Titular', 'Referencia', 'Monto'];
    const rows = filteredSales.map((sale) => {
      const date = getSaleDate(sale);
      return [sale.numero_venta || sale.id_venta, peruDateFormatter.format(date), peruTimeFormatter.format(date), getSaleCashier(sale), getSaleDetails(sale), getSaleMethod(sale), sale.cuenta_destino || '', sale.cuenta_titular || '', getSaleReference(sale), Number(sale.total || 0).toFixed(2)];
    });
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `reporte-ventas-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    if (filteredSales.length === 0) return toast.info('No hay ventas para generar el PDF');
    setExportingPdf(true);
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const eventName = currentEvent?.nombre || 'Evento';
      const primary = hexToRgb(currentEvent?.paleta?.color_primario_base || '#15803d');
      const secondary = hexToRgb(currentEvent?.paleta?.color_secundario_base || '#0f766e');
      const accent = hexToRgb(currentEvent?.paleta?.color_acento_base || '#38bdf8');
      const pageWidth = doc.internal.pageSize.getWidth();
      let logoData: string | undefined;
      let logoFormat: string | undefined;
      if (currentEvent?.logo_url) {
        try {
          logoData = await loadImageAsDataUrl(resolveAssetUrl(currentEvent.logo_url));
          logoFormat = logoData.startsWith('data:image/jpeg') ? 'JPEG' : logoData.startsWith('data:image/webp') ? 'WEBP' : 'PNG';
        } catch (error) {
          console.warn('No se pudo incorporar el logo al PDF', error);
        }
      }
      const letterheadBase = { eventName, primary, secondary, accent, logo: logoData, logoFormat };
      drawPdfLetterhead(doc, { ...letterheadBase, section: 'Reporte integral de ventas y analítica del evento' });
      doc.setTextColor(100, 116, 139); doc.setFontSize(7);
      const filterSummary = hasFilters ? `Tabla filtrada: ${filteredSales.length} de ${ventas.length} ventas` : `Tabla completa: ${ventas.length} ventas`;
      doc.text(filterSummary, 10, 35);

      const metricGap = 4;
      const metricWidth = (pageWidth - 20 - metricGap * 3) / 4;
      const averageTicket = filteredSales.length > 0 ? filteredTotalAmount / filteredSales.length : 0;
      const filteredCashiers = new Set(filteredSales.map(getSaleCashier)).size;
      const filteredMethods = new Set(filteredSales.map(getSaleMethod)).size;
      drawPdfMetric(doc, { x: 10, y: 38, width: metricWidth }, 'Ventas registradas', String(filteredSales.length), primary);
      drawPdfMetric(doc, { x: 10 + metricWidth + metricGap, y: 38, width: metricWidth }, 'Recaudación', `S/ ${filteredTotalAmount.toFixed(2)}`, secondary);
      drawPdfMetric(doc, { x: 10 + (metricWidth + metricGap) * 2, y: 38, width: metricWidth }, 'Ticket promedio', `S/ ${averageTicket.toFixed(2)}`, accent);
      drawPdfMetric(doc, { x: 10 + (metricWidth + metricGap) * 3, y: 38, width: metricWidth }, 'Cajeros / métodos', `${filteredCashiers} / ${filteredMethods}`, primary);

      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(15, 23, 42); doc.text('Detalle de ventas', 10, 61);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100, 116, 139); doc.text('Información completa de operaciones, medios de pago y cuentas receptoras.', 10, 65);

      const tableBody = filteredSales.map((sale) => {
        const date = getSaleDate(sale);
        const account = sale.cuenta_destino
          ? `${sale.cuenta_destino}\n${sale.cuenta_titular || 'Sin titular'}${getSaleReference(sale) ? `\nRef: ${getSaleReference(sale)}` : ''}`
          : getSaleReference(sale) || '—';
        return [
          `#${String(sale.numero_venta || sale.id_venta || '').padStart(4, '0')}`,
          Number.isNaN(date.getTime()) ? '—' : peruDateFormatter.format(date),
          Number.isNaN(date.getTime()) ? '—' : peruTimeFormatter.format(date),
          getSaleCashier(sale),
          getSaleDetails(sale),
          getSaleMethod(sale),
          account,
          `S/ ${Number(sale.total || sale.monto || sale.importe || 0).toFixed(2)}`,
        ];
      });

      autoTable(doc, {
        startY: 69,
        head: [['Venta', 'Fecha', 'Hora', 'Cajero', 'Productos y combos', 'Método', 'Cuenta / referencia', 'Monto']],
        body: tableBody,
        theme: 'grid',
        margin: { left: 10, right: 10, top: 35, bottom: 16 },
        styles: { font: 'helvetica', fontSize: 6.5, cellPadding: 2, textColor: [51, 65, 85], lineColor: [226, 232, 240], lineWidth: 0.1, valign: 'middle' },
        headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.2, cellPadding: 2.2 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        bodyStyles: { minCellHeight: 7 },
        columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 25 }, 2: { cellWidth: 18 }, 3: { cellWidth: 29 }, 4: { cellWidth: 72 }, 5: { cellWidth: 27 }, 6: { cellWidth: 53 }, 7: { cellWidth: 24, halign: 'right', fontStyle: 'bold' } },
        willDrawPage: (hookData) => {
          if (hookData.pageNumber > 1) drawPdfLetterhead(doc, { ...letterheadBase, section: 'Detalle de ventas · continuación' });
        },
      });

      const hourlyMap = new Map<number, number>();
      const paymentMap = new Map<string, number>();
      const cashierMap = new Map<string, number>();
      const productMap = new Map<string, number>();
      const comboMap = new Map<string, number>();
      ventas.forEach((sale) => {
        const date = getSaleDate(sale);
        if (!Number.isNaN(date.getTime())) {
          const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: PERU_TIME_ZONE, hour: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(({ type, value }) => [type, value]));
          const hour = Number(parts.hour);
          hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + Number(sale.total || 0));
        }
        const payment = getSaleMethod(sale); paymentMap.set(payment, (paymentMap.get(payment) || 0) + Number(sale.total || 0));
        const cashierName = getSaleCashier(sale); cashierMap.set(cashierName, (cashierMap.get(cashierName) || 0) + Number(sale.total || 0));
        (sale.detalles || sale.detalles_venta || sale.items || []).filter((detail: any) => !detail.es_parte_combo).forEach((detail: any) => {
          const name = detail.producto_nombre || detail.nombre || 'Producto'; productMap.set(name, (productMap.get(name) || 0) + Number(detail.cantidad || 0));
        });
        (sale.combos || []).forEach((combo: any) => {
          const name = combo.combo_nombre || combo.nombre || 'Combo'; comboMap.set(name, (comboMap.get(name) || 0) + Number(combo.cantidad || 0));
        });
      });
      const mapToPoints = (map: Map<string, number>) => Array.from(map, ([label, value]) => ({ label, value })).sort((first, second) => second.value - first.value);
      const hourlyPoints = Array.from(hourlyMap, ([hour, value]) => ({ label: `${String(hour).padStart(2, '0')}:00`, value })).sort((first, second) => first.label.localeCompare(second.label));
      const cumulativePoints = cumulativeSales.map((item) => ({ label: item.hora, value: item.acumulado }));
      const accountPoints = accountPerformance.map((item) => ({ label: `${item.titular} · ${item.cuenta}`, value: item.total }));
      const rangePoints = amountRanges.map((item) => ({ label: item.rango, value: item.ventas }));

      const charts: Array<{ kind: 'line' | 'bar'; title: string; subtitle: string; legend: string; data: PdfChartPoint[]; currency?: boolean }> = [
        { kind: 'line', title: 'Reporte · Recaudación acumulada', subtitle: 'Crecimiento progresivo durante el evento', legend: 'Monto acumulado', data: cumulativePoints },
        { kind: 'bar', title: 'Reporte · Distribución por monto', subtitle: 'Cantidad de ventas por rango de ticket', legend: 'N.º de ventas', data: rangePoints, currency: false },
        { kind: 'bar', title: 'Reporte · Cuentas receptoras', subtitle: 'Dinero recibido por cuenta y titular', legend: 'Monto recibido', data: accountPoints },
        { kind: 'line', title: 'Dashboard · Ingresos por hora', subtitle: 'Monto vendido en cada hora de Perú', legend: 'Ingresos por hora', data: hourlyPoints },
        { kind: 'bar', title: 'Dashboard · Métodos de pago', subtitle: 'Distribución del dinero según método', legend: 'Monto cobrado', data: mapToPoints(paymentMap) },
        { kind: 'bar', title: 'Dashboard · Ventas por cajero', subtitle: 'Monto registrado por cada cajero', legend: 'Monto vendido', data: mapToPoints(cashierMap) },
        { kind: 'bar', title: 'Dashboard · Productos más vendidos', subtitle: 'Ranking de productos por unidades', legend: 'Unidades', data: mapToPoints(productMap), currency: false },
        { kind: 'bar', title: 'Dashboard · Combos más vendidos', subtitle: 'Ranking de combos por unidades', legend: 'Unidades', data: mapToPoints(comboMap), currency: false },
      ];

      const graphMargin = 10; const graphGap = 7; const graphWidth = (pageWidth - graphMargin * 2 - graphGap) / 2; const graphHeight = 74;
      charts.forEach((chart, index) => {
        if (index % 4 === 0) {
          doc.addPage();
          drawPdfLetterhead(doc, { ...letterheadBase, section: 'Gráficos analíticos · etiquetas y leyendas incluidas' });
        }
        const position = index % 4; const column = position % 2; const row = Math.floor(position / 2);
        const bounds = { x: graphMargin + column * (graphWidth + graphGap), y: 36 + row * (graphHeight + 7), width: graphWidth, height: graphHeight };
        if (chart.kind === 'line') drawPdfLineChart(doc, bounds, chart.title, chart.subtitle, chart.legend, chart.data, primary);
        else drawPdfBarChart(doc, bounds, chart.title, chart.subtitle, chart.legend, chart.data, primary, chart.currency !== false);
      });

      const totalPages = doc.getNumberOfPages();
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        doc.setPage(pageNumber); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(100, 116, 139);
        doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - 10, doc.internal.pageSize.getHeight() - 5.7, { align: 'right' });
      }
      const safeName = eventName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'evento';
      doc.save(`reporte-${safeName}.pdf`);
      toast.success('PDF generado correctamente');
    } catch (error) {
      console.error('Error generando PDF', error);
      toast.error('No se pudo generar el PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="event-admin w-full space-y-8 pb-10">
      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="event-page-title">Reporte de ventas</h1>
          <p className="event-page-description">Analiza, filtra y exporta todas las ventas registradas en el evento.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button type="button" onClick={exportCsv} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><Download className="size-4" /> Exportar CSV</button>
          <button type="button" onClick={exportPdf} disabled={exportingPdf} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-wait disabled:opacity-70"><Download className="size-4" /> {exportingPdf ? 'Generando PDF…' : 'Descargar PDF'}</button>
        </div>
      </div>

      <section className="hidden" aria-labelledby="report-filters-title">
        <div className="mb-4 flex items-center justify-between gap-3"><div><h2 id="report-filters-title" className="text-balance text-sm font-black text-slate-800 dark:text-white">Filtros del reporte</h2><p className="mt-1 text-xs text-slate-400">Los gráficos, indicadores y tabla usan los mismos filtros.</p></div><button type="button" onClick={() => fetchSales()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 disabled:cursor-wait disabled:opacity-50 dark:border-slate-700"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /><span className="hidden sm:inline">Actualizar</span></button></div>
        {loadError && <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">{loadError}</div>}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="xl:col-span-2"><span className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">Buscar</span><span className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Venta, producto, combo o referencia" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></span></label>
          <label><span className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">Cajero</span><select value={cashier} onChange={(event) => { setCashier(event.target.value); setPage(1); }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="TODOS">Todos los cajeros</option>{cashierOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label><span className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">Método</span><select value={method} onChange={(event) => { setMethod(event.target.value); setPage(1); }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="TODOS">Todos los métodos</option>{methodOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label><span className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">Desde</span><span className="relative block"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></span></label>
          <label><span className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">Hasta</span><span className="relative block"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></span></label>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-400">Actualización automática cada 15 segundos · {lastUpdate ? lastUpdate.toLocaleTimeString('es-PE', { timeZone: PERU_TIME_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'pendiente'}</p><button type="button" onClick={clearFilters} disabled={!hasFilters} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"><FilterX className="size-4" /> Limpiar filtros</button></div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="event-card event-stat-card p-5"><div className="event-stat-icon mb-4"><ArrowUpRight className="size-4" /></div><p className="event-stat-label">Venta de mayor monto</p><p className="event-stat-value tabular-nums">S/ {highestSale.toFixed(2)}</p></div>
        <div className="event-card event-stat-card p-5"><div className="event-stat-icon mb-4"><ArrowDownRight className="size-4" /></div><p className="event-stat-label">Venta de menor monto</p><p className="event-stat-value tabular-nums">S/ {lowestSale.toFixed(2)}</p></div>
        <div className="event-card event-stat-card p-5"><div className="event-stat-icon mb-4"><WalletCards className="size-4" /></div><p className="event-stat-label">Cobrado a cuentas</p><p className="event-stat-value tabular-nums">S/ {receivingAmount.toFixed(2)}</p></div>
        <div className="event-card event-stat-card p-5"><div className="event-stat-icon mb-4"><Landmark className="size-4" /></div><p className="event-stat-label">Cuentas utilizadas</p><p className="event-stat-value tabular-nums">{accountPerformance.length}</p></div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="event-card p-5 xl:col-span-2" aria-labelledby="cumulative-sales-title"><div className="mb-5"><h2 id="cumulative-sales-title" className="text-balance text-sm font-black text-slate-800 dark:text-white">Recaudación acumulada</h2><p className="mt-1 text-pretty text-xs text-slate-400">Crecimiento progresivo del dinero recaudado durante el evento.</p></div><div className="h-72">{cumulativeSales.length > 0 ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={cumulativeSales} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" /><XAxis dataKey="hora" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(value) => `S/${value}`} /><Tooltip formatter={(value) => [`S/ ${Number(value).toFixed(2)}`, 'Acumulado']} labelFormatter={(label) => `${label} (Perú)`} contentStyle={CHART_TOOLTIP_CONTENT_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} /><Area type="monotone" dataKey="acumulado" stroke="var(--event-primary)" fill="var(--event-primary)" fillOpacity={0.14} strokeWidth={3} /></AreaChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">No hay ventas para calcular la recaudación acumulada.</div>}</div></section>
        <section className="event-card p-5" aria-labelledby="amount-ranges-title"><div className="mb-5"><h2 id="amount-ranges-title" className="text-balance text-sm font-black text-slate-800 dark:text-white">Distribución por monto</h2><p className="mt-1 text-pretty text-xs text-slate-400">Cantidad de ventas según el valor del ticket.</p></div><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={amountRanges} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" /><XAxis dataKey="rango" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} /><Tooltip formatter={(value) => [value, 'Ventas']} contentStyle={CHART_TOOLTIP_CONTENT_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} /><Bar dataKey="ventas" fill="var(--event-primary)" radius={[8, 8, 0, 0]} maxBarSize={48} /></BarChart></ResponsiveContainer></div></section>
      </div>

      <section className="event-card p-5" aria-labelledby="accounts-performance-title">
        <div className="mb-5"><h2 id="accounts-performance-title" className="text-balance text-sm font-black text-slate-800 dark:text-white">Recaudación por cuenta receptora</h2><p className="mt-1 text-pretty text-xs text-slate-400">Monto recibido y cantidad de cobros registrados en cada cuenta.</p></div>
        <div className="h-72">{accountPerformance.length > 0 ? <ResponsiveContainer width="100%" height="100%"><BarChart data={accountPerformance} layout="vertical" margin={{ top: 0, right: 16, left: 20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" /><XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(value) => `S/${value}`} /><YAxis type="category" dataKey="etiqueta" width={150} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} /><Tooltip formatter={(value) => [`S/ ${Number(value).toFixed(2)}`, 'Recaudado']} contentStyle={CHART_TOOLTIP_CONTENT_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} /><Bar dataKey="total" fill="var(--event-primary)" radius={[0, 8, 8, 0]} maxBarSize={30} /></BarChart></ResponsiveContainer> : <div className="flex h-full flex-col items-center justify-center text-center text-slate-400"><Landmark className="mb-3 size-8" /><p className="font-bold">Sin cuentas receptoras utilizadas</p><p className="mt-1 text-sm">Aparecerán cuando se registre un cobro hacia una cuenta.</p></div>}</div>
        {accountPerformance.length > 0 && <div className="mt-4 grid grid-cols-1 gap-2 border-t border-slate-100 pt-4 md:grid-cols-2 dark:border-slate-800">{accountPerformance.map((account) => <div key={account.cuenta} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-900/60"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">{account.titular}</p><p className="mt-0.5 font-mono text-xs tabular-nums text-slate-400">{account.cuenta} · {account.ventas} cobros</p></div><p className="shrink-0 text-sm font-black tabular-nums text-primary">S/ {account.total.toFixed(2)}</p></div>)}</div>}
      </section>

      <section className="event-table-shell" aria-labelledby="total-sales-title">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10"><div><h2 id="total-sales-title" className="text-balance text-sm font-black text-slate-800 dark:text-white">Ventas totales</h2><p className="mt-1 text-xs text-slate-400">Mostrando {filteredSales.length} de {ventas.length} ventas · actualizado {lastUpdate ? lastUpdate.toLocaleTimeString('es-PE', { timeZone: PERU_TIME_ZONE, hour: '2-digit', minute: '2-digit' }) : 'pendiente'}</p></div><div className="flex items-center gap-3"><button type="button" onClick={() => fetchSales()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 disabled:cursor-wait disabled:opacity-50 dark:border-slate-700"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar</button><p className="text-sm font-black tabular-nums text-primary">Resultado S/ {filteredTotalAmount.toFixed(2)}</p></div></div>
        {loadError && <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">{loadError}</div>}
        <div className="border-b border-slate-100 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-slate-900/40">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <label className="xl:col-span-2"><span className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">Buscar en la tabla</span><span className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Venta, producto, combo, cuenta o referencia" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></span></label>
            <label><span className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">Cajero</span><select value={cashier} onChange={(event) => { setCashier(event.target.value); setPage(1); }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="TODOS">Todos los cajeros</option>{cashierOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
            <label><span className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">Método</span><select value={method} onChange={(event) => { setMethod(event.target.value); setPage(1); }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="TODOS">Todos los métodos</option>{methodOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
            <label><span className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">Desde</span><span className="relative block"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></span></label>
            <label><span className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">Hasta</span><span className="relative block"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></span></label>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-400">Estos filtros solo modifican la tabla y la exportación CSV.</p><button type="button" onClick={clearFilters} disabled={!hasFilters} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900"><FilterX className="size-4" /> Limpiar filtros</button></div>
        </div>
        <div className="overflow-x-auto"><table className="event-data-table responsive-admin-table md:min-w-[1100px]"><thead className="border-b border-slate-100 bg-slate-50 dark:border-white/10 dark:bg-[#0B1120]"><tr><th className="px-4 py-4 text-xs font-black uppercase text-slate-400">Venta</th><th className="px-4 py-4 text-xs font-black uppercase text-slate-400">Fecha</th><th className="px-4 py-4 text-xs font-black uppercase text-slate-400">Hora</th><th className="px-4 py-4 text-xs font-black uppercase text-slate-400">Cajero</th><th className="px-4 py-4 text-xs font-black uppercase text-slate-400">Productos y combos</th><th className="px-4 py-4 text-xs font-black uppercase text-slate-400">Método</th><th className="px-4 py-4 text-xs font-black uppercase text-slate-400">Cuenta / referencia</th><th className="px-4 py-4 text-right text-xs font-black uppercase text-slate-400">Monto</th></tr></thead><tbody>
          {!loading && visibleSales.length === 0 ? <tr><td colSpan={8} className="py-12 text-center"><p className="font-bold text-slate-500 dark:text-slate-300">No se encontraron ventas</p><p className="mt-1 text-sm text-slate-400">Cambia o limpia los filtros para ver resultados.</p>{hasFilters && <button type="button" onClick={clearFilters} className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">Limpiar filtros</button>}</td></tr> : visibleSales.map((sale, index) => {
            const date = getSaleDate(sale); const methodName = getSaleMethod(sale); const methodColor = getPaymentMethodColor(methodName, sale.metodo_pago_color); const reference = getSaleReference(sale); const details = getSaleDetails(sale); const saleNumber = sale.numero_venta || sale.id_venta || filteredSales.length - ((currentPage - 1) * pageSize + index);
            return <tr key={sale.id_venta ?? index} className="border-b border-slate-50 hover:bg-slate-50/60 dark:border-white/10 dark:hover:bg-white/5"><td data-label="Venta" className="px-4 py-4"><span className="font-mono text-xs font-black tabular-nums text-primary">#{String(saleNumber).padStart(4, '0')}</span></td><td data-label="Fecha" className="px-4 py-4"><span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{Number.isNaN(date.getTime()) ? '—' : peruDateFormatter.format(date)}</span></td><td data-label="Hora" className="px-4 py-4"><span className="text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">{Number.isNaN(date.getTime()) ? '—' : peruTimeFormatter.format(date)}</span></td><td data-label="Cajero" className="px-4 py-4"><span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{getSaleCashier(sale)}</span></td><td data-label="Productos" className="max-w-72 px-4 py-4"><span className="block truncate text-xs text-slate-500 dark:text-slate-400" title={details}>{details}</span></td><td data-label="Método" className="px-4 py-4"><span className="inline-flex rounded-full px-2 py-1 text-xs font-black uppercase" style={{ backgroundColor: methodColor, color: getReadableTextColor(methodColor) }}>{methodName}</span></td><td data-label="Cuenta / referencia" className="px-4 py-4">{sale.cuenta_destino ? <div className="min-w-0"><span className="block font-mono text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">{sale.cuenta_destino}</span><span className="mt-0.5 block truncate text-xs text-slate-400">{sale.cuenta_titular || 'Sin titular registrado'}</span>{reference && <span className="mt-0.5 block font-mono text-xs tabular-nums text-slate-400">Ref: {reference}</span>}</div> : <span className="font-mono text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">{reference || '—'}</span>}</td><td data-label="Monto" className="px-4 py-4 text-right"><span className="text-sm font-black tabular-nums text-slate-800 dark:text-white">S/ {Number(sale.total || sale.monto || sale.importe || 0).toFixed(2)}</span></td></tr>;
          })}
        </tbody></table></div>
        {filteredSales.length > pageSize && <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-[#0B1120]"><p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredSales.length)} de {filteredSales.length} · Página {currentPage} de {totalPages}</p><div className="flex gap-2"><button type="button" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Anterior</button><button type="button" onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Siguiente</button></div></div>}
      </section>
    </div>
  );
}

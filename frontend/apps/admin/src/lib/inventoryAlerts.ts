export type InventoryAlertSeverity = 'critical' | 'warning';
export type InventoryAlertKind = 'product' | 'combo';

export type InventoryAlert = {
  id: string;
  kind: InventoryAlertKind;
  severity: InventoryAlertSeverity;
  name: string;
  message: string;
  currentStock: number;
  minimumStock?: number;
  imageUrl?: string | null;
  affectedBy?: string;
  href: '/productos' | '/combos';
};

type ProductPayload = {
  id_producto: number;
  nombre: string;
  stock?: number;
  stock_actual?: number;
  stock_minimo?: number;
  stock_min?: number;
  imagen_url?: string | null;
};

type ComboProductPayload = ProductPayload & { cantidad?: number };

type ComboPayload = {
  id_combo: number;
  nombre: string;
  activo?: boolean;
  capacidad_disponible?: number;
  imagen_url?: string | null;
  productos?: ComboProductPayload[];
};

const asStock = (product: ProductPayload) => Number(product.stock_actual ?? product.stock ?? 0);

export function buildInventoryAlerts(
  products: ProductPayload[] = [],
  combos: ComboPayload[] = [],
): InventoryAlert[] {
  const productAlerts = products.flatMap<InventoryAlert>((product) => {
    const stock = asStock(product);
    const minimum = Math.max(0, Number(product.stock_minimo ?? product.stock_min ?? 0));
    if (stock > minimum) return [];

    const isOut = stock <= 0;
    return [{
      id: `product-${product.id_producto}`,
      kind: 'product',
      severity: isOut ? 'critical' : 'warning',
      name: product.nombre,
      message: isOut
        ? 'Producto agotado. Ya no puede incluirse en nuevas ventas.'
        : `Quedan ${stock} unidades; alcanzó el mínimo configurado de ${minimum}.`,
      currentStock: stock,
      minimumStock: minimum,
      imageUrl: product.imagen_url,
      href: '/productos',
    }];
  });

  const comboAlerts = combos.flatMap<InventoryAlert>((combo) => {
    if (combo.activo === false) return [];
    const calculatedCapacity = combo.productos?.length
      ? Math.min(...combo.productos.map((product) => (
        Math.floor(asStock(product) / Math.max(1, Number(product.cantidad ?? 1)))
      )))
      : 0;
    const capacity = Number(combo.capacidad_disponible ?? calculatedCapacity);
    if (capacity > 3) return [];

    const limitingProduct = combo.productos
      ?.map((product) => ({
        name: product.nombre,
        capacity: Math.floor(asStock(product) / Math.max(1, Number(product.cantidad ?? 1))),
      }))
      .sort((a, b) => a.capacity - b.capacity)[0];
    const isUnavailable = capacity <= 0;

    return [{
      id: `combo-${combo.id_combo}`,
      kind: 'combo',
      severity: isUnavailable ? 'critical' : 'warning',
      name: combo.nombre,
      message: isUnavailable
        ? 'Combo no disponible por falta de stock en uno de sus componentes.'
        : `Solo pueden venderse ${capacity} combos con el inventario actual.`,
      currentStock: capacity,
      imageUrl: combo.imagen_url,
      affectedBy: limitingProduct?.name,
      href: '/combos',
    }];
  });

  return [...productAlerts, ...comboAlerts].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
    return a.currentStock - b.currentStock || a.name.localeCompare(b.name, 'es');
  });
}

export function inventoryAlertFingerprint(alert: InventoryAlert) {
  return `${alert.id}:${alert.severity}:${alert.currentStock}`;
}

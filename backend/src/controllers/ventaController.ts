import { Response } from 'express';
import { query, transaction } from '../config/database';
import { AuthRequest } from '../middlewares/auth';

export const procesarVenta = async (req: AuthRequest, res: Response) => {
  const { id_metodo_pago, id_cuenta_pago, detalles, combos } = req.body;
  const productosVenta = Array.isArray(detalles) ? detalles : [];
  const combosVenta = Array.isArray(combos) ? combos : [];
  const id_sesion = req.sesion?.id_sesion || null;
  const id_evento = req.id_evento || req.sesion?.id_evento;

  if (!id_evento) return res.status(401).json({ error: 'No se pudo determinar el evento' });
  if (productosVenta.length === 0 && combosVenta.length === 0) {
    return res.status(400).json({ error: 'La venta no tiene productos ni combos' });
  }

  try {
    const result = await transaction(async (client) => {
      // 1. Verificar estado de la sesión si existe (cajero)
      if (id_sesion) {
        const sesionRes = await client.query('SELECT estado FROM cajas_sesiones WHERE id_sesion = $1', [id_sesion]);
        if (sesionRes.rows[0].estado !== 'ABIERTA') throw new Error('La caja está cerrada');
      }

      const metodoRes = await client.query(
        `SELECT tipo
         FROM metodos_pago_evento
         WHERE id_metodo_pago = $1 AND id_evento = $2 AND activo = true`,
        [id_metodo_pago, id_evento]
      );
      if (metodoRes.rowCount === 0) throw new Error('MÃ©todo de pago no disponible');

      const metodo = metodoRes.rows[0];

      let idCuentaSeleccionada: number | null = null;
      if (['TRANSFERENCIA', 'BILLETERA_DIGITAL'].includes(metodo.tipo)) {
        const cuentaRes = await client.query(
          `SELECT id_cuenta_pago
           FROM metodos_pago_cuentas
           WHERE id_evento = $1
             AND id_metodo_pago = $2
             AND activo = true
             AND ($3::integer IS NULL OR id_cuenta_pago = $3)
           ORDER BY
             CASE WHEN id_cuenta_pago = $3 THEN 0 ELSE 1 END,
             es_predeterminado DESC,
             orden ASC,
             id_cuenta_pago ASC
           LIMIT 1`,
          [id_evento, id_metodo_pago, id_cuenta_pago ? Number(id_cuenta_pago) : null]
        );
        if (cuentaRes.rowCount === 0) {
          throw new Error('Configura o selecciona una cuenta receptora para esta transferencia');
        }
        idCuentaSeleccionada = cuentaRes.rows[0].id_cuenta_pago;
      }

      let subtotalGlobal = 0;
      let descuentoGlobal = 0;
      let totalGlobal = 0;

      // 2. Crear cabecera de la venta temporalmente para obtener ID
      const ventaRes = await client.query(
        `INSERT INTO ventas
           (id_sesion, id_evento, subtotal_sin_descuento, descuento_total, total, id_metodo_pago, id_cuenta_pago, referencia_pago)
         VALUES ($1, $2, 0, 0, 0, $3, $4, $5) RETURNING id_venta`,
        [id_sesion, id_evento, id_metodo_pago, idCuentaSeleccionada, null]
      );
      const id_venta = ventaRes.rows[0].id_venta;

      // 3. Procesar Productos Individuales
      if (productosVenta.length > 0) {
        for (const item of productosVenta) {
          const idProducto = Number(item.id_producto);
          const cantidad = Number(item.cantidad);
          if (!Number.isInteger(idProducto) || idProducto <= 0 || !Number.isInteger(cantidad) || cantidad <= 0) {
            throw new Error('Hay un producto con identificador o cantidad inválida');
          }

          // Bloquear fila del producto para asegurar stock
          const prodRes = await client.query(
            `SELECT nombre, precio_venta, stock_actual
             FROM productos
             WHERE id_producto = $1 AND id_evento = $2 AND estado = true
             FOR UPDATE`,
            [idProducto, id_evento]
          );
          
          if (prodRes.rowCount === 0) throw new Error(`Producto ${idProducto} no encontrado en este evento`);
          const prod = prodRes.rows[0];

          if (Number(prod.stock_actual) < cantidad) {
            throw new Error(`Stock insuficiente para ${prod.nombre}`);
          }

          // Descontar stock
          await client.query(
            'UPDATE productos SET stock_actual = stock_actual - $1 WHERE id_producto = $2',
            [cantidad, idProducto]
          );

          // Calcular subtotales
          const subtotalItem = Number(prod.precio_venta) * cantidad;
          const descuentoItem = 0; // Lógica de descuentos dinámicos podría ir aquí
          const totalItem = subtotalItem - descuentoItem;

          subtotalGlobal += subtotalItem;
          descuentoGlobal += descuentoItem;

          // Registrar detalle
          await client.query(
            `INSERT INTO detalles_venta (id_venta, id_producto, cantidad, precio_unitario, descuento_aplicado, subtotal, es_parte_combo)
             VALUES ($1, $2, $3, $4, $5, $6, false)`,
            [id_venta, idProducto, cantidad, prod.precio_venta, descuentoItem, totalItem]
          );

          // Registrar movimiento inventario
          await client.query(
            `INSERT INTO movimientos_inventario (id_producto, tipo_movimiento, cantidad, stock_antes, stock_despues, motivo, referencia)
             VALUES ($1, 'SALIDA', $2, $3, $4, 'Venta generada', $5)`,
            [idProducto, cantidad, prod.stock_actual, Number(prod.stock_actual) - cantidad, `Venta #${id_venta}`]
          );
        }
      }

      // 4. Procesar Combos (similar lógica de bloqueo)
      if (combosVenta.length > 0) {
        for (const c of combosVenta) {
          const idCombo = Number(c.id_combo);
          const cantidadCombo = Number(c.cantidad);
          if (!Number.isInteger(idCombo) || idCombo <= 0 || !Number.isInteger(cantidadCombo) || cantidadCombo <= 0) {
            throw new Error('Hay un combo con identificador o cantidad inválida');
          }

          const comboRes = await client.query(
            `SELECT nombre, precio_combo
             FROM combos
             WHERE id_combo = $1 AND id_evento = $2 AND activo = true`,
            [idCombo, id_evento]
          );
          if (comboRes.rowCount === 0) throw new Error(`Combo ${idCombo} no encontrado o inactivo`);
          
          const combo = comboRes.rows[0];
          const subtotalCombo = Number(combo.precio_combo) * cantidadCombo;

          // Bloquear primero todos los productos del combo en un orden estable.
          // Esto valida el stock completo antes de registrar o descontar cualquier componente.
          const internals = await client.query(
            `SELECT cp.id_producto, cp.cantidad, p.nombre, p.stock_actual
             FROM combo_productos cp
             JOIN productos p ON p.id_producto = cp.id_producto
             WHERE cp.id_combo = $1 AND p.id_evento = $2 AND p.estado = true
             ORDER BY cp.id_producto
             FOR UPDATE OF p`,
            [idCombo, id_evento]
          );

          if (internals.rowCount === 0) {
            throw new Error(`El combo ${combo.nombre} no tiene productos disponibles`);
          }

          for (const inter of internals.rows) {
            const qtyNecesaria = Number(inter.cantidad) * cantidadCombo;
            if (!Number.isInteger(qtyNecesaria) || qtyNecesaria <= 0) {
              throw new Error(`El combo ${combo.nombre} tiene una cantidad inválida para ${inter.nombre}`);
            }
            if (Number(inter.stock_actual) < qtyNecesaria) {
              throw new Error(`Stock insuficiente para ${inter.nombre} dentro del combo ${combo.nombre}`);
            }
          }
          
          subtotalGlobal += subtotalCombo;

          await client.query(
            `INSERT INTO ventas_combo (id_venta, id_combo, cantidad, precio_unitario_combo, subtotal_combo, descuento_aplicado)
             VALUES ($1, $2, $3, $4, $5, 0)`,
            [id_venta, idCombo, cantidadCombo, combo.precio_combo, subtotalCombo]
          );

          // Descontar y registrar cada producto interno del combo.
          for (const inter of internals.rows) {
            const qtyNecesaria = Number(inter.cantidad) * cantidadCombo;
            const stockAntes = Number(inter.stock_actual);

            await client.query('UPDATE productos SET stock_actual = stock_actual - $1 WHERE id_producto = $2', [qtyNecesaria, inter.id_producto]);

            await client.query(
              `INSERT INTO detalles_venta (id_venta, id_producto, cantidad, precio_unitario, descuento_aplicado, subtotal, es_parte_combo)
               VALUES ($1, $2, $3, 0, 0, 0, true)`,
              [id_venta, inter.id_producto, qtyNecesaria]
            );

            await client.query(
              `INSERT INTO movimientos_inventario (id_producto, tipo_movimiento, cantidad, stock_antes, stock_despues, motivo, referencia)
               VALUES ($1, 'SALIDA', $2, $3, $4, $5, $6)`,
              [
                inter.id_producto,
                qtyNecesaria,
                stockAntes,
                stockAntes - qtyNecesaria,
                `Venta de combo: ${combo.nombre}`,
                `Venta #${id_venta}`,
              ]
            );
          }
        }
      }

      totalGlobal = subtotalGlobal - descuentoGlobal;

      // 5. Actualizar cabecera de la venta con los totales reales
      await client.query(
        `UPDATE ventas SET subtotal_sin_descuento = $1, descuento_total = $2, total = $3 WHERE id_venta = $4`,
        [subtotalGlobal, descuentoGlobal, totalGlobal, id_venta]
      );

      return { id_venta, total: totalGlobal };
    });

    res.status(201).json({ message: 'Venta procesada con éxito', data: result });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error al procesar venta' });
  }
};

export const listarVentas = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.usuario && !req.sesion) {
      return res.status(401).json({ error: 'Se requiere una sesion autenticada para consultar ventas' });
    }

    const id_evento = req.id_evento || req.sesion?.id_evento;
    const id_sesion = req.sesion?.id_sesion;

    if (!id_evento) return res.status(401).json({ error: 'No se pudo determinar el evento' });

    const filtroSesion = id_sesion ? 'AND v.id_sesion = $2' : '';
    const parametros = id_sesion ? [id_evento, id_sesion] : [id_evento];

    const ventasRes = await query(
      `SELECT
         v.*,
         m.color_hex AS metodo_pago_color,
         c.numero_destino AS cuenta_destino,
         c.nombre_titular AS cuenta_titular,
         COALESCE(m.nombre, 'Sin método') AS metodo_pago,
         COALESCE(ce.nombre, 'Administrador') AS cajero_nombre,
         ROW_NUMBER() OVER (ORDER BY v.fecha_hora ASC, v.id_venta ASC) AS numero_venta
       FROM ventas v
       LEFT JOIN metodos_pago_evento m
         ON m.id_metodo_pago = v.id_metodo_pago
        AND m.id_evento = v.id_evento
       LEFT JOIN metodos_pago_cuentas c
         ON c.id_cuenta_pago = v.id_cuenta_pago
        AND c.id_evento = v.id_evento
       LEFT JOIN cajas_sesiones cs ON cs.id_sesion = v.id_sesion
       LEFT JOIN cajeros_evento ce
         ON ce.id_cajero_evento = cs.id_cajero_evento
        AND ce.id_evento = v.id_evento
       WHERE v.id_evento = $1
       ${filtroSesion}
       ORDER BY v.fecha_hora DESC, v.id_venta DESC`,
      parametros
    );

    const ventas = ventasRes.rows;
    const ids = ventas.map((venta: any) => venta.id_venta);

    if (ids.length > 0) {
      const detallesRes = await query(
        `SELECT dv.*, p.nombre as producto_nombre, p.id_categoria, cat.nombre as categoria_nombre
         FROM detalles_venta dv 
         JOIN productos p ON dv.id_producto = p.id_producto 
         LEFT JOIN categorias cat ON cat.id_categoria = p.id_categoria
         WHERE dv.id_venta = ANY($1)
         ORDER BY dv.id_venta`,
        [ids]
      );

      const combosRes = await query(
        `SELECT vc.*, c.nombre as combo_nombre,
                COALESCE(combo_categorias.categorias, '[]'::json) as categorias
         FROM ventas_combo vc 
         JOIN combos c ON vc.id_combo = c.id_combo 
         LEFT JOIN LATERAL (
           SELECT json_agg(
             json_build_object(
               'id_categoria', agrupado.id_categoria,
               'categoria_nombre', agrupado.categoria_nombre,
               'valor_componentes', agrupado.valor_componentes,
               'cantidad_componentes', agrupado.cantidad_componentes
             ) ORDER BY agrupado.categoria_nombre
           ) as categorias
           FROM (
             SELECT p.id_categoria,
                    COALESCE(cat.nombre, 'Sin categorÃ­a') as categoria_nombre,
                    SUM(cp.cantidad * COALESCE(p.precio_venta, 0)) as valor_componentes,
                    SUM(cp.cantidad) as cantidad_componentes
             FROM combo_productos cp
             JOIN productos p ON p.id_producto = cp.id_producto
             LEFT JOIN categorias cat ON cat.id_categoria = p.id_categoria
             WHERE cp.id_combo = vc.id_combo
             GROUP BY p.id_categoria, cat.nombre
           ) agrupado
         ) combo_categorias ON true
         WHERE vc.id_venta = ANY($1)
         ORDER BY vc.id_venta`,
        [ids]
      );

      const detallesMap = new Map<number, any[]>();
      detallesRes.rows.forEach((detalle: any) => {
        const arr = detallesMap.get(detalle.id_venta) || [];
        arr.push(detalle);
        detallesMap.set(detalle.id_venta, arr);
      });

      const combosMap = new Map<number, any[]>();
      combosRes.rows.forEach((combo: any) => {
        const arr = combosMap.get(combo.id_venta) || [];
        arr.push(combo);
        combosMap.set(combo.id_venta, arr);
      });

      ventas.forEach((venta: any) => {
        venta.detalles = detallesMap.get(venta.id_venta) || [];
        venta.combos = combosMap.get(venta.id_venta) || [];
      });
    }

    res.json(ventas);
  } catch (error) {
    res.status(500).json({ error: 'Error al listar ventas' });
  }
};

export const obtenerVenta = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.usuario && !req.sesion) {
      return res.status(401).json({ error: 'Se requiere una sesion autenticada para consultar ventas' });
    }

    const id_evento = req.id_evento || req.sesion?.id_evento;
    const id_sesion = req.sesion?.id_sesion;

    if (!id_evento) return res.status(401).json({ error: 'No se pudo determinar el evento' });

    const filtroSesion = id_sesion ? 'AND v.id_sesion = $3' : '';
    const parametros = id_sesion
      ? [req.params.id, id_evento, id_sesion]
      : [req.params.id, id_evento];

    const result = await query(
      `SELECT v.*, COALESCE(m.nombre, 'Sin método') AS metodo_pago
       FROM ventas v
       LEFT JOIN metodos_pago_evento m
         ON m.id_metodo_pago = v.id_metodo_pago
        AND m.id_evento = v.id_evento
       LEFT JOIN metodos_pago_cuentas c
         ON c.id_cuenta_pago = v.id_cuenta_pago
        AND c.id_evento = v.id_evento
       WHERE v.id_venta = $1 AND v.id_evento = $2
       ${filtroSesion}`,
      parametros
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Venta no encontrada' });
    
    const venta = result.rows[0];

    const detalles = await query(
      `SELECT dv.*, p.nombre, p.nombre as producto_nombre, p.id_categoria, cat.nombre as categoria_nombre
       FROM detalles_venta dv 
       JOIN productos p ON dv.id_producto = p.id_producto 
       LEFT JOIN categorias cat ON cat.id_categoria = p.id_categoria
       WHERE dv.id_venta = $1`,
      [venta.id_venta]
    );
    
    const combos = await query(
      `SELECT vc.*, c.nombre, c.nombre as combo_nombre,
              COALESCE(combo_categorias.categorias, '[]'::json) as categorias
       FROM ventas_combo vc 
       JOIN combos c ON vc.id_combo = c.id_combo 
       LEFT JOIN LATERAL (
         SELECT json_agg(
           json_build_object(
             'id_categoria', agrupado.id_categoria,
             'categoria_nombre', agrupado.categoria_nombre,
             'valor_componentes', agrupado.valor_componentes,
             'cantidad_componentes', agrupado.cantidad_componentes
           ) ORDER BY agrupado.categoria_nombre
         ) as categorias
         FROM (
           SELECT p.id_categoria,
                  COALESCE(cat.nombre, 'Sin categorÃ­a') as categoria_nombre,
                  SUM(cp.cantidad * COALESCE(p.precio_venta, 0)) as valor_componentes,
                  SUM(cp.cantidad) as cantidad_componentes
           FROM combo_productos cp
           JOIN productos p ON p.id_producto = cp.id_producto
           LEFT JOIN categorias cat ON cat.id_categoria = p.id_categoria
           WHERE cp.id_combo = vc.id_combo
           GROUP BY p.id_categoria, cat.nombre
         ) agrupado
       ) combo_categorias ON true
       WHERE vc.id_venta = $1`,
      [venta.id_venta]
    );

    venta.detalles = detalles.rows;
    venta.combos = combos.rows;

    res.json(venta);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener venta' });
  }
};

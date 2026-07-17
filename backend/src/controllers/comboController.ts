import { Response } from 'express';
import { query, transaction } from '../config/database';
import { AuthRequest } from '../middlewares/auth';

export const listarCombos = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM combos WHERE id_evento = $1 ORDER BY activo DESC, id_combo DESC`,
      [req.id_evento]
    );
    
    // Obtener los productos de cada combo
    const combos = result.rows;
    for (let combo of combos) {
      const prodRes = await query(
        `SELECT cp.cantidad, p.nombre, p.id_producto, p.stock_actual, p.stock_minimo, p.precio_venta, p.imagen_url
         FROM combo_productos cp 
         JOIN productos p ON cp.id_producto = p.id_producto 
         WHERE cp.id_combo = $1 AND p.id_evento = $2
         ORDER BY p.nombre`,
        [combo.id_combo, req.id_evento]
      );
      combo.productos = prodRes.rows;
      combo.capacidad_disponible = prodRes.rows.length > 0
        ? Math.min(...prodRes.rows.map((p: any) => Math.floor(Number(p.stock_actual) / Number(p.cantidad))))
        : 0;
    }
    
    res.json(combos);
  } catch (error) {
    res.status(500).json({ error: 'Error al listar combos' });
  }
};

export const crearCombo = async (req: AuthRequest, res: Response) => {
  const { nombre, descripcion, imagen_url, tipo_combo, tipo_descuento, valor_descuento, precio_original, precio_combo, fecha_inicio, fecha_fin, productos } = req.body;
  
  try {
    if (!nombre || String(nombre).trim() === '') return res.status(400).json({ error: 'El nombre del combo es requerido' });
    if (!Number(precio_combo) || Number(precio_combo) <= 0) return res.status(400).json({ error: 'El precio del combo debe ser mayor a 0' });
    if (!Array.isArray(productos) || productos.length === 0) return res.status(400).json({ error: 'El combo debe incluir al menos un producto' });

    const result = await transaction(async (client) => {
      for (const prod of productos) {
        const idProducto = Number(prod.id_producto);
        const cantidad = Number(prod.cantidad);
        if (!Number.isInteger(idProducto) || idProducto <= 0 || !Number.isInteger(cantidad) || cantidad <= 0) {
          throw new Error('El combo contiene un producto o cantidad inválida');
        }
        const exists = await client.query(
          'SELECT 1 FROM productos WHERE id_producto = $1 AND id_evento = $2 AND estado = true',
          [idProducto, req.id_evento],
        );
        if (exists.rowCount === 0) throw new Error(`El producto ${idProducto} no pertenece al evento o está inactivo`);
      }

      // Insertar combo
      const comboRes = await client.query(
        `INSERT INTO combos (id_evento, nombre, descripcion, imagen_url, tipo_combo, tipo_descuento, valor_descuento, precio_original, precio_combo, fecha_inicio, fecha_fin) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [
          req.id_evento, 
          nombre, 
          descripcion || null, 
          imagen_url || null, 
          tipo_combo || 'PACK', 
          tipo_descuento || 'PRECIO_ESPECIAL', 
          valor_descuento || 0, 
          precio_original || 0, 
          precio_combo || 0, 
          fecha_inicio || new Date().toISOString(), 
          fecha_fin || new Date('2099-12-31').toISOString()
        ]
      );
      
      const combo = comboRes.rows[0];

      // Insertar productos del combo
      if (productos && productos.length > 0) {
        for (let prod of productos) {
          await client.query(
            `INSERT INTO combo_productos (id_combo, id_producto, cantidad) VALUES ($1, $2, $3)`,
            [combo.id_combo, prod.id_producto, prod.cantidad]
          );
        }
      }
      
      return combo;
    });
    
    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error en crearCombo:', error);
    res.status(500).json({ error: 'Error al crear combo', detail: error.message });
  }
};

export const obtenerCombo = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query('SELECT * FROM combos WHERE id_combo = $1 AND id_evento = $2', [req.params.id, req.id_evento]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Combo no encontrado' });
    
    const combo = result.rows[0];
    const prodRes = await query(
      `SELECT cp.cantidad, p.nombre, p.id_producto, p.stock_actual, p.stock_minimo, p.precio_venta, p.imagen_url
       FROM combo_productos cp 
       JOIN productos p ON cp.id_producto = p.id_producto 
       WHERE cp.id_combo = $1 AND p.id_evento = $2
       ORDER BY p.nombre`,
      [combo.id_combo, req.id_evento]
    );
    combo.productos = prodRes.rows;
    combo.capacidad_disponible = prodRes.rows.length > 0
      ? Math.min(...prodRes.rows.map((p: any) => Math.floor(Number(p.stock_actual) / Number(p.cantidad))))
      : 0;

    res.json(combo);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener combo' });
  }
};

export const actualizarCombo = async (req: AuthRequest, res: Response) => {
  const { nombre, descripcion, imagen_url, tipo_combo, tipo_descuento, valor_descuento, precio_original, precio_combo, fecha_inicio, fecha_fin, productos } = req.body;
  const id_combo = req.params.id;

  try {
    const result = await transaction(async (client) => {
      // 1. Actualizar combo
      const comboRes = await client.query(
        `UPDATE combos 
         SET nombre = COALESCE($1, nombre),
             descripcion = COALESCE($2, descripcion),
             imagen_url = COALESCE($3, imagen_url),
             tipo_combo = COALESCE($4, tipo_combo),
             tipo_descuento = COALESCE($5, tipo_descuento),
             valor_descuento = COALESCE($6, valor_descuento),
             precio_original = COALESCE($7, precio_original),
             precio_combo = COALESCE($8, precio_combo),
             fecha_inicio = COALESCE($9, fecha_inicio),
             fecha_fin = COALESCE($10, fecha_fin)
         WHERE id_combo = $11 AND id_evento = $12 RETURNING *`,
        [nombre, descripcion, imagen_url, tipo_combo, tipo_descuento, valor_descuento, precio_original, precio_combo, fecha_inicio, fecha_fin, id_combo, req.id_evento]
      );
      
      if (comboRes.rowCount === 0) throw new Error('Combo no encontrado');
      const combo = comboRes.rows[0];

      // 2. Si se mandan nuevos productos, eliminar los viejos y recrear
      if (productos && Array.isArray(productos)) {
        if (productos.length === 0) throw new Error('El combo debe incluir al menos un producto');
        for (const prod of productos) {
          const idProducto = Number(prod.id_producto);
          const cantidad = Number(prod.cantidad);
          if (!Number.isInteger(idProducto) || idProducto <= 0 || !Number.isInteger(cantidad) || cantidad <= 0) {
            throw new Error('El combo contiene un producto o cantidad inválida');
          }
          const exists = await client.query(
            'SELECT 1 FROM productos WHERE id_producto = $1 AND id_evento = $2 AND estado = true',
            [idProducto, req.id_evento],
          );
          if (exists.rowCount === 0) throw new Error(`El producto ${idProducto} no pertenece al evento o está inactivo`);
        }

        await client.query('DELETE FROM combo_productos WHERE id_combo = $1', [combo.id_combo]);
        for (let prod of productos) {
          await client.query(
            `INSERT INTO combo_productos (id_combo, id_producto, cantidad) VALUES ($1, $2, $3)`,
            [combo.id_combo, prod.id_producto, prod.cantidad]
          );
        }
      }
      
      return combo;
    });
    
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error al actualizar combo' });
  }
};

export const toggleEstadoCombo = async (req: AuthRequest, res: Response) => {
  try {
    const { activo } = req.body;
    if (activo === undefined) {
      return res.status(400).json({ error: 'Falta el campo activo' });
    }
    const result = await query(
      `UPDATE combos SET activo = $1 WHERE id_combo = $2 AND id_evento = $3 RETURNING *`,
      [activo, req.params.id, req.id_evento]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Combo no encontrado' });
    res.json({ message: 'Estado del combo actualizado', combo: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Error al cambiar estado del combo' });
  }
};

export const eliminarCombo = async (req: AuthRequest, res: Response) => {
  try {
    await transaction(async (client) => {
      const comboRes = await client.query(
        'SELECT id_combo, nombre FROM combos WHERE id_combo = $1 AND id_evento = $2 FOR UPDATE',
        [req.params.id, req.id_evento],
      );

      if (comboRes.rowCount === 0) {
        const error: any = new Error('Combo no encontrado');
        error.status = 404;
        throw error;
      }

      const ventasRes = await client.query(
        `SELECT 1 FROM ventas_combo WHERE id_combo = $1
         UNION ALL
         SELECT 1 FROM detalles_venta WHERE id_combo = $1
         LIMIT 1`,
        [req.params.id],
      );

      if ((ventasRes.rowCount ?? 0) > 0) {
        const error: any = new Error('Este combo ya tiene ventas registradas. Desactívalo para conservar el historial.');
        error.status = 409;
        throw error;
      }

      await client.query('DELETE FROM combo_productos WHERE id_combo = $1', [req.params.id]);
      await client.query(
        'DELETE FROM combos WHERE id_combo = $1 AND id_evento = $2',
        [req.params.id, req.id_evento],
      );
    });

    res.json({ message: 'Combo eliminado correctamente' });
  } catch (error: any) {
    console.error('Error en eliminarCombo:', error);
    res.status(error.status || 500).json({
      error: error.message || 'Error al eliminar combo',
    });
  }
};

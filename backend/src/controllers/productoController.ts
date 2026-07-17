import { Response } from 'express';
import { query, transaction } from '../config/database';
import { AuthRequest } from '../middlewares/auth';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const listarProductos = async (req: AuthRequest, res: Response) => {
  try {
    // Determinar id_evento: preferido por middleware (req.id_evento). Si no existe, permitir fetch por codigo_evento query param (para POS sin token)
    let idEvento = req.id_evento;
    if (!idEvento && req.query.codigo_evento) {
      const codigo = String(req.query.codigo_evento);
      const ev = await query('SELECT id_evento FROM eventos WHERE codigo_caja = $1 AND estado = $2 LIMIT 1', [codigo, 'ACTIVO']);
      if (ev.rowCount === 0) return res.status(404).json({ error: 'Evento no encontrado o inactivo' });
      idEvento = ev.rows[0].id_evento;
    }

    if (!idEvento) return res.status(401).json({ error: 'No autorizado: token o codigo_evento requerido' });

    const result = await query(
      `SELECT p.id_producto, p.id_categoria, p.nombre, p.descripcion, COALESCE(p.precio_venta, 0) as precio, p.stock_actual as stock, p.stock_minimo, p.imagen_url, p.es_destacado, c.nombre as categoria_nombre
       FROM productos p
       LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
       WHERE p.id_evento = $1 AND p.estado = true
       ORDER BY p.id_producto DESC`,
      [idEvento]
    );
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error listarProductos:', error);
    res.status(500).json({ error: 'Error al listar productos', detail: error.message });
  }
};

export const crearProducto = async (req: AuthRequest, res: Response) => {
  // Aceptar variantes de nombres de campo que vienen del frontend
  const {
    id_categoria: id_categoria_body,
    categoria_id,
    nombre,
    descripcion,
    imagen_url,
    precio_venta,
    precio,
    stock: stock_body,
    stock_actual,
    stock_minimo,
    stock_min,
    es_destacado,
  } = req.body as any;

  const id_categoria = id_categoria_body ?? categoria_id ?? null;
  const precioFinal = precio_venta ?? precio ?? 0;
  const stockInicial = typeof stock_body !== 'undefined' ? Number(stock_body) : (typeof stock_actual !== 'undefined' ? Number(stock_actual) : 0);
  const stockMinFinal = stock_minimo ?? stock_min ?? 5;

  try {
    // Validaciones básicas para evitar 500 inesperados
    if (!nombre || String(nombre).trim() === '') return res.status(400).json({ error: 'El nombre del producto es requerido' });
    if (!Number(precioFinal) || Number(precioFinal) <= 0) return res.status(400).json({ error: 'El precio es requerido y debe ser mayor a 0' });

    const result = await query(
      `INSERT INTO productos (id_evento, id_categoria, nombre, descripcion, imagen_url, precio_venta, stock_actual, stock_minimo, es_destacado) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.id_evento, id_categoria, nombre, descripcion, imagen_url, precioFinal, stockInicial, stockMinFinal || 5, es_destacado || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Error crearProducto:', error);
    res.status(500).json({ error: 'Error al crear producto', detail: error.message });
  }
};

export const actualizarProducto = async (req: AuthRequest, res: Response) => {
  // Aceptar variantes de nombres de campo
  const {
    id_categoria: id_categoria_body,
    categoria_id,
    nombre,
    descripcion,
    imagen_url,
    precio_venta,
    precio,
    stock_minimo,
    stock_min,
    es_destacado,
  } = req.body as any;
  const id_producto = req.params.id;

  const id_categoria = id_categoria_body ?? categoria_id ?? null;
  const precioFinal = precio_venta ?? precio ?? null;
  const stockMinFinal = stock_minimo ?? stock_min ?? null;

  try {
    // Si imagen viene como DataURL guardarla en uploads
    let imagenParaGuardar = imagen_url;
    if (imagen_url && typeof imagen_url === 'string' && imagen_url.startsWith('data:')) {
      try {
        const matches = imagen_url.match(/^data:(image\/(png|jpeg|jpg|gif|webp));base64,(.+)$/);
        if (matches) {
          const mime = matches[1];
          const ext = matches[2] === 'jpeg' ? 'jpg' : matches[2];
          const data = matches[3];
          const buffer = Buffer.from(data, 'base64');

          const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
          if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

          const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
          const filePath = path.join(uploadsDir, filename);
          fs.writeFileSync(filePath, buffer);

          imagenParaGuardar = `/uploads/${filename}`;
        } else {
          imagenParaGuardar = null;
        }
      } catch (imgErr) {
        console.error('Error salvando imagen en actualizarProducto:', imgErr);
        imagenParaGuardar = null;
      }
    }

    const result = await query(
      `UPDATE productos 
       SET id_categoria = COALESCE($1, id_categoria),
           nombre = COALESCE($2, nombre),
           descripcion = COALESCE($3, descripcion),
           imagen_url = COALESCE($4, imagen_url),
           precio_venta = COALESCE($5, precio_venta),
           stock_minimo = COALESCE($6, stock_minimo),
           es_destacado = COALESCE($7, es_destacado)
       WHERE id_producto = $8 AND id_evento = $9 RETURNING *`,
      [id_categoria, nombre, descripcion, imagenParaGuardar, precioFinal, stockMinFinal, es_destacado, id_producto, req.id_evento]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error actualizarProducto:', error);
    res.status(500).json({ error: 'Error al actualizar producto', detail: error.message });
  }
};

export const ajustarStock = async (req: AuthRequest, res: Response) => {
  const { cantidad, motivo } = req.body; // Cantidad puede ser positiva o negativa
  const id_producto = req.params.id;
  const tipo = cantidad > 0 ? 'INGRESO' : 'SALIDA';

  try {
    const result = await transaction(async (client) => {
      // Bloquear fila de producto
      const prodRes = await client.query(
        'SELECT stock_actual FROM productos WHERE id_producto = $1 AND id_evento = $2 FOR UPDATE',
        [id_producto, req.id_evento]
      );

      if (prodRes.rowCount === 0) throw new Error('Producto no encontrado');
      
      const stockAnterior = prodRes.rows[0].stock_actual;
      const stockNuevo = stockAnterior + cantidad;

      if (stockNuevo < 0) throw new Error('El stock no puede ser negativo');

      // Actualizar stock
      await client.query(
        'UPDATE productos SET stock_actual = $1 WHERE id_producto = $2',
        [stockNuevo, id_producto]
      );

      // Registrar movimiento
      await client.query(
        `INSERT INTO movimientos_inventario (id_producto, tipo_movimiento, cantidad, stock_antes, stock_despues, motivo)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id_producto, tipo, Math.abs(cantidad), stockAnterior, stockNuevo, motivo || 'Ajuste manual']
      );

      return stockNuevo;
    });

    res.json({ message: 'Stock actualizado', nuevo_stock: result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getAlertasStock = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT p.id_producto, p.nombre, p.stock_actual, p.stock_minimo, p.imagen_url, c.nombre as categoria
       FROM productos p
       LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
       WHERE p.id_evento = $1 AND p.stock_actual <= p.stock_minimo AND p.estado = true
       ORDER BY p.stock_actual ASC`,
      [req.id_evento]
    );
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error getAlertasStock:', error);
    res.status(500).json({ error: 'Error al obtener alertas de stock', detail: error.message });
  }
};

export const getKardex = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { fecha_inicio, fecha_fin } = req.query;

  try {
    let q = `
      SELECT m.id_movimiento, m.tipo_movimiento, m.cantidad, m.stock_antes, m.stock_despues, m.motivo, m.referencia, m.fecha_hora
      FROM movimientos_inventario m
      JOIN productos p ON m.id_producto = p.id_producto
      WHERE p.id_evento = $1 AND m.id_producto = $2
    `;
    const params: any[] = [req.id_evento, id];
    let paramIndex = 3;

    if (fecha_inicio) {
      q += ` AND m.fecha_hora >= $${paramIndex}`;
      params.push(fecha_inicio);
      paramIndex++;
    }
    if (fecha_fin) {
      q += ` AND m.fecha_hora <= $${paramIndex}`;
      params.push(fecha_fin);
    }
    
    q += ' ORDER BY m.fecha_hora DESC';

    const result = await query(q, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error getKardex:', error);
    res.status(500).json({ error: 'Error al obtener kardex', detail: error.message });
  }
};

export const eliminarProducto = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const result = await query(
      'UPDATE productos SET estado = false WHERE id_producto = $1 AND id_evento = $2 RETURNING *',
      [id, req.id_evento]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json({ message: 'Producto eliminado (desactivado) exitosamente' });
  } catch (error: any) {
    console.error('Error eliminarProducto:', error);
    res.status(500).json({ error: 'Error al eliminar producto', detail: error.message });
  }
};

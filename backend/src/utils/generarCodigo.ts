import { query } from '../config/database';

/**
 * Genera un código de caja único basado en el nombre del evento
 */
export const generarCodigoCaja = async (nombreEvento: string): Promise<string> => {
  // Tomar las primeras letras o la primera palabra
  const prefijo = nombreEvento.split(' ')[0].substring(0, 4).toUpperCase();
  const year = new Date().getFullYear().toString().substring(2, 4);
  
  let codigo = `${prefijo}${year}`;
  
  // Validar unicidad
  let unico = false;
  let counter = 1;
  let codigoFinal = codigo;
  
  while (!unico) {
    const res = await query('SELECT 1 FROM eventos WHERE codigo_caja = $1', [codigoFinal]);
    if (res.rowCount === 0) {
      unico = true;
    } else {
      codigoFinal = `${codigo}${counter}`;
      counter++;
    }
  }
  
  return codigoFinal;
};

/**
 * Convierte un string a slug (minúsculas, sin espacios ni caracteres especiales)
 */
export const generarSlug = (nombre: string): string => {
  return nombre
    .toLowerCase()
    .normalize('NFD') // Separa acentos
    .replace(/[\u0300-\u036f]/g, '') // Elimina acentos
    .replace(/[^a-z0-9\s-]/g, '') // Elimina caracteres especiales
    .trim()
    .replace(/\s+/g, '-'); // Reemplaza espacios por guiones
};

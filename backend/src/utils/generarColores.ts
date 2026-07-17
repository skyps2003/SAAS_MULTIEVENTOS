// Utilidad para convertir HEX a HSL y generar variantes

type HSL = { h: number; s: number; l: number };

const hexToHsl = (hex: string): HSL => {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

const hslToHex = (h: number, s: number, l: number): string => {
  s /= 100;
  l /= 100;
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  
  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
  
  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

const getVariants = (hex: string) => {
  const hsl = hexToHsl(hex);
  return {
    '50': hslToHex(hsl.h, hsl.s, 95),
    '100': hslToHex(hsl.h, hsl.s, 90),
    '200': hslToHex(hsl.h, hsl.s, 80),
    '300': hslToHex(hsl.h, hsl.s, 70),
    '400': hslToHex(hsl.h, hsl.s, 60),
    '500': hslToHex(hsl.h, hsl.s, 50),
    '600': hslToHex(hsl.h, hsl.s, 40),
    '700': hslToHex(hsl.h, hsl.s, 30),
    '800': hslToHex(hsl.h, hsl.s, 20),
    '900': hslToHex(hsl.h, hsl.s, 10),
  };
};

export const generarPaletaCompleta = (primario: string, secundario: string, acento: string) => {
  const varPrimario = getVariants(primario);
  const varSecundario = getVariants(secundario);
  const varAcento = getVariants(acento);

  return {
    color_primario_base: primario,
    color_secundario_base: secundario,
    color_acento_base: acento,
    
    color_primario_50: varPrimario['50'], color_primario_100: varPrimario['100'],
    color_primario_200: varPrimario['200'], color_primario_300: varPrimario['300'],
    color_primario_400: varPrimario['400'], color_primario_500: varPrimario['500'],
    color_primario_600: varPrimario['600'], color_primario_700: varPrimario['700'],
    color_primario_800: varPrimario['800'], color_primario_900: varPrimario['900'],
    
    color_secundario_50: varSecundario['50'], color_secundario_100: varSecundario['100'],
    color_secundario_200: varSecundario['200'], color_secundario_300: varSecundario['300'],
    color_secundario_400: varSecundario['400'], color_secundario_500: varSecundario['500'],
    color_secundario_600: varSecundario['600'], color_secundario_700: varSecundario['700'],
    color_secundario_800: varSecundario['800'], color_secundario_900: varSecundario['900'],
    
    color_acento_50: varAcento['50'], color_acento_100: varAcento['100'],
    color_acento_200: varAcento['200'], color_acento_300: varAcento['300'],
    color_acento_400: varAcento['400'], color_acento_500: varAcento['500'],
    color_acento_600: varAcento['600'], color_acento_700: varAcento['700'],
    color_acento_800: varAcento['800'], color_acento_900: varAcento['900'],
    
    color_fondo: varPrimario['50'],
    color_superficie: '#FFFFFF',
    color_texto_primario: varPrimario['900'],
    color_texto_secundario: varPrimario['600'],
    color_texto_botones: '#FFFFFF', // Podría ser dinámico si el 500 es claro
    color_error: '#EF4444',
    color_exito: '#22C55E',
    color_advertencia: '#F59E0B'
  };
};

const apiUrl = import.meta.env.VITE_API_URL || 'https://tupos.onrender.com/api/v1';

export function resolveAssetUrl(source?: string | null) {
  if (!source) return '';
  if (/^(https?:|data:|blob:)/i.test(source)) return source;

  try {
    return new URL(source, new URL(apiUrl, window.location.origin).origin).toString();
  } catch {
    return source;
  }
}

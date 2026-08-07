import type { Formato } from './metricas';

export const mxn = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');

export const compacto = (n: number) =>
  Math.abs(n) >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M'
  : Math.abs(n) >= 1e3 ? '$' + Math.round(n / 1e3) + 'k'
  : '$' + Math.round(n);

export const entero = (n: number) => Math.round(n).toLocaleString('es-MX');

export const pct = (n: number, dec = 1) => n.toFixed(dec) + '%';

export function fmt(valor: number, formato: Formato): string {
  if (!Number.isFinite(valor)) return '—';
  switch (formato) {
    case 'moneda': return mxn(valor);
    case 'porcentaje': return pct(valor);
    case 'entero': return entero(valor);
    case 'dias': return Math.round(valor) + ' días';
    default: return String(valor);
  }
}

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

/** '2026-03' -> 'Mar' ; '2026-03-15' -> '15 Mar' ; '2026-Q1' -> 'Q1' */
export function fechaCorta(s: string): string {
  if (/^\d{4}-Q\d$/.test(s)) return s.slice(5);
  const p = s.split('-');
  if (p.length === 2) return MESES[+p[1] - 1] ?? s;
  if (p.length === 3) return `${+p[2]} ${MESES[+p[1] - 1]}`;
  return s;
}

export const nombreMes = (s: string) => MESES[+s.slice(5, 7) - 1] ?? s;

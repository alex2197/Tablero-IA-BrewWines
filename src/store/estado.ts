import { create } from 'zustand';

export type Vista =
  | 'ventas' | 'canales' | 'productos' | 'productividad'
  | 'retencion' | 'operativos' | 'forecast' | 'alertas';

export const VISTAS: [Vista, string][] = [
  ['ventas', 'Ventas General'],
  ['canales', 'Canales'],
  ['productos', 'Productos'],
  ['productividad', 'Productividad'],
  ['retencion', 'Retención'],
  ['operativos', 'Operativos'],
  ['forecast', 'Forecast'],
  ['alertas', 'Alertas'],
];

export interface Traza {
  id: string;
  tipo: 'canal' | 'periodo' | 'categoria' | 'vendedor' | 'cliente';
  texto: string;
  sql?: string;
}

interface Estado {
  vista: Vista;
  canal: string | null;
  categoria: string | null;
  vendedor: string | null;
  cliente: string | null;
  meses: string[];
  destacar: string | null;

  trazas: Traza[];
  setVista: (v: Vista) => void;
  toggleMes: (m: string) => void;
  setMeses: (m: string[]) => void;
  /** Punto de entrada único: lo usan los clics del usuario y la IA. */
  aplicar: (p: {
    vista?: Vista; canal?: string; categoria?: string; vendedor?: string;
    cliente?: string; meses?: string[]; limpiar?: boolean;
  }, sql?: string) => void;
  quitarTraza: (id: string) => void;
  limpiar: () => void;
  destacarPanel: (p: string | null) => void;
}

const nid = () => Math.random().toString(36).slice(2, 9);

export const useEstado = create<Estado>((set) => ({
  vista: 'ventas',
  canal: null, categoria: null, vendedor: null, cliente: null,
  meses: [], destacar: null, trazas: [],

  setVista: (vista) => set({ vista, destacar: null }),

  toggleMes: (m) => set(s => ({
    meses: s.meses.includes(m) ? s.meses.filter(x => x !== m) : [...s.meses, m].sort(),
  })),

  setMeses: (meses) => set({ meses }),

  aplicar: (p, sql) => set(s => {
    if (p.limpiar) {
      return { ...s, canal: null, categoria: null, vendedor: null, cliente: null,
               meses: [], trazas: [], vista: p.vista ?? s.vista };
    }
    let trazas = [...s.trazas];
    const poner = (tipo: Traza['tipo'], texto: string) => {
      trazas = trazas.filter(t => t.tipo !== tipo);
      trazas.push({ id: nid(), tipo, texto, sql });
    };
    if (p.canal) poner('canal', `canal = ${p.canal}`);
    if (p.categoria) poner('categoria', `categoría = ${p.categoria}`);
    if (p.vendedor) poner('vendedor', `vendedor = ${p.vendedor}`);
    if (p.cliente) poner('cliente', `cliente = ${p.cliente}`);
    if (p.meses?.length) poner('periodo', p.meses.length === 1 ? `mes = ${p.meses[0]}` : `${p.meses.length} meses`);

    return {
      ...s,
      vista: p.vista ?? s.vista,
      canal: p.canal ?? s.canal,
      categoria: p.categoria ?? s.categoria,
      vendedor: p.vendedor ?? s.vendedor,
      cliente: p.cliente ?? s.cliente,
      meses: p.meses ?? s.meses,
      trazas,
    };
  }),

  quitarTraza: (id) => set(s => {
    const t = s.trazas.find(x => x.id === id);
    if (!t) return s;
    return {
      ...s,
      trazas: s.trazas.filter(x => x.id !== id),
      canal: t.tipo === 'canal' ? null : s.canal,
      categoria: t.tipo === 'categoria' ? null : s.categoria,
      vendedor: t.tipo === 'vendedor' ? null : s.vendedor,
      cliente: t.tipo === 'cliente' ? null : s.cliente,
      meses: t.tipo === 'periodo' ? [] : s.meses,
    };
  }),

  limpiar: () => set({ canal: null, categoria: null, vendedor: null, cliente: null, meses: [], trazas: [] }),
  destacarPanel: (destacar) => set({ destacar }),
}));

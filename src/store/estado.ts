import { create } from 'zustand';

export type Vista = 'ventas' | 'cobranza' | 'inventario' | 'alertas';

export interface Traza {
  id: string;
  tipo: 'canal' | 'periodo';
  texto: string;
  sql?: string;
}

interface Estado {
  vista: Vista;
  canal: string | null;
  desde: string | null;
  hasta: string | null;
  trazas: Traza[];
  destacar: string | null;

  setVista: (v: Vista) => void;
  /** Punto de entrada único: lo usan tanto los clics del usuario como la IA. */
  aplicar: (p: {
    vista?: Vista; canal?: string; desde?: string; hasta?: string;
    etiqueta_periodo?: string; limpiar?: boolean;
  }, sql?: string) => void;
  quitarTraza: (id: string) => void;
  limpiar: () => void;
  destacarPanel: (p: string | null) => void;
}

const nuevoId = () => Math.random().toString(36).slice(2, 9);

export const useEstado = create<Estado>((set) => ({
  vista: 'ventas',
  canal: null,
  desde: null,
  hasta: null,
  trazas: [],
  destacar: null,

  setVista: (vista) => set({ vista, destacar: null }),

  aplicar: (p, sql) =>
    set((s) => {
      if (p.limpiar) {
        return { ...s, canal: null, desde: null, hasta: null, trazas: [], vista: p.vista ?? s.vista };
      }
      let trazas = [...s.trazas];

      if (p.canal) {
        trazas = trazas.filter((t) => t.tipo !== 'canal');
        trazas.push({ id: nuevoId(), tipo: 'canal', texto: `canal = ${p.canal}`, sql });
      }
      if (p.desde || p.hasta) {
        trazas = trazas.filter((t) => t.tipo !== 'periodo');
        const etiqueta = p.etiqueta_periodo ?? `${p.desde ?? '…'} a ${p.hasta ?? '…'}`;
        trazas.push({ id: nuevoId(), tipo: 'periodo', texto: etiqueta, sql });
      }
      return {
        ...s,
        vista: p.vista ?? s.vista,
        canal: p.canal ?? s.canal,
        desde: p.desde ?? s.desde,
        hasta: p.hasta ?? s.hasta,
        trazas,
      };
    }),

  quitarTraza: (id) =>
    set((s) => {
      const t = s.trazas.find((x) => x.id === id);
      if (!t) return s;
      return {
        ...s,
        trazas: s.trazas.filter((x) => x.id !== id),
        canal: t.tipo === 'canal' ? null : s.canal,
        desde: t.tipo === 'periodo' ? null : s.desde,
        hasta: t.tipo === 'periodo' ? null : s.hasta,
      };
    }),

  limpiar: () => set({ canal: null, desde: null, hasta: null, trazas: [] }),
  destacarPanel: (destacar) => set({ destacar }),
}));

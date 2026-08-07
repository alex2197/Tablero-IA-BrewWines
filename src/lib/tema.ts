/** Colores del tema Brew Wines, para usar en Recharts (que no lee CSS vars). */
export const T = {
  vino: '#3a0006', vino2: '#5e2010', tierra: '#a0705a', arena: '#c49070',
  rosa: '#d8a790', pizarra: '#5e5f64', carbon: '#37383e', cobre: '#7a4a3a',
  papel: '#f5f0eb', linea: '#e6ddd5', linea2: '#cfc2b8', humo: '#7a6e6a',
  jade: '#1f6f5c', rojo: '#9c1f24', ambar: '#b5761b',
};

export const SERIE = [T.vino, T.vino2, T.tierra, T.arena, T.rosa, T.pizarra, T.carbon, T.cobre];

export const ejeTick = { fontFamily: 'var(--font-mono)', fontSize: 9.5, fill: T.humo };

export const tooltipEstilo = {
  border: `1px solid ${T.linea2}`, borderRadius: 2, background: '#fff',
  fontFamily: 'var(--font-mono)', fontSize: 11,
};

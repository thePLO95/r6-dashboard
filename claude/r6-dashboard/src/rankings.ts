import type { Agg, Aggregates } from './data';

export type StatDef = { key: string; label: string; higher: boolean; dec: number; suffix: string; rating?: boolean; hint: string };
export const STAT_DEFS: StatDef[] = [
  { key: 'matches', label: 'Partidas', higher: true, dec: 0, suffix: '', hint: 'Partidas jugadas' },
  { key: 'winrate', label: '% Victorias', higher: true, dec: 1, suffix: '%', hint: 'Victorias / (victorias + derrotas)' },
  { key: 'kd', label: 'K/D', higher: true, dec: 2, suffix: '', hint: 'Σkills / Σmuertes' },
  { key: 'kpr', label: 'Kills/ronda', higher: true, dec: 2, suffix: '', hint: 'Σkills / Σrondas' },
  { key: 'dpr', label: 'Muertes/ronda', higher: false, dec: 2, suffix: '', hint: 'Σmuertes / Σrondas (menos es mejor)' },
  { key: 'apr', label: 'Asist./ronda', higher: true, dec: 2, suffix: '', hint: 'Σasistencias / Σrondas' },
  { key: 'hs', label: '% Headshots', higher: true, dec: 1, suffix: '%', hint: 'Headshots / kills' },
  { key: 'rounds', label: 'Rondas', higher: true, dec: 0, suffix: '', hint: 'Rondas jugadas' },
  { key: 'rwr', label: '% Rondas ganadas', higher: true, dec: 1, suffix: '%', hint: 'Rondas ganadas / rondas jugadas' },
  { key: 'peak', label: 'Pico rank points', higher: true, dec: 0, suffix: '', rating: true, hint: 'Máximo de rank points (solo ranked)' },
  { key: 'net', label: 'Progreso rank', higher: true, dec: 0, suffix: '', rating: true, hint: 'Rank points ganados desde el inicio de season (global = suma de seasons)' },
];

const zero = (): Agg => ({ n: 0, w: 0, l: 0, u: 0, k: 0, d: 0, a: 0, hs: 0, r: 0, rw: 0 });
const add = (a: Agg, b: Agg) => { (Object.keys(a) as (keyof Agg)[]).forEach((k) => { a[k] += b[k]; }); return a; };

function playerAgg(ag: Aggregates, name: string, season: string, group: string): Agg {
  const P = ag.players[name] ?? {}, out = zero();
  for (const s of season === 'all' ? Object.keys(P) : [season]) { const g = P[s]?.[group]; if (g) add(out, g); }
  return out;
}
function playerRating(ag: Aggregates, name: string, season: string) {
  const R = ag.rating[name] ?? {}, list = season === 'all' ? Object.values(R) : R[season] ? [R[season]] : [];
  return list.length ? { peak: Math.max(...list.map((r) => r.peak)), net: list.reduce((s, r) => s + r.net, 0), rated: list.reduce((s, r) => s + r.rated, 0) } : null;
}
const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;

/** Valor de un stat para un jugador, o null si no hay datos suficientes (< min muestras). */
function value(def: StatDef, a: Agg, r: ReturnType<typeof playerRating>, min: number): number | null {
  const d = def.dec;
  switch (def.key) {
    case 'matches': return a.n || null;
    case 'rounds': return a.r || null;
    case 'winrate': return a.w + a.l >= Math.max(min, 1) ? round((100 * a.w) / (a.w + a.l), d) : null;
    case 'kd': return a.u >= min && a.d ? round(a.k / a.d, d) : null;
    case 'kpr': return a.u >= min && a.r ? round(a.k / a.r, d) : null;
    case 'dpr': return a.u >= min && a.r ? round(a.d / a.r, d) : null;
    case 'apr': return a.u >= min && a.r ? round(a.a / a.r, d) : null;
    case 'hs': return a.u >= min && a.k ? round((100 * a.hs) / a.k, d) : null;
    case 'rwr': return a.u >= min && a.r ? round((100 * a.rw) / a.r, d) : null;
    case 'peak': return r && r.rated >= min ? r.peak : null;
    case 'net': return r && r.rated >= min ? r.net : null;
    default: return null;
  }
}

export type RankRow = { name: string; values: Record<string, number | null>; pos: Record<string, number | null> };
/** Tabla completa: valor y posición de cada jugador en cada stat, para una season (o 'all') y un grupo de playlist. */
export function buildRankings(ag: Aggregates, season: string, group: string, min: number): RankRow[] {
  const rows: RankRow[] = Object.keys(ag.players).map((name) => {
    const a = playerAgg(ag, name, season, group), r = playerRating(ag, name, season);
    return { name, values: Object.fromEntries(STAT_DEFS.map((d) => [d.key, value(d, a, r, min)])), pos: {} };
  });
  for (const d of STAT_DEFS) {
    const ranked = rows.filter((r) => r.values[d.key] != null).sort((x, y) => (d.higher ? y.values[d.key]! - x.values[d.key]! : x.values[d.key]! - y.values[d.key]!));
    ranked.forEach((r, i) => { r.pos[d.key] = i > 0 && r.values[d.key] === ranked[i - 1].values[d.key] ? ranked[i - 1].pos[d.key] : i + 1; });
    rows.forEach((r) => { if (!(d.key in r.pos)) r.pos[d.key] = null; });
  }
  return rows;
}

export type Match = {
  id: string; season: string; playlist: string; i: number; t: number;
  mode: string | null; map: string | null; res: string;
  k: number | null; d: number | null; a: number | null; hs: number | null;
  rounds: number | null; rw: number | null; dur?: number | null;
  rp: number | null; rpPrev: number | null; rpD: number | null; rank: string | null;
};
export type PlayerData = { name: string; avatar: string; playerId: string; matches: Match[] };
export type Index = { seasons: string[]; players: { name: string; avatar: string; seasonInfo: Record<string, { ranked: number; rated: number }> }[] };

export type Round = [matchId: string, round: number, outcome: 'win' | 'loss' | 'unknown', side: 'atk' | 'def' | null, operatorId: string];
type Named = { name: string; img: string | null };
export type Meta = { operators: Record<string, Named>; maps: Record<string, Named> };
export type Agg = { n: number; w: number; l: number; u: number; k: number; d: number; a: number; hs: number; r: number; rw: number };
export type SeasonRating = { start: number; end: number; peak: number; net: number; rated: number };
export type Aggregates = { seasons: string[]; players: Record<string, Record<string, Record<string, Agg>>>; rating: Record<string, Record<string, SeasonRating>> };
export type Squads = Record<string, string[]>;

const base = import.meta.env.BASE_URL + 'data/';
const get = <T,>(p: string) => fetch(base + p).then((r) => r.json() as Promise<T>);
// Cada fichero se descarga una sola vez por sesión
const memo = <T,>(f: (k: string) => Promise<T>) => { const m = new Map<string, Promise<T>>(); return (k: string) => { let p = m.get(k); if (!p) { p = f(k); m.set(k, p); } return p; }; };
const once = <T,>(f: () => Promise<T>) => { let p: Promise<T> | undefined; return () => (p ??= f()); };
export const loadIndex = once(() => get<Index>('index.json'));
export const loadMeta = once(() => get<Meta>('meta.json'));
export const loadSquads = once(() => get<Squads>('squads.json'));
export const loadAggregates = once(() => get<Aggregates>('aggregates.json'));
export const loadPlayer = memo((name: string) => get<PlayerData>(`players/${encodeURIComponent(name)}.json`));
export const loadRounds = memo((name: string) => get<Round[]>(`players/${encodeURIComponent(name)}.rounds.json`));

export type Metric = 'rating' | 'progress' | 'netwins';
export type XAxis = 'date' | 'match';

/** Serie [x, y] de un jugador en una season (solo ranked). Devuelve [] si no hay datos para esa métrica. */
export function rankSeries(p: PlayerData, season: string, metric: Metric, x: XAxis): [number, number][] {
  const ms = p.matches.filter((m) => m.season === season && m.playlist === 'ranked').sort((a, b) => a.t - b.t);
  const xv = (m: Match, idx: number) => (x === 'date' ? m.t : idx + 1);
  if (metric === 'netwins') {
    // Proxy válido en TODAS las temporadas: victorias - derrotas acumuladas
    let acc = 0;
    return ms.map((m, i) => { acc += m.res === 'win' ? 1 : m.res === 'loss' ? -1 : 0; return [xv(m, i), acc]; });
  }
  const rated = ms.map((m, i) => ({ m, i })).filter(({ m }) => m.rp != null);
  if (!rated.length) return [];
  if (metric === 'rating') return rated.map(({ m, i }) => [xv(m, i), m.rp!]);
  // progress: puntos respecto al inicio de season (rp anterior a la 1ª partida con dato)
  const f = rated[0].m;
  const base = f.rpPrev ?? (f.rpD != null ? f.rp! - f.rpD : f.rp!);
  return rated.map(({ m, i }) => [xv(m, i), m.rp! - base]);
}

export const seasonSummary = (p: PlayerData, season: string) => {
  const s = rankSeries(p, season, 'rating', 'date');
  const pr = rankSeries(p, season, 'progress', 'date');
  return s.length ? { start: s[0][1] - pr[0][1], end: s[s.length - 1][1], net: pr[pr.length - 1][1], peak: Math.max(...s.map((d) => d[1])) } : null;
};

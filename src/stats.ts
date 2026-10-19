import type { Match } from './data';

export const seasonKey = (s: string) => { const m = /Y(\d+)S(\d+)/.exec(s); return m ? +m[1] * 10 + +m[2] : 0; };
// Playlists mostradas; cualquier otra ("134", etc.) se agrupa en "other"
export const PLAYLIST_GROUPS = ['ranked', 'standard', 'quick-match', 'siege-cup', 'event', 'arcade', 'dual-front', 'other'];
export const playlistGroup = (p: string) => (PLAYLIST_GROUPS.includes(p) && p !== 'other' ? p : 'other');
const r2 = (x: number) => Math.round(x * 100) / 100;

type Agg = { n: number; k: number; d: number; a: number; r: number };
// Solo partidas con kills/deaths/assists y rondas jugadas
const usable = (m: Match, playlist: string) => (playlist === 'all' || playlistGroup(m.playlist) === playlist) && m.k != null && m.d != null && m.a != null && !!m.rounds;
const agg = (ms: Match[]): Agg => ms.reduce((s, m) => ({ n: s.n + 1, k: s.k + m.k!, d: s.d + m.d!, a: s.a + m.a!, r: s.r + m.rounds! }), { n: 0, k: 0, d: 0, a: 0, r: 0 });
// Ratio de sumas (no media de ratios): K/D = Σkills/Σdeaths, y por ronda = Σx/Σrondas
const ratios = (g: Agg) => ({ n: g.n, kd: g.d ? r2(g.k / g.d) : null, kpr: r2(g.k / g.r), dpr: r2(g.d / g.r), apr: r2(g.a / g.r) });
export type Ratios = ReturnType<typeof ratios>;

/** Un punto por season (orden cronológico). */
export function kdaBySeason(matches: Match[], playlist: string): (Ratios & { season: string })[] {
  const by = new Map<string, Match[]>();
  for (const m of matches) if (usable(m, playlist)) (by.get(m.season) ?? by.set(m.season, []).get(m.season)!).push(m);
  return [...by].sort((a, b) => seasonKey(a[0]) - seasonKey(b[0])).map(([season, ms]) => ({ season, ...ratios(agg(ms)) }));
}

/** Media móvil de las últimas `win` partidas dentro de una season. */
export function kdaRolling(matches: Match[], season: string, playlist: string, win: number): (Ratios & { i: number })[] {
  const ms = matches.filter((m) => m.season === season && usable(m, playlist)).sort((a, b) => a.t - b.t);
  return ms.map((_, i) => ({ i: i + 1, ...ratios(agg(ms.slice(Math.max(0, i - win + 1), i + 1))) }));
}

/** Partidas por season y grupo de playlist (orden fijo; se omiten los grupos sin partidas). */
export function playlistCounts(matches: Match[]) {
  const seasons = [...new Set(matches.map((m) => m.season))].sort((a, b) => seasonKey(a) - seasonKey(b));
  const cnt: Record<string, Record<string, number>> = {};
  for (const m of matches) { const g = playlistGroup(m.playlist); (cnt[g] ??= {})[m.season] = (cnt[g][m.season] ?? 0) + 1; }
  const playlists = PLAYLIST_GROUPS.filter((g) => cnt[g]);
  return { seasons, playlists, counts: (p: string, s: string) => cnt[p]?.[s] ?? 0 };
}

// ───────────── Mapas y operadores (usan los datos por ronda: solo existen desde Y10S1) ─────────────
import type { Round } from './data';

export type Filter = { season: string; group: string; side?: 'all' | 'atk' | 'def' };
const pass = (m: Match, f: Filter) => (f.season === 'all' || m.season === f.season) && (f.group === 'all' || playlistGroup(m.playlist) === f.group);
const rate = (w: number, l: number) => (w + l ? Math.round((1000 * w) / (w + l)) / 10 : null);

export type MapRow = { map: string; n: number; wr: number | null; atkN: number; atkWr: number | null; defN: number; defWr: number | null };
/** Por mapa: partidas, % victoria global y % de rondas ganadas atacando / defendiendo. Abandonos, rollbacks y empates no cuentan como V/D. */
export function mapStats(matches: Match[], rounds: Round[], f: Filter): MapRow[] {
  type A = { n: number; w: number; l: number; aw: number; al: number; dw: number; dl: number };
  const acc = new Map<string, A>(), byId = new Map<string, Match>();
  for (const m of matches) {
    if (!m.map || !pass(m, f)) continue;
    byId.set(m.id, m);
    const a = acc.get(m.map) ?? { n: 0, w: 0, l: 0, aw: 0, al: 0, dw: 0, dl: 0 };
    a.n++; if (m.res === 'win') a.w++; else if (m.res === 'loss') a.l++;
    acc.set(m.map, a);
  }
  for (const [id, , outcome, side] of rounds) {
    const m = byId.get(id);
    if (!m || outcome === 'unknown' || !side) continue;
    const a = acc.get(m.map!)!, win = outcome === 'win';
    if (side === 'atk') { if (win) a.aw++; else a.al++; } else if (win) a.dw++; else a.dl++;
  }
  return [...acc].map(([map, a]) => ({ map, n: a.n, wr: rate(a.w, a.l), atkN: a.aw + a.al, atkWr: rate(a.aw, a.al), defN: a.dw + a.dl, defWr: rate(a.dw, a.dl) })).sort((x, y) => y.n - x.n);
}

export type OpRow = { op: string; side: 'atk' | 'def'; rounds: number; wins: number; wr: number | null };
/** Por operador: rondas jugadas y % de rondas ganadas (rondas con resultado conocido). */
export function operatorStats(matches: Match[], rounds: Round[], f: Filter): OpRow[] {
  const byId = new Map<string, Match>(matches.filter((m) => pass(m, f)).map((m) => [m.id, m]));
  const acc = new Map<string, { rounds: number; wins: number; atk: number; def: number }>();
  for (const [id, , outcome, side, op] of rounds) {
    if (!byId.has(id) || outcome === 'unknown' || !side || (f.side && f.side !== 'all' && f.side !== side)) continue;
    const a = acc.get(op) ?? { rounds: 0, wins: 0, atk: 0, def: 0 };
    a.rounds++; if (outcome === 'win') a.wins++; a[side]++;
    acc.set(op, a);
  }
  return [...acc].map(([op, a]) => ({ op, side: a.atk >= a.def ? ('atk' as const) : ('def' as const), rounds: a.rounds, wins: a.wins, wr: rate(a.wins, a.rounds - a.wins) })).sort((x, y) => y.rounds - x.rounds);
}

/** Matriz operador x season (rondas y victorias) para los `top` operadores más jugados. */
export function operatorMatrix(matches: Match[], rounds: Round[], group: string, side: 'all' | 'atk' | 'def', top = 20) {
  const info = new Map<string, Match>(matches.filter((m) => group === 'all' || playlistGroup(m.playlist) === group).map((m) => [m.id, m]));
  const cell = new Map<string, { rounds: number; wins: number }>(), total = new Map<string, number>(), seasonSet = new Set<string>();
  for (const [id, , outcome, s, op] of rounds) {
    const m = info.get(id);
    if (!m || outcome === 'unknown' || !s || (side !== 'all' && side !== s)) continue;
    seasonSet.add(m.season); total.set(op, (total.get(op) ?? 0) + 1);
    const k = op + '|' + m.season, c = cell.get(k) ?? { rounds: 0, wins: 0 };
    c.rounds++; if (outcome === 'win') c.wins++; cell.set(k, c);
  }
  const seasons = [...seasonSet].sort((a, b) => seasonKey(a) - seasonKey(b));
  const ops = [...total].sort((a, b) => b[1] - a[1]).slice(0, top).map(([op]) => op);
  return { seasons, ops, get: (op: string, season: string) => cell.get(op + '|' + season) };
}

// Genera ficheros derivados a partir de public/data/players/*.json (salida de ingest.mjs):
//   squads.json     { matchId: [jugadores que comparten esa partida] }  (solo ids con >1 jugador)
//   aggregates.json totales por jugador x season x grupo de playlist + rating por season (para los rankings)
// Uso: node scripts/build-derived.mjs public/data
import fs from 'node:fs';

const dir = process.argv[2] ?? 'public/data';
// Mantener sincronizado con PLAYLIST_GROUPS de src/stats.ts
const GROUPS = ['ranked', 'standard', 'quick-match', 'siege-cup', 'event', 'arcade', 'dual-front'];
const group = (p) => (GROUPS.includes(p) ? p : 'other');
const seasonKey = (s) => { const m = /Y(\d+)S(\d+)/.exec(s); return m ? +m[1] * 10 + +m[2] : 0; };
const empty = () => ({ n: 0, w: 0, l: 0, u: 0, k: 0, d: 0, a: 0, hs: 0, r: 0, rw: 0 });

const index = JSON.parse(fs.readFileSync(`${dir}/index.json`, 'utf8'));
const byId = new Map(), players = {}, rating = {};
for (const p of index.players) {
  const { matches } = JSON.parse(fs.readFileSync(`${dir}/players/${p.name}.json`, 'utf8'));
  const P = (players[p.name] = {});
  for (const m of matches) {
    if (!byId.has(m.id)) byId.set(m.id, []);
    byId.get(m.id).push(p.name);
    for (const key of [group(m.playlist), 'all']) {
      const A = ((P[m.season] ??= {})[key] ??= empty());
      A.n++; if (m.res === 'win') A.w++; else if (m.res === 'loss') A.l++;
      if (m.k != null && m.d != null && m.a != null && m.rounds > 0) {
        A.u++; A.k += m.k; A.d += m.d; A.a += m.a; A.hs += m.hs ?? 0; A.r += m.rounds; A.rw += m.rw ?? 0;
      }
    }
  }
  const R = (rating[p.name] = {});
  const ranked = matches.filter((m) => m.playlist === 'ranked' && m.rp != null).sort((a, b) => a.t - b.t);
  for (const season of new Set(ranked.map((m) => m.season))) {
    const ms = ranked.filter((m) => m.season === season), f = ms[0];
    const start = f.rpPrev ?? (f.rpD != null ? f.rp - f.rpD : f.rp), end = ms[ms.length - 1].rp;
    R[season] = { start, end, peak: Math.max(...ms.map((m) => m.rp)), net: end - start, rated: ms.length };
  }
}
const squads = {};
for (const [id, names] of byId) if (names.length > 1) squads[id] = names;
const seasons = [...new Set(Object.values(players).flatMap((P) => Object.keys(P)))].sort((a, b) => seasonKey(b) - seasonKey(a));
fs.writeFileSync(`${dir}/squads.json`, JSON.stringify(squads));
fs.writeFileSync(`${dir}/aggregates.json`, JSON.stringify({ seasons, players, rating }));
console.log(`derived OK: ${Object.keys(squads).length} partidas compartidas, ${seasons.length} seasons, ${index.players.length} jugadores`);

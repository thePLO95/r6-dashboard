// Detecta el momento REAL en que se resetea el rating en cada cambio de season y lo compara con seasonData.js.
// Uso:  node scripts/detect-season-resets.mjs [raw/seasonData.js] [public/data] [--write]
//   --write  genera raw/seasonData.suggested.js con las fechas corregidas (no toca el original)
//
// Idea: en un reset, la primera partida con rating de la nueva season tiene rankPointsPrevious = null y los puntos
// caen (a ~1000 o con soft reset). Cada pareja de partidas ranked consecutivas (a, b) que muestra esa caída nos dice
// que el reset ocurrió entre a y b. Intersectando las parejas de todos los jugadores se acota el instante del reset.
// Las parejas "continuas" (b.rankPointsPrevious == a.rankPoints) demuestran que NO hubo reset entre a y b.
import fs from 'node:fs';
import vm from 'node:vm';

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const [seasonFile = 'raw/seasonData.js', dataDir = 'public/data'] = args.filter((a) => !a.startsWith('--'));
const D = 864e5;
const iso = (t) => new Date(t).toISOString().slice(0, 16).replace('T', ' ');
const dow = (t) => ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][new Date(t).getUTCDay()];

const seasons = vm.runInNewContext(fs.readFileSync(seasonFile, 'utf8') + ';seasonData')
  .map((s) => ({ id: s.id, t: new Date(s.releaseDate).getTime() })).sort((a, b) => a.t - b.t);
const index = JSON.parse(fs.readFileSync(`${dataDir}/index.json`, 'utf8'));
const players = index.players.map((p) => JSON.parse(fs.readFileSync(`${dataDir}/players/${p.name}.json`, 'utf8')));

const allMatches = players.flatMap((p) => p.matches);
const minT = Math.min(...allMatches.map((m) => m.t)), maxT = Math.max(...allMatches.map((m) => m.t));
const bounds = seasons.filter((s, i) => i > 0 && s.t >= minT - 7 * D && s.t <= maxT);

const resets = [], conts = [];
for (const p of players) {
  const ms = p.matches.filter((m) => m.playlist === 'ranked' && m.rp != null).sort((a, b) => a.t - b.t);
  for (let i = 1; i < ms.length; i++) {
    const a = ms[i - 1], b = ms[i];
    if (b.rpPrev == null && a.rp - b.rp >= 150) resets.push({ a: a.t, b: b.t });
    else if (b.rpPrev != null && b.rpPrev === a.rp) conts.push({ a: a.t, b: b.t });
  }
}

const rows = [];
for (const B of bounds) {
  const g = resets.filter((r) => { const inside = bounds.filter((x) => x.t > r.a - 4 * D && x.t <= r.b + D); return inside.length === 1 && inside[0].id === B.id; });
  if (!g.length) { rows.push({ id: B.id, B: B.t, n: 0 }); continue; }
  const lo = Math.max(...g.map((r) => r.a)), hi = Math.min(...g.map((r) => r.b));
  if (lo >= hi) { rows.push({ id: B.id, B: B.t, n: g.length, conflict: true }); continue; }
  let feas = [[lo, hi]];
  for (const c of conts) {
    if (c.b <= lo || c.a >= hi) continue;
    feas = feas.flatMap(([x, y]) => (c.b <= x || c.a >= y ? [[x, y]] : [...(c.a > x ? [[x, c.a]] : []), ...(c.b < y ? [[c.b, y]] : [])]));
  }
  rows.push({ id: B.id, B: B.t, n: g.length, lo, hi, feas });
}

// Hora del día común a todas las ventanas estrechas (< 1 día): el reset real ocurre siempre a la misma hora
const tod = (t) => t - Math.floor(t / D) * D;
const narrow = rows.filter((r) => r.n && !r.conflict && r.hi - r.lo < D && Math.floor(r.lo / D) === Math.floor(r.hi / D));
const todLo = Math.max(...narrow.map((r) => tod(r.lo))), todHi = Math.min(...narrow.map((r) => tod(r.hi)));
let T = null;
if (narrow.length && todLo < todHi) { const h = Math.ceil(todLo / 36e5) * 36e5; T = h < todHi ? h : (todLo + todHi) / 2; }
const hhmm = (ms) => new Date(ms).toISOString().slice(11, 16);

console.log(`\nJugadores: ${players.length} | partidas: ${allMatches.length} | reset-pairs: ${resets.length} | continuas: ${conts.length}`);
if (T != null) console.log(`Hora de reset común a las ventanas estrechas: entre ${hhmm(todLo)} y ${hhmm(todHi)} UTC -> propuesta ${hhmm(T)} UTC\n`);

const fixes = {};
for (const r of rows) {
  if (!r.n) { console.log(`${r.id.padEnd(6)} actual ${iso(r.B)} (${dow(r.B)}) | sin resets detectables (faltan datos de rating)`); continue; }
  if (r.conflict) { console.log(`${r.id.padEnd(6)} actual ${iso(r.B)} | DATOS CONTRADICTORIOS, revisar a mano`); continue; }
  const inWin = r.B >= r.lo && r.B <= r.hi;
  // propuesta: primer día dentro de la ventana en que "día + hora común" cae dentro de ella
  let sug = null;
  if (T != null) for (let d = Math.floor(r.lo / D); d <= Math.floor(r.hi / D); d++) { const c = d * D + T; if (c > r.lo && c < r.hi && r.feas.some(([x, y]) => c >= x && c <= y)) { sug = c; break; } }
  if (sug == null) sug = Math.round((r.lo + r.hi) / 2);
  const wrong = allMatches.filter((m) => (r.B < r.lo ? m.t > r.B && m.t <= r.lo : r.B > r.hi ? m.t > r.hi && m.t <= r.B : false)).length;
  const verdict = inWin ? 'OK' : r.B < r.lo ? `MAL: frontera ${((r.lo - r.B) / 36e5).toFixed(1)}h ANTES del reset` : `MAL: frontera ${((r.B - r.hi) / 36e5).toFixed(1)}h DESPUÉS del reset`;
  console.log(`${r.id.padEnd(6)} actual ${iso(r.B)} (${dow(r.B)}) | reset entre ${iso(r.lo)} y ${iso(r.hi)} (n=${r.n}) | ${verdict}${wrong ? ` | ${wrong} partidas mal etiquetadas seguras` : ''}`);
  if (!inWin) { console.log(`       -> propuesta: ${iso(sug)} UTC (${dow(sug)})`); fixes[r.id] = sug; }
}

console.log('\nChequeo de longitud y día de la semana (seasons con datos; sin rating no se puede verificar con datos):');
for (let i = 0; i < seasons.length - 1; i++) {
  const s = seasons[i], len = (seasons[i + 1].t - s.t) / D;
  if (s.t < minT - 100 * D || s.t > maxT) continue;
  const odd = len < 75 || len > 105 || dow(s.t) !== 'mar';
  if (odd) console.log(`  ${s.id}: inicio ${iso(s.t)} (${dow(s.t)}), dura ${len.toFixed(0)} días${len < 75 || len > 105 ? '  <- longitud atípica' : ''}${dow(s.t) !== 'mar' ? '  <- no es martes' : ''}`);
}

if (WRITE) {
  let src = fs.readFileSync(seasonFile, 'utf8');
  for (const [id, t] of Object.entries(fixes)) {
    const re = new RegExp(`(new Date\\(")[^"]+("\\)\\s*,\\s*id:\\s*"${id}")`);
    src = src.replace(re, `$1${new Date(t).toISOString().replace('Z', '+00:00')}$2`);
  }
  const out = seasonFile.replace(/\.js$/, '.suggested.js');
  fs.writeFileSync(out, src);
  console.log(`\nEscrito ${out} con ${Object.keys(fixes).length} fechas corregidas.`);
}

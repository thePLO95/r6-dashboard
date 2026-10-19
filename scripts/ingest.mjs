// Raw del tracker -> JSON final (sin pasar por el objeto `users`).
// Uso: node scripts/ingest.mjs raw/seasonData.js raw/allMatches public/data
// raw/allMatches puede contener data_XX.js (var data_XX = [...]) o *.json (array). Se procesa fichero a fichero.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const [, , seasonFile = 'raw/seasonData.js', matchesDir = 'raw/allMatches', outDir = 'public/data'] = process.argv;
fs.mkdirSync(`${outDir}/players`, { recursive: true });

const load = (file, varName) => {
  const src = fs.readFileSync(file, 'utf8'); // UTF-8 explícito: aquí no hay mojibake
  try { return file.endsWith('.json') ? JSON.parse(src) : vm.runInNewContext(src + `\n;${varName}`); }
  catch (e) { throw new Error(`No pude leer ${file} (¿variable "${varName}"?): ${e.message}`); }
};
const fix = (s) => (typeof s === 'string' ? s.trim() : s);
const v = (s, k) => s?.[k]?.value ?? null;
// duration del tracker en ms (si viniera ya en segundos, < 10000, se respeta)
const duration = (d) => (d == null ? null : Math.round(d > 10000 ? d / 1000 : d));

// Misma semántica que tu GetSeason: la última entrada de seasonData es el límite superior
const seasons = load(seasonFile, 'seasonData').map((s) => ({ id: s.id, t: new Date(s.releaseDate).getTime() })).sort((a, b) => a.t - b.t);
const seasonOf = (t) => { for (let i = 0; i < seasons.length - 1; i++) if (t >= seasons[i].t && t < seasons[i + 1].t) return seasons[i].id; return 'none'; };
const seasonKey = (s) => { const m = /Y(\d+)S(\d+)/.exec(s); return m ? +m[1] * 10 + +m[2] : 0; };

const players = new Map(), seen = new Set(), meta = { operators: {}, maps: {}, ranks: {} }, rankT = {};
let none = 0, total = 0;

for (const f of fs.readdirSync(matchesDir).filter((f) => /\.(js|json)$/.test(f)).sort()) {
  const raw = load(path.join(matchesDir, f), path.parse(f).name);
  for (const r of raw) {
    const seg = r.segments?.[0];
    if (!seg || seen.has(r.user + '|' + r.attributes.id)) continue;
    seen.add(r.user + '|' + r.attributes.id);
    const t = new Date(r.metadata.timestamp).getTime();
    const season = seasonOf(t); if (season === 'none') none++;
    let p = players.get(r.user);
    if (!p) players.set(r.user, (p = { name: r.user, avatar: null, avatarT: -Infinity, playerId: null, matches: [], rounds: [] }));
    // Avatar: el más reciente que venga informado (una sola partida con avatar basta para conservarlo)
    const av = seg.metadata?.avatarUrl;
    if (av && t >= p.avatarT) { p.avatar = av; p.avatarT = t; }
    if (!p.playerId && seg.attributes?.playerId) p.playerId = seg.attributes.playerId;
    const s = seg.stats ?? {};
    const rk = s.rankPoints?.metadata;
    if (rk?.name && rk?.imageUrl && t >= (rankT[fix(rk.name)] ?? -Infinity)) { meta.ranks[fix(rk.name)] = rk.imageUrl; rankT[fix(rk.name)] = t; }
    p.matches.push({
      id: r.attributes.id, season, playlist: r.attributes.sessionType, t, dur: duration(r.metadata.duration),
      mode: r.attributes.sessionMode ?? null, map: r.attributes.sessionMap ?? null, res: seg.metadata?.result,
      k: v(s, 'kills'), d: v(s, 'deaths'), a: v(s, 'assists'), hs: v(s, 'headshots'),
      rounds: v(s, 'roundsPlayed'), rw: v(s, 'roundsWon'),
      rp: v(s, 'rankPoints'), rpPrev: v(s, 'rankPointsPrevious'), rpD: v(s, 'rankPointsDelta'),
      rank: fix(s.rankPoints?.metadata?.name) ?? null,
    });
    for (const ro of seg.metadata?.rounds ?? []) {
      p.rounds.push([r.attributes.id, ro.round, ro.outcome, ro.operatorSide, ro.operatorId]);
      meta.operators[ro.operatorId] ??= { name: fix(ro.operatorName), img: ro.operatorImageUrl ?? null };
    }
    if (r.attributes.sessionMap && r.metadata.sessionMapName)
      meta.maps[r.attributes.sessionMap] ??= { name: r.metadata.sessionMapName, img: r.metadata.sessionMapImageUrl ?? null };
    total++;
  }
  console.log(`${f}: ok (${total} partidas únicas hasta ahora)`);
}

const index = { players: [], seasons: new Set() };
for (const p of players.values()) {
  p.matches.sort((a, b) => a.t - b.t);
  const counter = {}, seasonInfo = {};
  for (const m of p.matches) {
    const k = m.season + '|' + m.playlist;
    m.i = counter[k] = (counter[k] ?? 0) + 1;
    index.seasons.add(m.season);
    if (m.playlist === 'ranked') { const si = (seasonInfo[m.season] ??= { ranked: 0, rated: 0 }); si.ranked++; if (m.rp != null) si.rated++; }
  }
  const { rounds, avatarT, ...player } = p;
  fs.writeFileSync(`${outDir}/players/${p.name}.json`, JSON.stringify(player));
  fs.writeFileSync(`${outDir}/players/${p.name}.rounds.json`, JSON.stringify(rounds));
  index.players.push({ name: p.name, avatar: p.avatar, seasonInfo });
}
index.seasons = [...index.seasons].filter((s) => s !== 'none').sort((a, b) => seasonKey(b) - seasonKey(a));
fs.writeFileSync(`${outDir}/index.json`, JSON.stringify(index));
fs.writeFileSync(`${outDir}/meta.json`, JSON.stringify(meta));
console.log(`OK -> ${outDir}: ${index.players.length} jugadores, ${total} partidas, ${index.seasons.length} seasons`);
if (none) console.warn(`⚠ ${none} partidas sin season (fecha fuera de seasonData). Añade la season actual + una entrada final como límite.`);

// Diagnostica por qué una partida sale (o no) con squad.
// Uso:  npm run check-match -- <matchId>                 (mira public/data)
//       npm run check-match -- <matchId> --raw           (además busca la partida en raw/allMatches)
// Opciones: --raw [carpeta]   --data [carpeta]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const args = process.argv.slice(2);
const opt = (flag, def) => { const i = args.indexOf(flag); return i < 0 ? null : args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def; };
const id = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--raw' && args[args.indexOf(a) - 1] !== '--data');
const rawDir = opt('--raw', 'raw/allMatches'), dir = opt('--data', 'public/data') ?? 'public/data';
if (!id) { console.log('Uso: npm run check-match -- <matchId> [--raw]'); process.exit(1); }
const fmt = (t) => new Date(t).toISOString().slice(0, 16).replace('T', ' ');

console.log(`\nPartida ${id}\n`);
const index = JSON.parse(fs.readFileSync(`${dir}/index.json`, 'utf8'));
const processed = [];
for (const p of index.players) {
  const m = JSON.parse(fs.readFileSync(`${dir}/players/${p.name}.json`, 'utf8')).matches.find((x) => x.id === id);
  if (m) processed.push({ name: p.name, m });
}
console.log(`1) Datos procesados (${dir}/players): ${processed.length ? '' : 'NO está en ningún jugador'}`);
processed.forEach(({ name, m }) => console.log(`   - ${name}: ${fmt(m.t)} · ${m.season} · ${m.playlist} · ${m.res}`));

const sq = fs.existsSync(`${dir}/squads.json`) ? JSON.parse(fs.readFileSync(`${dir}/squads.json`, 'utf8')) : null;
console.log(`2) squads.json: ${sq == null ? 'NO existe (ejecuta npm run data)' : sq[id] ? sq[id].join(', ') : 'no incluye esta partida'}`);

const rawUsers = new Map();
if (rawDir) {
  console.log(`3) Datos raw (${rawDir}):`);
  for (const f of fs.readdirSync(rawDir).filter((f) => /\.(js|json)$/.test(f)).sort()) {
    let rows; try { const src = fs.readFileSync(path.join(rawDir, f), 'utf8'); rows = f.endsWith('.json') ? JSON.parse(src) : vm.runInNewContext(src + `\n;${path.parse(f).name}`); } catch { console.log(`   ! no pude leer ${f}`); continue; }
    for (const r of rows) if (r.attributes?.id === id) { rawUsers.set(r.user, (rawUsers.get(r.user) ?? 0) + 1); console.log(`   - ${f}: user="${r.user}" · ${fmt(new Date(r.metadata.timestamp).getTime())}`); }
  }
  if (!rawUsers.size) console.log('   la partida no aparece en ningún fichero raw');
}

console.log('\nDiagnóstico:');
const notes = [];
const processedNames = processed.map((p) => p.name);
if (rawDir) {
  for (const [u, n] of rawUsers) {
    if (n > 1) notes.push(`El raw tiene esta partida ${n} veces con el MISMO user "${u}". Se descarta la repetida: si era la copia para otro jugador, cambia su campo "user" por el del segundo jugador.`);
    if (!processedNames.includes(u)) notes.push(`"${u}" tiene la partida en el raw pero no en public/data: falta ejecutar npm run data.`);
  }
  if (rawUsers.size === 1 && !notes.length) notes.push('En el raw solo la tiene un jugador (user distinto en cada copia = squad; aquí no hay ninguno más).');
}
if (processed.length === 1 && !notes.length) notes.push('Solo UN jugador de los procesados tiene esta partida, así que no hay squad. ¿El otro jugador está en los datos y con el mismo id? Repite con --raw.');
if (processed.length > 1 && sq && !sq[id]) notes.push('Está en varios jugadores pero squads.json no lo recoge: está desactualizado. Ejecuta npm run derived (o npm run data).');
if (processed.length > 1 && sq?.[id]) notes.push('Todo correcto en los datos. Si la web no lo muestra, recarga la página con Ctrl+F5 (la web guarda squads.json al abrirla).');
console.log(notes.length ? notes.map((n) => ' • ' + n).join('\n') : ' • Sin incidencias detectadas.');

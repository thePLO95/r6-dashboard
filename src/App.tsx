import { useEffect, useState } from 'react';
import { loadAggregates, loadIndex, loadPlayer, seasonSummary, type Index, type Metric, type PlayerData, type XAxis } from './data';
import { useLoad } from './hooks';
import RankEvolution from './RankEvolution';
import KDAEvolution from './KDAEvolution';
import PlaylistDistribution from './PlaylistDistribution';
import MapsTab from './MapsTab';
import OperatorsTab from './OperatorsTab';
import MatchesTab from './MatchesTab';
import RankingsTab from './RankingsTab';
import PlayerChips from './PlayerChips';

const METRICS: [Metric, string][] = [['rating', 'Rank points'], ['progress', 'Progreso en la season'], ['netwins', 'Victorias − derrotas (todas las seasons)']];
const TABS = [['rank', 'Rango'], ['kda', 'K / D / A'], ['playlists', 'Playlists'], ['maps', 'Mapas'], ['ops', 'Operadores'], ['matches', 'Partidas'], ['rankings', 'Rankings']] as const;
type Tab = (typeof TABS)[number][0];

export default function App() {
  const [index, setIndex] = useState<Index>();
  const [tab, setTab] = useState<Tab>('rank');
  const [sel, setSel] = useState<string[]>([]);   // comparación (pestaña Rango)
  const [focus, setFocus] = useState('');          // jugador único (resto de pestañas)
  const [cache, setCache] = useState<Record<string, PlayerData>>({});
  const [season, setSeason] = useState('');
  const [metric, setMetric] = useState<Metric>('progress');
  const [x, setX] = useState<XAxis>('match');

  useEffect(() => {
    Promise.all([loadIndex(), loadAggregates().catch(() => null)]).then(([i, ag]) => {
      const latest = i.seasons[0];
      const games = (n: string) => ag?.players[n]?.[latest]?.all?.n ?? 0;   // partidas (todas las playlists) en la última season
      const top = [...i.players].sort((a, b) => games(b.name) - games(a.name)).slice(0, 5).map((p) => p.name);
      // Selector ordenado por partidas totales (todas las seasons y playlists), de más a menos
      const total = (n: string) => Object.values(ag?.players[n] ?? {}).reduce((sum, s) => sum + (s.all?.n ?? 0), 0);
      const players = [...i.players].sort((a, b) => total(b.name) - total(a.name) || a.name.localeCompare(b.name));
      setIndex({ ...i, players }); setSel(top); setFocus(top[0] ?? ''); setSeason(latest);
    });
  }, []);
  useEffect(() => { sel.filter((n) => !cache[n]).forEach((n) => loadPlayer(n).then((p) => setCache((c) => ({ ...c, [n]: p })))); }, [sel]);
  const fp = useLoad(focus ? () => loadPlayer(focus) : null, [focus]);

  if (!index) return <p>Cargando…</p>;
  const players = sel.map((n) => cache[n]).filter(Boolean);
  const toggle = (n: string) => setSel((s) => (s.includes(n) ? s.filter((v) => v !== n) : [...s, n]));
  const noRating = metric !== 'netwins' && players.every((p) => !seasonSummary(p, season));

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{ padding: '6px 14px', fontWeight: tab === k ? 700 : 400 }}>{l}</button>)}
      </nav>

      {tab === 'rankings' ? <RankingsTab /> : tab === 'rank' ? (<>
        <PlayerChips players={index.players} selected={sel} onPick={toggle} multi />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <select value={season} onChange={(e) => setSeason(e.target.value)}>{index.seasons.map((s) => <option key={s}>{s}</option>)}</select>
          <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>{METRICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select value={x} onChange={(e) => setX(e.target.value as XAxis)}><option value="match">Por partidas jugadas</option><option value="date">Por fecha</option></select>
        </div>
        {noRating && <p>⚠️ En {season} no hay rank points. Prueba la métrica «Victorias − derrotas».</p>}
        <RankEvolution players={players} season={season} metric={metric} x={x} />
        <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse' }}>
          <thead><tr><th align="left">Jugador</th><th>Inicio</th><th>Fin</th><th>Progreso</th><th>Pico</th></tr></thead>
          <tbody>{players.map((p) => { const s = seasonSummary(p, season); return (
            <tr key={p.name}><td>{p.name}</td>{s ? <><td align="center">{s.start}</td><td align="center">{s.end}</td><td align="center">{s.net > 0 ? '+' : ''}{s.net}</td><td align="center">{s.peak}</td></> : <td colSpan={4} align="center">sin rank points</td>}</tr>); })}</tbody>
        </table>
      </>) : (<>
        <PlayerChips players={index.players} selected={[focus]} onPick={setFocus} />
        {!focus ? null : tab === 'kda' ? (fp ? <KDAEvolution key={focus} player={fp} /> : <p>Cargando…</p>)
          : tab === 'playlists' ? (fp ? <PlaylistDistribution player={fp} /> : <p>Cargando…</p>)
          : tab === 'maps' ? <MapsTab key={focus} name={focus} />
          : tab === 'ops' ? <OperatorsTab key={focus} name={focus} />
          : <MatchesTab key={focus} name={focus} />}
      </>)}
    </main>
  );
}

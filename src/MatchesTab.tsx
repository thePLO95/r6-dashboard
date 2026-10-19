import { useMemo, useState } from 'react';
import { loadIndex, loadMeta, loadPlayer, loadSquads, type Match } from './data';
import { useLoad } from './hooks';
import { Avatar } from './PlayerChips';
import { PLAYLIST_GROUPS, playlistGroup, seasonKey } from './stats';

const RESULT: Record<string, [string, string]> = { win: ['Victoria', '#2e9e5b'], loss: ['Derrota', '#d9534f'], tied: ['Empate', '#888'], abandon: ['Abandono', '#c98a00'], rollback: ['Rollback', '#888'] };
const dur = (s?: number | null) => (s == null ? '—' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
const delta = (m: Match) => m.rpD ?? (m.rp != null && m.rpPrev != null ? m.rp - m.rpPrev : null);
const PAGE = 100;

export default function MatchesTab({ name }: { name: string }) {
  const player = useLoad(() => loadPlayer(name), [name]);
  const meta = useLoad(() => loadMeta(), []);
  const squads = useLoad(() => loadSquads(), []);
  const index = useLoad(() => loadIndex(), []);
  const [seasonSel, setSeasonSel] = useState('');
  const [group, setGroup] = useState('all');
  const [limit, setLimit] = useState(PAGE);

  const avatar = useMemo(() => new Map((index?.players ?? []).map((p) => [p.name, p.avatar])), [index]);
  const seasons = useMemo(() => [...new Set((player?.matches ?? []).map((m) => m.season))].sort((a, b) => seasonKey(b) - seasonKey(a)), [player]);
  const groups = useMemo(() => PLAYLIST_GROUPS.filter((g) => player?.matches.some((m) => playlistGroup(m.playlist) === g)), [player]);
  const season = seasons.includes(seasonSel) ? seasonSel : seasons[0];
  const rows = useMemo(() => (player?.matches ?? []).filter((m) => m.season === season && (group === 'all' || playlistGroup(m.playlist) === group)).sort((a, b) => b.t - a.t), [player, season, group]);

  if (!player) return <p>Cargando…</p>;
  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <select value={season} onChange={(e) => { setSeasonSel(e.target.value); setLimit(PAGE); }}>{seasons.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={group} onChange={(e) => { setGroup(e.target.value); setLimit(PAGE); }}><option value="all">Todas las playlists</option>{groups.map((g) => <option key={g}>{g}</option>)}</select>
        <span style={{ alignSelf: 'center', opacity: 0.7 }}>{rows.length} partidas · más recientes primero</span>
      </div>
      {!squads && <p style={{ opacity: 0.7 }}>Cargando squads…</p>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead><tr><th align="left">Fecha</th><th>Duración</th><th>Resultado</th><th align="left">Mapa</th><th align="left">Playlist</th><th>K/D/A</th><th align="left">Rango</th><th align="left">Squad</th></tr></thead>
          <tbody>{rows.slice(0, limit).map((m) => {
            const [label, color] = RESULT[m.res] ?? [m.res, '#888'], d = delta(m), mates = (squads?.[m.id] ?? []).filter((n) => n !== name);
            return (
              <tr key={m.id} style={{ borderTop: '1px solid #8883' }}>
                <td style={{ padding: '4px 8px 4px 0', whiteSpace: 'nowrap' }}>{new Date(m.t).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td align="center">{dur(m.dur)}</td>
                <td align="center" style={{ color, fontWeight: 600 }}>{label}</td>
                <td>{m.map ? meta?.maps[m.map]?.name ?? m.map : '—'}</td>
                <td>{m.playlist}</td>
                <td align="center">{m.k == null ? '—' : `${m.k}/${m.d}/${m.a}`}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{m.rp == null ? '—' : <>{d != null && <b style={{ color: d >= 0 ? '#2e9e5b' : '#d9534f' }}>{d > 0 ? '+' : ''}{d}</b>} → {m.rp}{m.rank ? <small style={{ opacity: 0.7 }}> {m.rank}</small> : null}</>}</td>
                <td>{mates.length ? <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>{mates.map((n) => <span key={n} style={{ whiteSpace: 'nowrap' }}><Avatar src={avatar.get(n)} size={18} /> {n}</span>)}</span> : <span style={{ opacity: 0.4 }}>—</span>}</td>
              </tr>);
          })}</tbody>
        </table>
      </div>
      {rows.length > limit && <button onClick={() => setLimit((l) => l + PAGE)} style={{ marginTop: 12 }}>Mostrar {Math.min(PAGE, rows.length - limit)} más</button>}
    </>
  );
}

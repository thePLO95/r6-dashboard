import { useMemo, useState } from 'react';
import { loadAggregates, loadIndex } from './data';
import { useLoad } from './hooks';
import { Avatar } from './PlayerChips';
import { buildRankings, STAT_DEFS } from './rankings';
import { PLAYLIST_GROUPS } from './stats';

const MEDAL = ['#d4a017', '#9aa0a6', '#b0702f'];
const STICKY = { position: 'sticky' as const, left: 0, background: 'Canvas', padding: '4px 8px 4px 0', whiteSpace: 'nowrap' as const, zIndex: 1 };

export default function RankingsTab() {
  const ag = useLoad(() => loadAggregates(), []);
  const index = useLoad(() => loadIndex(), []);
  const [season, setSeason] = useState('all');
  const [group, setGroup] = useState('ranked');
  const [min, setMin] = useState(10);
  const [sortKey, setSortKey] = useState('kd');

  const rows = useMemo(() => (ag ? buildRankings(ag, season, group, min) : []), [ag, season, group, min]);
  const sorted = useMemo(() => [...rows].sort((a, b) => (a.pos[sortKey] ?? 1e9) - (b.pos[sortKey] ?? 1e9) || a.name.localeCompare(b.name)), [rows, sortKey]);
  const avatar = useMemo(() => new Map((index?.players ?? []).map((p) => [p.name, p.avatar])), [index]);

  if (!ag) return <p>Cargando…</p>;
  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <select value={season} onChange={(e) => setSeason(e.target.value)}><option value="all">Global (todas las seasons)</option>{ag.seasons.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={group} onChange={(e) => setGroup(e.target.value)}><option value="all">Todas las playlists</option>{PLAYLIST_GROUPS.map((g) => <option key={g}>{g}</option>)}</select>
        <label>Mínimo de partidas <input type="number" min={1} value={min} onChange={(e) => setMin(Math.max(1, +e.target.value || 1))} style={{ width: 60 }} /></label>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 14, width: '100%' }}>
          <thead>
            <tr>
              <th />
              {STAT_DEFS.reduce<{ g: string; n: number }[]>((acc, d) => { const l = acc[acc.length - 1]; if (l && l.g === d.group) l.n++; else acc.push({ g: d.group, n: 1 }); return acc; }, [])
                .map((c, i) => <th key={i} colSpan={c.n} style={{ fontSize: 12, opacity: 0.7, borderBottom: '1px solid #8886', borderLeft: '1px solid #8883', padding: '2px 8px' }}>{c.g}</th>)}
            </tr>
            <tr>
              <th align="left" style={STICKY}>Jugador</th>
              {STAT_DEFS.map((d) => (
                <th key={d.key} onClick={() => setSortKey(d.key)} title={d.hint} style={{ cursor: 'pointer', padding: '4px 8px', whiteSpace: 'nowrap', textDecoration: sortKey === d.key ? 'underline' : 'none' }}>
                  {d.label}
                </th>))}
            </tr>
          </thead>
          <tbody>{sorted.map((r) => (
            <tr key={r.name} style={{ borderTop: '1px solid #8883' }}>
              <td style={STICKY}><Avatar src={avatar.get(r.name)} name={r.name} size={20} /> {r.name}</td>
              {STAT_DEFS.map((d) => { const v = r.values[d.key], p = r.pos[d.key]; return (
                <td key={d.key} align="center" style={{ padding: '4px 8px', background: sortKey === d.key ? '#4a90e214' : undefined }}>
                  {v == null ? <span style={{ opacity: 0.35 }}>—</span> : <>{d.key === 'net' && v > 0 ? '+' : ''}{v}{d.suffix} <small style={{ color: p && p <= 3 ? MEDAL[p - 1] : undefined, opacity: p && p <= 3 ? 1 : 0.55, fontWeight: p && p <= 3 ? 700 : 400 }}>#{p}</small></>}
                </td>); })}
            </tr>))}</tbody>
        </table>
      </div>
      <p style={{ fontSize: 13, opacity: 0.7 }}>Pulsa en una columna para ordenar. Los stats de ratio se calculan como Σ/Σ y solo puntúan con el mínimo de partidas elegido. ★ = rank points: solo ranked, ignoran el filtro de playlist y existen desde Y9S3. Pasa el ratón por la cabecera para ver la definición. Los «% de rondas» usan solo las partidas que traen esos datos; «First death» puntúa mejor cuanto más bajo. «% clutches ganados» exige al menos 5 clutches disputados.</p>
    </>
  );
}

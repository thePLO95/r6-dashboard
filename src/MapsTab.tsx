import { useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { loadMeta, loadPlayer, loadRounds } from './data';
import { useLoad } from './hooks';
import { mapStats, PLAYLIST_GROUPS, playlistGroup, seasonKey } from './stats';
import { useChart } from './useChart';

const pct = (v: number | null) => (v == null ? '—' : `${v.toFixed(1)}%`);
const th = { textAlign: 'center' as const, padding: '4px 8px' };

export default function MapsTab({ name }: { name: string }) {
  const player = useLoad(() => loadPlayer(name), [name]);
  const rounds = useLoad(() => loadRounds(name), [name]);
  const meta = useLoad(() => loadMeta(), []);
  const [season, setSeason] = useState('all');
  const [group, setGroup] = useState('all');

  const seasons = useMemo(() => [...new Set((player?.matches ?? []).map((m) => m.season))].sort((a, b) => seasonKey(b) - seasonKey(a)), [player]);
  const groups = useMemo(() => PLAYLIST_GROUPS.filter((g) => player?.matches.some((m) => playlistGroup(m.playlist) === g)), [player]);
  const rows = useMemo(() => (player && rounds ? mapStats(player.matches, rounds, { season, group }) : []), [player, rounds, season, group]);

  const top = rows.slice(0, 15);
  const option = useMemo<EChartsOption>(() => {
    const names = top.map((r) => meta?.maps[r.map]?.name ?? r.map).reverse();
    const bar = (label: string, key: 'wr' | 'atkWr' | 'defWr') => ({ name: label, type: 'bar' as const, data: [...top].reverse().map((r) => r[key]) });
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } }, legend: { top: 0 },
      grid: { top: 36, left: 110, right: 20, bottom: 20 },
      xAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
      yAxis: { type: 'category', data: names },
      series: [bar('Global', 'wr'), bar('Ataque (rondas)', 'atkWr'), bar('Defensa (rondas)', 'defWr')],
    };
  }, [top, meta]);
  const chartRef = useChart(option);

  if (!player || !rounds) return <p>Cargando…</p>;
  const noRounds = rows.length > 0 && rows.every((r) => r.atkN + r.defN === 0);
  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <select value={season} onChange={(e) => setSeason(e.target.value)}><option value="all">Todas las seasons</option>{seasons.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={group} onChange={(e) => setGroup(e.target.value)}><option value="all">Todas las playlists</option>{groups.map((g) => <option key={g}>{g}</option>)}</select>
      </div>
      {noRounds && <p>⚠️ Antes de Y10S1 no hay datos por ronda: solo se muestra el % de victoria global.</p>}
      {rows.length === 0 ? <p>Sin partidas con mapa para este filtro (el mapa se registra desde Y9S2).</p> : (<>
        <div ref={chartRef} style={{ width: '100%', height: 90 + top.length * 34 }} />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
            <thead><tr><th align="left">Mapa</th><th style={th}>Partidas</th><th style={th}>% Victoria</th><th style={th}>Ataque</th><th style={th}>Defensa</th></tr></thead>
            <tbody>{rows.map((r) => { const mp = meta?.maps[r.map]; return (
              <tr key={r.map} style={{ borderTop: '1px solid #8883' }}>
                <td style={{ padding: '4px 0' }}>{mp?.img && <img src={mp.img} alt="" width={64} height={36} loading="lazy" style={{ objectFit: 'cover', borderRadius: 4, verticalAlign: 'middle', marginRight: 8 }} />}{mp?.name ?? r.map}</td>
                <td align="center">{r.n}</td><td align="center">{pct(r.wr)}</td>
                <td align="center">{pct(r.atkWr)} <small style={{ opacity: 0.6 }}>({r.atkN})</small></td>
                <td align="center">{pct(r.defWr)} <small style={{ opacity: 0.6 }}>({r.defN})</small></td>
              </tr>); })}</tbody>
          </table>
        </div>
        <p style={{ fontSize: 13, opacity: 0.7 }}>% Victoria = victorias / (victorias + derrotas); abandonos, rollbacks y empates no cuentan. Ataque y Defensa = % de rondas ganadas, entre paréntesis las rondas jugadas.</p>
      </>)}
    </>
  );
}

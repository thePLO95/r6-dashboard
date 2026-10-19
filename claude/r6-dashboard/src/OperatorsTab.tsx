import { useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { loadMeta, loadPlayer, loadRounds } from './data';
import { useLoad } from './hooks';
import { operatorMatrix, operatorStats, PLAYLIST_GROUPS, playlistGroup, seasonKey } from './stats';
import { useChart } from './useChart';

type Side = 'all' | 'atk' | 'def';

export default function OperatorsTab({ name }: { name: string }) {
  const player = useLoad(() => loadPlayer(name), [name]);
  const rounds = useLoad(() => loadRounds(name), [name]);
  const meta = useLoad(() => loadMeta(), []);
  const [season, setSeason] = useState('all');
  const [group, setGroup] = useState('ranked');
  const [side, setSide] = useState<Side>('all');

  const seasons = useMemo(() => [...new Set((player?.matches ?? []).map((m) => m.season))].sort((a, b) => seasonKey(b) - seasonKey(a)), [player]);
  const groups = useMemo(() => PLAYLIST_GROUPS.filter((g) => player?.matches.some((m) => playlistGroup(m.playlist) === g)), [player]);
  const rows = useMemo(() => (player && rounds ? operatorStats(player.matches, rounds, { season, group, side }) : []), [player, rounds, season, group, side]);
  const mx = useMemo(() => (player && rounds ? operatorMatrix(player.matches, rounds, group, side, 20) : null), [player, rounds, group, side]);

  const option = useMemo<EChartsOption>(() => {
    if (!mx) return {};
    const opName = (id: string) => meta?.operators[id]?.name ?? id;
    const data: [number, number, number, number | null][] = [];
    let max = 1;
    mx.ops.forEach((op, y) => mx.seasons.forEach((s, x) => {
      const c = mx.get(op, s); if (!c) return;
      max = Math.max(max, c.rounds);
      data.push([x, y, c.rounds, Math.round((1000 * c.wins) / c.rounds) / 10]);
    }));
    return {
      tooltip: { formatter: (p: unknown) => { const v = (p as { value: [number, number, number, number] }).value; return `${opName(mx.ops[v[1]])} · ${mx.seasons[v[0]]}<br/>${v[2]} rondas · ${v[3]}% ganadas`; } },
      grid: { top: 10, left: 100, right: 20, bottom: 70 },
      xAxis: { type: 'category', data: mx.seasons, splitArea: { show: true } },
      yAxis: { type: 'category', data: mx.ops.map(opName), inverse: true, splitArea: { show: true } },
      visualMap: { min: 0, max, dimension: 2, calculable: false, orient: 'horizontal', left: 'center', bottom: 5, text: ['más rondas', ''] },
      series: [{ type: 'heatmap', data, label: { show: true, formatter: (p: unknown) => String((p as { value: number[] }).value[2]), fontSize: 10 } }],
    };
  }, [mx, meta]);
  const chartRef = useChart(option);

  if (!player || !rounds) return <p>Cargando…</p>;
  const maxRounds = Math.max(1, ...rows.map((r) => r.rounds));
  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <select value={season} onChange={(e) => setSeason(e.target.value)}><option value="all">Todas las seasons</option>{seasons.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={group} onChange={(e) => setGroup(e.target.value)}><option value="all">Todas las playlists</option>{groups.map((g) => <option key={g}>{g}</option>)}</select>
        <select value={side} onChange={(e) => setSide(e.target.value as Side)}><option value="all">Ataque y defensa</option><option value="atk">Solo ataque</option><option value="def">Solo defensa</option></select>
      </div>
      {rows.length === 0 ? <p>Sin rondas para este filtro (los datos por ronda existen desde Y10S1).</p> : (<>
        <h3 style={{ margin: '8px 0' }}>Rondas por operador y season (top 20)</h3>
        <div ref={chartRef} style={{ width: '100%', height: 90 + (mx?.ops.length ?? 0) * 26 }} />
        <h3 style={{ margin: '16px 0 8px' }}>{season === 'all' ? 'Todas las seasons' : season}</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th align="left">Operador</th><th>Lado</th><th align="left">Rondas</th><th>Ganadas</th><th>% Ganadas</th></tr></thead>
            <tbody>{rows.map((r) => { const o = meta?.operators[r.op]; return (
              <tr key={r.op} style={{ borderTop: '1px solid #8883' }}>
                <td style={{ padding: '3px 0' }}>{o?.img && <img src={o.img} alt="" width={26} height={26} loading="lazy" style={{ verticalAlign: 'middle', marginRight: 8 }} />}{o?.name ?? r.op}</td>
                <td align="center">{r.side === 'atk' ? 'ATK' : 'DEF'}</td>
                <td style={{ minWidth: 140 }}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ height: 8, width: `${(100 * r.rounds) / maxRounds}%`, background: '#4a90e2', borderRadius: 4 }} />{r.rounds}</div></td>
                <td align="center">{r.wins}</td><td align="center">{r.wr == null ? '—' : `${r.wr.toFixed(1)}%`}</td>
              </tr>); })}</tbody>
          </table>
        </div>
      </>)}
    </>
  );
}

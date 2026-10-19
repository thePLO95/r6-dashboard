import { useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import type { PlayerData } from './data';
import { kdaBySeason, kdaRolling, playlistGroup, PLAYLIST_GROUPS, seasonKey } from './stats';
import { useChart } from './useChart';

const COLORS = { k: '#2e9e5b', d: '#d9534f', a: '#4a90e2', kd: '#888888' };

export default function KDAEvolution({ player }: { player: PlayerData }) {
  const [mode, setMode] = useState<'season' | 'rolling'>('season');
  const [playlist, setPlaylist] = useState('ranked');
  const [seasonSel, setSeasonSel] = useState('');
  const [win, setWin] = useState(10);

  const playlists = useMemo(() => PLAYLIST_GROUPS.filter((g) => player.matches.some((m) => playlistGroup(m.playlist) === g)), [player]);
  const pl = playlist === 'all' || playlists.includes(playlist) ? playlist : 'all';
  const seasons = useMemo(() => [...new Set(player.matches.filter((m) => pl === 'all' || playlistGroup(m.playlist) === pl).map((m) => m.season))].sort((a, b) => seasonKey(b) - seasonKey(a)), [player, pl]);
  const season = seasons.includes(seasonSel) ? seasonSel : seasons[0];

  const option = useMemo<EChartsOption>(() => {
    const rows = mode === 'season'
      ? kdaBySeason(player.matches, pl).map((r) => ({ ...r, x: `${r.season} (${r.n})` }))
      : kdaRolling(player.matches, season, pl, win).map((r) => ({ ...r, x: r.i }));
    const line = (name: string, key: 'kpr' | 'dpr' | 'apr' | 'kd', color: string, axis: number) => ({
      name, type: 'line' as const, yAxisIndex: axis, symbolSize: 5, itemStyle: { color }, lineStyle: { color, type: key === 'kd' ? ('dashed' as const) : ('solid' as const) },
      data: rows.map((r) => r[key]),
    });
    return {
      tooltip: { trigger: 'axis' },
      legend: { top: 0 },
      grid: { top: 40, left: 55, right: 55, bottom: mode === 'rolling' ? 60 : 30 },
      dataZoom: mode === 'rolling' ? [{ type: 'inside' }, { type: 'slider', height: 18 }] : [],
      xAxis: { type: 'category', data: rows.map((r) => r.x), name: mode === 'rolling' ? 'Partida nº' : '' },
      yAxis: [{ type: 'value', name: 'por ronda', min: 0 }, { type: 'value', name: 'K/D', min: 0, splitLine: { show: false } }],
      series: [line('Kills/ronda', 'kpr', COLORS.k, 0), line('Muertes/ronda', 'dpr', COLORS.d, 0), line('Asist./ronda', 'apr', COLORS.a, 0), line('K/D', 'kd', COLORS.kd, 1)],
    };
  }, [player, mode, pl, season, win]);

  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <select value={mode} onChange={(e) => setMode(e.target.value as 'season' | 'rolling')}>
          <option value="season">Evolución por season</option><option value="rolling">Dentro de una season (media móvil)</option>
        </select>
        <select value={pl} onChange={(e) => setPlaylist(e.target.value)}>
          <option value="all">Todas las playlists</option>{playlists.map((p) => <option key={p}>{p}</option>)}
        </select>
        {mode === 'rolling' && <>
          <select value={season} onChange={(e) => setSeasonSel(e.target.value)}>{seasons.map((s) => <option key={s}>{s}</option>)}</select>
          <select value={win} onChange={(e) => setWin(+e.target.value)}>{[5, 10, 20].map((n) => <option key={n} value={n}>Últimas {n} partidas</option>)}</select>
        </>}
      </div>
      <div ref={useChart(option)} style={{ width: '100%', height: 420 }} />
      <p style={{ fontSize: 13, opacity: 0.7 }}>Valores calculados como Σ/Σ (no media de ratios). Entre paréntesis, nº de partidas de la season.</p>
    </>
  );
}

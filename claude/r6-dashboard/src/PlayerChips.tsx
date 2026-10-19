import type { Index } from './data';

export function Avatar({ src, size = 22 }: { src?: string | null; size?: number }) {
  if (!src) return <span style={{ display: 'inline-block', width: size, height: size }} />;
  return <img src={src} alt="" width={size} height={size} loading="lazy" referrerPolicy="no-referrer"
    style={{ borderRadius: '50%', objectFit: 'cover', verticalAlign: 'middle', flex: 'none' }}
    onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />;
}

/** Selector de jugadores con foto de perfil. multi = checkboxes (comparar); si no, selección única. */
export default function PlayerChips({ players, selected, onPick, multi = false }: { players: Index['players']; selected: string[]; onPick: (name: string) => void; multi?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
      {players.map((p) => {
        const on = selected.includes(p.name);
        return (
          <label key={p.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', border: '1px solid #8886', borderRadius: 18, padding: '2px 10px 2px 4px', background: on ? '#4a90e233' : 'none' }}>
            <input type={multi ? 'checkbox' : 'radio'} name="player" checked={on} onChange={() => onPick(p.name)} style={{ margin: 0 }} />
            <Avatar src={p.avatar} /> {p.name}
          </label>
        );
      })}
    </div>
  );
}

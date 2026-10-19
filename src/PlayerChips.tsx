import { useState } from 'react';
import type { Index } from './data';

/** Foto de perfil; si no hay URL o no carga, círculo gris con la inicial del jugador. */
export function Avatar({ src, size = 22, name = '' }: { src?: string | null; size?: number; name?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: '50%', background: '#8885', fontSize: size * 0.5, fontWeight: 600, verticalAlign: 'middle', flex: 'none' }}>{name.charAt(0).toUpperCase()}</span>;
  }
  return <img src={src} alt="" width={size} height={size} loading="lazy" referrerPolicy="no-referrer"
    style={{ borderRadius: '50%', objectFit: 'cover', verticalAlign: 'middle', flex: 'none' }} onError={() => setFailed(true)} />;
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
            <Avatar src={p.avatar} name={p.name} /> {p.name}
          </label>
        );
      })}
    </div>
  );
}

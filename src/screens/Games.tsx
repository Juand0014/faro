import type { Member } from '../lib/session';
import type { GameRow } from '../lib/useGame';
import { useLooksInbox } from '../games/Fashion';

const list = [
  { href: '/game/ttt', type: 'ttt', icon: '⭕', name: 'Tres en raya', desc: 'El clásico, rapidito.' },
  { href: '/game/c4', type: 'c4', icon: '🔴', name: '4 en línea', desc: 'Conecta cuatro antes que tu pareja.' },
  { href: '/game/stop', type: 'stop', icon: '✏️', name: 'Stop', desc: 'Una letra, muchas categorías. El primero en Stop cierra.' },
  { href: '/game/hang', type: 'hang', icon: '🪢', name: 'Ahorcado', desc: 'Uno piensa la palabra, el otro adivina.' },
  { href: '/game/draw', type: 'draw', icon: '🎨', name: 'Pictionary', desc: 'Dibuja la palabra para que tu pareja la adivine.' },
  { href: '/game/ships', type: 'ships', icon: '🚢', name: 'Batalla naval', desc: 'Prepara tu flota y hunde la de tu pareja.' },
  { href: '/game/look', type: 'look', icon: '👗', name: 'Atelier', desc: 'Diseña un look. Tu pareja lo puntúa del 1 al 10 y queda guardado.' },
];

export default function Games({ me, active, rematches }: { me: Member; active: GameRow[]; rematches: GameRow[] }) {
  const looksWaiting = useLooksInbox(me.couple_id, me.id);

  return (
    <div className="wrap">
      <div className="title">Juegos</div>
      <p className="muted">Por turnos, en vivo. Si tu pareja empieza, te aparece aquí para entrar a la misma partida.</p>
      <div className="gamelist">
        {list.map((g) => {
          const live = active.find((row) => row.type === g.type);
          const challenge = rematches.find((row) => row.type === g.type);
          const incoming = challenge && challenge.state?.rematch?.status === 'pending' && challenge.state.rematch.from !== me.id;
          const startedByPartner = live && live.state?.first && live.state.first !== me.id;
          const lookLive = g.type === 'look' && looksWaiting > 0;
          return (
            <a key={g.href} href={'#' + g.href} className={live || incoming || lookLive ? 'live' : undefined}>
              <b>{g.icon}</b>
              <span>
                <div style={{ fontWeight: 700 }}>{g.name}</div>
                <div className="muted">{g.desc}</div>
                {incoming && (
                  <div className="livepill" style={{ marginTop: 8 }}>Te pidieron revancha — entra para aceptar o rechazar</div>
                )}
                {!incoming && lookLive && (
                  <div className="livepill" style={{ marginTop: 8 }}>Hay un look para puntuar</div>
                )}
                {!incoming && !lookLive && live && (
                  <div className="livepill" style={{ marginTop: 8 }}>
                    {startedByPartner ? 'Tu pareja ya empezó — entra a su partida' : 'Partida en curso'}
                  </div>
                )}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

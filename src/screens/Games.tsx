import type { Member } from '../lib/session';
import type { GameRow } from '../lib/useGame';

const list = [
  { href: '/game/ttt', type: 'ttt', icon: '⭕', name: 'Tres en raya', desc: 'El clásico, rapidito.' },
  { href: '/game/c4', type: 'c4', icon: '🔴', name: '4 en línea', desc: 'Conecta cuatro antes que tu pareja.' },
];

export default function Games({ me, active }: { me: Member; active: GameRow[] }) {

  return (
    <div className="wrap">
      <div className="title">Juegos</div>
      <p className="muted">Por turnos, en vivo. Si tu pareja empieza, te aparece aquí para entrar a la misma partida.</p>
      <div className="gamelist">
        {list.map((g) => {
          const live = active.find((row) => row.type === g.type);
          const startedByPartner = live && live.state?.first && live.state.first !== me.id;
          return (
            <a key={g.href} href={'#' + g.href} className={live ? 'live' : undefined}>
              <b>{g.icon}</b>
              <span>
                <div style={{ fontWeight: 700 }}>{g.name}</div>
                <div className="muted">{g.desc}</div>
                {live && (
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

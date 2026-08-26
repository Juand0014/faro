const list = [
  { href: '/game/ttt', icon: '⭕', name: 'Tres en raya', desc: 'El clásico, rapidito.' },
  { href: '/game/c4', icon: '🔴', name: '4 en línea', desc: 'Conecta cuatro antes que tu pareja.' },
];
export default function Games() {
  return (
    <div className="wrap">
      <div className="title">Juegos</div>
      <p className="muted">Por turnos, en vivo. Juega tu movida y le llega al instante.</p>
      <div className="gamelist">
        {list.map((g) => (
          <a key={g.href} href={'#' + g.href}>
            <b>{g.icon}</b>
            <span><div style={{ fontWeight: 700 }}>{g.name}</div><div className="muted">{g.desc}</div></span>
          </a>
        ))}
      </div>
    </div>
  );
}

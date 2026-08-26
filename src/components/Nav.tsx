const items = [
  { href: '/home', icon: '🌊', label: 'Cielo' },
  { href: '/questions', icon: '💬', label: 'Pregunta' },
  { href: '/games', icon: '🎮', label: 'Juegos' },
];
export default function Nav({ route, live }: { route: string; live?: boolean }) {
  return (
    <nav className="nav">
      {items.map((i) => (
        <a key={i.href} href={'#' + i.href} className={route.startsWith(i.href) ? 'active' : ''}>
          <b className={live && i.href === '/games' ? 'haslive' : undefined}>{i.icon}</b>{i.label}
        </a>
      ))}
    </nav>
  );
}

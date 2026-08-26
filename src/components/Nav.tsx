const items = [
  { href: '/home', icon: '🌊', label: 'Cielo' },
  { href: '/questions', icon: '💬', label: 'Pregunta' },
  { href: '/games', icon: '🎮', label: 'Juegos' },
];
export default function Nav({ route }: { route: string }) {
  return (
    <nav className="nav">
      {items.map((i) => (
        <a key={i.href} href={'#' + i.href} className={route.startsWith(i.href) ? 'active' : ''}>
          <b>{i.icon}</b>{i.label}
        </a>
      ))}
    </nav>
  );
}

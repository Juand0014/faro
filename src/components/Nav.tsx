const items = [
  { href: '/home', icon: '🌊', label: 'Cielo' },
  { href: '/chat', icon: '💬', label: 'Chat' },
  { href: '/questions', icon: '❓', label: 'Pregunta' },
  { href: '/games', icon: '🎮', label: 'Juegos' },
];
export default function Nav({ route, live, chatUnread }: { route: string; live?: boolean; chatUnread?: boolean }) {
  return (
    <nav className="nav">
      {items.map((i) => (
        <a key={i.href} href={'#' + i.href} className={route.startsWith(i.href) ? 'active' : ''}>
          <b className={(live && i.href === '/games') || (chatUnread && i.href === '/chat') ? 'haslive' : undefined}>{i.icon}</b>{i.label}
        </a>
      ))}
    </nav>
  );
}

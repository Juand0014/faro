import { useEffect, useState } from 'react';
import { hasConfig } from './lib/supabase';
import { authErrorMessage, ensureAuth, getMyMember, getPartnerId, touchLastSeen, type Member } from './lib/session';
import { supabase } from './lib/supabase';
import { useHashRoute } from './lib/router';
import Pair from './screens/Pair';
import Home from './screens/Home';
import Questions from './screens/Questions';
import Chat from './screens/Chat';
import Games from './screens/Games';
import TicTacToe from './games/TicTacToe';
import ConnectFour from './games/ConnectFour';
import Stop from './games/Stop';
import Hangman from './games/Hangman';
import Pictionary from './games/Pictionary';
import Battleship from './games/Battleship';
import Nav from './components/Nav';
import RematchOverlay from './components/RematchOverlay';
import { useActiveGames } from './lib/useActiveGames';
import { useChatUnread } from './lib/useChatUnread';
import { connectCoupleLive, subscribeRematch } from './lib/coupleLive';
import type { GameRow } from './lib/useGame';

export default function App() {
  const [ready, setReady] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [authErr, setAuthErr] = useState('');
  const [route, go] = useHashRoute();

  async function refreshMember() {
    const m = await getMyMember();
    setMember(m);
    if (m) setPartnerId(await getPartnerId(m.couple_id, m.id));
  }

  // El asiento de la pareja cambia cuando entra desde otro aparato: hay que reseguirlo o los
  // turnos quedarían apuntando a un id muerto.
  useEffect(() => {
    if (!member) return;
    const { couple_id, id } = member;
    const sync = async () => setPartnerId(await getPartnerId(couple_id, id));
    const channel = supabase
      .channel(`members:${couple_id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'members', filter: `couple_id=eq.${couple_id}` },
        sync)
      .subscribe();
    const poll = setInterval(sync, 20000);
    window.addEventListener('focus', sync);
    return () => {
      clearInterval(poll);
      window.removeEventListener('focus', sync);
      supabase.removeChannel(channel);
    };
  }, [member?.couple_id, member?.id]);

  useEffect(() => {
    (async () => {
      if (!hasConfig) { setReady(true); return; }
      try {
        await ensureAuth();
        await refreshMember();
        await touchLastSeen();
      } catch (e) {
        setAuthErr(authErrorMessage(e));
      }
      setReady(true);
    })();
  }, []);

  if (!hasConfig) return (
    <div className="wrap">
      <div className="title" style={{ marginTop: 40 }}>🌊 Faro — falta configurar Supabase</div>
      <div className="card">
        <p className="muted">Crea un archivo <code>.env</code> (o define variables en el deploy) con:</p>
        <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--gold)' }}>VITE_SUPABASE_URL=...{'\n'}VITE_SUPABASE_ANON_KEY=...</pre>
        <p className="muted">Y corre el SQL de <code>supabase/schema.sql</code> en el panel de Supabase.</p>
      </div>
    </div>
  );

  if (!ready) return <div className="wrap"><p className="muted" style={{ marginTop: 40 }}>Cargando…</p></div>;
  if (authErr) return (
    <div className="wrap">
      <div className="title" style={{ marginTop: 40 }}>🌊 Faro</div>
      <div className="card">
        <p className="err">{authErr}</p>
        <p className="muted">
          Ábrelo aquí:{' '}
          <a href="https://supabase.com/dashboard/project/czhqqgtygjixcpxunzpo/auth/providers" target="_blank" rel="noreferrer">
            Authentication → Providers
          </a>
          . Activa <strong>Anonymous sign-ins</strong>, guarda, y recarga esta página.
        </p>
      </div>
    </div>
  );
  if (!member) return <Pair onDone={refreshMember} />;

  return <AppShell member={member} partnerId={partnerId} route={route} />;
}

function AppShell({ member, partnerId, route }: { member: Member; partnerId: string | null; route: string }) {
  const { active, rematches } = useActiveGames(member.couple_id);
  const chatUnread = useChatUnread(member.couple_id, member.id, route.startsWith('/chat'));
  const [invite, setInvite] = useState<GameRow | null>(null);
  const [rejectedMsg, setRejectedMsg] = useState('');
  const incoming = rematches.filter((g) => g.state?.rematch?.status === 'pending' && g.state.rematch.from !== member.id);

  useEffect(() => connectCoupleLive(member.couple_id), [member.couple_id]);
  useEffect(() => subscribeRematch((e) => {
    if (e.rematch.status === 'pending' && e.rematch.from !== member.id) {
      setInvite(e.game);
      navigator.vibrate?.(250);
    }
    if (e.rematch.status === 'rejected' && e.rematch.from === member.id) {
      setInvite(null);
      setRejectedMsg('Tu pareja rechazó la revancha');
      window.setTimeout(() => setRejectedMsg(''), 7000);
    }
    if (e.rematch.status === 'accepted') setInvite(null);
  }), [member.id]);

  useEffect(() => {
    if (incoming[0]) setInvite(incoming[0]);
  }, [incoming[0]?.id]);

  let screen;
  if (route.startsWith('/chat')) screen = <Chat me={member} />;
  else if (route.startsWith('/questions')) screen = <Questions me={member} />;
  else if (route === '/games') screen = <Games me={member} active={active} rematches={rematches} />;
  else if (route.startsWith('/game/ttt')) screen = <TicTacToe me={member} partnerId={partnerId} />;
  else if (route.startsWith('/game/c4')) screen = <ConnectFour me={member} partnerId={partnerId} />;
  else if (route.startsWith('/game/stop')) screen = <Stop me={member} partnerId={partnerId} />;
  else if (route.startsWith('/game/hang')) screen = <Hangman me={member} partnerId={partnerId} />;
  else if (route.startsWith('/game/draw')) screen = <Pictionary me={member} partnerId={partnerId} />;
  else if (route.startsWith('/game/ships')) screen = <Battleship me={member} partnerId={partnerId} />;
  else screen = <Home me={member} activeGames={active} rematches={rematches} />;

  return (
    <>
      {screen}
      <Nav route={route} live={active.length > 0 || incoming.length > 0} chatUnread={chatUnread} />
      {invite && <RematchOverlay me={member} game={invite} onClose={() => setInvite(null)} />}
      {rejectedMsg && (
        <div style={{ position: 'fixed', bottom: 92, left: 0, right: 0, textAlign: 'center', zIndex: 80 }}>
          <span className="pill" style={{ background: 'rgba(255,138,155,.16)', color: '#ff8a9b' }}>{rejectedMsg}</span>
        </div>
      )}
    </>
  );
}

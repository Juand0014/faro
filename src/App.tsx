import { useEffect, useState } from 'react';
import { hasConfig } from './lib/supabase';
import { ensureAuth, getMyMember, touchLastSeen, type Member } from './lib/session';
import { supabase } from './lib/supabase';
import { useHashRoute } from './lib/router';
import Pair from './screens/Pair';
import Home from './screens/Home';
import Questions from './screens/Questions';
import Games from './screens/Games';
import TicTacToe from './games/TicTacToe';
import ConnectFour from './games/ConnectFour';
import Nav from './components/Nav';

export default function App() {
  const [ready, setReady] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [route, go] = useHashRoute();

  async function refreshMember() {
    const m = await getMyMember();
    setMember(m);
    if (m) {
      const { data } = await supabase.from('members').select('id').eq('couple_id', m.couple_id).neq('id', m.id).maybeSingle();
      setPartnerId((data as any)?.id ?? null);
    }
  }

  useEffect(() => {
    (async () => {
      if (!hasConfig) { setReady(true); return; }
      try { await ensureAuth(); await refreshMember(); await touchLastSeen(); } catch (e) { /* noop */ }
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
  if (!member) return <Pair onDone={refreshMember} />;

  let screen;
  if (route.startsWith('/questions')) screen = <Questions me={member} />;
  else if (route === '/games') screen = <Games />;
  else if (route.startsWith('/game/ttt')) screen = <TicTacToe me={member} partnerId={partnerId} />;
  else if (route.startsWith('/game/c4')) screen = <ConnectFour me={member} partnerId={partnerId} />;
  else screen = <Home me={member} />;

  return (<>{screen}<Nav route={route} /></>);
}

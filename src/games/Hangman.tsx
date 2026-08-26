import { useState } from 'react';
import { useGame } from '../lib/useGame';
import type { Member } from '../lib/session';
import RematchPanel from '../components/RematchPanel';
import StopMatchPanel from '../components/StopMatchPanel';
import {
  allRevealed, applyGuess, HANG_LETTERS, hangNorm, initialHangState,
  letterCount, letterHits, MAX_WRONG, maskSecret, type HangState,
} from '../lib/hangman';

export default function Hangman({ me, partnerId }: { me: Member; partnerId: string | null }) {
  const { game, loading, newGame, applyMove, askRematch, acceptRematch, rejectRematch, stopMatch, notice } =
    useGame('hang', me, () => initialHangState(me.id));
  const [draft, setDraft] = useState('');

  if (loading) return <div className="wrap"><p className="muted">Cargando…</p></div>;

  if (!game) return (
    <div className="wrap">
      <a className="muted" href="#/games">← Juegos</a>
      <div className="title" style={{ marginTop: 8 }}>Ahorcado</div>
      <div className="card center">
        <p className="muted">Uno piensa la palabra, el otro adivina letra a letra.</p>
        <button className="btn" style={{ marginTop: 10 }} disabled={!partnerId} onClick={() => newGame(me.id)}>Empezar partida</button>
        {partnerId && <p className="locked">Esperando a que alguien inicie…</p>}
        {!partnerId && <p className="locked">Necesitas a tu pareja enlazada para jugar.</p>}
      </div>
    </div>
  );

  const st: HangState = game.state;
  // Contra asientos muertos: si el rol guardado no es el mío, es del asiento actual de la pareja.
  const setter = (st.setter ?? st.first) === me.id ? me.id : partnerId;
  const guesser = setter === me.id ? partnerId : me.id;
  const iSet = setter === me.id;
  const iGuess = Boolean(guesser) && guesser === me.id;
  const over = game.status !== 'active';

  function lockWord() {
    const secret = draft.trim();
    if (!partnerId || letterCount(secret) < 3) return;
    applyMove({
      state: { ...st, setter: me.id, guesser: partnerId, secret, guessed: [], wrong: 0, phase: 'guess' },
      turn: partnerId,
    });
    setDraft('');
  }

  function tap(letter: string) {
    if (over || st.phase !== 'guess' || !iGuess || !guesser) return;
    if (st.guessed.some((x) => hangNorm(x) === hangNorm(letter))) return;
    const next = applyGuess(st, letter);
    const lost = next.wrong >= (next.maxWrong || MAX_WRONG);
    const won = allRevealed(next.secret, next.guessed);
    applyMove({
      state: next,
      turn: guesser,
      status: lost || won ? 'won' : 'active',
      winner: lost ? setter : won ? guesser : null,
    });
  }

  const lives = (st.maxWrong || MAX_WRONG) - st.wrong;
  const shown = over || iSet ? spaced(st.secret) : maskSecret(st.secret, st.guessed);

  return (
    <div className="wrap">
      <a className="muted" href="#/games">← Juegos</a>
      <div className="title" style={{ marginTop: 8 }}>Ahorcado</div>
      {notice && <div className="livepill">{notice}</div>}

      <Gallows wrong={st.phase === 'guess' || over ? st.wrong : 0} />

      {st.phase === 'word' && !over && (
        <div className="card">
          {iSet ? (
            <>
              <p className="muted">Escribe una palabra o frase. Tu pareja no la ve.</p>
              <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)}
                placeholder="mínimo 3 letras" autoComplete="off"
                onKeyDown={(e) => { if (e.key === 'Enter') lockWord(); }} />
              <button className="btn" style={{ marginTop: 14 }} disabled={!partnerId || letterCount(draft) < 3} onClick={lockWord}>
                Listo, que adivine
              </button>
            </>
          ) : (
            <p className="muted">Tu pareja está pensando la palabra…</p>
          )}
        </div>
      )}

      {(st.phase === 'guess' || over) && (
        <div className="card center">
          <div className="hang-mask">{shown}</div>
          <div className="turnbar">
            {over
              ? (game.status === 'abandoned' ? '⏹️ Partida detenida' : overText(game.winner, me.id, setter, iSet))
              : iGuess ? `Tu turno · ${lives} ${lives === 1 ? 'vida' : 'vidas'}`
                : `Esperando a que adivine · ${lives} ${lives === 1 ? 'vida' : 'vidas'}`}
          </div>
        </div>
      )}

      {st.phase === 'guess' && !over && (
        <div className="hang-keys">
          {HANG_LETTERS.map((L) => {
            const used = st.guessed.some((x) => hangNorm(x) === hangNorm(L));
            const hit = used && letterHits(st.secret, L);
            return (
              <button key={L} type="button" disabled={!iGuess || used}
                className={'hang-key' + (used ? (hit ? ' hit' : ' miss') : '')}
                onClick={() => tap(L)}>{L}</button>
            );
          })}
        </div>
      )}

      <RematchPanel me={me} game={game} onAsk={askRematch} onAccept={acceptRematch} onReject={rejectRematch} />
      {game.status === 'active' && <StopMatchPanel onStop={stopMatch} />}
    </div>
  );
}

function spaced(secret: string) {
  return [...secret].join(' ');
}

function overText(winner: string | null, meId: string, setter: string | null, iSet: boolean) {
  if (winner === meId && !iSet) return 'La adivinaste';
  if (winner === meId && iSet) return 'No la adivinó';
  if (winner === setter) return 'Se acabaron las vidas';
  return 'La adivinó tu pareja';
}

function Gallows({ wrong }: { wrong: number }) {
  return (
    <svg className="hang-gallows" viewBox="0 0 120 140" aria-hidden="true">
      <path d="M20 130 H100 M35 130 V15 H75 V30" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      {wrong > 0 && <circle cx="75" cy="42" r="12" fill="none" stroke="currentColor" strokeWidth="3" />}
      {wrong > 1 && <path d="M75 54 V88" fill="none" stroke="currentColor" strokeWidth="3" />}
      {wrong > 2 && <path d="M75 62 L58 78" fill="none" stroke="currentColor" strokeWidth="3" />}
      {wrong > 3 && <path d="M75 62 L92 78" fill="none" stroke="currentColor" strokeWidth="3" />}
      {wrong > 4 && <path d="M75 88 L60 112" fill="none" stroke="currentColor" strokeWidth="3" />}
      {wrong > 5 && <path d="M75 88 L90 112" fill="none" stroke="currentColor" strokeWidth="3" />}
    </svg>
  );
}

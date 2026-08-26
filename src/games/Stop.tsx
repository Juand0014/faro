import { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '../lib/useGame';
import type { Member } from '../lib/session';
import RematchPanel from '../components/RematchPanel';
import StopMatchPanel from '../components/StopMatchPanel';
import { supabase } from '../lib/supabase';
import {
  bothReady,
  categoryIdFromLabel,
  detectFalseStop,
  initialStopState,
  matchWinner,
  needsVote,
  remainingSeconds,
  scoreRound,
  startRound,
  voteKey,
  type StopCategory,
  type StopState,
} from '../lib/stop';

export default function Stop({ me, partnerId }: { me: Member; partnerId: string | null }) {
  const { game, loading, newGame, applyMove, askRematch, acceptRematch, rejectRematch, stopMatch, notice } =
    useGame('stop', me, () => initialStopState(me.id));

  const [local, setLocal] = useState<Record<string, string>>({});
  const [now, setNow] = useState(Date.now());
  const [names, setNames] = useState<Record<string, string>>({});
  const [newCat, setNewCat] = useState('');
  const localRef = useRef(local);
  localRef.current = local;

  const st: StopState | undefined = game?.state;
  const players = [me.id, partnerId].filter(Boolean) as string[];

  useEffect(() => {
    supabase.from('members').select('id,name').eq('couple_id', me.couple_id)
      .then(({ data }) => setNames(Object.fromEntries((data ?? []).map((m: any) => [m.id, m.name]))));
  }, [me.couple_id]);

  useEffect(() => {
    setLocal(st?.round?.sheets?.[me.id] || {});
  }, [st?.round?.n, st?.round?.letter, me.id]);

  useEffect(() => {
    if (st?.phase !== 'play') return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [st?.phase]);

  const busy = useRef(false);

  const saveState = useCallback(async (next: StopState, extra: { status?: string; winner?: string | null } = {}) => {
    if (!game) return;
    await applyMove({ state: next, turn: null, ...extra });
  }, [applyMove, game]);

  const mergeSheet = useCallback(async (lock: { stoppedBy: string | null } | null) => {
    if (!game || busy.current) return;
    busy.current = true;
    try {
      const { data } = await supabase.from('games').select('*').eq('id', game.id).single();
      const cur: StopState = (data as any)?.state ?? game.state;
      if (!cur?.round) return;
      if (cur.phase !== 'play' && cur.phase !== 'vote') return;
      const sheets = { ...cur.round.sheets, [me.id]: { ...localRef.current } };
      const becameVote = cur.phase === 'play' && Boolean(lock);
      const round = {
        ...cur.round,
        sheets,
        stoppedBy: becameVote ? lock!.stoppedBy : cur.round.stoppedBy,
        falseStop: cur.round.falseStop,
      };
      if (becameVote) round.falseStop = detectFalseStop(round, cur.config.categories);
      const next: StopState = { ...cur, phase: becameVote ? 'vote' : cur.phase, round };
      await applyMove({ state: next, turn: null });
    } finally {
      busy.current = false;
    }
  }, [applyMove, game, me.id]);

  useEffect(() => {
    if (st?.phase !== 'play' || !st.round?.endsAt) return;
    if (Date.now() >= new Date(st.round.endsAt).getTime()) mergeSheet({ stoppedBy: null });
  }, [now, st?.phase, st?.round?.endsAt, mergeSheet]);

  useEffect(() => {
    if (st?.phase !== 'vote' || !st.round) return;
    if (st.round.sheets?.[me.id]) return;
    mergeSheet(null);
  }, [st?.phase, st?.round?.sheets, me.id, mergeSheet]);

  useEffect(() => {
    if (!st || st.phase !== 'vote' || !st.round || !partnerId) return;
    if (!bothReady(st.round, players)) return;
    if (Object.keys(st.round.roundScores || {}).length) return;
    saveState(scoreRound(st, players));
  }, [st?.phase, st?.round?.voteReady, partnerId]);

  if (loading) return <div className="wrap"><p className="muted">Cargando…</p></div>;

  if (!game || !st) return (
    <div className="wrap">
      <a className="muted" href="#/games">← Juegos</a>
      <div className="title" style={{ marginTop: 8 }}>Stop</div>
      <div className="card center">
        <p className="muted">Una letra, varias categorías. El primero en completar pulsa Stop.</p>
        <button className="btn" style={{ marginTop: 10 }} disabled={!partnerId} onClick={() => newGame(me.id)}>Empezar partida</button>
        {partnerId && <p className="locked">Esperando a que alguien inicie…</p>}
        {!partnerId && <p className="locked">Necesitas a tu pareja enlazada para jugar.</p>}
      </div>
    </div>
  );

  const who = (id: string) => (id === me.id ? 'Tú' : (names[id] || 'Tu pareja'));
  const left = remainingSeconds(st.round?.endsAt || null, now);

  function patchConfig(partial: Partial<StopState['config']>) {
    saveState({ ...st!, config: { ...st!.config, ...partial } });
  }

  function addCategory() {
    const label = newCat.trim();
    if (!label) return;
    const cats = st!.config.categories;
    if (cats.some((c) => c.label.toLowerCase() === label.toLowerCase())) return;
    setNewCat('');
    patchConfig({ categories: [...cats, { id: categoryIdFromLabel(label, cats), label }] });
  }

  function removeCategory(id: string) {
    const cats = st!.config.categories.filter((c) => c.id !== id);
    if (!cats.length) return;
    patchConfig({ categories: cats });
  }

  function begin() {
    if (!st!.config.categories.length) return;
    const next = startRound(st!);
    if (next.phase === 'match') {
      const w = matchWinner(next.scores, players);
      saveState(next, { status: w ? 'won' : 'draw', winner: w });
      return;
    }
    saveState(next);
  }

  function confirmVotes() {
    if (!st?.round) return;
    const next: StopState = {
      ...st,
      round: { ...st.round, voteReady: { ...st.round.voteReady, [me.id]: true } },
    };
    saveState(next);
  }

  function setVote(playerId: string, catId: string, ok: boolean) {
    if (!st?.round || st.round.voteReady?.[me.id]) return;
    const key = voteKey(playerId, catId);
    saveState({
      ...st,
      round: { ...st.round, votes: { ...st.round.votes, [me.id]: { ...st.round.votes[me.id], [key]: ok } } },
    });
  }

  function nextRound() {
    const next = startRound(st!);
    if (next.phase === 'match') {
      const w = matchWinner(next.scores, players);
      saveState(next, { status: w ? 'won' : 'draw', winner: w });
      return;
    }
    saveState(next);
  }

  function endMatch() {
    const w = matchWinner(st!.scores, players);
    saveState({ ...st!, phase: 'match' }, { status: w ? 'won' : 'draw', winner: w });
  }

  const setup = st.phase === 'setup';
  const play = st.phase === 'play';
  const vote = st.phase === 'vote';
  const reveal = st.phase === 'reveal';
  const match = st.phase === 'match' || game.status !== 'active';

  return (
    <div className="wrap">
      <a className="muted" href="#/games">← Juegos</a>
      <div className="title" style={{ marginTop: 8 }}>Stop</div>
      {notice && <div className="livepill">{notice}</div>}

      {setup && (
        <div className="card">
          <p className="muted">Categorías. Pueden quitar o añadir antes de la primera letra.</p>
          <div className="stop-cats">
            {st.config.categories.map((c) => (
              <span key={c.id} className="pill">
                {c.label}
                <button className="stop-x" type="button" onClick={() => removeCategory(c.id)} aria-label={'Quitar ' + c.label}>×</button>
              </span>
            ))}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <input className="input" value={newCat} onChange={(e) => setNewCat(e.target.value)}
              placeholder="Nueva categoría" onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); }} />
          </div>
          <button className="btn ghost" style={{ marginTop: 8 }} disabled={!newCat.trim()} onClick={addCategory}>Añadir</button>

          <label>Tiempo por ronda</label>
          <div className="stop-opts">
            {([30, 60, 90, null] as const).map((n) => (
              <button key={String(n)} type="button"
                className={'btn ghost' + (st.config.roundSeconds === n ? ' on' : '')}
                onClick={() => patchConfig({ roundSeconds: n })}>
                {n ? n + ' s' : 'Sin reloj'}
              </button>
            ))}
          </div>
          <label className="stop-check">
            <input type="checkbox" checked={st.config.advancedLetters}
              onChange={(e) => patchConfig({ advancedLetters: e.target.checked })} />
            Incluir letras difíciles (W, X, Ñ, Z)
          </label>
          <button className="btn" style={{ marginTop: 16 }} disabled={!partnerId || !st.config.categories.length} onClick={begin}>
            Sacar letra
          </button>
          {!partnerId && <p className="locked">Necesitas a tu pareja enlazada.</p>}
        </div>
      )}

      {play && st.round && (
        <>
          <div className="card center">
            <div className="muted">Letra</div>
            <div className="stop-letter">{st.round.letter}</div>
            <div className="turnbar">
              {left === null ? 'Modo clásico — pulsa Stop cuando termines' : (left > 0 ? left + ' s' : 'Tiempo')}
            </div>
          </div>
          <div className="card">
            {st.config.categories.map((c) => (
              <label key={c.id}>
                {c.label}
                <input className="input" value={local[c.id] || ''} autoComplete="off"
                  onChange={(e) => setLocal((s) => ({ ...s, [c.id]: e.target.value }))} />
              </label>
            ))}
            <button className="btn" style={{ marginTop: 16 }} onClick={() => mergeSheet({ stoppedBy: me.id })}>Stop</button>
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={endMatch}>Terminar partida</button>
            <p className="locked">Cierra con el marcador de las rondas ya contadas.</p>
          </div>
        </>
      )}

      {vote && st.round && (
        <div className="card">
          <div className="livepill">Letra {st.round.letter} — voten las palabras dudosas</div>
          <p className="muted" style={{ marginTop: 8 }}>Vacío o que no empiece por la letra ya vale 0. El resto: aprueba o rechaza las de tu pareja.</p>
          <VoteSheet
            categories={st.config.categories}
            letter={st.round.letter}
            players={players}
            meId={me.id}
            names={who}
            sheets={st.round.sheets}
            votes={st.round.votes[me.id] || {}}
            locked={Boolean(st.round.voteReady?.[me.id])}
            onVote={setVote}
          />
          {st.round.voteReady?.[me.id]
            ? <p className="locked">Esperando el voto de tu pareja…</p>
            : <button className="btn" style={{ marginTop: 14 }} onClick={confirmVotes}>Confirmar votos</button>}
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={endMatch}>Terminar partida</button>
        </div>
      )}

      {reveal && st.round && (
        <div className="card">
          <div className="livepill">Ronda {st.round.n} · {st.round.letter}</div>
          {st.round.falseStop && (
            <p className="err">{who(st.round.falseStop)} hizo falso Stop (−10)</p>
          )}
          <Scoreboard players={players} who={who} round={st.round.roundScores} total={st.scores} />
          <VoteSheet
            categories={st.config.categories}
            letter={st.round.letter}
            players={players}
            meId={me.id}
            names={who}
            sheets={st.round.sheets}
            votes={Object.assign({}, ...players.map((id) => st.round!.votes[id] || {}))}
            locked
          />
          <button className="btn" style={{ marginTop: 14 }} onClick={nextRound}>Siguiente letra</button>
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={endMatch}>Terminar partida</button>
        </div>
      )}

      {match && game.status !== 'active' && (
        <div className="card center">
          <div className="turnbar">
            {game.status === 'abandoned' ? 'Partida detenida'
              : game.status === 'draw' ? 'Empate'
              : (game.winner === me.id ? 'Ganaste la partida' : 'Ganó tu pareja')}
          </div>
          <Scoreboard players={players} who={who} round={{}} total={st.scores} />
        </div>
      )}

      <RematchPanel me={me} game={game} onAsk={askRematch} onAccept={acceptRematch} onReject={rejectRematch} />
      {game.status === 'active' && <StopMatchPanel onStop={stopMatch} />}
    </div>
  );
}

function Scoreboard({
  players, who, round, total,
}: {
  players: string[];
  who: (id: string) => string;
  round: Record<string, number>;
  total: Record<string, number>;
}) {
  return (
    <div className="stop-score">
      {players.map((id) => (
        <div key={id}>
          <div className="muted">{who(id)}</div>
          <div className="nm">{total[id] || 0}</div>
          {round[id] != null && <div className="muted">esta ronda {round[id] > 0 ? '+' : ''}{round[id]}</div>}
        </div>
      ))}
    </div>
  );
}

function VoteSheet({
  categories, letter, players, meId, names, sheets, votes, locked, onVote,
}: {
  categories: StopCategory[];
  letter: string;
  players: string[];
  meId: string;
  names: (id: string) => string;
  sheets: Record<string, Record<string, string>>;
  votes: Record<string, boolean>;
  locked: boolean;
  onVote?: (playerId: string, catId: string, ok: boolean) => void;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      {categories.map((c) => (
        <div key={c.id} className="stop-vote">
          <div className="muted">{c.label}</div>
          {players.map((id) => {
            const raw = sheets[id]?.[c.id] || '';
            const okLetter = needsVote(raw, letter);
            const key = voteKey(id, c.id);
            const mine = id === meId;
            const voted = votes[key];
            return (
              <div key={id} className="stop-ans">
                <span className="muted">{names(id)}</span>
                <span>{raw.trim() || '—'}</span>
                {!okLetter && <span className="err">0</span>}
                {okLetter && !mine && !locked && onVote && (
                  <span className="stop-opts">
                    <button type="button" className={'btn ghost' + (voted === true ? ' on' : '')} onClick={() => onVote(id, c.id, true)}>Sí</button>
                    <button type="button" className={'btn ghost' + (voted === false ? ' on' : '')} onClick={() => onVote(id, c.id, false)}>No</button>
                  </span>
                )}
                {okLetter && locked && voted === false && <span className="err">rechazada</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

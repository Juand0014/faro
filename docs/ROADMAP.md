# 🎮 Faro — Backlog de juegos (para implementar 1 a 1 con Cursor)

Este repo es una PWA Vite + React + TS sobre **Supabase** (Postgres + Realtime + Auth anónima).
Trabaja **un juego a la vez** y **detente después de cada uno** para que yo lo revise.

## Patrón que ya existe (cópialo)
Un juego es un componente en `src/games/` que usa el hook `useGame(type, me, initial)`
(en `src/lib/useGame.ts`). El hook carga/crea la partida activa de la pareja para ese `type`,
la mantiene en vivo por Realtime, y expone `newGame(firstTurn)` y `applyMove(patch)`.
Persistes en la fila `games`: `{ state (jsonb), turn (uuid del que sigue), status, winner }`.

**Plantilla de referencia: `src/games/TicTacToe.tsx`** (y `ConnectFour.tsx`).

### Pasos para cada juego nuevo
1. Crea `src/games/<Nombre>.tsx` copiando la estructura de TicTacToe: estado inicial en
   `initial()`, turnos con `game.turn === me.id`, y al mover llama `applyMove({ state, turn: partnerId, status, winner })`.
2. Regístralo en `src/App.tsx` (una rama nueva en el enrutado por `route`).
3. Añádelo a la lista en `src/screens/Games.tsx`.
4. Si necesita estilos, agrégalos a `src/styles.css`.
5. Elige un `type` corto y único para la columna `games.type` (p.ej. `'wordle'`, `'ships'`).
6. `npm run build` debe pasar. **Commit** `feat(game): <nombre>` y **PARAR**.

No hace falta tocar el SQL: la tabla `games` es genérica (state jsonb). No cambies RLS.
No hagas `git push` sin permiso.

---

## Tickets (ordenados por diversión/esfuerzo)

### ✅ Ticket 0 — Tres en raya y 4 en línea *(ya implementados)*

### Ticket 1 — Ahorcado del amor  (`type: 'hangman'`)
Uno define una palabra/frase secreta (un apodo, un chiste interno) y le toca a la pareja adivinar.
- state: `{ phrase, guessed: [], misses: 0, setter: me.id }`. El "setter" no juega esa ronda.
- Teclado en pantalla; 6 fallos = pierde. Muestra guiones y letras acertadas.
- Aceptación: solo el que adivina puede jugar; aciertos revelan letras; en vivo para ambos.
- Esfuerzo: M.

### Ticket 2 — Wordle para dos  (`type: 'wordle'`)
Uno elige una palabra de 5 letras (su nombre, algo de ustedes); el otro tiene 6 intentos.
- state: `{ answer, rows: [], setter: me.id }`. Colorea verde/amarillo/gris.
- Aceptación: feedback correcto por letra; gana al acertar, pierde a los 6 intentos.
- Esfuerzo: M.

### Ticket 3 — Batalla naval  (`type: 'ships'`)
El async por excelencia. Cada uno coloca barcos; se turnan disparos.
- state: `{ boards: { [uid]: {ships, shots} }, phase: 'place'|'battle' }`.
- Aceptación: colocar barcos, disparar por turnos, detectar hundido y victoria; en vivo.
- Esfuerzo: L.

### Ticket 4 — Trivia "sobre nosotros"  (`type: 'trivia'`)
Uno escribe una pregunta + respuesta de la relación; el otro adivina. Marcador acumulado.
- Puedes guardar el marcador en `state` o en una tabla nueva (si la creas, agrégale RLS por `couple_id`).
- Esfuerzo: S–M.

### Ticket 5 — Timbiriche (puntos y cajas)  (`type: 'dots'`)
Rejilla de puntos; por turnos trazan líneas; cerrar una caja da punto y repite turno.
- Esfuerzo: M.

### Ticket 6 — Dibuja y adivina  (`type: 'draw'`)
Uno dibuja en `<canvas>` y guarda la palabra; el otro adivina. Guarda el trazo como dataURL en `state`
(ojo con el límite de 256 KB por mensaje Realtime; si es grande, sube a Supabase Storage).
- Esfuerzo: M–L.

### Ticket 7 — Ajedrez / damas por correspondencia  (`type: 'chess'`) *(al final)*
Usa `chess.js` para validar. El más pesado.
- Esfuerzo: L.

## Bonus (no son juegos)
- **Frasco de citas** (tabla `date_ideas` con RLS por `couple_id`; sorteo al azar).
- **Cápsulas** (tabla con `open_at`; se revelan por fecha).
- **Cuenta regresiva al reencuentro** + confeti (campo en `couples`).

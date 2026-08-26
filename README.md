# 🌊 Faro

Una PWA privada para dos, a distancia. Sitio estático (Vite + React) sobre **Supabase**
(Postgres + Realtime + Auth anónima). **No despliegas backend**: subes solo el sitio a GitHub Pages.

## Qué trae este MVP
- **Emparejar** por código de 6 caracteres (sin correo ni contraseña, auth anónima).
- **Mismo cielo**: hora local y estado de cada uno + **presencia en vivo** (en línea ahora).
- **Pienso en ti**: enciende el teléfono de tu pareja al instante (Realtime).
- **Pregunta del día**: misma pregunta para ambos (semilla por fecha); respuestas que se
  revelan solo cuando los dos contestan.
- **Juegos en tiempo real**: Tres en raya y 4 en línea (por turnos; la jugada del otro aparece sola).

## Puesta en marcha (una vez)
1. Crea un proyecto gratis en https://supabase.com.
2. En **SQL Editor**, pega y ejecuta `supabase/schema.sql` (crea tablas, RLS y Realtime).
3. En **Authentication > Providers**, habilita **Anonymous sign-ins**.
4. En **Settings > API** copia la *Project URL* y la *anon public key*.

## Correr local
```bash
cp .env.example .env      # pega tu URL y anon key
npm install
npm run dev               # http://localhost:5173
```
Abre en dos navegadores (uno normal, otro incógnito) para simular a las dos personas.

## Desplegar gratis en GitHub Pages
1. Sube el repo a GitHub.
2. En **Settings > Secrets and variables > Actions**, crea dos *secrets*:
   `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
   (La anon key es pública por diseño; **RLS** protege los datos.)
3. En **Settings > Pages**, Source = **GitHub Actions**.
4. Push a `main`: el workflow `deploy.yml` compila y publica. Tu app queda en
   `https://<usuario>.github.io/<repo>/`.

El workflow `keepalive.yml` hace un ping cada 4 días para que Supabase no pause el proyecto
gratis por inactividad.

## Seguridad
Todo pasa por **Row Level Security**: cada pareja solo puede leer/escribir sus propias filas
(`couple_id = my_couple_id()`). El emparejamiento usa funciones RPC `SECURITY DEFINER`
(`create_couple`, `join_couple`) para no exponer la tabla de parejas.

## Añadir más juegos
Cada juego es un componente que usa el hook `useGame(type, me, initial)` y persiste
`{ state, turn, status, winner }`. Copia `src/games/TicTacToe.tsx` como plantilla,
agrégalo al enrutador en `App.tsx` y a la lista en `src/screens/Games.tsx`. Ver `docs/ROADMAP.md`.

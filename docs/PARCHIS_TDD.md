# Parchís — evidencia TDD

## Alcance

Parchís español para una pareja, con 2–4 fichas por jugador, reglas compactas,
acciones atómicas en Supabase y reacciones emoji efímeras.

## Garantías verificadas

| Garantía | Evidencia | Resultado |
|---|---|---|
| El estado admite exactamente 2, 3 o 4 fichas y sigue siendo compacto | `src/lib/parchis.test.ts` | PASS |
| Solo un 5 saca de casa y cada asiento usa una salida opuesta | `src/lib/parchis.test.ts` | PASS |
| Los seguros, capturas, puentes y salida ocupada respetan las reglas Faro | `src/lib/parchis.test.ts` | PASS |
| Comer otorga +20 y llegar a meta otorga +10 | `src/lib/parchis.test.ts` | PASS |
| La meta exige número exacto y gana quien lleva todas sus fichas | `src/lib/parchis.test.ts` | PASS |
| Un 6 repite turno y el tercero consecutivo lo termina | `src/lib/parchis.test.ts` | PASS |
| Una tirada sin movimientos se resuelve o permite reintentar “Pasar turno” | Motor unitario y recuperación en `src/games/Parchis.tsx` | PASS |
| La cadena de premios tiene un límite seguro de cuatro | `src/lib/parchis.test.ts` | PASS |
| Las reacciones se validan, filtran por partida, deduplican y expiran | `src/lib/gameReactions.test.ts` | PASS |
| Dados y movimientos concurrentes se serializan | RPC con `FOR UPDATE` en `supabase/schema.sql` | PASS |
| Las escrituras directas no pueden alterar una partida activa | `guard_parchis_direct_update` revisado en Supabase | PASS |

## Ciclo RED / GREEN

- RED motor: `npm test -- src/lib/parchis.test.ts` falló porque `./parchis` todavía no existía.
- GREEN motor: 14 pruebas de Parchís aprobadas.
- RED reacciones: `npm test -- src/lib/gameReactions.test.ts` falló porque el módulo aún no existía.
- GREEN reacciones: 3 pruebas aprobadas.
- Regresión completa: `npm test` aprobó 41 pruebas en 6 archivos.
- Producción: `npm run build` completó TypeScript y Vite.

## Base de datos

Se aplicaron las migraciones `add_atomic_parchis_actions` y
`allow_parchis_lifecycle_updates`. La instalación se comprobó consultando
`pg_proc`: `roll_parchis`, `pass_parchis`, `move_parchis` y
`guard_parchis_direct_update` están presentes.

## Revisiones

Las revisiones finales de código, React, accesibilidad y PostgreSQL aprobaron
la implementación después de agregar recuperación de turno, guardas de
desmontaje, foco visible, conteos accesibles y validación completa de `last`.

## Limitación de validación local

La prueba visual autenticada con dos navegadores no pudo ejecutarse porque el
entorno local no contiene las variables públicas de Supabase. El bundle, las
pruebas puras y las funciones remotas sí fueron verificados; la comprobación
visual multicliente queda para el entorno desplegado.

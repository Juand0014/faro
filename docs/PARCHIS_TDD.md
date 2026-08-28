# Parchís — evidencia TDD

## Alcance

Superparchís español para una pareja, con dos dados, 2–4 fichas por jugador,
acciones atómicas en Supabase y reacciones emoji efímeras.

## Garantías verificadas

| Garantía | Evidencia | Resultado |
|---|---|---|
| El estado admite exactamente 2, 3 o 4 fichas y sigue siendo compacto | `src/lib/parchis.test.ts` | PASS |
| Un 5 individual o una suma de 5 obliga a sacar ficha si la salida está libre | `src/lib/parchis.test.ts` | PASS |
| Cada dado se consume por separado y puede mover la misma ficha o fichas distintas | `src/lib/parchis.test.ts` | PASS |
| Amarillo entra al pasillo justo después de la 68 y rojo justo después de la 34, sin cuatro pasos extra | `src/lib/parchis.test.ts` | PASS |
| Los seguros, capturas, puentes y salida ocupada respetan las reglas Faro | `src/lib/parchis.test.ts` | PASS |
| Comer otorga +20 y llegar a meta otorga +10 | `src/lib/parchis.test.ts` | PASS |
| La meta exige número exacto y gana quien lleva todas sus fichas | `src/lib/parchis.test.ts` | PASS |
| Los dobles repiten turno y el tercer doble consecutivo lo termina | `src/lib/parchis.test.ts` | PASS |
| Una tirada sin movimientos se resuelve o permite reintentar “Pasar turno” | Motor unitario y recuperación en `src/games/Parchis.tsx` | PASS |
| La cadena de premios tiene un límite seguro de cuatro | `src/lib/parchis.test.ts` | PASS |
| Las reacciones se validan, filtran por partida, deduplican y expiran | `src/lib/gameReactions.test.ts` | PASS |
| Dados y movimientos concurrentes se serializan | RPC con `FOR UPDATE` en `supabase/schema.sql` | PASS |
| Las escrituras directas no pueden alterar una partida activa | `guard_parchis_direct_update` revisado en Supabase | PASS |
| El SVG contiene 68 casillas numeradas, cuatro casas y 14 casillas de llegada | `src/games/ParchisBoard.test.tsx` | PASS |

## Ciclo RED / GREEN

- RED motor: `npm test -- src/lib/parchis.test.ts` falló porque `./parchis` todavía no existía.
- GREEN motor: 14 pruebas de Parchís aprobadas.
- RED reacciones: `npm test -- src/lib/gameReactions.test.ts` falló porque el módulo aún no existía.
- GREEN reacciones: 3 pruebas aprobadas.
- Regresión completa: `npm test` aprobó 41 pruebas en 6 archivos.
- Producción: `npm run build` completó TypeScript y Vite.

### Ciclo del rediseño con dos dados

- RED: `npm test -- src/lib/parchis.test.ts` ejecutó 17 pruebas y falló 11:
  el estado seguía en versión 1, rechazaba dos dados y `globalCell('a', 64)`
  devolvía la casilla 1 en vez de entrar al pasillo.
- GREEN inicial: las 17 pruebas aprobaron tras introducir estado v2, consumo
  independiente y recorrido compartido de 64 posiciones.
- Regresión exigente: se añadieron salida obligatoria, salida bloqueada,
  reanudación del dado pendiente tras +10 y validación de dados serializados;
  aprobaron 20 pruebas del motor.
- Tablero: `src/games/ParchisBoard.test.tsx` aprobó 2 pruebas sobre estructura
  clásica y continuidad visual entre la 68 y la primera casilla de llegada.
- Regresión completa v2: `npm test` aprobó 49 pruebas en 7 archivos y
  `npm run build` completó TypeScript y Vite.

## Base de datos

La versión original instaló `add_atomic_parchis_actions` y
`allow_parchis_lifecycle_updates`. El esquema v2 añade `parchis_has_legal_move`
y reemplaza las firmas de `roll_parchis`, `pass_parchis` y `move_parchis`; debe
aplicarse junto al despliegue del cliente para que ambos usen el mismo contrato.

## Revisiones

Las revisiones finales de código, React, accesibilidad y PostgreSQL aprobaron
la implementación v2 después de corregir puentes por color, impedir pases con
movimientos disponibles, bloquear la omisión de premios, canonicalizar el
estado escrito, añadir estados accesibles a ambos dados y proteger el abandono.

## Limitación de validación local

La prueba visual autenticada con dos navegadores no pudo ejecutarse porque el
entorno local no contiene las variables públicas de Supabase. El bundle, las
pruebas puras y las funciones remotas sí fueron verificados; la comprobación
visual multicliente queda para el entorno desplegado.

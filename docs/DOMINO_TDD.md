# Dominó dominicano — evidencia TDD

## Alcance

La funcionalidad se construyó desde pruebas para dos modalidades: duelo remoto
entre la pareja y frente de la pareja contra dos bots. Las reglas se fijan antes
de repartir y ambos miembros deben confirmarlas.

## Ciclo RED / GREEN

- RED inicial: `src/lib/domino.test.ts` no podía importar `./domino`.
- GREEN del motor: reparto determinista, 28 fichas únicas, salidas, extremos,
  robos, pases, dominó, capicúa, trancadas, puntuación y bots.
- RED de calidad: faltaban orientación visual, salida posterior a una trancada,
  estrategia de cierre del bot y conteos públicos al terminar.
- GREEN final: cadena orientada, ganador de trancada conserva la salida, bots
  consideran capicúa y escasez pública, y solo se revelan sumas de pintas.
- RED del contrato: faltaba el estado público seguro del lobby.
- GREEN del contrato: ninguna mano ni pozo se serializa en `games.state`.

## Garantías

| Garantía | Evidencia |
|---|---|
| El doble-seis contiene exactamente 28 fichas sin duplicados | `src/lib/domino.test.ts` |
| El reparto se reproduce por semilla y conserva todas las fichas | `src/lib/domino.test.ts` |
| En pareja se reparten cuatro manos de siete sin pozo | `src/lib/domino.test.ts` |
| Solo se juega en extremos válidos y la cadena se orienta correctamente | `src/lib/domino.test.ts`, `src/games/Domino.test.tsx` |
| Robar o pasar obedece la configuración de 1v1 | `src/lib/domino.test.ts` |
| Regla general y regla de patio resuelven trancadas por separado | `src/lib/domino.test.ts` |
| Capicúa suma el bono configurado y la meta por defecto es 200 | `src/lib/domino.test.ts` |
| Los bots reciben únicamente su vista permitida | `src/lib/domino.test.ts`, `src/lib/domino-server.test.ts` |
| Realtime nunca recibe manos ni pozo | `src/lib/domino-server.test.ts`, `src/lib/dominoClient.test.ts` |
| Humanos quedan frente a frente y bots a los lados | `src/lib/domino-server.test.ts` |
| La interfaz conserva semántica de fichas y mesa | `src/games/Domino.test.tsx` |

## Seguridad

`domino_private` no concede acceso a `anon` ni `authenticated`. La Edge Function
autentica al usuario, limita la partida a su pareja y llama a `domino_commit`.
La RPC usa `FOR UPDATE`, compara `seq` y actualiza estado público y privado en
una sola transacción. El trigger impide saltarse el motor durante una partida.

## Verificación

Antes del despliegue se deben ejecutar:

```text
npm test
npm run build
```

La migración y `domino-game` deben desplegarse antes que el cliente.

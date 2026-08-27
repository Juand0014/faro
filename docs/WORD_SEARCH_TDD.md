# Sopa de letras — evidencia TDD

## Garantías

| Comportamiento | Prueba | Resultado |
|---|---|---|
| El diccionario ofrece al menos 40 categorías y 1.000 palabras | `word-search dictionary > offers a large categorized Spanish vocabulary` | PASS |
| Cada palabra es única en su categoría y cabe en un tablero 14×14 | `contains only unique, board-safe words` | PASS |
| Categoría y semilla producen siempre el mismo tablero | `builds the same board from the same category and seed` | PASS |
| Las 14 palabras realmente aparecen en el tablero | `places every target word in the generated board` | PASS |
| Todas las categorías generan 14 palabras con semillas variadas | `can generate every category across varied seeds` | PASS |
| Se aceptan selecciones inversas y se rechazan líneas torcidas | `accepts a straight reverse selection and rejects crooked lines` | PASS |
| El estado compartido es compacto y el marcador cuenta por jugador | `creates compact multiplayer state and counts claims by player` | PASS |

## Ciclo RED → GREEN

- RED: `npm test -- src/lib/wordSearch.test.ts` falló porque los módulos
  `wordSearch` y `wordSearchWords` aún no existían.
- GREEN: el mismo comando terminó con 9/9 pruebas aprobadas.
- Regresión completa: `npm test` terminó con 24/24 pruebas aprobadas.
- Compilación: `npm run build` terminó correctamente.

## Concurrencia

La función PostgreSQL `claim_word_search_word` usa `SELECT ... FOR UPDATE`.
Si ambas personas reclaman la misma palabra al mismo tiempo, la fila se bloquea
y solo el primer reclamo asigna el punto. El cierre de la partida y el ganador
se calculan dentro de la misma transacción.

## Alcance conocido

La interfaz se valida con puntero y teclado; una prueba visual local completa
requiere las variables de Supabase que solo están configuradas en el entorno de
GitHub Pages.

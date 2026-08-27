# Atelier croquis ligero — evidencia TDD

## Garantías

| Comportamiento | Prueba | Resultado |
|---|---|---|
| Los looks antiguos se normalizan al modelo v3 | `fashion.test.ts` | PASS |
| Materiales inválidos vuelven a un valor seguro | `fashion.test.ts` | PASS |
| Los trazos se limitan, redondean y quedan bajo 12 KB | `fashion.test.ts` | PASS |
| Un seed reconstruye siempre el mismo reto | `fashion.test.ts` | PASS |
| Reacciones y notas siguen usando la columna existente | `fashion.test.ts` | PASS |
| Los borradores se aíslan por pareja/diseñador y vencen en 7 días | `fashionDrafts.test.ts` | PASS |
| Sin IndexedDB, el estudio degrada a memoria | `fashionDrafts.test.ts` | PASS |

## Ciclo RED/GREEN

- RED: `npm test -- --run src/lib/fashion.test.ts src/lib/fashionDrafts.test.ts` ejecutó 9 pruebas; 6 fallaron por el modelo, retos y notas aún inexistentes, y una suite falló porque `fashionDrafts.ts` todavía no existía.
- GREEN: el mismo objetivo ejecutó 12 pruebas sin fallos después de implementar el modelo y la caché.
- Verificación integral: `npm test` y `npm run build`.

## Alcance manual

La prueba visual local requiere las variables públicas de Supabase usadas en producción. El build, tipos y lógica pura quedan cubiertos aquí; el flujo táctil, IndexedDB real y la apariencia final se validan en navegador antes de publicar.

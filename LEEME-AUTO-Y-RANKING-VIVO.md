# Switch de resultados automáticos + Ranking en vivo

## Archivos (formato del repo, sustitución directa — 10 archivos)

| Archivo | Estado |
|---|---|
| `lib/admin-results.ts` | Mod — campo `autoImportApi` (ON por defecto) |
| `lib/server/live-fixtures.ts` | **Nuevo** — proveedores extraídos del route (caché compartida) |
| `app/api/results/fixtures/route.ts` | Mod — wrapper fino, comportamiento público idéntico |
| `lib/admin-import-fixtures.ts` | Mod — merge puro reutilizable |
| `app/api/admin-results/route.ts` | Mod — merge automático en GET + modo `?raw=1` |
| `app/api/admin-results/auto-import/route.ts` | **Nuevo** — persiste el switch |
| `components/admin/import-finished-button.tsx` | Mod — ahora es el switch (+ importación manual cuando está OFF) |
| `app/admin/page.tsx` | Mod — el formulario carga el estado raw |
| `lib/use-scored-participants.ts` | Mod — hook `useLiveScoredParticipants` |
| `app/clasificacion/page.tsx` | Mod — banner en vivo, conmutador y flechas ▲▼ |

## 1 · Switch "Resultados automáticos desde la API" (Admin → Resultados)

**Activo por defecto.** Mientras está ON, los partidos FINALIZADOS según la API se
completan y puntúan SOLOS en toda la app (clasificación, resultados, progreso) sin que
tengas que tocar nada. Claves del diseño:

- El merge ocurre en el servidor al servir `/api/admin-results`, al vuelo: **no se
  guarda nada automáticamente** en la base de datos.
- **Lo que confirmes a mano siempre tiene prioridad** sobre la API, con el switch ON
  u OFF. Tu formulario del Admin sigue mostrando solo lo confirmado a mano.
- Si la API se cae, la app sirve lo guardado sin romperse.
- Al apagarlo (se guarda al instante, sin pasar por "Guardar cambios"), vuelves al modo
  100 % manual; en ese modo sigue disponible el botón de importación puntual con su
  deshacer.

## 2 · Ranking en vivo (Clasificación)

Cuando hay partidos en juego, aparece un banner rojo "N partidos en juego" y la tabla
muestra por defecto la **clasificación provisional**: el scoring real alimentado además
con los marcadores en directo como si los partidos acabaran ahora. Cada fila lleva su
flecha ▲/▼ comparando con la clasificación oficial. El botón del banner alterna entre
"en vivo" y "oficial". Se refresca cada 30 s y desaparece solo cuando no hay partidos
en juego. Es solo lectura: no altera puntos oficiales ni guarda nada.

## Verificado

- Tests con los módulos reales del repo: defaults y persistencia del switch, prioridad
  de lo manual, los EN JUEGO no puntúan como oficiales, el estado guardado no se muta,
  y el escenario completo de ranking (participante que clava un 1-0 en juego suma +5
  provisionales, adelanta al rival y el rival muestra ▼1).
- `tsc --noEmit` limpio y `next build` de producción completo (12/12 páginas).

## Tras desplegar

Abre `/api/admin-results` en el navegador: si hay finalizados en la API verás sus
marcadores ya incluidos y `"configured": true`. En el Admin, el switch aparece encima
de los filtros de Resultados.

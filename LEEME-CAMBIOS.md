# Peñita Mundial 2026 — Paquete de cambios (5 modificaciones)

Este ZIP contiene **solo los archivos modificados/nuevos**, con su ruta exacta.
Cópialos sobre tu repo respetando la estructura de carpetas y sustituyendo los
existentes. **No hace falta tocar Neon ni ejecutar ningún SQL**: todos los
cambios son de código. Verificado con `tsc --noEmit` y `next build` sin errores.

## Archivos incluidos

Nuevos:
- `lib/worldcup/kickoffs.ts`
- `lib/worldcup/resolve-knockout.ts`

Modificados (reemplazar):
- `lib/data.ts`
- `app/resultados/page.tsx`
- `app/api/results/fixtures/route.ts`
- `app/clasificacion/page.tsx`

> `app/versus/page.tsx` **no** se modifica: la pantalla Versus pinta
> automáticamente lo que devuelve `compareSpecials`, así que el nuevo dato
> aparece sin tocar ese archivo.

## Qué hace cada cambio

1. **Horarios reales de los 104 partidos.**
   `lib/worldcup/kickoffs.ts` es la fuente única de las fechas/horas. Las horas
   que diste están en **hora de Madrid (CEST, UTC+2)** y aquí se guardan ya
   convertidas a ISO UTC. La app las muestra en `Europe/Madrid` (24h), así que
   se ven exactamente como en tu calendario. `lib/data.ts` y
   `app/api/results/fixtures/route.ts` ahora toman el kickoff de este módulo (por
   id de partido), en lugar de las series horarias inventadas que había antes.
   No se cambian ids, equipos ni orden de los partidos.

2. **Partido inaugural — Minuto del primer gol.** En el detalle de
   *México – Sudáfrica* (id 1), bajo el marcador previsto de cada porra aparece
   "Min. 1.er gol: XX'" con el pick especial de esa porra.

3. **Ficha de clasificación.** En el detalle de cada porra se añaden dos picks
   especiales que faltaban: **Primer Gol ESP** y **Min. 1.er gol**.

4. **Versus.** En la pestaña *Especiales* se añade la comparación de
   **Min. 1.er gol** (con apóstrofo en pantalla; la igualdad se calcula sobre el
   valor numérico). Funciona tanto contra un rival como contra el consenso
   (mediana).

5. **Nombres reales en la fase final.** En *Resultados*, los marcadores de
   posición de eliminatorias ("1.º Grupo H", "Ganador 74"…) se sustituyen por el
   país real **cuando el admin ya ha cargado** posiciones de grupo y/o resultados
   oficiales. Si aún no está determinado, se mantiene el texto del placeholder.

   *Nota:* "Mejor 3.º A/B/C/D/F" **no** se resuelve a un país, porque el panel de
   Admin no almacena a qué cruce va cada mejor tercero. Se conserva el
   placeholder a propósito (no es un fallo).

## Cómo aplicarlo

1. Copia las 6 rutas de este ZIP sobre tu proyecto.
2. `npm install` (sin dependencias nuevas) y `npm run build` para comprobar.
3. Despliega como siempre en Vercel.

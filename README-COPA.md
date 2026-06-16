# Modo Copa — Mundial entre porras

Modo nuevo y aislado: cada porra es como una selección. En cada jornada se
enfrenta a otra y sus puntos de esa jornada son los goles. Fase de grupos (14
grupos) + cuadro de 32 desde dieciseisavos. No toca la clasificación general
(la Copa es una capa por encima que solo lee el scoring existente).

## Qué incluye este paquete

Archivos nuevos:
- `lib/cup/types.ts` — tipos de dominio.
- `lib/cup/perJornada.ts` — goles por ventana + verificador de cuadre.
- `lib/cup/template.ts` — plantilla fija del cuadro de 32 (validada) y reparto de mejores terceros.
- `lib/cup/draw.ts` — sorteo determinista en 14 grupos.
- `lib/cup/groups.ts` — calendario, tablas y clasificados.
- `lib/cup/bracket.ts` — resolución y avance del cuadro.
- `lib/cup/use-cup.ts` — hook de cliente.
- `lib/server/cup-db.ts` — persistencia (tabla `cup_config`).
- `app/api/cup/route.ts` — API (GET config; POST sorteo/reset, solo admin).
- `app/copa/page.tsx` — página con Grupos, Calendario y Cuadro.

Archivos modificados (solo añadidos, sin cambiar el comportamiento previo):
- `lib/scoring.ts` — desglose por ventana (`scoreTeamWindows`, `getResolvedWindows`, `sumWindows`, tipo `Ventana`).
- `components/bottom-nav.tsx` — entrada "Copa".

Test:
- `scripts/verify-cup-windows.ts` — cuadre de puntos.

## Reparto de puntos por ventana (los "goles")

- J1 = puntos de los partidos de la Jornada 1 + minuto del primer gol del Mundial
- J2 = puntos de los partidos de la Jornada 2 + primer goleador español
- J3 = puntos de los partidos de la Jornada 3 + posición de grupo
- Dieciseisavos / Octavos / Cuartos / Semifinales = puntos de esa ronda
- Final y 3.er puesto = puntos de la ronda final + podio + resto de especiales

La suma de las 8 ventanas es siempre igual al total de la porra (se calcula con
las mismas funciones internas que la clasificación, así que no se desincroniza).

## Puesta en marcha

1. Sustituye/añade todos los archivos respetando las rutas.
2. No hace falta migración manual: la tabla `cup_config` se crea sola en la
   primera llamada a `/api/cup` usando el mismo `DATABASE_URL`.
3. Despliega.
4. Como organizador (sesión de admin iniciada), entra en `/copa` →
   "Administración (solo organizador)" → "Generar sorteo". Esto congela el
   sorteo con las porras actuales. Se puede deshacer mientras quieras rehacerlo.

A partir de ahí, las tablas y el cuadro se rellenan solos según vayan entrando
los resultados (igual que la clasificación). Los colores de los grupos son los
mismos que en Resultados (y dos extra para los grupos M y N, que no existen en
el torneo real).

## Test de cuadre

```
npx tsx scripts/verify-cup-windows.ts
```

Debe imprimir PASS en todas las comprobaciones.

## Notas

- Empates en el cuadro: se resuelven por acumulado general hasta esa jornada y,
  si persiste, por id (determinista). La capa de "más aciertos exactos de la
  jornada" como primer desempate se puede añadir más adelante.
- El sorteo es aleatorio (semilla fija al generarlo). Si quieres bombos para
  evitar grupos de la muerte, es un añadido sencillo sobre `draw.ts`.
- No se pudo ejecutar un `npm run build` en el entorno donde se generó esto;
  conviene correrlo una vez tras integrar para confirmar tipos.

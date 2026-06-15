# Cronología de partido + Estadísticas + Filtro En vivo/Hoy

## Archivos (formato del repo, sustitución directa — 3 archivos)

| Archivo | Estado |
|---|---|
| `lib/server/live-fixtures.ts` | Mod — extrae cronología completa de eventos de ESPN |
| `app/resultados/page.tsx` | Mod — timeline + estadísticas + filtro rápido |
| `app/api/results/match/route.ts` | **Nuevo** — proxy al summary de ESPN (estadísticas) |

Requiere los zips anteriores aplicados.

## 1 · Cronología del partido (feature 1)

Al tocar un partido, el detalle muestra ahora la cronología completa minuto a
minuto: goles (⚽, con marca de penalti y gol en propia), tarjetas (🟨 🟥 🟨🟥),
sustituciones (🔄 entra ↔ sale), VAR (📺) y penaltis fallados (❌). Cada evento
se alinea a su lado (local izquierda / visitante derecha). Sale del array
`details` del scoreboard que ya descargábamos — cero peticiones extra.

## 2 · Estadísticas del partido (feature 2)

Bajo el marcador, barras comparativas de posesión, tiros, tiros a puerta,
córners, faltas, etc. Se cargan BAJO DEMANDA al abrir un partido, desde el nuevo
endpoint `/api/results/match?event=<id>` que hace de proxy al summary de ESPN
(con caché de 30 s). Si un partido no tiene estadísticas (sin empezar, o ESPN no
las da), el bloque simplemente no aparece.

⚠️ NOTA IMPORTANTE sobre las estadísticas: el parser está montado sobre la
estructura DOCUMENTADA del summary de ESPN (boxscore.teams[].statistics[] con
name/displayValue), pero NO he podido verificarlo contra un partido real del
Mundial porque ese endpoint no es accesible desde mi entorno. Es defensivo (si
la estructura no encaja, no muestra nada en vez de romperse), pero te pido que
tras desplegar abras un partido jugado y confirmes que las stats salen. Si no
salieran, pégame el JSON de:
  https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=<ID>
(el <ID> es el apiId; lo ves en /api/results/fixtures) y ajusto el parser al
instante. Las features 1 y 4 NO dependen de esto y funcionan con seguridad.

## 4 · Filtro rápido En vivo / Hoy (feature 4)

Encima de los filtros de región, una fila nueva:
- "En vivo (N)" con punto rojo — solo aparece si hay partidos en juego; muestra
  únicamente esos. Se desactiva solo cuando ya no hay partidos en vivo.
- "Hoy (N)" — los partidos de hoy (zona horaria de Madrid).
- "Quitar filtro" cuando hay alguno activo.
Se combinan con los filtros de región/fase/búsqueda que ya existían.

## Verificado

- E2E del extractor de cronología con la estructura real del scoreboard de ESPN
  (goles, amarillas, rojas, segundas amarillas, cambios con entra/sale, goles en
  propia bien acreditados, orden por minuto).
- `tsc --noEmit` limpio y `next build` completo (endpoint /api/results/match
  registrado).

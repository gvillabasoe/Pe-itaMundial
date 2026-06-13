# Tablas de grupo + Eliminatorias automáticas + Goleadores

## Archivos (formato del repo, sustitución directa — 9 archivos)

| Archivo | Estado |
|---|---|
| `lib/worldcup/group-tables.ts` | **Nuevo** — tablas de grupo con criterios FIFA |
| `components/live-group-tables.tsx` | **Nuevo** — tablas en vivo en Resultados |
| `lib/admin-import-fixtures.ts` | Mod — autocompletado de posiciones, rondas y especiales |
| `lib/server/live-fixtures.ts` | Mod — extrae goleadores del scoreboard de ESPN |
| `app/api/admin-results/route.ts` | Mod — cadena de merges automáticos ampliada |
| `app/resultados/page.tsx` | Mod — tablas montadas + goles en el detalle de partido |
| `lib/home-countdown.ts` + `app/page.tsx` | Mod — goleadores bajo el marcador de la home |
| `components/admin/import-finished-button.tsx` | Mod — sugerencias de especiales |

Requiere tener aplicado el zip anterior (switch automático + ranking en vivo).

## 1 · Tablas de grupo en vivo (pestaña Resultados)

Sección plegable "Tablas de grupo" encima del buscador: las 12 tablas con selector,
calculadas con los criterios FIFA oficiales (puntos → diferencia global → goles a
favor → head-to-head entre empatados), incluyendo marcadores de partidos EN JUEGO
(punto rojo en los grupos con partido en directo). Cero peticiones extra: reutiliza
el mismo payload que la página.

**Y con el switch automático ON**: cuando un grupo completa sus 6 partidos, las
posiciones finales 1–4 se rellenan y PUNTÚAN solas. Si el desempate exige fair play
o sorteo (empate total a–f), el sistema SE ABSTIENE y lo decides tú. Si has puesto
cualquier posición de un grupo a mano, ese grupo no se toca.

## 2 · Eliminatorias automáticas

Con el switch ON, los equipos que alcanzan cada ronda (dieciseisavos, octavos,
cuartos, semis, finalistas) se rellenan solos en cuanto la API publica los cruces
con nombres reales. Reglas: solo rondas que tengas completamente vacías, y solo si
la API aporta exactamente el nº de equipos esperado (32/16/8/4/2) sin placeholders
("TBD" se descarta). El podio sigue siendo manual.

## 3 · Goleadores

- **Home**: bajo el marcador en vivo, los goleadores de cada equipo ("⚽ Jiménez 23'").
- **Resultados**: al tocar un partido, el detalle muestra los goles de cada lado con
  minuto, (p) penalti y (pp) propia puerta.
- **Minuto del primer gol** (premio especial): se autocompleta y puntúa solo cuando
  el inaugural termina (si no lo has fijado tú).
- **Admin**: el panel del switch muestra sugerencias 💡 (minuto del primer gol y
  primer goleador español según la API). El goleador es SOLO informativo — los
  nombres de jugador varían entre fuentes, así que ese premio lo confirmas tú.

## Verificado

- 16 tests de tablas FIFA (incl. head-to-head y empates irresolubles → abstención),
  reglas de autocompletado (nunca pisa nada tuyo, se abstiene con TBD) y especiales.
- E2E del extractor de goles con la estructura real del scoreboard de ESPN
  (goles sí, tarjetas no; penaltis y propia puerta marcados; lados por team.id).
- `tsc --noEmit` limpio y `next build` completo.

Nota: los goleadores dependen del campo `details` de ESPN (verificado hoy en el
endpoint real). Si algún partido viniera sin él, simplemente no se muestran goles —
nada se rompe.

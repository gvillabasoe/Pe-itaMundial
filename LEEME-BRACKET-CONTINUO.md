# Bracket continuo + auto-posición por fecha

## Archivos

| Archivo | Estado |
|---|---|
| `components/knockout-bracket.tsx` | SUSTITUIR (1 archivo del repo) |
| `muestra-bracket.html` | MUESTRA (fuera del repo) — ábrela en el navegador |
| `muestra-bracket.png` | Captura de la muestra |

Solo se modifica `components/knockout-bracket.tsx`. El `lib/worldcup/bracket.ts`
del paso anterior (con los cruces corregidos) NO cambia y debe estar aplicado.

## Qué cambia

- El cuadro pasa de pestañas a **scroll horizontal continuo**: todas las
  rondas (Ronda de 32 → Octavos → Cuartos → Semis → Final) en columnas
  pegadas y conectadas por las llaves, navegables deslizando de un tirón.
- Al abrir, **se posiciona automáticamente en la ronda activa según la
  fecha**: la última ronda cuyo primer partido ya ha empezado. Hoy (fase de
  grupos) arranca en Ronda de 32; cuando empiecen los octavos, arrancará en
  octavos; y así hasta la final. La columna activa se marca "● EN CURSO".
- Las rondas no activas se ven con menos opacidad para destacar la actual.
- Las llaves siguen usando los cruces reales (corrección anterior) y se
  mantiene el panel "qué porras tienen a X avanzando" al tocar una selección.

## La muestra (fuera del repo)

`muestra-bracket.html` es un HTML autónomo (no usa el repo) para que veas el
resultado, incluido el panel que se abre al pinchar un partido. Ábrelo en
cualquier navegador; viene con el panel desplegado sobre "Suecia" como ejemplo.
Los datos y banderas son de ejemplo; en la app real son los de verdad.

## Verificado

- Test de la ronda activa por fecha (15 jun→R32, 5 jul→octavos, 10 jul→
  cuartos, 14 jul→semis, 19 jul→final).
- `tsc --noEmit` limpio y `next build` completo.

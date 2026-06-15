# Primer goleador español en España–Cabo Verde

## Archivo (sustitución directa — 1 archivo)

| Archivo | Estado |
|---|---|
| `app/resultados/page.tsx` | SUSTITUIR |

(`spain-preview.png` es solo una muestra del aspecto, no va al repo.)

## Qué cambia

En el detalle del partido España–Cabo Verde (id 14), bajo el marcador
previsto de cada porra aparece su pick de "Primer Goleador Español", en el
MISMO formato que el "Minuto Primer Gol" del México–Sudáfrica:

  1.er goleador ESP: Lamine Yamal

Si una porra no puso ese pronóstico, muestra "—". El dato sale de
`specials.primerGolEsp` de cada porra (el mismo que ya se puntúa en la
clasificación). Solo aparece en ese partido; el resto de detalles no cambian.

## Verificado

`tsc --noEmit` limpio, `next build` completo y previsualización del formato.

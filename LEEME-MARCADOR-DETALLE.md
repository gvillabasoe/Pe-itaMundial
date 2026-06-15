# Marcador en el detalle del partido

## Archivo (sustitución directa — 1 archivo)

| Archivo | Estado |
|---|---|
| `app/resultados/page.tsx` | SUSTITUIR |

## Qué cambia

Al abrir el detalle de un partido, donde antes salía solo "Suecia vs Túnez",
ahora aparece el marcador en el MISMO formato que la tarjeta de la lista:

- Badge de estado encima (Finalizado / 59'· En vivo / fecha y hora si no ha
  empezado).
- Banderas a los lados y el resultado en su recuadro central (más grande, por
  ser la vista de detalle).
- Muestra el marcador solo si el partido está en vivo o finalizado y hay
  resultado; si aún no ha empezado, mantiene "vs" como antes.

El resto del detalle (cronología, predicciones de la peñita) no cambia.

## Verificado

`tsc --noEmit` limpio, `next build` completo y previsualización de los tres
estados (finalizado, en vivo, por jugar) confirmando que el formato coincide
con la tarjeta.

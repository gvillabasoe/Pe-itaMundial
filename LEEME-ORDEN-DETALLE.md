# Reordenar el detalle del partido

## Archivo (sustitución directa — 1 archivo)

| Archivo | Estado |
|---|---|
| `app/resultados/page.tsx` | SUSTITUIR |

## Qué cambia

El nuevo orden dentro del detalle del partido es:

1. Marcador (badge de estado + banderas + resultado, formato tarjeta)
2. Cronología (goles, tarjetas, cambios)
3. Predicciones de la peñita

Antes la cronología iba arriba del todo; ahora va justo debajo del marcador
y antes de las predicciones, como pediste. Nada más cambia.

## Verificado
`tsc --noEmit` limpio y `next build` completo. Sin cronología duplicada.

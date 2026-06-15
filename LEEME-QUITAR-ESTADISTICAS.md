# Quitar las estadísticas de partido (feature 2)

Revierte SOLO las estadísticas. La cronología de eventos y el filtro
En vivo/Hoy se mantienen intactos.

## Aplicar en 2 pasos

### 1. Sustituir este archivo
| Archivo | Acción |
|---|---|
| `app/resultados/page.tsx` | SUSTITUIR — ya sin el bloque de estadísticas |

### 2. BORRAR este archivo de tu repo (importante)
```
app/api/results/match/route.ts
```
(y la carpeta `app/api/results/match/` si queda vacía)

Era el proxy al endpoint summary de ESPN que alimentaba las estadísticas.
Al quitarse el bloque de la UI, ya no se llama; conviene borrarlo para no
dejar una ruta muerta. Si lo dejas, no rompe nada, simplemente no se usa.

## Qué se ha quitado
- El componente `MatchStatsBlock`, su interfaz y el helper `pctToNumber`.
- El punto de montaje en el detalle del partido (las barras de posesión,
  tiros, córners, etc.).

## Qué se mantiene
- Cronología del partido (goles, tarjetas, cambios, VAR).
- Filtro rápido En vivo / Hoy.
- Tablas de grupo y cuadro de la fase final.

## Verificado
`tsc --noEmit` limpio y `next build` completo. El endpoint /api/results/match
ya no figura entre las rutas generadas.

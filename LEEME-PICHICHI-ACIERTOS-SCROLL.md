# Pichichi + resaltar aciertos + auto-scroll + puntos visibles en Mi Club

## Archivos (sustitución directa — 3 archivos)

| Archivo | Estado |
|---|---|
| `components/top-scorers.tsx` | **Nuevo** — carrera por la Bota de Oro |
| `app/resultados/page.tsx` | Mod — monta el pichichi, resalta aciertos, auto-scroll |
| `app/mi-club/page.tsx` | Mod — puntos visibles por defecto |

Requiere los zips anteriores aplicados.

## 1 · Pichichi / Bota de Oro (feature 3)

Sección plegable "Carrera por la Bota de Oro" en Resultados. Agrega los goles
por jugador desde los goleadores que da la API en todos los partidos (los goles
en propia NO cuentan) y los ordena. La ⭐ marca a quién eligió cada porra como
máximo goleador (specials.maxGoleador). El podio (top 3) va destacado. Es
informativo: el matching de nombres de jugador es difuso entre fuentes.

## 2 · Resaltar aciertos en los especiales (feature 4)

En el detalle de partido, los picks especiales que coinciden con el resultado
oficial se resaltan en verde con ✓:
- "Minuto 1.er gol" (México–Sudáfrica) cuando el minuto coincide.
- "1.er goleador ESP" (España–Arabia) cuando el goleador coincide (comparación
  tolerante a mayúsculas/acentos/espacios).
El resultado oficial sale de adminResults.specialResults.

## 3 · Auto-scroll al partido en vivo (feature 5)

Al abrir Resultados, si hay un partido en juego, se abre su sección y la página
se desplaza suavemente hasta él (centrado). Solo una vez por carga; si el
usuario navega luego, no le interrumpe.

## 4 · Mi Club: puntos visibles por defecto

El conmutador "Ver puntos / Ocultar puntos" ahora arranca mostrando los puntos
(antes salían ocultos por defecto). Se puede seguir ocultando con el botón.

## Verificado

- Test del agregador del pichichi: conteo por jugador, exclusión de goles en
  propia, y respaldo por porras con normalización de nombres.
- tsc limpio, next build completo, y los tests del repo siguen pasando (4/4 en
  scoring-mapping).

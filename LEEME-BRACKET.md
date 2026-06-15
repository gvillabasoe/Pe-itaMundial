# Cuadro de la fase final (bracket) en Resultados

## Archivos (formato del repo, sustitución directa — 3 archivos)

| Archivo | Estado |
|---|---|
| `lib/worldcup/bracket.ts` | **Nuevo** — estructura del cuadro + lógica de "quién avanza" |
| `components/knockout-bracket.tsx` | **Nuevo** — componente del bracket |
| `app/resultados/page.tsx` | Mod — monta el bracket bajo las tablas de grupo |

Requiere los zips anteriores aplicados.

## Qué hace

En Resultados, sección plegable "Cuadro de la fase final", al mismo nivel que
las tablas de grupo. Muestra el bracket completo en columnas con scroll
horizontal: Ronda de 32 → Octavos → Cuartos → Semifinales → Final.

- Los cruces muestran los equipos REALES cuando ya se conocen (resueltos desde
  los resultados del admin vía el resolver de bracket que ya existía). Mientras
  no se conozcan, aparecen los marcadores de posición ("Ganador 74", "1.º Grupo
  A", "Mejor 3.º...") en gris cursiva.
- Cada cruce muestra el marcador y el estado (En vivo / Final) desde la API.

## "Quién lo tiene en la siguiente ronda"

Al tocar una selección de cualquier cruce, se abre un panel que muestra, por
cada porra, si la tiene avanzando a la siguiente ronda — con ✓ (la tiene) o –
(no la tiene), ordenadas las que sí primero, y un contador "N de M porras".

La semántica respeta el modelo de puntuación de la app: los picks de cada porra
en knockoutPicks[ronda] representan "equipos que creo que avanzan DESDE esa
ronda". Así, tocar un equipo en:
- Ronda de 32 → muestra quién lo tiene pasando a Octavos
- Octavos → a Cuartos
- Cuartos → a Semifinales
- Semifinales → a la Final
- Final → no aplica (el campeón va en el podio); se indica con un aviso.

Los marcadores de posición no son pinchables.

## Verificado

- 22 asserts del lib: estructura (5 columnas 16/8/4/2/1), detección de
  placeholders, mapeo fase→ronda de pick, lookup de avance (incluido
  case-insensitive con acentos), propagación de marcadores al bracket.
- `tsc --noEmit` limpio y `next build` completo. (El test del repo "7
  prediction teams" que falla ya fallaba antes de estos cambios.)

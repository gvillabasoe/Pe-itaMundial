# Corrección de los cruces del bracket

## Archivos (sustitución directa — 2 archivos)

| Archivo | Estado |
|---|---|
| `lib/worldcup/bracket.ts` | Mod — expone los partidos-origen de cada cruce |
| `components/knockout-bracket.tsx` | Mod — empareja visualmente por el cruce real |

## El diagnóstico

Hice un CHECK de todos los cruces de tu `schedule.ts` contra las capturas de
la app de Apple (octavos, cuartos, semis, final, bronce y estadios): **los
datos de los cruces eran TODOS correctos**. El fallo estaba en el COMPONENTE
del bracket, no en los datos.

El componente asumía que los partidos de una ronda, ordenados por número,
se cruzan de dos en dos consecutivos (1+2, 3+4...). Pero en el Mundial no es
así: p. ej. el octavo de Filadelfia enfrenta a los ganadores de los partidos
74 y 77 de la Ronda de 32, no a dos partidos consecutivos. Por eso las llaves
visuales unían equipos que en realidad no se cruzan.

## La corrección

- `bracket.ts` ahora extrae de cada cruce sus partidos-origen reales (parsea
  "Ganador 74" / "Ganador 77" → [74, 77]) y los expone en `sourceMatchIds`.
- El componente reordena cada ronda para que los dos partidos que de verdad
  alimentan un cruce queden juntos, con su llave apuntando al cruce correcto
  de la ronda siguiente.

## Verificado

- CHECK completo de cruces vs Apple: octavos, cuartos, semis, final, bronce
  y estadios — todo coincide.
- Test del reordenamiento: cada par visual = cruce real, en las tres
  transiciones (R32→octavos, octavos→cuartos, cuartos→semis).
- `tsc --noEmit` limpio y `next build` completo.

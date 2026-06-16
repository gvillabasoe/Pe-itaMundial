# Reorganización de la página de Resultados

## Archivos (sustitución directa — 4 archivos)

| Archivo | Estado |
|---|---|
| `app/resultados/page.tsx` | Mod — sub-pestañas + partidos primero |
| `components/live-group-tables.tsx` | Mod — acepta prop `defaultOpen` |
| `components/knockout-bracket.tsx` | Mod — acepta prop `defaultOpen` |
| `components/top-scorers.tsx` | Mod — acepta prop `defaultOpen` |

## El problema

Lo que la gente venía a ver —los partidos— estaba enterrado al final, después
de tres secciones plegables (tablas, cuadro, pichichi) y cuatro filas de
filtros. Había que hacer scroll por delante de medio menú.

## La solución

**Sub-pestañas** arriba: Partidos · Tablas · Cuadro · Goleadores. Cada una
muestra solo lo suyo.

- **Partidos** (por defecto): buscador + filtros + lista. Al entrar, se abre
  automáticamente la sección del partido EN VIVO (o, si no hay, la de los
  partidos de HOY) y la página se desplaza hasta él. El resto sigue agrupado
  por fase/jornada, plegable. La pestaña "Partidos" muestra un punto rojo si
  hay algo en vivo.
- **Tablas / Cuadro / Goleadores**: cada herramienta en su pestaña, ya
  desplegada (sin tener que abrir el plegable).

Los tres componentes ahora aceptan una prop `defaultOpen` para arrancar
abiertos dentro de su pestaña; su uso plegable anterior sigue intacto.

## Verificado

`tsc --noEmit` limpio, `next build` completo y previsualización de la nueva
estructura.

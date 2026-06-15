# Cuadro de la fase final — nuevo formato visual (estilo Apple Sports)

## Archivo (sustitución directa — 1 archivo)

| Archivo | Estado |
|---|---|
| `components/knockout-bracket.tsx` | SUSTITUIR — nuevo diseño tipo bracket |

Solo cambia este componente. El `lib/worldcup/bracket.ts` y el montaje en
`app/resultados/page.tsx` del paso anterior NO cambian.

## Qué cambia respecto a la versión anterior

El cuadro pasa del formato comprimido en columnas a un bracket grande estilo
Apple Sports, como en el vídeo que pasaste:

- **Pestañas de ronda** arriba: Ronda de 32 · Octavos · Cuartos · Semifinal ·
  Final. Navegas una ronda cada vez.
- **Tarjetas grandes** por partido: barra de color de la región/estadio,
  nombre del estadio, las dos selecciones con su **bandera** real, marcador y
  fecha/hora (o "Vivo"/"Final").
- **Conectores en llave** que unen cada par de partidos con su cruce de la
  ronda siguiente, mostrada desplazada a la derecha y centrada entre sus dos
  orígenes — se ve el camino hacia la final.
- La pestaña **Final** muestra la Gran Final (con trofeo) y el Tercer puesto.
- Scroll horizontal para ver la ronda siguiente; vertical dentro de la ronda.

## Se mantiene

- Al tocar una selección, panel de qué porras la tienen avanzando a la
  siguiente ronda (✓ / –, contador "N de M"), con la misma semántica.
- Los equipos reales aparecen conforme el admin/la API confirman resultados;
  mientras tanto, marcadores de posición ("Ganador 75", "1.º Grupo A"...).

## Verificado

`tsc --noEmit` limpio, `next build` completo, y previsualización del layout
para confirmar que coincide con el formato del vídeo (tarjetas + banderas +
conectores en llave hacia la ronda siguiente).

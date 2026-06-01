# Peñita Mundial 2026 — Paquete de cambios

Este ZIP contiene **solo los archivos modificados/nuevos**, con su ruta exacta.
Cópialos sobre el repo respetando la estructura y sustituyendo los existentes.
Sin migraciones de BD, sin dependencias nuevas. Verificado con `tsc --noEmit`
y `next build` en verde (todas las rutas compilan).

Incluye los **5 cambios previos** (entregados anteriormente) más los **3 nuevos**
que pediste en esta tanda. Si ya aplicaste el ZIP anterior, este lo sustituye
en su totalidad: contiene la versión más reciente de todos los archivos.

## Archivos incluidos (11)

Nuevos (3):
- `lib/worldcup/kickoffs.ts`
- `lib/worldcup/resolve-knockout.ts`
- `lib/porra-completeness.ts`

Modificados (8):
- `lib/data.ts`
- `lib/scoring.ts`
- `app/resultados/page.tsx`
- `app/api/results/fixtures/route.ts`
- `app/clasificacion/page.tsx`
- `app/versus/page.tsx`
- `app/admin/page.tsx`
- `app/globals.css`

## Resumen de los 8 cambios

### Entrega previa (5 cambios)

1. **Horarios reales de los 104 partidos.** `lib/worldcup/kickoffs.ts` es la
   fuente única de fechas/horas (ISO UTC, derivado de la tabla en hora de
   Madrid CEST). `lib/data.ts` y `app/api/results/fixtures/route.ts` toman el
   kickoff de aquí por id de partido. No cambian ids, equipos ni orden.

2. **Partido inaugural — Minuto del primer gol.** En *Resultados*, en el
   detalle del partido id 1 (México – Sudáfrica), bajo el marcador previsto
   de cada porra se muestra "Min. 1.er gol: XX'".

3. **Ficha de clasificación.** En el detalle de cada porra se añaden los
   especiales que faltaban: *Primer Gol ESP* y *Min. 1.er gol*.

4. **Versus — comparación de "Min. 1.er gol".** En la pestaña *Especiales*
   del Versus se añade la fila de minuto del primer gol (apóstrofo en
   pantalla, la igualdad se calcula sobre el valor numérico).

5. **Nombres reales en la fase final.** En *Resultados*, los placeholders
   ("1.º Grupo H", "Ganador 74"…) se sustituyen por el país real cuando el
   admin ya ha cargado posiciones y/o resultados. "Mejor 3.º A/B/C/D/F" se
   mantiene como placeholder a propósito: el panel admin no almacena la
   asignación de mejores terceros a cada cruce.

### Entrega nueva (3 cambios)

6. **Mejora global de UX/UI.** Refinamiento del sistema de diseño existente
   en `app/globals.css`:
   - Contraste tipográfico más alto en texto muted (mejor legibilidad).
   - Sombras y bordes de tarjetas más nítidos; al hacer hover, una elevación
     más visible (translateY -1px + sombra mayor).
   - Foco accesible coherente en pills/inputs/botones (anillo dorado).
   - Micro-interacción press en pills (scale 0.97).
   - Touch targets mínimos: 32px en pills, 40px en botones (mejor en móvil).
   - Helper `.row-hover` para listados con hover sutil.

   No se cambia la estructura funcional de ninguna pestaña — solo tokens y
   estilos compartidos, así que el efecto se propaga a Resultados,
   Clasificación, Versus, Admin y Mi Club sin tocar sus archivos. Light y
   dark theme respetados.

7. **Versus — puntos por cada pick individual.** Nueva pestaña **Partidos**
   en Versus que muestra los marcadores previstos por partido de fase de
   grupos (porra base ↔ rival o consenso) con un chip de puntos por cada
   pick: verde (exacto) / ámbar (signo) / rojo (fallo) / neutro "—" sin
   jugar. La pestaña **Especiales** añade el mismo chip de puntos
   (correct/wrong/pending) junto a cada predicción especial cuando el admin
   ya cargó el resultado oficial. La pestaña **Eliminatorias** añade el chip
   por cada equipo de cada ronda. Reusa la misma lógica de scoring que ya
   alimenta la clasificación general (`lib/scoring.ts`): no hay cálculos
   duplicados ni nuevas reglas, son helpers de solo lectura (`scoreMatchPickAgainstAdmin`,
   `getSpecialsBreakdown`).

   *Nota sobre el consenso:* cuando el modo es "General", la columna derecha
   es el consenso (mediana/moda). No es una porra real, por lo que no se
   muestran puntos al lado del consenso en *Especiales* (no tendría sentido
   atribuirle aciertos). En *Partidos* el consenso sí se puntúa al vuelo
   contra el resultado oficial.

   **Pestaña Dobles (partido doble / doble puntuación).** Nueva pestaña que
   compara, por grupo, el partido doble elegido por tu porra frente al del
   rival (modo participante) o al doble más elegido por el resto (modo
   general). Para cada lado muestra el marcador previsto, el badge ×2 y los
   puntos obtenidos (con el bonus de partido doble ya aplicado). Además, para
   cada partido doble indica el **resultado más elegido entre las porras que
   doblan ese mismo partido** y cuántas lo predicen así (p. ej. "2 - 1
   (5/9)"). En modo general también muestra cuántas porras doblan ese partido
   sobre el total. Los filtros "Solo diferencias / Solo coincidencias"
   funcionan según si tu doble coincide con el de la referencia.

8. **Admin — Barra de progreso por porra.** Nueva pestaña **Progreso**
   en el panel admin junto a "Porras" y "Usuarios". Lista cada porra con
   nombre, barra de progreso (rojo 0-33%, ámbar 34-66%, verde 67-99%, verde
   con tick 100%), porcentaje y desglose `X/Y partidos · X/Y especiales`
   (más una línea de detalle con `grupos · fase final`). Ordenación por
   defecto: menos completas primero (lo que necesita el admin para
   identificar quién va atrás); también permite "más completas" y "nombre".

   La completitud se calcula sobre **117 picks**: 72 marcadores de grupos
   + 32 clasificados de fase final + 10 especiales + 3 podio. La lógica
   está en `lib/porra-completeness.ts` (módulo nuevo, puro y reusable, sin
   efectos secundarios). **No requiere SQL ni migraciones**: solo lee
   `participants` desde el hook que ya alimenta el resto del admin.

## Cómo aplicarlo

1. Copia las 11 rutas de este ZIP sobre tu proyecto.
2. `npm install` (sin dependencias nuevas, pero conviene asegurarse).
3. `npm run build` para verificar localmente.
4. Despliega en Vercel como siempre.

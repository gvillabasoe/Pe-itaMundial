# Peñita Mundial — Refactor completo (Tareas 1–5)

ZIP con **5 archivos** que resuelven todas las tareas planteadas. Lógica de la app intacta — solo se refactorizan presentación y arquitectura.

## ⚡ Despliegue

```bash
unzip -o penita-final.zip
git add app/admin/page.tsx \
        app/api/results/fixtures/route.ts \
        app/resultados/page.tsx \
        app/globals.css \
        components/mi-porra-builder.tsx
git commit -m "refactor: admin/resultados/builder UX + API + CSS completo"
git push origin main
```

No requiere migración de BBDD, ni nuevas dependencias, ni nuevas variables de entorno.

---

## ✅ Tarea 1 — Pantalla de Resultados

**Archivo:** `app/resultados/page.tsx`

- **Orden cronológico real**: todos los partidos se ordenan por `kickoff` ascendente sobre timestamps ISO 8601 UTC. Comparación segura entre zonas horarias.
- **División Jornada 1 / 2 / 3**: función nueva `assignMatchdays()` que agrupa por grupo, ordena cronológicamente y asigna jornada por pares. No depende de etiquetas hardcoded — si cambia el calendario, sigue funcionando.
- **Renderizado por secciones colapsables independientes**: Jornada 1, Jornada 2, Jornada 3, Dieciseisavos, Octavos, Cuartos, Semis, Tercer puesto, Final. Solo una abierta a la vez (Jornada 1 por defecto).
- **Timezones**: `Intl.DateTimeFormat` con `timeZone: "Europe/Madrid"`. Las comparaciones siempre sobre UTC para evitar desfases entre clientes.
- **Las fechas las toma del calendario oficial** en `lib/worldcup/schedule.ts`. La API solo pisa `score` y `minute`. Si una fecha es incorrecta, debe corregirse en esa fuente única.

## ✅ Tarea 2 — API de resultados

**Archivo:** `app/api/results/fixtures/route.ts`

- **Endpoint correcto**: `https://v3.football.api-sports.io/fixtures?league=1&season=2026` con header `x-apisports-key` y timeout `AbortController` 10s.
- **Mapeo defensivo**: cada campo del response validado con `typeof`. Helper `mapRoundToStage()` con orden correcto (round of 16 antes que round of 32).
- **Manejo de errores robusto**: siempre devuelve HTTP 200 con shape consistente. Bandera `connection: "live" | "calendar" | "error"` + mensaje `error?: string`. El frontend nunca ve excepciones.
- **Estados de carga**: skeletons en primera carga, banner ámbar con botón "Reintentar" si la API falla.
- **Polling inteligente**: solo si hay partidos en vivo. `dedupingInterval: 5_000`, `onErrorRetry` limitado a 3 intentos con backoff exponencial — evita bucles de reintentos.
- **Fallback a calendario**: sin API key configurada, muestra el calendario oficial sin error. Con API key pero la llamada falla, también cae al calendario y avisa con badge ámbar.

## ✅ Tareas 3 + 4 — Pantalla de Admin

**Archivos:** `app/admin/page.tsx` + `app/globals.css`

### Causa raíz del layout roto

El JSX original usaba clases CSS que **no estaban definidas** en `globals.css`:
- `admin-results-toolbar`, `admin-results-toolbar-row`, `admin-results-toggle`, `admin-results-summary`, `admin-results-filter-row`
- `admin-position-card`, `admin-position-grid`, `admin-position-stack`, `admin-position-row`, `admin-position-slot`, `admin-position-preview`, `admin-preview-row`, `admin-preview-rank`
- `admin-standings-row`, `admin-standings-rank`, `admin-standings-metrics`, `admin-standings-points`
- `admin-round-grid`, `admin-toast`

Por eso se veían los marcadores con flechas spinning del navegador, los nombres partidos en líneas raras (Corea del Sur), las posiciones colapsadas, sin spacing, sin grids. **Todo el caos visual venía de ahí.**

### Solución estructural en CSS

- **`admin-score-editor`** con `admin-score-input` que oculta las flechas del `<input type="number">` (`-moz-appearance: textfield` + `::-webkit-inner-spin-button`). Editor compacto, dorado al focus.
- **`admin-match-row`** con `grid-template-columns: 1fr auto 1fr` — equipo izq, score centrado, equipo der. Nombres con `truncate` para que "Corea del Sur" no se parta en líneas.
- **`admin-position-layout`** responsive — apilado en móvil, dos columnas en desktop (orden manual / vista guardada).
- **`admin-standings-row`** con `grid-template-columns: 28px 1fr auto` — rank, equipo, métricas. Monospace tabular-nums para alineación perfecta de números.
- **`admin-round-grid`** responsive: 1 col móvil → 2 cols sm → 4 cols lg.
- **`admin-savebar`** fijo posicionado `bottom: env(safe-area-inset-bottom) + 76px` para no solapar la bottom-nav del móvil.
- **`admin-toast`** estilo "pill" verde flotante con animación `toastIn`.

### Mejoras UX en `app/admin/page.tsx`

- **KPI cards en cabecera**: 3 tarjetas con número de marcadores cargados, grupos completos y estado dirty/sync. Vista de un vistazo sin scroll.
- **Aviso al cerrar sesión con cambios sin guardar**: `window.confirm` antes del logout si hay cambios pendientes.
- **`beforeunload` listener**: el navegador avisa al cerrar la pestaña con cambios sin guardar.
- **Botón Guardar inteligente**: deshabilitado cuando no hay cambios y el último guardado fue exitoso. Evita ejecuciones innecesarias.
- **Botón Limpiar marcador**: solo activo si hay marcador cargado (antes siempre activo, confuso).
- **Mensaje de error inline**: con icono `AlertCircle`, en el savebar, recuperable con un nuevo intento.
- **Accesibilidad**: `aria-label` en todos los inputs de marcador, `role="status"` en el toast, focus rings con `--gold`.

### Lógica del Admin: 100% intacta

- Carga inicial desde `/api/admin-results` con `sanitizeAdminResults`
- `serializeAdminResults` para detectar dirty
- Toda la lógica de `handleMatchScoreChange`, `handleClearMatchResult`, `handleGroupSlotChange`, `handleRoundChange`, `handlePodiumChange`, `handleSpecialChange`, `handleSave`
- `notifyAdminResultsUpdated()` tras guardar para que el resto de la app refresque
- `computeGroupStandings` con desempate por puntos / DG / GF / nombre

## ✅ Tarea 5 — Mi Porra (Mi Club)

**Archivo:** `components/mi-porra-builder.tsx`

- **Stepper de progreso visible siempre**: barra de progreso 0–100% + 6 chips (Nombre · Grupos X/72 · Doble X/12 · Posiciones X/12 · Eliminatorias X/30 · Podio + Especiales X/Y). Sin scroll para saber qué falta.
- **Tarjetas de grupo divididas por jornadas**: Jornada 1 / Jornada 2 / Jornada 3 con separadores visuales claros + clasificación final 2x2 al pie.
- **Editor de marcador centrado**: mismo `admin-score-editor` que el admin. `grid-cols-[1fr_auto_1fr]` para que los nombres tengan espacio definido. "Corea del Sur" ya no se parte.
- **Partido doble: solo 1 por grupo, garantizado**: al marcar uno, reemplaza el anterior automáticamente. Evita el bug "Doble 2/1" en rojo.
- **Validación al guardar (no al abrir)**: el banner de errores solo aparece si el usuario pulsó "Guardar" o si hubo un `saveError` de backend. Antes aparecía nada más entrar al builder, generando ansiedad.
- **CTA flotante con feedback claro**:
  - "Te falta X%" mientras está incompleta
  - "✓ Porra completa" al 100%
  - Subtítulo: "X cosas por revisar" si hay errores, "Lista para guardar" si no
  - Al pulsar Guardar con errores, scroll automático hacia arriba para mostrar el banner
- **Numeración explícita de secciones**: 1. Nombre · 2. Fase de grupos · 3. Mejores terceros · 4. Cuadro eliminatorio · 5. Podio · 6. Especiales

### Lógica del Builder: 100% intacta

- Mismo `createEmptyPorraDraft`, `validatePorraDraft`, `buildStoredTeamFromDraft`
- Mismo state shape: `matchPicks`, `doubleMatches`, `groupOrderPicks`, `roundWinners`, `bestThirdGroups`, `bestThirdAssignments`, `championPick`, `runnerUpPick`, `thirdPlacePick`, `specials`
- Mismo `POST /api/user-teams` con payload `{ entry }`
- Misma firma del componente: `MiPorraBuilder({ user, onSaved, onCancel })`

---

## 🧪 Validación post-deploy

1. **Resultados**: abre `/resultados`. Las tres jornadas aparecen como secciones independientes, ordenadas cronológicamente. Las fechas se muestran en hora Madrid.
2. **API**: corta el WiFi un instante → la página sigue funcionando con calendario y muestra banner ámbar de error con botón Reintentar.
3. **Admin**: entra como `@canallita` con la contraseña que tengas configurada. Comprueba:
   - Toolbar de resultados se ve correctamente con toggle "Por grupo / Por fase"
   - Al introducir un marcador, los inputs son compactos y centrados (sin flechas spinning)
   - Las posiciones de grupo se ven en dos columnas (orden manual + vista guardada)
   - Al guardar, aparece el toast verde "Guardado correctamente"
   - Si intentas cerrar sesión con cambios sin guardar, te avisa
   - El botón Guardar se deshabilita cuando no hay cambios
4. **Mi Porra**: en `/mi-club`, pulsa "Crear porra":
   - Stepper de progreso visible en cabecera
   - Cada grupo muestra "Jornada 1 / 2 / 3" claramente separadas
   - Los nombres de equipos no se parten ("Corea del Sur" se ve completo)
   - Al pulsar Guardar incompleto, scroll a arriba con banner amistoso
   - Al completar todo y guardar, navega a la vista de tu porra creada

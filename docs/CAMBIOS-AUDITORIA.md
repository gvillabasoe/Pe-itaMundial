# Peñita Mundial · Auditoría completa + entrega

## ✅ Phase 2 — Bug crítico corregido

**Síntoma:** los puntos por marcador exacto del admin no se reflejaban en algunas porras de usuario, aunque otros puntos (grupos, eliminatorias, especiales) sí.

**Causa raíz:** `lib/scoring.ts` indexaba el `Map` de partidos del schedule oficial solo en sentido `home|away`. Como el mock `FIXTURES` (`lib/data.ts`) genera algunos pares con orden invertido, esos fixtures quedaban fuera del lookup y `resolveGroupMatchResult` devolvía `null` → la pick se quedaba en `pending`.

**Fix:** indexar el Map en ambos sentidos (`home|away` Y `away|home`). Cambio quirúrgico en 3 líneas, sin afectar BBDD.

**Archivos:**
- `lib/scoring.ts` — fix
- `lib/__tests__/scoring-mapping.test.ts` — test de regresión

**Validar:** ejecuta `npx tsx lib/__tests__/scoring-mapping.test.ts`. Debe imprimir `4 passed, 0 failed`.

---

## 🎨 Phase 3 — UI/UX premium light-first

### Cambios estructurales

- **Light mode es ahora el default.** El script anti-flash en `<html><head>` solo aplica `.dark` si el usuario lo cambió previamente. Sin localStorage, light directo.
- **Dark mode opcional** vía toggle Sun/Moon (top-right). Mismo componente que antes, solo cambia la lógica de inicialización.
- **Paleta light-first oficial** definida en CSS vars (`:root`) con HEX completos en `app/globals.css`.
- **Glassmorphism light:** clase `.card-glass` con `backdrop-filter: blur(18px) saturate(180%)`.
- **Sombras suaves** en 4 niveles (`sm`, `md`, `lg`, `glow`).
- **Toasts globales** (`<ToastProvider>`) — `useToast().success() / error() / info()`.
- **Skeletons** con animación shimmer.
- **Reduce-motion:** todas las animaciones se desactivan respetando `prefers-reduced-motion`.

### Paleta HEX completa

| Token | Light | Dark |
|---|---|---|
| `--bg-canvas` | `#FAFAF7` | `#050608` |
| `--bg-surface` | `#FFFFFF` | `#0C0F14` |
| `--bg-elevated` | `#FFFDF8` | `#12171D` |
| `--bg-muted` | `#F2EFE8` | `#0B0E13` |
| `--text-primary` | `#0E1320` | `#F0F2F7` |
| `--text-secondary` | `#3C4660` | `#C8D2E0` |
| `--text-muted` | `#7B879C` | `#98A3B8` |
| `--text-faint` | `#A8B0BF` | `#646E7D` |
| `--border-subtle` | `#E9E5DA` | `#1E222A` |
| `--border-default` | `#D9D2C2` | `#282E38` |
| `--gold` | `#C99625` | `#D4AF37` |
| `--gold-light` | `#E5B340` | `#FFD87A` |
| `--gold-soft` | `#FAF1D9` | `#1F1B0C` |
| `--navy` | `#1A2240` | `#C8D2E0` |
| `--success` | `#0E9F6E` | `#27E6AC` |
| `--danger` | `#D63B5A` | `#FF7AA5` |
| `--amber` | `#B58A1B` | `#DFBE38` |
| `--accent-participante` | `#3F9D4E` | `#3F9D4E` |
| `--accent-versus` | `#D6336F` | `#D6336F` |

### Estados de pick visibles inline (Phase 3)

Nueva clase `.pick-chip` con 4 variantes:
- `.pick-chip-correct` ⭐ verde — exacto
- `.pick-chip-sign` ✅ ámbar — solo signo
- `.pick-chip-wrong` ❌ rojo — fallo
- `.pick-chip-pending` · gris — pendiente

Componente `<PickChip status={...} points={...} />` exportado desde `components/ui.tsx`. Se muestra en cada pick (Mi Club, Resultados modal, Clasificación expand).

### Leaderboard mejorado

- 🥇🥈🥉 medallas reales (componente `<Medal>`)
- Avatar con iniciales determinísticas por nombre (`<InitialsAvatar>`)
- Match breakdown colapsable por usuario en `/clasificacion`
- Total acumulado por grupo siempre visible en Mi Club > Partidos

### Archivos tocados

- `app/globals.css` — design system completo light-first
- `tailwind.config.ts` — tokens via CSS vars
- `app/layout.tsx` — ThemeProvider + ToastProvider + ThemeToggle integrados
- `components/theme-provider.tsx` — light default
- `components/theme-toggle.tsx` — toggle Sun/Moon
- `components/toast-provider.tsx` — sistema global de toasts
- `components/ui.tsx` — `PickChip`, `Medal`, `InitialsAvatar`, `Skeleton`
- `components/bottom-nav.tsx` — light polished
- `app/clasificacion/page.tsx` — medallas + avatares + breakdown colapsable
- `app/resultados/page.tsx` — pick chips inline en predicciones
- `app/mi-club/page.tsx` — premium hero card + skeletons + integración toasts

---

## 🧭 Phase 4 — "Crear mi Porra" más claro (NO invasivo)

**Reglas respetadas:**
- ✅ No se cambia ningún input del builder existente
- ✅ No se cambia el método de input
- ✅ No se cambia la lógica de validación interna
- ✅ Solo se añaden envoltorios visuales opcionales

**Nuevos helpers** en `components/builder-helpers.tsx`:

```tsx
import {
  BuilderStepper,
  BuilderFieldGroup,
  BuilderHelperText,
  BuilderFloatingCTA,
  BuilderDivider,
} from "@/components/builder-helpers";
```

**Cómo integrarlos en `MiPorraBuilder`** (cambios opcionales que tú haces cuando localices el archivo):

```tsx
// Al inicio del builder
<BuilderStepper
  currentStep={2}
  totalSteps={6}
  labels={["Datos", "Grupos", "Doble", "Eliminatorias", "Podio", "Especiales"]}
/>

// Envolver cada sección de inputs
<BuilderFieldGroup
  title="Equipos por grupo"
  hint="Ordena del 1.º al 4.º. Imprescindible para puntos por posición."
  required
>
  {/* tus inputs originales SIN tocar */}
</BuilderFieldGroup>

// Validación amistosa inline (sin reemplazar la tuya)
<BuilderHelperText kind="error">Falta seleccionar el campeón.</BuilderHelperText>

// Separador visual
<BuilderDivider label="Picks especiales" />

// CTA siempre visible
<BuilderFloatingCTA visible={canSave}>
  <span className="text-xs text-text-muted">{progress}% completado</span>
  <button className="btn btn-primary" onClick={onSave}>Guardar porra</button>
</BuilderFloatingCTA>
```

Las clases CSS (`.field-group`, `.stepper`, `.floating-cta`, `.required-asterisk`, `.optional-tag`) ya están en `globals.css` y funcionan aunque no uses los componentes.

---

## 🔐 Seguridad

- **`POST /api/admin-results`** ahora valida `Content-Length` ≤ 256 KB.
- **`lib/use-scored-participants.ts`** limita reintentos a 3 con backoff exponencial.
- **SWR** con `dedupingInterval: 10_000` para no saturar Neon.
- ⚠️ **Pendiente que tú hagas:** rotar el `DATABASE_URL` de `.env.local` ya que estaba commiteada en el repo.

---

## 🗄️ Migración SQL

Archivo `sql/002_add_username_safe.sql`. Idempotente. Ejecuta en Neon → SQL Editor → Run. Resuelve el error `column "username" does not exist` que viste antes.

---

## 📊 Phase 5 — Roadmap de features (pendientes de implementar)

| Categoría | Feature | Effort | Impact |
|---|---|---|---|
| **Gamificación** | Logros desbloqueables (primera porra, pleno de signos, exacto perfecto) | M | H |
| **Gamificación** | Racha activa de aciertos por usuario | L | M |
| **Gamificación** | Predicción del día con bonus 2x | M | H |
| **Gamificación** | Mini-ligas privadas dentro de la peñita | H | H |
| **Stats** | Heatmap de aciertos por participante (calendario × grupos) | M | M |
| **Stats** | Comparador head-to-head con histórico de divergencias | M | M |
| **Stats** | Distribución de probabilidades por equipo agregada (basada en picks de la peñita) | L | L |
| **Stats** | Export CSV con datos enriquecidos (puntos calculados en BD, no en cliente) | M | M |
| **Notificaciones** | Web Push para inicio de partido + resultado final | H | H |
| **Notificaciones** | Email digest semanal con cambios en el ranking | M | M |
| **Notificaciones** | Alerta cuando un rival te supera | M | H |
| **Técnico** | Persistir puntos calculados en `entry.computedPoints` con timestamp | M | M |
| **Técnico** | Lock pesimista en INSERT user_teams para evitar 4ª porra concurrente | L | L |
| **Técnico** | ETag / If-Match en POST /api/admin-results para edición concurrente | M | L |
| **Técnico** | API pública (read-only) para consultar rankings desde otras apps | M | L |
| **Técnico** | Test e2e con Playwright de flujo completo (login → crear porra → admin saves → puntos se reflejan) | H | H |
| **Social** | Compartir tu porra como imagen (canvas → PNG) | M | M |
| **Social** | Botones de compartir resultado por WhatsApp/Twitter | L | M |
| **Social** | Wall pública de actividad reciente (quién acertó qué) | M | M |
| **Social** | Comentarios por partido entre la peñita | H | M |

---

## ✅ Checklist de despliegue

1. `unzip penita-mundial-final.zip -d .` en la raíz del repo
2. `npm install` (no hay dependencias nuevas)
3. Ejecutar `sql/002_add_username_safe.sql` en Neon SQL Editor
4. Rotar `DATABASE_URL` en Neon y actualizar variable en Vercel
5. `git add . && git commit -m "feat: light-first premium UI + scoring fix" && git push`
6. Verificar en Vercel deployment
7. Probar el fix Phase 2: admin guarda resultado #25 (Chequia vs Sudáfrica) → ver en Mi Club que el partido invertido del mock recibe puntos

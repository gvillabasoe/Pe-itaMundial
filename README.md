# Peñita Mundial · Auditoría completa + entrega

ZIP listo para subir al repositorio. **18 archivos** organizados en la misma estructura que `gvillabasoe/Mundial2026`.

## ⚡ Quick start

```bash
# 1. Descomprimir en la raíz del repo (sobrescribe los archivos existentes)
unzip penita-mundial-final.zip -d .

# 2. Ejecutar migración SQL en Neon (SQL Editor → pegar → Run)
cat sql/002_add_username_safe.sql

# 3. Verificar test del fix Phase 2
npx tsx lib/__tests__/scoring-mapping.test.ts
# → Debe imprimir: 4 passed, 0 failed

# 4. Build y deploy
npm install
npm run build
git add . && git commit -m "feat: light-first premium UI + scoring fix" && git push
```

## 📋 Qué incluye

| Phase | Archivo | Cambio |
|---|---|---|
| **2** | `lib/scoring.ts` | Fix root cause del bug de marcador exacto (indexación bidireccional) |
| **2** | `lib/__tests__/scoring-mapping.test.ts` | Test de regresión |
| **3** | `app/globals.css` | Design system light-first completo |
| **3** | `tailwind.config.ts` | Tokens via CSS vars |
| **3** | `app/layout.tsx` | ThemeProvider + ToastProvider integrados |
| **3** | `components/theme-provider.tsx` | Light por defecto, dark opcional |
| **3** | `components/theme-toggle.tsx` | Toggle Sun/Moon |
| **3** | `components/toast-provider.tsx` | Sistema global de toasts |
| **3** | `components/ui.tsx` | `<PickChip>`, `<Medal>`, `<InitialsAvatar>`, `<Skeleton>` (Flag intacto) |
| **3** | `components/bottom-nav.tsx` | Nav inferior light polished |
| **3** | `app/clasificacion/page.tsx` | Medallas + avatares + breakdown colapsable |
| **3** | `app/resultados/page.tsx` | PickChips inline en predicciones |
| **3** | `app/mi-club/page.tsx` | Hero card premium + skeletons + toasts |
| **4** | `components/builder-helpers.tsx` | Helpers visuales NO invasivos para Mi Porra |
| **Sec.** | `app/api/admin-results/route.ts` | Validación tamaño payload |
| **Sec.** | `lib/use-scored-participants.ts` | Reintentos limitados + dedupe |
| **DB** | `sql/002_add_username_safe.sql` | Migración idempotente |
| **Docs** | `docs/CAMBIOS-AUDITORIA.md` | Detalle completo Phase 1–5 |

## ⚠️ Importante

1. **Rotar `DATABASE_URL`** en Neon — la actual estaba en `.env.local` commiteada.
2. **Eliminar del git history** la credencial expuesta (`git filter-repo` o BFG).
3. **`mi-porra-builder.tsx`** no se ha modificado — está intacto. Los helpers de `components/builder-helpers.tsx` son opcionales y se pueden integrar cuando localices el archivo. Las clases CSS (`.field-group`, `.stepper-*`, `.floating-cta`) ya funcionan sin tocar el builder.

## 🚦 Validación post-deploy

1. Entra a `/admin` con `@canallita / oyarsexo`.
2. Carga el resultado del partido **#25 Chequia vs Sudáfrica**: por ejemplo `2-1`. Pulsa Guardar.
3. Entra como Carlos_M en `/mi-club` → pestaña "Partidos" → grupo A.
4. El partido **Sudáfrica vs Chequia** (orden invertido en el mock) debe mostrar puntos calculados (✅ acierto/❌ fallo según el pick), NO "Pendiente".
5. Si sigue en "Pendiente" → ejecuta el test (`npx tsx lib/__tests__/scoring-mapping.test.ts`) y revisa la consola del servidor en frío buscando `[scoring] N fixtures de grupo sin matchId`.

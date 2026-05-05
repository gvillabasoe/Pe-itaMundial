# Peñita — Fix 6 items · ZIP de despliegue

## Archivos incluidos (subir directamente):

- `lib/admin-results.ts` — KNOCKOUT_ADMIN_COUNTS (32/16/8/4), arrays correctos
- `app/admin/page.tsx` — KNOCKOUT_ADMIN_COUNTS + tab "Gestionar porras"
- `app/mi-club/page.tsx` — link admin restaurado, layout móvil, botón eliminar
- `app/api/user-teams/delete/route.ts` — endpoint de eliminación

## Despliegue

```bash
unzip -o penita-fix6.zip
git add lib/admin-results.ts \
        app/admin/page.tsx \
        app/mi-club/page.tsx \
        app/api/user-teams/delete/route.ts
git commit -m "fix: knockout admin counts, delete porra, mobile layout, admin link"
git push origin main
```

---

## ⚠️ Parche manual adicional — Scores en blanco al guardar

El bug "guarda como 0-0 cuando debería quedar en blanco" requiere 3 cambios
quirúrgicos en archivos que no tengo completos. Hazlos desde GitHub web:

### A. `lib/data.ts` — MatchPick: cambiar tipos de home/away

Busca esta interfaz:
```ts
export interface MatchPick {
  home: number;
  away: number;
  points: number | null;
  status: "pending" | "correct" | "sign" | "wrong";
}
```

Reemplaza `home: number` y `away: number` por:
```ts
export interface MatchPick {
  home: number | null;
  away: number | null;
  points: number | null;
  status: "pending" | "correct" | "sign" | "wrong";
}
```

### B. `lib/porra-builder.ts` — buildStoredTeamFromDraft: null en vez de 0

Busca dentro de `buildStoredTeamFromDraft` estas dos líneas:
```ts
          home: parseDraftScore(pick?.home) ?? 0,
          away: parseDraftScore(pick?.away) ?? 0,
```

Reemplaza por:
```ts
          home: parseDraftScore(pick?.home) ?? null,
          away: parseDraftScore(pick?.away) ?? null,
```

### C. `lib/scoring.ts` — scoreGroupMatchPicks: guard contra null

Busca en `scoreGroupMatchPicks` el bloque que empieza con:
```ts
    const actual = resolveGroupMatchResult(fixtureId, adminResults);

    if (!actual) {
```

JUSTO DESPUÉS del `if (!actual) { ... return; }`, añade estas líneas:
```ts
    // Si el marcador no fue rellenado (null), marcar como pendiente
    if (pick.home === null || pick.away === null) {
      matchPicks[fixtureId] = { ...pick, points: null, status: "pending" };
      return;
    }
```

---

## Qué resuelve cada cambio

| Problema | Archivo(s) | Fix |
|---|---|---|
| Admin link desaparecido | `app/mi-club/page.tsx` | Restaurado en LoginView |
| Badge porras tapa username en móvil | `app/mi-club/page.tsx` | Layout flex-col en xs, flex-row en sm+ |
| Gestionar porras en admin | `app/admin/page.tsx` | Nueva tab "Gestionar porras" con editar/eliminar por usuario |
| Score en blanco → 0-0 | `lib/data.ts`, `lib/porra-builder.ts`, `lib/scoring.ts` | MatchPick.home/away: number\|null; ?? null; guard null |
| Knockout admin: 16 en vez de 32 | `lib/admin-results.ts`, `app/admin/page.tsx` | KNOCKOUT_ADMIN_COUNTS hardcodeado (32/16/8/4); arrays del tamaño correcto |
| Eliminar porra | `app/mi-club/page.tsx` + `app/api/user-teams/delete/route.ts` | Modal de confirmación "¿Estás seguro?" + endpoint DELETE |

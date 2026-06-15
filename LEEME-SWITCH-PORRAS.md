# Switch para habilitar/deshabilitar la creación de nuevas porras

## Archivos (formato del repo, sustitución directa — 6 archivos)

| Archivo | Estado |
|---|---|
| `lib/admin-results.ts` | Mod — campo `allowNewPorras` (ON por defecto) |
| `app/api/admin-results/settings/route.ts` | **Nuevo** — persiste flags del Admin |
| `lib/server/user-teams-db.ts` | Mod — bloqueo en servidor de porras nuevas |
| `app/api/user-teams/route.ts` | Mod — código de error 400 para el bloqueo |
| `app/admin/page.tsx` | Mod — el switch en la pestaña Porras |
| `app/mi-club/page.tsx` | Mod — UI de creación respeta el switch |

Requiere los zips anteriores aplicados (usa el mismo patrón que el switch de
resultados automáticos).

## Qué hace

En **Admin → Porras**, arriba del todo, un switch "Permitir crear nuevas porras"
(habilitado por defecto). Se guarda al instante al pulsarlo (no pasa por
"Guardar cambios"). Verde = habilitado, gris = bloqueado.

Con el switch en **Bloqueado**:
- En "Mi Club", el botón "Nueva porra" desaparece y aparece el badge
  "Creación cerrada". Un usuario sin ninguna porra ve "Porras cerradas".
- El bloqueo se aplica TAMBIÉN en el servidor (`saveUserTeamToDb`): aunque
  alguien llame a la API directamente, una porra NUEVA se rechaza con
  "La creación de nuevas porras está deshabilitada por el administrador".
- **Editar y eliminar porras existentes sigue funcionando** — solo se bloquea
  la creación de porras nuevas.

## Verificado

- Defaults y sanitize del flag (ON por defecto, persiste, no afecta a
  autoImportApi).
- El bloqueo en servidor solo aplica a la rama de porra nueva (rowCount===0),
  antes del límite de 3; las ediciones (rowCount===1) no lo tocan.
- `tsc --noEmit` limpio y `next build` completo (endpoint settings registrado).

Tras desplegar: Admin → Porras → el switch está arriba. Apágalo y comprueba en
Mi Club (con otro usuario) que "Nueva porra" ya no aparece.

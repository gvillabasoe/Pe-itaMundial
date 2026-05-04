# Peñita Mundial — Sistema de usuarios + sedes renombradas + paleta restaurada

## ⚡ Despliegue — sin tocar el local

Este zip **no requiere instalar dependencias**. Usa `node:crypto` nativo (`scrypt`) en lugar de `bcryptjs`. No tocas `package.json` ni `package-lock.json`.

### 1️⃣ Ejecutar la migración SQL en Neon

Abre Neon → SQL Editor → pega y ejecuta `sql/003_create_users.sql`. Crea la tabla `users` y siembra los dos usuarios:

| Username  | Password  | Rol   |
|-----------|-----------|-------|
| canallita | oyarsexo  | admin |
| tester    | test1     | user  |

Las contraseñas están guardadas con **scrypt N=16384 r=8 p=1**, formato:
`scrypt$N$r$p$salt_b64$hash_b64`. **Si ya ejecutaste antes una versión con bcrypt**, no hay problema — el `ON CONFLICT (username) DO UPDATE` actualizará los hashes al formato nuevo.

Verifica que existen:

```sql
select id, username, role from users;
```

### 2️⃣ Descomprimir y commitear (todo desde web/GitHub)

Si trabajas siempre desde GitHub web (sin local):

1. Descarga el zip y descomprímelo en tu Mac/PC
2. Sube los archivos al repo arrastrándolos uno a uno desde `https://github.com/gvillabasoe/Pe-itaMundial` (botón "Add file → Upload files")
3. Commit message sugerido: `feat: bbdd usuarios scrypt + paleta sedes + CDMX/NY-NJ`

Archivos a subir:
- `app/api/auth/login/route.ts`
- `app/api/auth/me/route.ts`
- `app/mi-club/page.tsx`
- `app/resultados/page.tsx`
- `components/auth-provider.tsx`
- `lib/config/regions.ts`
- `lib/users.ts`
- `sql/003_create_users.sql`

**No subas** `package.json` ni `package-lock.json`. No los necesitas porque no añadimos dependencias.

### 3️⃣ Editar a mano 2 archivos en GitHub web

Pulsa el lápiz de editar archivo en GitHub y haz estos dos cambios.

#### A. `lib/data.ts` — Eliminar usuarios demo (Carlos_M, Laura_G, etc.)

Busca este bloque (alrededor de las líneas 80-91):

```ts
const MOCK_USERS_SEED = [
  { id: "u1", username: "Carlos_M", teamNames: ["Los Toreros", "Furia Roja", "La Peña"] },
  { id: "u2", username: "Laura_G", teamNames: ["Las Campeonas"] },
  // ... hasta u10
];
```

Reemplázalo por una sola línea:

```ts
const MOCK_USERS_SEED: Array<{ id: string; username: string; teamNames: string[] }> = [];
```

NO toques nada más del archivo. La cadena de derivación (`MOCK_USERS` y `PARTICIPANTS` se generan a partir de este array) hará que ambos queden vacíos automáticamente.

¿Por qué es seguro?
- `useScoredParticipants` ya tiene `if (hasRealUserTeams(...)) return userTeams.store.entries`. Como ya tienes una porra real en Neon, los demos nunca se usan.
- Si en el futuro la BBDD se vacía, el ranking aparecerá vacío en lugar de poblarse con Carlos_M y demás. Que es lo que has pedido.

#### B. `lib/worldcup/schedule.ts` — Renombrar sedes

GitHub web tiene un find & replace integrado (Ctrl/Cmd+F en el modo edit). Haz dos búsquedas y reemplazos exactos:

| Buscar (con comillas)            | Reemplazar por  |
|----------------------------------|-----------------|
| `"Ciudad de México"`             | `"CDMX"`        |
| `"Nueva York/Nueva Jersey"`      | `"NY/NJ"`       |

Esto solo afecta a los strings de `hostCity` en `WORLD_CUP_MATCHES`. La función `m()` valida contra `REGION_BY_CITY`, que **ya está actualizado** en este zip con las nuevas claves cortas.

---

## ✅ Cambios incluidos en este zip

### Sistema de usuarios real (sin dependencias externas)

- **`sql/003_create_users.sql`**: tabla `users` + seeds con scrypt hashes pre-generados y verificados
- **`app/api/auth/login/route.ts`**: `POST /api/auth/login` con `crypto.scrypt` nativo + delay anti-timing 250ms
- **`app/api/auth/me/route.ts`**: `GET /api/auth/me?id=xxx` para hidratar contexto al recargar
- **`lib/users.ts`**: API cliente con `loginAsync` + `fetchUserById` + stubs sync con warning
- **`components/auth-provider.tsx`**: nuevo hook `loginAsync` + flag `isHydrating` + sigue compatible con código antiguo
- **`app/mi-club/page.tsx`**: usa `loginAsync` y muestra errores reales del backend

### Resultados — paleta restaurada

- **`app/resultados/page.tsx`**: paleta de sedes restaurada con `getCityColor` + `getCityBgColor`. Los badges de sede vuelven a tener color (turquesa Oeste, verde Centro, naranja Este).

### Sedes renombradas

- **`lib/config/regions.ts`**: claves `"CDMX"` y `"NY/NJ"` reemplazan a las largas. Los aliases largos (`"Ciudad de México"`, `"Mexico City"`, `"East Rutherford"`...) siguen aceptándose como entrada en `normalizeCity()` para compat con la API-Football.

---

## 🔐 Notas de seguridad

El sistema de auth migrado **es funcional pero NO es seguridad de verdad**. Por dos razones:

1. **Sesión en `localStorage`**: cualquiera con DevTools puede setear `localStorage["penita_user"] = "u_tester"` y entrar como tester sin saber la contraseña. Esto era cierto antes y sigue siendo cierto. Para arreglarlo de verdad haría falta cookies httpOnly + JWT firmado del lado servidor.

2. **`/api/auth/me?id=` es público**: cualquiera puede pedir el registro de un usuario por id (sin password_hash, eso sí). Permite enumerar IDs.

**Para los dos usuarios de prueba que tienes ahora, esto es aceptable**. Si quieres seguridad real, pídelo aparte (1-2 horas adicionales de trabajo: middleware, cookies httpOnly, JWT).

---

## ¿Por qué scrypt en lugar de bcrypt?

`scrypt` está en `node:crypto` desde Node 10. **No requiere instalar nada**. Vercel ejecuta Node 20+, así que la API está disponible sin cambios al `package.json`.

`scrypt` es:
- **Robusto**: recomendado por OWASP, IETF RFC 7914
- **Memory-hard**: resistente a ataques con GPU (más que bcrypt)
- **Configurable**: con N=16384 r=8 p=1 da ~64ms por hash en hardware moderno

Compatibilidad: si en el futuro quieres migrar a Argon2 o cambiar parámetros, el formato `scrypt$N$r$p$salt$hash` es extensible — solo añade soporte para `argon2$...` en el verifier.

---

## ✅ Verificación post-deploy

1. **Login `tester / test1`** en `/mi-club` → entra, te lleva al builder o a tu porra si ya tienes una.
2. **Login `canallita / oyarsexo`** en `/admin/login` → sigue funcionando igual (no toca el sistema nuevo, su cookie `admin_session` es independiente).
3. **Login con credenciales mal** → mensaje "Usuario o contraseña incorrectos" (real, viene del backend) y delay ~250ms.
4. **Resultados**: en `/resultados` los badges de "CDMX" y "NY/NJ" se ven con color de región (verde y naranja respectivamente).
5. **Demos eliminados**: en `/clasificacion` solo aparece tu porra real. No hay Carlos_M, Laura_G, etc.

Si algo falla en el build, pega el log de Vercel.

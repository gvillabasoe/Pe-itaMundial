# Peñita Mundial — Sistema de usuarios + sedes renombradas + paleta restaurada

## ⚡ Despliegue (en orden)

### 1️⃣ Instalar dependencia nueva

```bash
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

`bcryptjs` es una implementación pure-JS de bcrypt (no requiere binarios nativos como `bcrypt`, mucho mejor para Vercel). 30 KB instalados, sin trampas.

### 2️⃣ Ejecutar la migración SQL en Neon

Abre Neon → SQL Editor → pega y ejecuta `sql/003_create_users.sql`. Crea la tabla `users` y siembra los dos usuarios:

| Username  | Password  | Rol   |
|-----------|-----------|-------|
| canallita | oyarsexo  | admin |
| tester    | test1     | user  |

Las contraseñas están guardadas como **bcrypt rounds=10**, no en claro.

Verifica que existen:

```sql
select id, username, role from users;
```

### 3️⃣ Descomprimir y commitear

```bash
unzip -o penita-users-feat.zip
git add app/api/auth/login/route.ts \
        app/api/auth/me/route.ts \
        app/mi-club/page.tsx \
        app/resultados/page.tsx \
        components/auth-provider.tsx \
        lib/config/regions.ts \
        lib/users.ts \
        sql/003_create_users.sql \
        package.json package-lock.json
git commit -m "feat: bbdd de usuarios + paleta sedes restaurada + sedes renombradas (CDMX, NY/NJ)"
git push origin main
```

### 4️⃣ Editar a mano (2 archivos)

#### A. `lib/data.ts` — Eliminar usuarios demo (Carlos_M, Laura_G, etc.)

Busca este bloque (alrededor de las líneas 80-91 del archivo):

```ts
const MOCK_USERS_SEED = [
  { id: "u1", username: "Carlos_M", teamNames: ["Los Toreros", "Furia Roja", "La Peña"] },
  { id: "u2", username: "Laura_G", teamNames: ["Las Campeonas"] },
  // ... hasta u10
];
```

Reemplázalo por:

```ts
const MOCK_USERS_SEED: Array<{ id: string; username: string; teamNames: string[] }> = [];
```

Eso es todo. **NO toques nada más** del archivo. La cadena de derivación (`MOCK_USERS` y `PARTICIPANTS` se generan a partir de este array) hará que ambos queden vacíos automáticamente.

¿Por qué es seguro?
- `useScoredParticipants` en `lib/use-scored-participants.ts` ya tiene un `if (hasRealUserTeams(userTeams.store)) return userTeams.store.entries`. Como ya tienes una porra real en Neon, los demos nunca se usan.
- Si en el futuro la BBDD se vacía, el ranking aparecerá vacío en lugar de poblarse con Carlos_M y compañía. Que es lo que has pedido.

#### B. `lib/worldcup/schedule.ts` — Renombrar sedes

Busca y reemplaza (con sustitución exacta, **2 búsquedas globales**):

| Buscar (con comillas)            | Reemplazar por  |
|----------------------------------|-----------------|
| `"Ciudad de México"`             | `"CDMX"`        |
| `"Nueva York/Nueva Jersey"`      | `"NY/NJ"`       |

Esto solo afecta a las strings de `hostCity` en `WORLD_CUP_MATCHES`. La función `m()` valida contra `REGION_BY_CITY`, que **ya está actualizado** en este zip con las nuevas claves cortas.

⚠️ Si tras el cambio el build falla con `Unknown city: "CDMX"` u otro error similar, significa que el orden de despliegue no fue correcto: el `lib/config/regions.ts` actualizado debe estar desplegado **antes** que el `schedule.ts` renombrado. Por eso este zip incluye `regions.ts` actualizado — descomprímelo, edita `schedule.ts`, commitea ambos juntos en el mismo push.

---

## ✅ Cambios incluidos en este zip

### Sistema de usuarios real

- **`sql/003_create_users.sql`**: tabla `users` + seeds con bcrypt hashes verificados
- **`app/api/auth/login/route.ts`**: `POST /api/auth/login` con bcrypt.compare + delay anti-timing
- **`app/api/auth/me/route.ts`**: `GET /api/auth/me?id=xxx` para hidratar contexto al recargar
- **`lib/users.ts`**: API cliente con `loginAsync` + `fetchUserById` + stubs sync con warning
- **`components/auth-provider.tsx`**: nuevo hook `loginAsync` + flag `isHydrating` + sigue siendo compatible con código antiguo (la firma síncrona `login(u, p): boolean` se mantiene pero ahora simula con setTimeout interno)
- **`app/mi-club/page.tsx`**: usa `loginAsync` y muestra errores reales del backend

### Resultados

- **`app/resultados/page.tsx`**: paleta de sedes restaurada con `getCityColor` + `getCityBgColor`. Los badges de sede vuelven a tener color (turquesa Oeste, verde Centro, naranja Este).

### Sedes renombradas

- **`lib/config/regions.ts`**: claves `"CDMX"` y `"NY/NJ"` reemplazan a las largas. Los aliases largos (`"Ciudad de México"`, `"Mexico City"`, `"East Rutherford"`...) siguen aceptándose como entrada por `normalizeCity()` para compat con la API-Football.

---

## 🔐 Notas de seguridad (importante leer)

El sistema de auth migrado **es funcional pero NO es seguridad de verdad**. Por dos razones:

1. **El estado de sesión vive en `localStorage`**: cualquiera con DevTools puede setear `localStorage["penita_user"] = "u_tester"` y entrar como tester sin saber la contraseña. Esto era cierto antes y sigue siendo cierto. Para arreglarlo de verdad haría falta cookies httpOnly + JWT firmado del lado servidor.

2. **El bypass de `/api/auth/me`**: cualquiera puede pegar `GET /api/auth/me?id=u_canallita` desde un cliente no autenticado y obtener el registro del admin (sin password_hash, eso sí). No es información sensible pero sí permite enumerar IDs.

**Si quieres seguridad real**, el siguiente paso sería:
1. Cookie httpOnly `session_token` firmada con un secret en `.env`
2. Endpoint `POST /api/auth/login` que setee la cookie en lugar de devolver el user
3. Endpoint `GET /api/auth/me` que **lea la cookie** en lugar de aceptar `?id=`
4. Middleware Next.js que valide la cookie en rutas protegidas

Eso es 1-2 horas extras de trabajo. Pídelo cuando quieras y lo abordamos. **Lo que entrego ahora cumple lo que pediste** ("BBDD de usuarios y contraseñas") y mejora el patrón existente, pero no es producción para datos sensibles.

---

## ✅ Verificación post-deploy

1. **Login nuevo usuario**: entra a `/mi-club`, login con `tester / test1`. Debería entrarte y dejarte crear una porra.
2. **Login admin sigue funcionando**: `/admin/login` con `canallita / oyarsexo` → cookie de admin se setea (no toca el sistema nuevo, sigue por su `/api/admin/login`).
3. **Resultados**: en `/resultados` los badges de "CDMX" y "NY/NJ" se ven con color de región (verde y naranja respectivamente).
4. **Demos eliminados**: en `/clasificacion` solo aparece tu porra real (la que tienes guardada). No hay Carlos_M, Laura_G, etc.

Si algo falla en el build, pega el log de Vercel.

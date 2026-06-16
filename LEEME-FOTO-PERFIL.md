# Foto de perfil de usuario (avatar)

## Archivos (12: 2 endpoints nuevos, 1 componente nuevo, resto modificados)

| Archivo | Estado |
|---|---|
| `app/api/auth/avatar/route.ts` | Nuevo — sube/quita la foto (POST) |
| `app/api/auth/avatars/route.ts` | Nuevo — mapa userId→foto para listados |
| `components/avatar-uploader.tsx` | Nuevo — control de subida con recorte |
| `app/api/auth/me/route.ts` | Mod — devuelve avatarUrl |
| `app/api/auth/login/route.ts` | Mod — devuelve avatarUrl |
| `components/auth-provider.tsx` | Mod — avatarUrl en User + updateAvatar() |
| `components/ui.tsx` | Mod — InitialsAvatar muestra foto si la hay |
| `app/mi-club/page.tsx` | Mod — uploader en la cabecera de usuario |
| `app/clasificacion/page.tsx` | Mod — avatares en el ranking |
| `app/resultados/page.tsx` | Mod — avatares en predicciones |
| `lib/data.ts` | Mod — avatarUrl en User y Team |
| `lib/use-scored-participants.ts` | Mod — inyecta foto en cada participante |

Requiere los zips anteriores aplicados.

## Cómo funciona

1. BBDD: se añade sola la columna users.avatar_url (text) con
   "alter table ... add column if not exists" la primera vez que se usa. No
   hay que migrar nada a mano; las filas existentes quedan con NULL.
2. Subida (Mi Club): en la cabecera, la foto del usuario con un botón de
   cámara. Al elegir un JPG/PNG, el navegador lo recorta cuadrado y lo
   comprime a 128px JPEG (~5-15 KB) ANTES de subirlo, y lo guarda en la BBDD
   vía /api/auth/avatar. Así la base de datos no se infla.
3. Se ve en toda la app: la foto aparece al instante en Mi Club, y en la
   clasificación y en las predicciones de cada partido. Si un usuario no
   tiene foto, salen sus iniciales como hasta ahora.
4. Se puede cambiar o quitar la foto desde Mi Club.

## Seguridad

- El endpoint solo acepta data URLs de imagen (jpeg/png/webp); rechaza
  cualquier otra cosa (HTML, javascript:, URLs externas) — testeado.
- Límite de ~200 KB por imagen tras compresión, y de 8 MB en el archivo
  original antes de procesar.
- Cada usuario sube su propia foto, identificado por su id de sesión.

## Verificado

- Test de validación: acepta JPG/PNG/WEBP, rechaza GIF, data URLs de HTML/JS,
  URLs externas y base64 corrupto; detecta el límite de tamaño.
- tsc limpio, next build completo (ambos endpoints registrados) y los tests
  del repo siguen pasando.

## Nota
La foto se guarda como data URL en Postgres (lo pediste así). Para una peña
es perfecto. Si algún día creciera mucho y quisieras aligerar la BBDD, el
siguiente paso sería mover las fotos a un blob store (p. ej. Vercel Blob) y
guardar solo la URL — pero hoy no hace falta.

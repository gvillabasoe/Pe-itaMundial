# Botón "Importar finalizados" · Pack completo (sustituye TODO esto)

Este zip consolida los 3 archivos necesarios. Olvida los zips anteriores del botón:
sustituye/copia ESTOS TRES y listo.

| Archivo | Acción |
|---|---|
| `app/admin/page.tsx` | SUSTITUIR el tuyo (es tu archivo íntegro + el botón montado) |
| `lib/admin-import-fixtures.ts` | COPIAR (nuevo) |
| `components/admin/import-finished-button.tsx` | COPIAR (nuevo) |

Después: commit + push y espera a que Vercel termine el deploy (pestaña Deployments
→ estado "Ready"). Luego recarga el panel Admin con Ctrl+F5 (o Cmd+Shift+R en Mac).

## Dónde aparece

Admin → pestaña Resultados → tarjeta con el botón "Importar finalizados desde la API",
justo debajo del título "Resultados oficiales" y encima de los filtros Por grupo/Por fase.

## Checklist si sigue sin verse

1. ¿`app/admin/page.tsx` de tu repo contiene `ImportFinishedFromApi`? (búscalo en GitHub)
   → Si no: no sustituiste el page.tsx de este zip.
2. ¿Existen `lib/admin-import-fixtures.ts` y `components/admin/import-finished-button.tsx`
   en el repo? → Si no, el build de Vercel habrá FALLADO (módulo no encontrado) y estarás
   viendo el deploy anterior. Míralo en Vercel → Deployments.
3. ¿El último deploy en Vercel está en "Ready" (verde)? Si está en "Error", ábrelo y
   pega el log.
4. Recarga forzada del navegador (Ctrl+F5) — la página /admin es estática y el navegador
   puede tener cacheada la versión vieja.

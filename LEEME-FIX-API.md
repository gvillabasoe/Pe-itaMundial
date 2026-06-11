# Fix · Conexión de la API de resultados en vivo

## TL;DR

Sustituye `app/api/results/fixtures/route.ts` por el de este zip, sube el cambio y
redespliega. **No hay que configurar ninguna key ni registrarse en ningún sitio**: la
app se conecta sola a la API pública de ESPN (gratuita, sin key, sin free trial).

## Por qué fallaba (y por qué "siempre")

El problema tenía tres causas que se sumaban:

1. **API-Football devuelve sus errores con HTTP 200.** Cuando algo falla (key inválida,
   plan insuficiente...), responde `200 OK` con un objeto `errors` en el cuerpo y
   `response: []`. El código solo comprobaba el código HTTP, así que el error real se
   descartaba y solo veías el mensaje genérico.

2. **El plan GRATUITO de API-Football NO incluye la temporada 2026.** Si tu key es
   gratuita, la consulta `league=1&season=2026` falla siempre, da igual cuántas veces
   reintentes. Esta es casi seguro tu causa.

3. **Aunque conectara, los nombres de equipo no casaban.** Las APIs devuelven nombres en
   inglés ("Spain") y el frontend cruza los partidos de grupos contra el calendario en
   español ("España"). Sin normalización, los marcadores de grupos nunca se pintarían.

## Qué hace el nuevo route.ts (solo 1 archivo, mismo contrato)

La respuesta mantiene exactamente el mismo shape y estados (`live/calendar/error`), y
el frontend no se toca. Proveedores en cascada:

| Orden | Proveedor | Requiere | Coste |
|---|---|---|---|
| 1 | API-Football | `API_FOOTBALL_KEY` / `API_SPORTS_KEY` | Solo funciona con plan de pago (el free no cubre 2026) |
| 2 | football-data.org | `FOOTBALL_DATA_KEY` | Gratis para siempre (registro sin tarjeta) |
| 3 | **ESPN** | **Nada** | **Gratis, sin key, sin registro, sin trial** |

Como ESPN no necesita configuración, **funciona out-of-the-box**: si no tienes ninguna
key, la pestaña Resultados se conectará igualmente con datos en tiempo real del Mundial
(verificado hoy mismo con el México–Sudáfrica inaugural). Si algún día configuras una de
las keys, esa tendrá prioridad automáticamente.

Mejoras internas adicionales:

- Muestra el **error real** de cada proveedor en el campo `error` de la respuesta
  (visible abriendo `/api/results/fixtures` en el navegador).
- **Normaliza los nombres de equipo al español** con `normalizeName()` (ya existente
  en `lib/data.ts`) para que el merge del frontend encuentre los partidos.
- **Soporte automático de keys de RapidAPI** para API-Football (antes fallaban con 403).
- **Caché de 25 s** (memoria + CDN de Vercel): el frontend refresca cada 30 s por
  usuario y, con varios miembros de la peña a la vez, sin caché se agotaban las cuotas.

Nota sobre ESPN: es la API no oficial que alimenta espn.com. Es la opción gratuita más
completa y en tiempo real, pero al no ser oficial podría cambiar sin aviso. Por eso el
código la trata como un proveedor más dentro de la cascada con fallback al calendario:
si fallara, la app sigue mostrando los 104 partidos y el campo `error` te diría por qué.

## Instalación

1. Sustituye en tu repo el archivo `app/api/results/fixtures/route.ts` por el del zip
   (misma ruta).
2. Commit + push (o "Upload files" en GitHub web). Vercel redesplegará solo.
3. Abre `https://TU-DOMINIO/api/results/fixtures` y comprueba `"connection": "live"`
   y `"source": "espn"` (o el proveedor con key que tengas configurado).

## Diagnóstico rápido

| Verás | Significa |
|---|---|
| `"connection": "live"` | Conectado. ✅ El campo `source` dice qué proveedor está sirviendo. |
| `"connection": "error"` + campo `error` | Todos los proveedores fallaron — el mensaje dice exactamente por qué cada uno. |

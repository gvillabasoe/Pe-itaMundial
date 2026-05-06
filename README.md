# Peñita Mundial 2026

## Variables de entorno necesarias

Copia `.env.example` y rellena valores reales fuera del repositorio:

- `DATABASE_URL`: conexion PostgreSQL/Neon.
- `ADMIN_SESSION_SECRET`: secreto largo para firmar la cookie admin.
- `USER_SESSION_SECRET`: secreto largo para firmar la cookie de usuario.
- `ADMIN_USERNAME` y `ADMIN_PASSWORD_HASH`: fallback opcional para login admin si no hay admin en la tabla `users`.
- `DISABLE_RUNTIME_SCHEMA_MIGRATIONS=1`: opcional; desactiva la normalizacion/DDL runtime cuando las migraciones se gestionan fuera de la app.

No guardes credenciales reales ni hashes privados en archivos versionados.

## Comandos utiles

```bash
npm run check:flags
npm test
```

`npm test` ejecuta las regresiones criticas de scoring, guardado incompleto, deadline y autorizacion server-side sin depender de Next en runtime.

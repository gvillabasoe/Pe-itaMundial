# Peñita Mundial · IV Edición

Versión Vercel-ready de la porra del Mundial 2026, sin módulo de probabilidades.

## Qué incluye

- Inicio con logo, cuenta atrás, accesos rápidos, top 3, mini porra, actividad y sistema de puntuación completo.
- Clasificación con búsqueda, filtros, favoritos persistentes y ficha detallada de cada equipo.
- Resultados unificados con los 104 partidos, filtros por fase, región y ciudad, y enriquecimiento opcional con API-FOOTBALL.
- Mi Club con login demo, selector de equipo y tabs de resumen, partidos, grupos, eliminatorias, especiales y favoritos.
- Versus privado contra consenso o rival concreto.
- Tema dark/light persistente con anti-flash.
- Ruta legado `/mundial-2026` redirigida a `/resultados`.

## Credenciales demo

- Usuarios: los handles de `MOCK_USERS` en `lib/data.ts`
- Contraseña: cualquiera

## Variables de entorno

Solo una, y es opcional:

```bash
API_SPORTS_KEY=
```

Sin esa clave, la app funciona completa en modo demo con calendario estático y picks deterministas.

## Desarrollo local

```bash
npm install
npm run dev
```

## Estructura principal

```text
app/
  page.tsx
  clasificacion/page.tsx
  resultados/page.tsx
  mi-club/page.tsx
  versus/page.tsx
  mundial-2026/page.tsx
  api/results/fixtures/route.ts
components/
  auth-provider.tsx
  bottom-nav.tsx
  theme-provider.tsx
  theme-toggle.tsx
  ui.tsx
lib/
  data.ts
  flags.ts
  config/regions.ts
  config/match-status.ts
  worldcup/schedule.ts
public/
  Logo_Porra_Mundial_2026.webp
  flags/Inglaterra.png
```

## Notas

- Todas las banderas se muestran con emoji salvo Inglaterra, que usa `public/flags/Inglaterra.png`.
- La identidad visual usa el logo en una ruta segura sin caracteres problemáticos: `public/Logo_Porra_Mundial_2026.webp`.
- El módulo de probabilidades se ha eliminado por completo del código, la navegación y la documentación.

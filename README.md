# Peñita Mundial · IV Edición

Versión Vercel-ready de la porra del Mundial 2026, ya fusionada con la app premium en JSX y con módulo de probabilidades integrado.

## Qué incluye

- Inicio con logo, cuenta atrás, accesos rápidos, top 3, radar premium, actividad y sistema de puntuación completo.
- Clasificación con búsqueda, filtros, favoritos persistentes y ficha detallada de cada equipo.
- Resultados unificados con los 104 partidos del Mundial, filtros por fase, región y ciudad, hora siempre en Europe/Madrid, polling en vivo cada 15 segundos y prioridad visual de cualquier marcador guardado desde Admin.
- Mi Club con login demo, selector de equipo, tabs de resumen, partidos, grupos, eliminatorias, especiales y favoritos, además de acceso directo a Admin.
- Admin rediseñado con editor de resultados oficiales para los 104 partidos, filtros por grupo o fase, posiciones de grupos, eliminatorias, final y especiales.
- Probabilidades de ganador vía Polymarket, con API interna en `/api/probabilities`, refresco periódico, hero premium, histórico y shortlist filtrada.
- Tema dark/light persistente con anti-flash.
- Ruta legado `/mundial-2026` redirigida a `/resultados`.
- Banderas PNG reales para toda la app usando los assets de `public/flags`; si falta un archivo concreto, la interfaz muestra un marcador neutro de texto, no emojis.
- Documentación técnica de API-FOOTBALL para el Mundial 2026 incluida en `docs/api-football-world-cup-2026.md`.

## Credenciales demo

- Usuarios: los handles de `MOCK_USERS` en `lib/data.ts`
- Contraseña: cualquiera

## Variables de entorno

```bash
DATABASE_URL=
API_SPORTS_KEY=
API_FOOTBALL_KEY=
POLYMARKET_GAMMA_BASE=https://gamma-api.polymarket.com
```

Notas:

- `DATABASE_URL` activa la persistencia real en Neon / Postgres para `user_teams` y `admin_results`.
- `API_SPORTS_KEY` o `API_FOOTBALL_KEY` habilitan las llamadas server-side a API-FOOTBALL para el Mundial 2026.
- Si la API no responde o no hay clave configurada, la app mantiene el calendario base del Mundial y puede seguir mostrando los resultados oficiales cargados manualmente desde Admin.
- `POLYMARKET_GAMMA_BASE` es opcional. La lectura de mercados se hace contra la Gamma API pública de Polymarket; solo se deja como override por si quieres apuntar a otro host compatible.

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
  admin/page.tsx
  versus/page.tsx
  probabilidades/page.tsx
  mundial-2026/page.tsx
  api/results/fixtures/route.ts
  api/admin-results/route.ts
  api/probabilities/route.ts
  api/worldcup-probabilities/route.ts
components/
  auth-provider.tsx
  bottom-nav.tsx
  theme-provider.tsx
  theme-toggle.tsx
  ui.tsx
  worldcup/match-card.tsx
lib/
  admin-results.ts
  scoring.ts
  use-scored-participants.ts
  data.ts
  flags.ts
  probabilities/polymarket.ts
  probabilities/team-config.ts
  predictions/team-config.ts
  config/regions.ts
  config/match-status.ts
  worldcup/schedule.ts
public/
  Logo_Porra_Mundial_2026.webp
  flags/*.png
docs/
  api-football-world-cup-2026.md
```

## Notas

- La navegación principal mantiene 5 ítems en la barra inferior: Inicio, Ranking, Resultados, Mi Club y Versus. Probabilidades queda accesible desde la home y por ruta directa.
- La identidad visual usa el logo en una ruta segura sin caracteres problemáticos: `public/Logo_Porra_Mundial_2026.webp`.
- El proyecto está preparado para desplegar en Vercel tal cual, con fallback demo cuando no hay claves configuradas.

# Peñita Mundial · IV Edición

Versión Vercel-ready de la porra del Mundial 2026, ya fusionada con la app premium en JSX y con módulo de probabilidades integrado.

## Qué incluye

- Inicio con logo, cuenta atrás, accesos rápidos, top 3, radar premium, actividad y sistema de puntuación completo.
- Clasificación con búsqueda, filtros, favoritos persistentes y ficha detallada de cada equipo.
- Resultados unificados con los 104 partidos, filtros por fase, región y ciudad, hora siempre en Europe/Madrid y un fixture de prueba Crystal Palace vs West Ham con resolución dinámica de fixture_id, polling real mientras está en vivo, marcador con fallback 0-0 y auto-hide solo tras 2 horas + FT/AET/PEN.
- Mi Club con login demo, selector de equipo y tabs de resumen, partidos, grupos, eliminatorias, especiales y favoritos.
- Versus privado contra consenso o rival concreto.
- Probabilidades de ganador vía Polymarket, con API interna en `/api/probabilities`, refresco periódico, hero premium, histórico y shortlist filtrada.
- Tema dark/light persistente con anti-flash.
- Ruta legado `/mundial-2026` redirigida a `/resultados`.
- Banderas PNG para todas las selecciones disponibles en `public/flags`, no solo Inglaterra. Si falta alguna bandera concreta, la app cae de forma automática al emoji correspondiente.

## Credenciales demo

- Usuarios: los handles de `MOCK_USERS` en `lib/data.ts`
- Contraseña: cualquiera

## Variables de entorno

```bash
API_SPORTS_KEY=
POLYMARKET_GAMMA_BASE=https://gamma-api.polymarket.com
```

Notas:

- `API_SPORTS_KEY` permite sobrescribir la clave server-side usada para el test fixture en vivo. Si la API no responde, la app mantiene el calendario base del Mundial y oculta el test fixture para no simular datos.
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
  versus/page.tsx
  probabilidades/page.tsx
  mundial-2026/page.tsx
  api/results/fixtures/route.ts
  api/probabilities/route.ts
  api/worldcup-probabilities/route.ts
components/
  auth-provider.tsx
  bottom-nav.tsx
  theme-provider.tsx
  theme-toggle.tsx
  ui.tsx
lib/
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
```

## Notas

- La navegación principal mantiene 5 ítems en la barra inferior: Inicio, Ranking, Resultados, Mi Club y Versus. Probabilidades queda accesible desde la home y por ruta directa.
- La identidad visual usa el logo en una ruta segura sin caracteres problemáticos: `public/Logo_Porra_Mundial_2026.webp`.
- El proyecto está preparado para desplegar en Vercel tal cual, con fallback demo cuando no hay claves configuradas.

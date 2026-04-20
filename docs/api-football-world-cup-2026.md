# API-FOOTBALL · FIFA World Cup 2026

Guía interna de integración para esta app.

## Identificadores fijos del torneo

- `league=1`
- `season=2026`
- Base URL: `https://v3.football.api-sports.io`
- Header: `x-apisports-key: <API_KEY>`

## Reglas de integración en este proyecto

1. Todas las llamadas relacionadas con el Mundial deben usar siempre `league=1` y `season=2026`.
2. No mezclar fixtures de otras ligas o temporadas.
3. Antes de usar endpoints avanzados, comprobar cobertura con:
   - `GET /leagues?id=1&season=2026`
4. Para partidos en vivo, refrescar cada 15 segundos.
5. El `fixture.fixture.id` es el identificador principal para enlazar datos entre endpoints.

## Endpoints principales

### Cobertura

- `GET /leagues?id=1&season=2026`

Usar para validar `coverage.fixtures.events`, `coverage.fixtures.lineups`, `coverage.fixtures.statistics_fixtures`, `coverage.fixtures.statistics_players`, etc.

### Calendario completo

- `GET /fixtures?league=1&season=2026`

Debe devolver los 104 partidos del Mundial.

### Partidos en vivo

Dos referencias válidas:

- `GET /fixtures?live=all` y filtrar por `league=1`
- `GET /fixtures?league=1&season=2026&status=1H-HT-2H-ET-P-BT-LIVE`

En este proyecto usamos la segunda para acotar directamente al Mundial.

### Detalle de partido

- `GET /fixtures?id=FIXTURE_ID`

### Batch de partidos

- `GET /fixtures?ids=ID1-ID2-ID3`
- Máximo 20 IDs por request.

### Clasificación de grupos

- `GET /standings?league=1&season=2026`

### Equipos participantes

- `GET /teams?league=1&season=2026`

### Rondas y fase actual

- `GET /fixtures/rounds?league=1&season=2026`
- `GET /fixtures/rounds?league=1&season=2026&current=true`

## Proceso recomendado para vivo

1. Obtener los partidos en vivo del Mundial:

```ts
GET /fixtures?league=1&season=2026&status=1H-HT-2H-ET-P-BT-LIVE
```

2. Agrupar los `fixture.id` en bloques de 20.

3. Resolver detalles por batch:

```ts
GET /fixtures?ids=ID1-ID2-ID3
```

4. Fusionar el detalle vivo con el calendario principal por `fixture.fixture.id`.

## Campos clave que usa la app

- Fixture ID: `fixture.fixture.id`
- Equipos: `teams.home`, `teams.away`
- Goles: `goals.home`, `goals.away`
- Estado corto: `fixture.status.short`
- Minuto: `fixture.status.elapsed`
- Ciudad: `fixture.venue.city`
- Ronda: `league.round`

## Estados en vivo considerados

```txt
1H-HT-2H-ET-P-BT-LIVE
```

## Política de fallback de la app

Si no hay clave o la API falla:

- se muestra el calendario base local del Mundial 2026,
- se mantienen filtros por fase, grupo y ciudad,
- cualquier marcador guardado manualmente en Admin tiene prioridad visual y de puntuación.

## Archivos relacionados

- `app/api/results/fixtures/route.ts`
- `app/resultados/page.tsx`
- `app/admin/page.tsx`
- `lib/admin-results.ts`
- `lib/scoring.ts`

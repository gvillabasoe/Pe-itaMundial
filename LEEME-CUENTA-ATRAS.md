# Cuenta atrás encadenada en la home

## Archivo (formato del repo, sustitución directa)

| Archivo | Estado |
|---|---|
| `app/page.tsx` | Modificado — única pieza tocada: la tarjeta de la cuenta atrás |

## Comportamiento

La tarjeta dorada de la home ahora encadena automáticamente, en el segundo exacto en
que cada cuenta llega a cero:

1. México vs Sudáfrica → 11 de junio · 21:00 (Madrid)   ← la actual
2. España vs Cabo Verde → 15 de junio · 18:00 (Madrid)
3. España vs Arabia Saudí → 21 de junio · 18:00 (Madrid)
4. Uruguay vs España → 27 de junio · 02:00 (Madrid)

En cada cambio se actualizan las banderas, los nombres y la fecha/hora. Equipos y
horarios salen del calendario oficial del propio repo (lib/worldcup), no hay fechas
duplicadas a mano. Tras el inicio del Uruguay–España, la última cuenta se queda a 00
(mismo comportamiento que tenía la tarjeta original).

Nada más cambia: diseño de la tarjeta, botones, enlaces y resto de la home intactos.

# Tarjeta de la home: cuenta atrás → marcador en vivo → siguiente partido

## Archivos (formato del repo, sustitución directa)

| Archivo | Estado |
|---|---|
| `app/page.tsx` | Modificado — sustituye al de la entrega anterior de la cuenta atrás |
| `lib/home-countdown.ts` | Nuevo — lógica de la tarjeta (testeada) |

## Comportamiento por cada partido de la secuencia
(México–Sudáfrica → España–Cabo Verde → España–Arabia Saudí → Uruguay–España)

1. **Antes del partido** → cuenta atrás con fecha/hora Madrid (como hasta ahora).
2. **Durante el partido** → la tarjeta muestra el marcador en vivo con el badge de
   estado (1ª parte · 23', Descanso, 2ª parte…) con el punto rojo pulsante. Usa el
   mismo endpoint que la pestaña Resultados (/api/results/fixtures) refrescando cada
   30 s, y solo hace peticiones mientras hay partido — el resto del tiempo, cero
   tráfico extra.
3. **Al acabar** → muestra "Finalizado" con el resultado final durante 1 HORA y
   después pasa solo a la cuenta atrás del siguiente.

## Redes de seguridad incluidas

- Si la API se cae durante un partido: muestra "– : –" con "Esperando datos…" y, como
  máximo a las 3 h del kickoff, pasa al siguiente aunque no haya recibido el final.
- Si la API dice que el partido sigue en juego, el corte de las 3 h NO se aplica
  (partidos con mucho descuento o interrupciones largas).
- Si abres la web días después, salta directa al partido que toque sin pasos
  intermedios.
- Si la API trae local/visitante invertido, el marcador se voltea al orden oficial.

Diseño: misma tarjeta dorada, mismos botones y resto de la home intactos.

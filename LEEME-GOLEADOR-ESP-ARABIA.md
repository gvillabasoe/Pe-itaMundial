# Primer goleador español → España–Arabia Saudí (+ fix de solapamiento)

## Archivo (sustitución directa — 1 archivo)

| Archivo | Estado |
|---|---|
| `app/resultados/page.tsx` | SUSTITUIR |

(`spain2-preview.png` es solo muestra del aspecto.)

## Qué cambia

1. El pick "Primer Goleador Español" se ha movido del España–Cabo Verde
   (id 14) al **España–Arabia Saudí (id 38)**, ya que en el primero no hubo
   gol español.

2. **Fix de solapamiento**: antes el nombre del goleador iba en la columna
   derecha (junto al marcador) con texto sin recorte, y con nombres largos
   ("Lamine Yamal") se montaba sobre el @usuario. Ahora ocupa una **línea
   propia a todo el ancho** debajo de cada fila, separada por un borde sutil:

     1.ER GOLEADOR ESP   Lamine Yamal

   Así no compite por espacio con el marcador ni con el nombre, y trunca con
   "…" si fuera larguísimo. También se añadió recorte al @usuario por si acaso.

El "Minuto Primer Gol" del México–Sudáfrica no se toca (es corto y nunca se
solapaba).

## Verificado

`tsc --noEmit` limpio, `next build` completo y previsualización con nombres
largos confirmando que ya no hay solapamiento.

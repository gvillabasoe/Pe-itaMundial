# Botón conmutable: Importar finalizados ⇄ Deshacer importación

## Archivos (formato del repo, sustitución directa)

| Archivo | Estado |
|---|---|
| `lib/admin-import-fixtures.ts` | Modificado — añade la lógica de deshacer |
| `components/admin/import-finished-button.tsx` | Modificado — botón ahora conmutable |

`app/admin/page.tsx` NO cambia: el componente usa las mismas props, así que el que ya
tienes (con las 2 líneas integradas) sigue valiendo tal cual.

## Comportamiento

1. **Importar finalizados desde la API** → rellena los marcadores y el botón pasa al
   estado activo "Deshacer importación".
2. **Deshacer importación** → devuelve cada partido importado a lo que había antes,
   y el botón vuelve a su estado normal.
3. En ambos casos no se guarda nada: revisas y pulsas "Guardar cambios" como siempre.

Reglas del deshacer:

- Solo revierte los partidos que siguen EXACTAMENTE como los dejó la importación. Si
  después de importar corregiste alguno a mano, tu edición se respeta y no se revierte
  (el mensaje te dice cuántos se respetaron).
- Los resultados que ya tenías confirmados antes de importar nunca se tocaron, así que
  el deshacer tampoco los toca.
- El deshacer está disponible mientras permanezcas en la pestaña Resultados. Si cambias
  de pestaña o recargas, la referencia de esa importación se descarta (los marcadores
  importados siguen en el formulario; siempre puedes vaciarlos a mano con la X de cada
  partido o no guardar).

## Verificado contra tu repo real

- Tests de importar/deshacer con los módulos reales de `lib/admin-results`: todos pasan,
  incluidos los casos de edición manual post-importación y resultados previos confirmados.
- `tsc --noEmit` limpio y `next build` de producción completo sin errores.

# R6 Dashboard
1. `raw/seasonData.js` y tus `data_XX.js` en `raw/allMatches/`.
2. `npm install` (solo la primera vez)
3. `npm run data`     -> ingest (raw -> JSON) + derived (squads.json y aggregates.json). Imprescindible tras añadir datos.
   `npm run derived`  -> solo regenera squads/aggregates a partir de public/data/players.
   `npm run seasons`  -> comprueba las fechas de season contra los resets reales de rating.
4. `npm run dev`

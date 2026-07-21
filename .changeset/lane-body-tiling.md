---
'@buildtovalue/core': minor
'@buildtovalue/react': minor
'@buildtovalue/lint': minor
---

#154 — lanes now tile the pool body at design time, and the lint names the gap.

- core: lane/pool body geometry as ONE shared source (`POOL_TITLE_BAND`,
  `poolBodyOf`, `poolContainingRect`, `lanesOfPool`, `tileLaneRects`,
  `lanesTileBody`) — consumed by both the react gesture and the lint rule so
  interaction and diagnosis never drift.
- react: creating a lane inside a pool snaps it to the pool body
  (`x = pool.x + 30`, `width = pool.width − 30`) and tiles the body equally
  with its siblings; resizing a lane keeps the requested height and re-tiles
  the siblings; resizing a pool reflows its lanes — each case inside the SAME
  gesture (one composite, one undo). Import is untouched: imported DI stays
  sovereign.
- lint: new etiquette rule `LANE_BODY_TILING` (warning) flags a lane whose
  bounds do not partition the pool body (wrong x/width, vertical gap, overlap,
  remainder), with the mechanical quick-fix "ajustar ao corpo do pool" (one
  composite of ordinary resize commands). Etiquette profile 1.4.0 → 1.5.0.

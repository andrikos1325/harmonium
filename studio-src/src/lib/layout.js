/* LAYOUT ARITHMETIC shared by the page and section editors (0.88 —
   docs/design/notes/tablet-layout.md §3, §14). Twins of the engine's
   ui/tiles.js so every label tells the truth the engine will draw:
   colsAt is colsFor (reference 480, 24 grid padding, 10 gap, cap 12);
   wallColsOf is the wall's count as the engine resolves it — an
   explicit `wide_columns` on the section, else the page's, else the
   tile-size arithmetic at the given width. */
const REF_W = 480, PAD = 24, GAP = 10, MAX = 12;
const tileW = (c) => (REF_W - PAD - (c - 1) * GAP) / Math.max(1, c);
/* an explicit `tile_width` (px, v0.68) WINS over the size a count
   implies — the engine's tileWidthOf rule (2026-09-14, his Bar board:
   a Presets section carrying tile_width: 380 from the Code tab drew
   by that width while Section settings said Large — the field was
   invisible; now it is shown and counted) */
export const colsAt = (c, width, tileWidth) => {
  const tw = +tileWidth > 0 ? +tileWidth : tileW(c);
  return Math.max(c, Math.min(MAX, Math.floor((width - PAD + GAP) / (tw + GAP))));
};
/* a page shown only on wall tablets never draws on a remote, so its
   remote tile size is moot and the wall count is the whole story */
export const tabletOnly = (scr) =>
  Array.isArray(scr?.surfaces) && scr.surfaces.length > 0 && !scr.surfaces.includes("remote");
/* THE WALL THE HINTS TALK ABOUT (2026-09-14 — his Bar board drew 3
   across while the hint said 2: the hint assumed a 1280 wall, his
   wall profile carries its measured viewport). The previewed profile,
   when it is a tablet with a viewport of its own, is the wall; else
   the 1280 reference. `remotes` and `device` come from the caller
   (app.draft.remotes, app.device) so this file stays a pure helper. */
export const wallWidthOf = (remotes, device) => {
  const r = remotes?.[device];
  const v = r?.skin?.viewport || r?.viewport;
  return r?.view === "tablet" && v && +v.w > 0 ? +v.w : 1280;
};
/* the wall's column count for a section (sec may be null = the page) */
export const wallColsOf = (scr, sec, width = 1280) => {
  const sw = parseInt(sec?.wide_columns);
  if (sw > 0) return sw;
  const pw = parseInt(scr?.grid?.wide_columns);
  if (pw > 0) return pw;   /* the page's count rules the wall; a section's tile size is a remote fact */
  if (sec?.columns) return colsAt(sec.columns, width, sec.tile_width);
  return colsAt(scr?.grid?.columns || 2, width, scr?.grid?.tile_width);
};

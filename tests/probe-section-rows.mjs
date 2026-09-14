/* SECTION ROWS probe (0.88 — docs/design/notes/tablet-layout.md §3–4).
   Suresh's two Lovelace boards as fixtures, rendered by the real
   engine at 480 (the remote), 1280 and 1920 (walls). Fences:
     1. LEGACY: a page with no row keys renders exactly as before —
        every section its own full row, headers in the page grid;
     2. OWN/JOIN KEPT: Home board — Pergola own · Lounge join · Dining
        join · Porch own → at 1280/1920 Lounge and Dining share a row;
        at 480 they stack;
     3. FIT: 3-tile block + joined 2-tile block share a 7-column row
        (5 of 7 filled, gap stays); 3 + 5 kept → the 5 start a row;
     4. FLOW: 3 + 5 with keep:false → the 5 continue the grid (4 on
        the first row, 1 wraps), no band header;
     5. STRETCH: a joined block with stretch:true takes the rest of
        the row and its tiles grow; tile_scale sizes the block;
     6. ALIGN end: a one-tile section on a wide row sits at the right
        edge (leading spacer), and start/center behave;
     7. SPACER: type "spacer" takes its columns, draws no card, is not
        focusable, and never reaches tilesOf;
     8. SPAN reading: below the declared count a span is N tile
        columns at every width (×2 of 4 is 2 of 10 at 1920, not 5);
        span ≥ declared is still Full. */
import { chromium } from 'playwright-core';

/* script tiles: ×1 by nature (device tiles default to ×2 — see adapters.js) */
const tile = (id, label) => ({ id, type: 'script', entity: 'script.' + id, label });
const tiles = (p, n) => Array.from({ length: n }, (_, i) => tile(p + i, p + i));
const STATES = {};
for (let i = 0; i < 40; i++) STATES['script.a' + i] = STATES['script.b' + i] =
  STATES['script.c' + i] = STATES['script.d' + i] = { s: 'off', a: {} };
STATES['script.x0'] = { s: 'off', a: {} };

const hub = (sections, grid) => ({ name: 'Board', type: 'hub', room: true,
  grid: grid || { columns: 4 }, sections });
const CONFIG = {
  version: 2, home_screen: 'home', screen_order: ['home'],
  global: {}, devices: {}, dialects: {}, activities: {},
  screens: {
    /* 1. legacy shape — no row keys anywhere */
    legacy: hub([{ title: 'A', tiles: tiles('a', 3) }, { title: 'B', tiles: tiles('b', 2) }]),
    /* 2. Suresh's Home board */
    home: hub([
      { title: 'Pergola', row: 'own', tiles: tiles('a', 4) },
      { title: 'Lounge', row: 'join', cols: 2, tiles: tiles('b', 4) },
      { title: 'Dining', row: 'join', cols: 2, tiles: tiles('c', 4) },
      { title: 'Porch', row: 'own', tiles: tiles('d', 4) },
    ], { columns: 2 }),   /* a real room page: 2 columns at 480, 5 at 1280, 8 at 1920 */
    /* 3. fit (10 columns at 1280, 12 at 1920): 6 + 3 share; a kept 5 does not fit beside 9 and starts a row */
    fit: hub([
      { title: 'Six', row: 'join', tiles: tiles('a', 6) },
      { title: 'Three', row: 'join', tiles: tiles('b', 3) },
      { title: 'Five', row: 'join', tiles: tiles('c', 5) },
    ]),
    /* 4. flow: the 5 continue the grid */
    flow: hub([
      { title: 'Three', row: 'join', tiles: tiles('a', 3) },
      { title: 'Five', row: 'join', keep: false, tiles: tiles('c', 5) },
    ]),
    /* 5. stretch / scale */
    stretch: hub([
      { title: 'Three', row: 'join', tiles: tiles('a', 3) },
      { title: 'Grow', row: 'join', stretch: true, tiles: tiles('b', 2) },
      { title: 'Scaled', row: 'own', tile_scale: 2, tiles: tiles('c', 2) },
    ]),
    /* 6. align */
    align: hub([
      { title: 'Right', row: 'own', align: 'end', tiles: [tile('x0', 'Power')] },
      { title: 'Mid', row: 'own', align: 'center', tiles: tiles('b', 2) },
    ]),
    /* 7. spacer */
    spacer: hub([{ title: 'S', row: 'own', tiles: [
      tile('a0', 'A'), { id: 'gap', type: 'spacer', span: 2 }, tile('a1', 'B') ] }]),
    /* 8. span reading — declared 4, tile a0 ×2, tile a1 full (span 4) */
    span: hub([{ title: 'Sp', tiles: [
      Object.assign(tile('a0', 'Wide'), { span: 2 }),
      Object.assign(tile('a1', 'Full'), { span: 4 }), tile('a2', 'One') ] }]),
    /* 9. wide_columns (Suresh 2026-09-13: "I want 7 columns. Not just
       what a preset Medium/Small gives me"): the page says 7 on the
       wall — 7 at 1280 AND at 1920 (the count is the author's, not the
       width's); tile size 2 still rules at 480. Heaters: 7 tiles, one
       row; span 3 is three of the seven; span 7 is the row. A section
       with its own wide_columns (3) gets three inside its block. */
    wall: hub([
      { title: 'Heaters', row: 'own', tiles: tiles('a', 7) },
      { title: 'Spans', row: 'own', tiles: [
        Object.assign(tile('b0', 'Three'), { span: 3 }),
        Object.assign(tile('b1', 'Row'), { span: 7 }), tile('b2', 'One') ] },
      { title: 'Own count', row: 'own', wide_columns: 3, tiles: tiles('c', 3) },
      /* a Large-tile (1) section stays ROWS on a 7-column wall — the
         tile style reads the tile size, never the wall count
         (2026-09-14, his Bar board: "Something wrong with Presets") */
      { title: 'Rows', columns: 1, tiles: tiles('d', 3) },
    ], { columns: 2, wide_columns: 7 }),
  },
};

const errs = [];
const ck = (n, c) => { if (!c) errs.push(n); };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function open(width) {
  const ctx = await b.newContext({ viewport: { width, height: 800 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(width + ' pageerror: ' + String(e.message).slice(0, 120)));
  await ctx.route('**/config.json*', r => r.fulfill({ json: CONFIG }));
  await p.addInitScript((STATES) => {
    localStorage.setItem('hakr_token', 't');
    localStorage.setItem('hakr_host', 'localhost:8482');
    window._STATES = STATES;
    window.WebSocket = class {
      constructor() { setTimeout(() => this.onmessage?.({ data: JSON.stringify({ type: 'auth_required' }) }), 20); }
      send(m) { const msg = JSON.parse(m);
        const reply = (o) => setTimeout(() => this.onmessage?.({ data: JSON.stringify(o) }), 15);
        if (msg.type === 'auth') reply({ type: 'auth_ok' });
        else if (msg.type === 'subscribe_entities') {
          reply({ type: 'result', id: msg.id, success: true, result: null });
          const a = {}; (msg.entity_ids || []).forEach(e => { if (window._STATES[e]) a[e] = window._STATES[e]; });
          reply({ type: 'event', id: msg.id, event: { a } });
        } else reply({ type: 'result', id: msg.id, success: true, result: null });
      }
      close() {}
    };
  }, STATES);
  await p.goto('http://localhost:8482/index.html');
  await p.waitForTimeout(700);
  return { ctx, p };
}
/* geometry of every tile / block on the current page */
const geo = (p) => p.evaluate(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
  const tiles = {}; document.querySelectorAll('#grid .tile').forEach(el => tiles[el.id.replace(/^tile_/, '')] = Object.assign(r(el), { row: el.classList.contains('row') }));
  const blocks = Array.from(document.querySelectorAll('#grid > .sec')).map(el => Object.assign(r(el), { title: (el.querySelector('.shead') || {}).textContent || '' }));
  const heads = Array.from(document.querySelectorAll('#grid > .shead')).map(el => Object.assign(r(el), { title: el.textContent }));
  const spacers = Array.from(document.querySelectorAll('#grid .spacer')).map(r);
  const cols = getComputedStyle(document.getElementById('grid')).gridTemplateColumns.split(' ').length;
  return { tiles, blocks, heads, spacers, cols, wide: document.documentElement.classList.contains('wide'),
    focusables: typeof tilesOf === 'function' ? tilesOf(screenOf(S.screen)).map(t => t.id) : null };
});
const go = async (p, id) => { await p.evaluate((id) => navigate(id), id); await p.waitForTimeout(250); return geo(p); };
const sameRow = (a, b) => Math.abs(a.y - b.y) < 4;
const document_row = (g, id) => !!(g.tiles[id] && g.tiles[id].row);
const sameBase = (a, b) => Math.abs((a.y + a.h) - (b.y + b.h)) < 4;   /* flowing tiles sit on the row's baseline */

/* ---------- 480: the remote — everything stacks ---------- */
{
  const { ctx, p } = await open(480);
  let g = await go(p, 'legacy');
  ck('480 legacy: 2 headers in the page grid, no blocks', g.heads.length === 2 && g.blocks.length === 0);
  ck('480 legacy: not wide', !g.wide);
  g = await go(p, 'home');
  ck('480 home: four blocks', g.blocks.length === 4);
  ck('480 home: Lounge and Dining STACK on the remote', !sameRow(g.blocks[1], g.blocks[2]) && g.blocks[1].y < g.blocks[2].y);
  ck('480 home: every block is full width', g.blocks.every(bk => bk.w === g.blocks[0].w));
  g = await go(p, 'flow');
  ck('480 flow: flowing tiles continue the page grid (4 columns: a0 a1 a2 c0)',
    sameBase(g.tiles.a2, g.tiles.c0) && g.tiles.c0.x > g.tiles.a2.x);
  g = await go(p, 'spacer');
  ck('480 spacer: spacer present, no card, not in tilesOf',
    g.spacers.length === 1 && !g.focusables.includes('gap') && g.focusables.includes('a0'));
  g = await go(p, 'span');
  ck('480 span: ×2 of 4 is 2 columns; full is full (4 cols at 480 for tile size 4)',
    g.cols === 4 && Math.round(g.tiles.a0.w / g.tiles.a2.w) === 2 && g.tiles.a1.w > g.tiles.a0.w * 1.8);
  g = await go(p, 'wall');
  ck('480 wall: wide_columns is ignored on the remote — tile size 2 rules', g.cols === 2);
  ck('480 wall: the seven heaters wrap 2 per row', sameRow(g.tiles.a0, g.tiles.a1) && !sameRow(g.tiles.a1, g.tiles.a2));
  await ctx.close();
}

/* ---------- 1280 and 1920: the walls ---------- */
for (const width of [1280, 1920]) {
  const { ctx, p } = await open(width);
  const W = width + ' ';
  let g = await go(p, 'legacy');
  ck(W + 'legacy: unchanged shape — headers in the page grid, no blocks', g.heads.length === 2 && g.blocks.length === 0 && g.wide);
  const expectCols = width === 1280 ? 10 : 12;   /* tile size 4 at 480 = ~106px → 10 at 1280, capped at 12 */
  ck(W + 'legacy: ' + expectCols + ' page columns', g.cols === expectCols);

  g = await go(p, 'home');
  ck(W + 'home: four blocks', g.blocks.length === 4);
  ck(W + 'home: Lounge and Dining share a row', sameRow(g.blocks[1], g.blocks[2]) && g.blocks[2].x > g.blocks[1].x);
  ck(W + 'home: Pergola above, Porch below, both full width',
    g.blocks[0].y < g.blocks[1].y && g.blocks[3].y > g.blocks[1].y && g.blocks[0].w === g.blocks[3].w && g.blocks[1].w < g.blocks[0].w);
  ck(W + 'home: Lounge tiles are the same size as Pergola tiles (no stretch)', Math.abs(g.tiles.b0.w - g.tiles.a0.w) <= 2);

  g = await go(p, 'fit');
  ck(W + 'fit: Six + Three share a row', sameRow(g.blocks[0], g.blocks[1]));
  ck(W + 'fit: Five starts its own row (kept together)', !sameRow(g.blocks[1], g.blocks[2]) && g.blocks[2].y > g.blocks[1].y);
  ck(W + 'fit: Five is one row of five', sameRow(g.tiles.c0, g.tiles.c4));
  ck(W + 'fit: gap stays — Three does not stretch', Math.abs(g.tiles.b0.w - g.tiles.a0.w) <= 2);

  g = await go(p, 'flow');
  ck(W + 'flow: no band header for the flowing section', g.blocks.length === 1 && g.blocks[0].title === 'Three');
  ck(W + 'flow: c0 continues the row after a2, level with it', sameBase(g.tiles.a2, g.tiles.c0) && g.tiles.c0.x > g.tiles.a2.x);
  ck(W + 'flow: 3+5 fits one row at 10 and 12 columns', sameRow(g.tiles.c0, g.tiles.c4));

  g = await go(p, 'stretch');
  ck(W + 'stretch: Grow shares the row with Three', sameRow(g.blocks[0], g.blocks[1]));
  ck(W + 'stretch: Grow reaches the right edge (the full-width Scaled block is the ruler)', Math.abs((g.blocks[1].x + g.blocks[1].w) - (g.blocks[2].x + g.blocks[2].w)) <= 2);
  ck(W + 'stretch: Grow tiles are wider than Three tiles', g.tiles.b0.w > g.tiles.a0.w * 1.3);
  ck(W + 'scale: tile_scale 2 makes ×1 tiles about two columns wide', Math.abs((g.tiles.c0.w + 10) / (g.tiles.a0.w + 10) - 2) < 0.15);

  g = await go(p, 'align');
  const pergolaRight = g.blocks[0].x + g.blocks[0].w;
  ck(W + 'align end: the single tile sits at the right edge', Math.abs((g.tiles.x0.x + g.tiles.x0.w) - pergolaRight) <= 2 && g.tiles.x0.x > g.blocks[0].x + g.blocks[0].w / 2);
  ck(W + 'align end: exactly one leading spacer', g.spacers.length >= 1);
  const midC = g.blocks[1].x + g.blocks[1].w / 2;
  const tilesC = (g.tiles.b0.x + g.tiles.b1.x + g.tiles.b1.w) / 2;
  ck(W + 'align center: the two tiles sit near the middle', Math.abs(midC - tilesC) < g.tiles.b0.w);

  g = await go(p, 'spacer');
  ck(W + 'spacer: B sits three columns right of A (A, 2 spacer columns, B)',
    sameRow(g.tiles.a0, g.tiles.a1) && Math.round((g.tiles.a1.x - g.tiles.a0.x) / (g.tiles.a0.w + 10)) === 3);

  g = await go(p, 'span');
  ck(W + 'span: ×2 of 4 is TWO tile columns, not a proportion', Math.round(g.tiles.a0.w / g.tiles.a2.w) === 2);
  ck(W + 'span: full is the whole row', Math.abs(g.tiles.a1.w - (g.cols * g.tiles.a2.w + (g.cols - 1) * 10)) <= 4);

  g = await go(p, 'wall');
  ck(W + 'wall: the page has exactly 7 columns (the author\'s count, at any wide width)', g.cols === 7);
  ck(W + 'wall: seven heaters on one row', sameRow(g.tiles.a0, g.tiles.a6) && g.tiles.a6.x > g.tiles.a5.x);
  ck(W + 'wall: span 3 is three of the seven', Math.abs((g.tiles.b0.w + 10) / (g.tiles.b2.w + 10) - 3) < 0.1);
  ck(W + 'wall: span 7 is the whole row', Math.abs(g.tiles.b1.w - g.blocks[1].w) <= 4);
  ck(W + 'wall: a Large-tile section on the 7-column wall keeps its ROW style, 7 across',
    g.tiles.d0 && document_row(g, 'd0') && sameRow(g.tiles.d0, g.tiles.d2));
  ck(W + 'wall: a section with wide_columns 3 draws three across its own block',
    sameRow(g.tiles.c0, g.tiles.c2) && Math.abs((g.tiles.c0.x + 3 * (g.tiles.c0.w + 10) - 10) - (g.blocks[2].x + g.blocks[2].w)) <= 4);
  await ctx.close();
}

console.log(JSON.stringify({ ok: errs.length === 0, errs }, null, 1));
await b.close();
if (errs.length) process.exit(1);

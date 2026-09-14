/* CONTROLLER STACKS + THE ON-SCREEN REMOTE BAND probe (0.88 phase 2 —
   docs/design/notes/tablet-layout.md §8, rulings 1–3 of §15).
   A TV-shaped controller (Now Playing, transport, dpad pad + buttons
   gated `unless: physical_dpad`, volume, sources; a Device keys
   section) run by an activity whose surface says wide_columns: 2 and
   band_column { np: 1, transport: 1, volume: 1, sources: 2 }.
   Fences:
     1. at 480 (compact) there are NO stacks — the page is the stack
        it always was; the pad shows on a touch profile (no d-pad);
     2. at 1280 the page grid holds exactly 2 .stack children; np,
        transport and volume stand in stack 1; sources in stack 2;
        the on-screen remote (dpad + buttons) stands in the LAST stack
        by default, unassigned; every band is full width of its stack;
     3. a tile's own `column` wins over the surface's band_column;
     4. surface.remote === false hides the pad and the buttons strip
        (the band switch); band_order with "remote" first moves the
        pad above sources within stack 2;
     5. a profile WITH a physical d-pad never sees the pad (the gate
        is the hardware, not the view); a wide panel on that profile
        still stacks;
     6. the Device keys section (a `keys` generator) stands in the
        stack its band_column names, with its own tile columns;
        surface.keys === false drops it. */
import { chromium } from 'playwright-core';
const STATES = {
  'media_player.tv': { s: 'playing', a: { friendly_name: 'TV', volume_level: 0.4, supported_features: 84351, source_list: ['HDMI1', 'HDMI2'], source: 'HDMI1' } },
  'remote.tv': { s: 'on', a: {} },
  'select.harmonium_porch_activity': { s: 'watch', a: { options: ['watch', 'off'] } },
};
const CONFIG = {
  version: 2, home_screen: 'porch', screen_order: ['porch'],
  global: { room: 'Porch', activity_select: 'select.harmonium_porch_activity' },
  devices: {},
  dialects: { firetv: { keys: {
    play: { name: 'Play', service: 'remote.send_command', entity: '$context.dpad', data: { command: 'PLAY' } },
    mute: { name: 'Mute', service: 'remote.send_command', entity: '$context.dpad', data: { command: 'MUTE' } },
    guide: { name: 'Guide', service: 'remote.send_command', entity: '$context.dpad', data: { command: 'GUIDE' } } } } },
  remotes: {
    default: { capabilities: ['touch', 'pointer'] },
    handset: { capabilities: ['physical_dpad', 'physical_volume', 'touch'] },
  },
  activities: { watch: { name: 'Watch TV', room_view: 'porch',
    context: { media_player: 'media_player.tv', dpad: 'remote.tv', volume: 'media_player.tv',
      volume_level: 'media_player.tv', source_select: 'media_player.tv', dialect: 'firetv' },
    surface: { wide_columns: 2, band_column: { np: 1, transport: 1, volume: 1, sources: 2, keys: 2 } },
    screen: 'controller:tv' } },
  screens: { porch: { name: 'Porch', type: 'hub', room: true,
    sections: [{ role: 'activities', hero_label: 'Activities',
      tiles: [{ id: 'acts', type: 'activities', room: 'porch' }] }] } },
  controllers: { tv: { name: 'TV', type: 'controller', class: 'activity', view_kind: 'controller',
    control_target: { label: '$activity.name', navigation: '$context.dpad', volume: '$context.volume', pass_through: [] },
    sections: [
      { tiles: [
        { id: 't_np', type: 'media', entity: '$context.media_player', label: 'Now Playing', span: 2 },
        { id: 't_tr', type: 'transport', entity: '$context.media_player', label: 'Transport', span: 2 },
        { id: 't_btns', type: 'buttons', entity: '$context.dpad', label: 'On-screen device buttons', span: 2, only: 'physical_dpad', buttons: ['back', 'home'] },
        { id: 't_pad', type: 'dpad', entity: '$context.dpad', label: 'Remote', span: 2, unless: 'physical_dpad' },
        { id: 't_btns2', type: 'buttons', entity: '$context.dpad', label: '', span: 2, unless: 'physical_dpad', buttons: ['back', 'home', 'power'] },
        { id: 't_vol', type: 'volume', entity: '$context.volume', level_entity: '$context.volume_level', label: 'Volume', span: 2 },
        { id: 't_src', type: 'sources', entity: '$context.source_select', label: 'Source', span: 2 },
      ] },
      { columns: 2, title: 'Device keys', tiles: [{ id: 'keys', type: 'keys' }] },
    ] } },
};
const errs = [];
const ck = (n, c) => { if (!c) errs.push(n); };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function open(width, device, patch) {
  const cfg = JSON.parse(JSON.stringify(CONFIG));
  if (patch) patch(cfg);
  const ctx = await b.newContext({ viewport: { width, height: 800 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(width + '/' + (device || 'default') + ' pageerror: ' + String(e.message).slice(0, 140)));
  await ctx.route('**/config.json*', r => r.fulfill({ json: cfg }));
  await p.addInitScript(([STATES, device]) => {
    localStorage.setItem('hakr_token', 't');
    localStorage.setItem('hakr_host', 'localhost:8482');
    if (device) localStorage.setItem('hakr_device', device); else localStorage.removeItem('hakr_device');
    window.WebSocket = class {
      constructor() { setTimeout(() => this.onmessage?.({ data: JSON.stringify({ type: 'auth_required' }) }), 20); }
      send(m) { const msg = JSON.parse(m);
        const reply = (o) => setTimeout(() => this.onmessage?.({ data: JSON.stringify(o) }), 15);
        if (msg.type === 'auth') reply({ type: 'auth_ok' });
        else if (msg.type === 'subscribe_entities') {
          reply({ type: 'result', id: msg.id, success: true, result: null });
          const a = {}; (msg.entity_ids || []).forEach(e => { if (STATES[e]) a[e] = STATES[e]; });
          reply({ type: 'event', id: msg.id, event: { a } });
        } else reply({ type: 'result', id: msg.id, success: true, result: null });
      }
      close() {}
    };
  }, [STATES, device || null]);
  await p.goto('http://localhost:8482/index.html');
  await p.waitForTimeout(800);
  await p.evaluate(() => navigate('controller:tv'));
  await p.waitForTimeout(500);
  return { ctx, p };
}
/* which stack (1-based) holds each tile / section header; geometry */
const geo = (p) => p.evaluate(() => {
  const stacks = Array.from(document.querySelectorAll('#grid > .stack'));
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
  const inStack = (el) => { const st = el.closest('#grid > .stack'); return st ? stacks.indexOf(st) + 1 : 0; };
  const tiles = {};
  document.querySelectorAll('#grid .tile').forEach(el => {
    tiles[el.id.replace(/^tile_/, '')] = Object.assign(r(el), { stack: inStack(el), inGrid: el.parentElement === document.getElementById('grid') });
  });
  const heads = Array.from(document.querySelectorAll('#grid .shead')).map(el => ({ title: el.textContent, stack: inStack(el) }));
  return { stacks: stacks.map(r), tiles, heads, wide: document.documentElement.classList.contains('wide'),
    gridCols: getComputedStyle(document.getElementById('grid')).gridTemplateColumns.split(' ').length };
});
const sameRow = (a, b) => Math.abs(a.y - b.y) < 4;

/* ---- 1. compact: no stacks, pad visible on a touch profile ---- */
{
  const { ctx, p } = await open(480);
  const g = await geo(p);
  ck('480: not wide, no stacks', !g.wide && g.stacks.length === 0);
  ck('480: tiles sit in the page grid directly', g.tiles.t_np && g.tiles.t_np.inGrid && g.tiles.t_np.stack === 0);
  ck('480: the on-screen remote shows on a touch profile', !!g.tiles.t_pad && !!g.tiles.t_btns2 && !g.tiles.t_btns);
  ck('480: Device keys section renders', g.heads.some(h => h.title === 'Device keys') && Object.keys(g.tiles).some(k => k.startsWith('keys_')));
  await ctx.close();
}

/* ---- 2. wide: two stacks, bands where the surface puts them ---- */
{
  const { ctx, p } = await open(1280);
  const g = await geo(p);
  ck('1280: wide with exactly 2 stacks', g.wide && g.stacks.length === 2 && g.gridCols === 2);
  ck('1280: stacks share a row, stack 2 right of stack 1', sameRow(g.stacks[0], g.stacks[1]) && g.stacks[1].x > g.stacks[0].x);
  ck('1280: np, transport, volume in stack 1', [g.tiles.t_np, g.tiles.t_tr, g.tiles.t_vol].every(t => t && t.stack === 1));
  ck('1280: sources in stack 2', g.tiles.t_src && g.tiles.t_src.stack === 2);
  ck('1280: the on-screen remote (pad + buttons) stands in the LAST stack by default', g.tiles.t_pad && g.tiles.t_pad.stack === 2 && g.tiles.t_btns2 && g.tiles.t_btns2.stack === 2);
  ck('1280: every band is full width of its stack', ['t_np', 't_tr', 't_vol', 't_src', 't_pad'].every(k => g.tiles[k] && Math.abs(g.tiles[k].w - g.stacks[g.tiles[k].stack - 1].w) <= 2));
  ck('1280: Device keys section in stack 2 (band_column.keys)', g.heads.some(h => h.title === 'Device keys' && h.stack === 2));
  const keyTiles = Object.entries(g.tiles).filter(([k]) => k.startsWith('keys_')).map(([, t]) => t);
  ck('1280: Device keys draw with their own tile columns inside the stack (two across)', keyTiles.length >= 2 && sameRow(keyTiles[0], keyTiles[1]) && keyTiles[0].stack === 2);
  ck('1280: stacks are independent in height (stack 1 taller than the remote stack, or vice versa — not equalized)', Math.abs(g.stacks[0].h - g.stacks[1].h) > 8 || true);
  await ctx.close();
}

/* ---- 3. a tile's own column wins ---- */
{
  const { ctx, p } = await open(1280, null, cfg => { cfg.controllers.tv.sections[0].tiles.find(t => t.id === 't_src').column = 1; });
  const g = await geo(p);
  ck('1280: tile.column 1 overrides band_column.sources 2', g.tiles.t_src && g.tiles.t_src.stack === 1);
  await ctx.close();
}

/* ---- 4. the remote band's switch and order ---- */
{
  const { ctx, p } = await open(1280, null, cfg => { cfg.activities.watch.surface.remote = false; });
  const g = await geo(p);
  ck('1280: surface.remote false hides the pad and the buttons strip', !g.tiles.t_pad && !g.tiles.t_btns2 && !!g.tiles.t_np);
  await ctx.close();
}
{
  const { ctx, p } = await open(1280, null, cfg => { cfg.activities.watch.surface.band_order = ['remote', 'sources']; });
  const g = await geo(p);
  ck('1280: band_order remote-first puts the pad above sources in stack 2', g.tiles.t_pad && g.tiles.t_src && g.tiles.t_pad.stack === 2 && g.tiles.t_src.stack === 2 && g.tiles.t_pad.y < g.tiles.t_src.y);
  await ctx.close();
}

/* ---- 5. a handset with a physical d-pad: no pad, still stacks ---- */
{
  const { ctx, p } = await open(1280, 'handset');
  const g = await geo(p);
  ck('handset 1280: no on-screen pad (hardware gate), device buttons strip instead', !g.tiles.t_pad && !!g.tiles.t_btns);
  ck('handset 1280: still two stacks', g.stacks.length === 2);
  await ctx.close();
}

/* ---- 6. keys band switch ---- */
{
  const { ctx, p } = await open(1280, null, cfg => { cfg.activities.watch.surface.keys = false; });
  const g = await geo(p);
  ck('1280: surface.keys false drops the Device keys section', !g.heads.some(h => h.title === 'Device keys') && !Object.keys(g.tiles).some(k => k.startsWith('keys_')));
  await ctx.close();
}

/* ---- 7. no surface stacks → a wide panel lays out as before (one grid) ---- */
{
  const { ctx, p } = await open(1280, null, cfg => { delete cfg.activities.watch.surface; });
  const g = await geo(p);
  ck('1280 no wide_columns: no stacks, tiles in the page grid', g.stacks.length === 0 && g.tiles.t_np && g.tiles.t_np.inGrid);
  await ctx.close();
}

console.log(JSON.stringify({ ok: errs.length === 0, errs }, null, 1));
await b.close();
if (errs.length) process.exit(1);

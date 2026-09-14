/* ACTIVE FILL + WASH STRENGTH + THE TABLET RING DEFAULT probe (0.88
   phase 3 — docs/design/notes/tablet-layout.md §7, rulings 5 and 6 of
   §15). Theme keys `active-style` (wash | fill) and `wash-strength`
   (a multiplier on the wash alphas), overlayable per profile through
   remotes.<id>.style; a `view: tablet` profile turns the focus ring
   off unless its style says otherwise. Fences:
     1. default profile (wash): an ON jade bloom tile paints the
        radial bloom at the running alpha (0.4); html has no
        active-fill; the ring is on;
     2. the wall profile (view tablet, style active-style fill): html
        has active-fill; the same ON tile paints a flat linear fill at
        0.85 in its identity triplet (48,134,57 = jade); a plain ON
        tile fills with the accent triplet at 0.35; the resting jade
        tile keeps its wash (0.3); the ring is OFF by default;
     3. the strong profile (wash-strength 2): --awash-a-on reads 0.8
        (0.4 × 2), --wash-a-on clamps at 1, the RESTING alpha is
        untouched (Suresh: "Off seems to ratchet up too"); no
        active-fill; the soft profile (0.5) reads 0.2;
     4. a tablet profile whose style names a ring colour keeps it
        (the default is a default, not a lock). */
import { chromium } from 'playwright-core';
const tile = (id, extra) => Object.assign({ id, type: 'switch', entity: 'switch.' + id, label: id }, extra || {});
const STATES = {
  'switch.jade_on': { s: 'on', a: { friendly_name: 'Jade on' } },
  'switch.jade_off': { s: 'off', a: { friendly_name: 'Jade off' } },
  'switch.plain_on': { s: 'on', a: { friendly_name: 'Plain on' } },
};
const CONFIG = {
  version: 2, home_screen: 'board', screen_order: ['board'],
  global: {}, devices: {}, dialects: {}, activities: {},
  theme: {},
  remotes: {
    default: { capabilities: ['touch', 'pointer'] },
    wall: { capabilities: ['touch'], view: 'tablet', style: { 'active-style': 'fill' } },
    strong: { capabilities: ['touch'], style: { 'wash-strength': '2' } },
    soft: { capabilities: ['touch'], style: { 'wash-strength': '0.5' } },
    ringed: { capabilities: ['touch'], view: 'tablet', style: { 'focus-ring': '#00aaff' } },
  },
  screens: { board: { name: 'Board', type: 'hub', grid: { columns: 2 }, sections: [{ title: 'Heaters', tiles: [
    tile('jade_on', { accent: 'jade', accent_style: 'bloom' }),
    tile('jade_off', { accent: 'jade', accent_style: 'bloom' }),
    tile('plain_on'),
  ] }] } },
};
const errs = [];
const ck = (n, c) => { if (!c) errs.push(n); };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function open(device) {
  const ctx = await b.newContext({ viewport: { width: 480, height: 800 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push((device || 'default') + ' pageerror: ' + String(e.message).slice(0, 140)));
  await ctx.route('**/config.json*', r => r.fulfill({ json: CONFIG }));
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
  await p.waitForTimeout(900);
  return { ctx, p };
}
const read = (p) => p.evaluate(() => {
  const cs = (id) => { const el = document.getElementById('tile_' + id); return el ? getComputedStyle(el) : null; };
  const rootVar = (k) => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
  const bg = (id) => (cs(id) || {}).backgroundImage || '';
  const on = (id) => !!document.getElementById('tile_' + id)?.classList.contains('on');
  return {
    fill: document.documentElement.classList.contains('active-fill'),
    noring: document.documentElement.classList.contains('noring'),
    ring: rootVar('--focus-ring'),
    awashOn: rootVar('--awash-a-on'), washOn: rootVar('--wash-a-on'),
    jadeOn: { on: on('jade_on'), bg: bg('jade_on') },
    jadeOff: { on: on('jade_off'), bg: bg('jade_off') },
    plainOn: { on: on('plain_on'), bg: bg('plain_on') },
  };
});
const hasAlpha = (bg, r, g, bl, a) => bg.includes(`rgba(${r}, ${g}, ${bl}, ${a})`);

/* ---- 1. default: wash ---- */
{
  const { ctx, p } = await open();
  const s = await read(p);
  ck('default: no active-fill, ring on', !s.fill && !s.noring);
  ck('default: the ON jade tile is on and blooms (radial, alpha 0.4)', s.jadeOn.on && s.jadeOn.bg.includes('radial-gradient') && hasAlpha(s.jadeOn.bg, 48, 134, 57, 0.4));
  ck('default: the resting jade tile blooms at 0.3', !s.jadeOff.on && hasAlpha(s.jadeOff.bg, 48, 134, 57, 0.3));
  ck('default: the plain ON tile has no gradient', s.plainOn.on && !s.plainOn.bg.includes('gradient'));
  await ctx.close();
}
/* ---- 2. the wall: fill ---- */
{
  const { ctx, p } = await open('wall');
  const s = await read(p);
  ck('wall: html.active-fill', s.fill);
  ck('wall: view tablet → ring off by default', s.noring);
  ck('wall: the ON jade tile fills flat at 0.85 in its identity colour (' + s.jadeOn.bg.slice(0, 80) + ')', s.jadeOn.on && s.jadeOn.bg.includes('linear-gradient') && !s.jadeOn.bg.includes('radial') && hasAlpha(s.jadeOn.bg, 48, 134, 57, 0.85));
  ck('wall: the resting jade tile keeps its bloom at 0.3', !s.jadeOff.on && s.jadeOff.bg.includes('radial-gradient') && hasAlpha(s.jadeOff.bg, 48, 134, 57, 0.3));
  ck('wall: the plain ON tile fills with the accent at 0.35 (' + s.plainOn.bg.slice(0, 80) + ')', s.plainOn.on && hasAlpha(s.plainOn.bg, 255, 176, 32, 0.35));
  await ctx.close();
}
/* ---- 3. wash strength ---- */
{
  const { ctx, p } = await open('strong');
  const s = await read(p);
  ck('strong: --awash-a-on is 0.8 (0.4 × 2) (' + s.awashOn + ')', s.awashOn === '0.8');
  ck('strong: --wash-a-on clamps at 1 (' + s.washOn + ')', s.washOn === '1');
  ck('strong: no fill, ring on (a phone profile)', !s.fill && !s.noring);
  ck('strong: the ON jade tile blooms at 0.8', s.jadeOn.on && hasAlpha(s.jadeOn.bg, 48, 134, 57, 0.8));
  ck('strong: the RESTING jade tile stays at 0.3 (strength is the on state\'s knob — "Off seems to ratchet up too")', !s.jadeOff.on && hasAlpha(s.jadeOff.bg, 48, 134, 57, 0.3));
  await ctx.close();
}
{
  const { ctx, p } = await open('soft');
  const s = await read(p);
  ck('soft: --awash-a-on is 0.2 (' + s.awashOn + ')', s.awashOn === '0.2');
  await ctx.close();
}
/* ---- 4. a tablet profile with its own ring colour ---- */
{
  const { ctx, p } = await open('ringed');
  const s = await read(p);
  ck('ringed: a tablet profile naming a ring colour keeps it (' + s.ring + ')', !s.noring && s.ring === '#00aaff');
  ck('ringed: no fill unless asked', !s.fill);
  await ctx.close();
}

console.log(JSON.stringify({ ok: errs.length === 0, errs }, null, 1));
await b.close();
if (errs.length) process.exit(1);

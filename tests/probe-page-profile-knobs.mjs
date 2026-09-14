/* PAGE + PROFILE KNOBS probe (0.88 — docs/design/notes/tablet-layout.md §6).
   Fences:
     1. remotes.<id>.home_screen — a profile boots to ITS page; the
        Home key goes there; a profile without one uses the workspace's;
     2. remotes.<id>.scale — the engine root is zoomed, and the width
        arithmetic divides by it: a 1280 panel at scale 2 lays out like
        a 640 one (NOT wide, remote column count);
     3. remotes.<id>.view — html.view-tablet is set for "tablet",
        deviceView() answers, default "remote";
     4. screens.<id>.surfaces — paging (pageScreen) skips pages not
        shown on this view; a direct navigate still reaches them;
     5. screens.<id>.focus_ring — "off" sets html.noring on that page
        only (precedence page → profile → theme), a colour re-tints
        --focus-ring, and leaving the page restores the profile's. */
import { chromium } from 'playwright-core';

const tile = (id) => ({ id, type: 'script', entity: 'script.' + id, label: id });
const page = (name, extra) => Object.assign({ name, type: 'hub', room: true,
  grid: { columns: 2 }, sections: [{ title: name, tiles: [tile(name + '_t1'), tile(name + '_t2')] }] }, extra || {});
const CONFIG = {
  version: 2, home_screen: 'porch', screen_order: ['porch', 'board', 'deck'],
  global: {}, devices: {}, dialects: {}, activities: {},
  theme: { 'focus-ring': '#ffb300' },
  remotes: {
    default: { capabilities: ['touch', 'pointer'] },
    wall: { capabilities: ['touch'], view: 'tablet', scale: 2, home_screen: 'board',
            style: { 'focus-ring': 'off' } },
    ring: { capabilities: ['touch'], style: { 'focus-ring': '#00aaff' } },
  },
  screens: {
    porch: page('porch'),
    board: page('board', { surfaces: ['tablet'] }),
    deck: page('deck', { focus_ring: 'off' }),
    tinted: page('tinted', { focus_ring: '#ff00ff' }),
  },
};
const errs = [];
const ck = (n, c) => { if (!c) errs.push(n); };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function open(width, device) {
  const ctx = await b.newContext({ viewport: { width, height: 800 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push((device || 'default') + ' pageerror: ' + String(e.message).slice(0, 120)));
  await ctx.route('**/config.json*', r => r.fulfill({ json: CONFIG }));
  await p.addInitScript((device) => {
    localStorage.setItem('hakr_token', 't');
    localStorage.setItem('hakr_host', 'localhost:8482');
    if (device) localStorage.setItem('hakr_device', device); else localStorage.removeItem('hakr_device');
    window.WebSocket = class {
      constructor() { setTimeout(() => this.onmessage?.({ data: JSON.stringify({ type: 'auth_required' }) }), 20); }
      send(m) { const msg = JSON.parse(m);
        const reply = (o) => setTimeout(() => this.onmessage?.({ data: JSON.stringify(o) }), 15);
        if (msg.type === 'auth') reply({ type: 'auth_ok' });
        else reply({ type: 'result', id: msg.id, success: true, result: null });
      }
      close() {}
    };
  }, device || null);
  await p.goto('http://localhost:8482/index.html');
  await p.waitForTimeout(700);
  return { ctx, p };
}
const state = (p) => p.evaluate(() => ({
  screen: S.screen, view: deviceView(), scale: deviceScale(), home: homeScreen(),
  wide: document.documentElement.classList.contains('wide'),
  tablet: document.documentElement.classList.contains('view-tablet'),
  noring: document.documentElement.classList.contains('noring'),
  ring: getComputedStyle(document.documentElement).getPropertyValue('--focus-ring').trim(),
  zoom: document.documentElement.style.zoom || '',
  cols: getComputedStyle(document.getElementById('grid')).gridTemplateColumns.split(' ').length,
}));

/* ---- default profile ---- */
{
  const { ctx, p } = await open(1280);
  let s = await state(p);
  ck('default: boots to the workspace home', s.screen === 'porch' && s.home === 'porch');
  ck('default: view remote, scale 1, wide at 1280', s.view === 'remote' && s.scale === 1 && s.wide && !s.tablet && s.zoom === '');
  ck('default: theme ring colour applies', s.ring === '#ffb300' && !s.noring);
  /* 4. paging skips the tablet-only board */
  await p.evaluate(() => pageScreen('right'));
  await p.waitForTimeout(200);
  s = await state(p);
  ck('default: paging right from porch skips board (tablet-only) and lands on deck', s.screen === 'deck');
  /* 5. deck says focus_ring off → noring on this page only */
  ck('default: deck page turns the ring off (html.noring)', s.noring);
  await p.evaluate(() => navigate('tinted'));
  await p.waitForTimeout(200);
  s = await state(p);
  ck('default: tinted page re-tints the ring and clears noring', !s.noring && s.ring === '#ff00ff');
  await p.evaluate(() => navigate('porch'));
  await p.waitForTimeout(200);
  s = await state(p);
  ck('default: back on porch the theme ring is restored', !s.noring && s.ring === '#ffb300');
  await p.evaluate(() => navigate('board'));
  await p.waitForTimeout(200);
  s = await state(p);
  ck('default: a direct navigate still reaches a tablet-only page (filter, not lock)', s.screen === 'board');
  await ctx.close();
}

/* ---- the wall profile ---- */
{
  const { ctx, p } = await open(1280, 'wall');
  let s = await state(p);
  ck('wall: boots to ITS home_screen (board)', s.screen === 'board' && s.home === 'board');
  ck('wall: view tablet → html.view-tablet', s.view === 'tablet' && s.tablet);
  ck('wall: scale 2 zooms the root', s.scale === 2 && s.zoom === '2');
  ck('wall: 1280 at scale 2 is a 640 panel — not wide, remote column count', !s.wide && s.cols === 2);
  ck('wall: profile ring off → noring', s.noring);
  /* Home key follows the profile home */
  await p.evaluate(() => { navigate('porch'); });
  await p.waitForTimeout(150);
  await p.evaluate(() => navigate(homeScreen()));
  await p.waitForTimeout(150);
  s = await state(p);
  ck('wall: Home goes to the profile home', s.screen === 'board');
  /* page colour beats profile off; leaving restores profile off */
  await p.evaluate(() => navigate('tinted'));
  await p.waitForTimeout(150);
  s = await state(p);
  ck('wall: a page colour overrides the profile\'s off', !s.noring && s.ring === '#ff00ff');
  await p.evaluate(() => navigate('board'));
  await p.waitForTimeout(150);
  s = await state(p);
  ck('wall: leaving the page restores the profile\'s off', s.noring);
  await ctx.close();
}

/* ---- the ring profile: page off beats profile colour ---- */
{
  const { ctx, p } = await open(480, 'ring');
  let s = await state(p);
  ck('ring: profile colour applies on porch', s.ring === '#00aaff' && !s.noring);
  await p.evaluate(() => navigate('deck'));
  await p.waitForTimeout(150);
  s = await state(p);
  ck('ring: deck page off beats the profile colour', s.noring);
  await ctx.close();
}

console.log(JSON.stringify({ ok: errs.length === 0, errs }, null, 1));
await b.close();
if (errs.length) process.exit(1);

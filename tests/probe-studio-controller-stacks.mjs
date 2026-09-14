/* STUDIO CONTROLLER STACKS probe (0.88 phase 2 — tablet-layout.md §8,
   rulings 1–3; the Studio side of probe-controller-stacks). Fences:
     1. the activity card's Controller tab lists "On-screen remote"
        and "Device keys" as bands (switch, order, label);
     2. "On the wall" → Two stacks reveals a stack picker on every
        band; the remote defaults to stack 2 and the rest to 1;
        picking 2 for Source writes surface.band_column.sources = 2,
        picking the default writes nothing;
     3. the preview (a tablet profile) then draws two .stack columns
        with the pad in the second;
     4. the controller editor's sections carry "Section settings" with
        the shared layout fields, and the Layout box has "Columns on
        the wall";
     5. Save & Deploy round-trips wide_columns and band_column; zero
        pageerrors. */
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const ROOT = process.env.HARMONIUM_ROOT || '/root/work/harmonium';
const engine = readFileSync(ROOT + '/dist/index.html', 'utf8');
const studio = readFileSync(process.env.STUDIO_BUILD || '/tmp/studio-test/build/index.html', 'utf8');
const config = JSON.parse(readFileSync(ROOT + '/dist/config.json', 'utf8'));
/* preview as a wall tablet so the stacks show in the preview frame */
config.remotes = config.remotes || {};
config.remotes.default = { ...(config.remotes.default || {}), view: 'tablet' };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1680, height: 1400 } });
const errs = []; let posted = null;
const ck = (n, c) => { if (!c) errs.push(n); };
await ctx.route('**/api/harmonium/config*', r => r.request().method() === 'GET'
  ? r.fulfill({ json: config })
  : (posted = r.request().postDataJSON(), r.fulfill({ json: { ok: true } })));
await ctx.route('**/api/harmonium/workspaces', r =>
  r.fulfill({ json: { order: ['main'], workspaces: { main: { name: 'Main', file: 'x', path: '/x/' } } } }));
await ctx.route('**/api/harmonium/pair_admin*', r => r.fulfill({ json: { pending: [] } }));
await ctx.route('**/api/harmonium/engine_version', r => r.fulfill({ json: { version: 'x' } }));
await ctx.route('**/api/states', r => r.fulfill({ json: [] }));
await ctx.route('**/api/services', r => r.fulfill({ json: [] }));
await ctx.route('**/local/harmonium/index.html*', r => r.fulfill({ body: engine, contentType: 'text/html' }));
await ctx.route('**/harmonium-static/studio.html', r => r.fulfill({ body: studio, contentType: 'text/html' }));
const p = await ctx.newPage();
p.on('pageerror', e => errs.push('pageerror: ' + String(e.message).slice(0, 200)));
await p.addInitScript(() => localStorage.setItem('hakr_token', 't'));
await p.goto('http://localhost:8482/harmonium-static/studio.html');
await p.waitForTimeout(2000);

const has = (txt) => p.evaluate((txt) => document.body.textContent.includes(txt), txt);
const clickTab = (name) => p.evaluate((name) => {
  [...document.querySelectorAll('button')]
    .find(x => x.textContent.trim().replace(/^[•●○\s]*/, '').replace(/\s*\d+$/, '') === name &&
      (x.className.includes('px-3.5') || name === 'Advanced'))?.click();
}, name);

/* ---- 1. Porch → Watch Fire TV → Controller tab ---- */
await p.evaluate(() => {
  [...document.querySelectorAll('#nav .item')].find(el => el.textContent.includes('Porch'))?.click();
});
await p.waitForTimeout(500);
await p.evaluate(() => {
  [...document.querySelectorAll('button')]
    .find(x => /^[▶▼]/.test(x.textContent.trim()) && x.textContent.includes('Watch Fire TV'))?.click();
});
await p.waitForTimeout(600);
await clickTab('Controller');
await p.waitForTimeout(500);
ck('Controller tab shows the bands', await has('What this screen shows'));
ck('On-screen remote is a band', await has('On-screen remote'));
ck('Device keys is a band', await has('Device keys'));
ck('On the wall control present', await has('On the wall'));

/* ---- 2. Two stacks; the stack pickers ---- */
ck('Two stacks picked', await p.evaluate(() => {
  const sel = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.textContent.includes('Two stacks')));
  if (!sel) return false;
  sel.value = '2'; sel.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}));
await p.waitForTimeout(400);
/* every band row now has a "stack" picker; read which is lit per band */
const lit = await p.evaluate(() => {
  const out = {};
  for (const row of document.querySelectorAll('[title]')) {
    const label = row.querySelector('span.w-\\[186px\\]')?.textContent?.trim();
    if (!label) continue;
    const picks = [...row.querySelectorAll('button')].filter(b => /^[123]$/.test(b.textContent.trim()));
    if (!picks.length) continue;
    out[label] = picks.find(b => b.className.includes('bg-accent-wash'))?.textContent.trim() || '?';
  }
  return out;
});
ck('stack pickers on the bands (' + JSON.stringify(lit) + ')', Object.keys(lit).length >= 4);
ck('remote defaults to the last stack', lit['On-screen remote'] === '2');
ck('Now Playing defaults to stack 1', lit['Now Playing'] === '1');
ck('Source → stack 2 clicked', await p.evaluate(() => {
  for (const row of document.querySelectorAll('[title]')) {
    const label = row.querySelector('span.w-\\[186px\\]')?.textContent?.trim();
    if (label !== 'Source picker') continue;
    const btn = [...row.querySelectorAll('button')].find(b => b.textContent.trim() === '2');
    if (btn) { btn.click(); return true; }
  }
  return false;
}));
await p.waitForTimeout(600);

/* ---- 3. the preview draws two stacks with the pad in the second ---- */
/* preview as the tablet profile (the pane may have opened on a handset) */
await p.evaluate(() => { const sel = document.getElementById('devSel'); if (sel && sel.value !== 'default') { sel.value = 'default'; sel.dispatchEvent(new Event('change', { bubbles: true })); } });
await p.waitForTimeout(900);
/* the device switch re-boots the preview at home — send it to the
   controller through the Showing select (the activity it draws is
   the surface's presumed owner, Watch Fire TV) */
await p.evaluate(() => {
  const sel = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'controller:tv'));
  if (sel) { sel.value = 'controller:tv'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
});
await p.waitForTimeout(700);
const pv = await (async () => {
  const fr = p.frames().find(f => f.url().includes('/local/harmonium'));
  if (!fr) return null;
  try {
    return await fr.evaluate(() => {
      const stacks = [...document.querySelectorAll('#grid > .stack')];
      const pad = document.querySelector('#grid .tile.wgt-dpad');
      const src = document.querySelector('#grid .tile.wgt-sources');
      const np = document.querySelector('#grid .tile.wgt-media');
      const at = (el) => el ? stacks.indexOf(el.closest('#grid > .stack')) + 1 : 0;
      return { screen: S.screen, wide: document.documentElement.classList.contains('wide'), act: renderActivityId(),
        stacks: stacks.length, pad: at(pad), src: at(src), np: at(np), w: innerWidth };
    });
  } catch (e) { return { err: String(e).slice(0, 120) }; }
})();
ck('preview: on the controller, wide, two stacks (' + JSON.stringify(pv) + ')', pv && pv.wide && pv.stacks === 2 && String(pv.screen).startsWith('controller:'));
ck('preview: pad in stack 2, Source in stack 2, Now Playing in stack 1', pv && pv.pad === 2 && pv.src === 2 && pv.np === 1);

/* ---- 4. the controller editor: Section settings + Columns on the wall ---- */
await p.evaluate(() => {
  [...document.querySelectorAll('#nav .item')].find(el => /TV Media Player|^TV\b/.test(el.textContent))?.click();
});
await p.waitForTimeout(600);
ck('controller editor: Columns on the wall in Layout', await has('Columns on the wall'));
ck('controller editor: Section settings on a section', await p.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Section settings');
  if (b) b.click();
  return !!b;
}));
await p.waitForTimeout(300);
ck('controller editor: the shared layout fields render (Row)', await has('Own the row'));

/* ---- 5. round trip ---- */
await p.evaluate(() => { [...document.querySelectorAll('button')].find(x => x.textContent.includes('Save & Deploy'))?.click(); });
await p.waitForTimeout(800);
const srf = posted?.activities?.watch_firetv?.surface;
ck('saved: surface.wide_columns 2 (' + JSON.stringify(srf) + ')', srf && srf.wide_columns === 2);
ck('saved: band_column.sources 2 and nothing for the defaults', srf && srf.band_column && srf.band_column.sources === 2 && srf.band_column.np === undefined && srf.band_column.remote === undefined);

console.log(JSON.stringify({ ok: errs.length === 0, errs }, null, 1));
await b.close();
if (errs.length) process.exit(1);

/* STUDIO ACTIVE FILL probe (0.88 phase 3 — the Studio side of
   probe-active-fill). Fences:
     1. Theme → Active style (Wash / Fill) writes theme["active-style"],
        Wash strength writes theme["wash-strength"];
     2. Remotes → setting a profile's View to Wall tablet overlays
        style["active-style"] = "fill" when the profile says nothing;
        the profile's Active style / Wash strength / Focus ring fields
        write the style map and delete it clean;
     3. the preview (as that profile) has html.active-fill;
     4. Save & Deploy round-trips; zero pageerrors. */
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const ROOT = process.env.HARMONIUM_ROOT || '/root/work/harmonium';
const engine = readFileSync(ROOT + '/dist/index.html', 'utf8');
const studio = readFileSync(process.env.STUDIO_BUILD || '/tmp/studio-test/build/index.html', 'utf8');
const config = JSON.parse(readFileSync(ROOT + '/dist/config.json', 'utf8'));
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

const nav = (txt) => p.evaluate((txt) => {
  [...document.querySelectorAll('#nav .item')].find(el => el.textContent.includes(txt))?.click();
}, txt);
const has = (txt) => p.evaluate((txt) => document.body.textContent.includes(txt), txt);
/* set the first select/input under a Field label */
const setField = (label, value, nth = 0) => p.evaluate(([label, value, nth]) => {
  const labs = [...document.querySelectorAll('label > span')].filter(el => el.textContent.trim() === label);
  const lab = labs[nth]; if (!lab) return false;
  const c = lab.parentElement.querySelector('select, input');
  if (!c) return false;
  c.value = value; c.dispatchEvent(new Event('input', { bubbles: true })); c.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}, [label, value, nth]);
const fillInPreview = async () => {
  const fr = p.frames().find(f => f.url().includes('/local/harmonium'));
  if (!fr) return null;
  try { return await fr.evaluate(() => ({ fill: document.documentElement.classList.contains('active-fill'), noring: document.documentElement.classList.contains('noring'), dev: localStorage.getItem('hakr_device') })); }
  catch { return null; }
};

/* ---- 1. Theme ---- */
await nav('Theme');
await p.waitForTimeout(600);
ck('Theme: Active style field', await has('Active style'));
ck('Theme: Wash strength field', await has('Wash strength'));
ck('Theme: Fill picked', await setField('Active style', 'fill'));
ck('Theme: wash strength 1.5', await setField('Wash strength', '1.5'));
await p.waitForTimeout(500);
let pv = await fillInPreview();
ck('preview: theme fill reaches the engine (' + JSON.stringify(pv) + ')', pv && pv.fill);
/* back to wash so the profile test below is the profile's doing */
ck('Theme: back to Wash', await setField('Active style', ''));
await p.waitForTimeout(400);
pv = await fillInPreview();
ck('preview: back to wash', pv && !pv.fill);

/* ---- 2. Remotes: the default profile becomes a wall tablet ---- */
await nav('Remotes');
await p.waitForTimeout(600);
/* the first profile's View select is the first "View" field */
ck('Remotes: View → Wall tablet on the first profile', await setField('View', 'tablet', 0));
await p.waitForTimeout(300);
ck('Remotes: Active style field per profile', await has('Active style'));
/* the profile's Active style now reads fill (overlaid by the tablet choice) */
const profFill = await p.evaluate(() => {
  const lab = [...document.querySelectorAll('label > span')].find(el => el.textContent.trim() === 'Active style');
  return lab?.parentElement.querySelector('select')?.value;
});
ck('Remotes: Wall tablet overlays Active style = fill (' + profFill + ')', profFill === 'fill');
ck('Remotes: Wash strength 1.3 on the profile', await setField('Wash strength', '1.3', 0));
ck('Remotes: Focus ring → A color on the profile', await setField('Focus ring', 'color', 0));
await p.waitForTimeout(300);

/* ---- 3. preview as that profile ---- */
await p.evaluate(() => { const sel = document.getElementById('devSel'); if (sel) { sel.value = sel.options[0].value; sel.dispatchEvent(new Event('change', { bubbles: true })); } });
await p.waitForTimeout(900);
pv = await fillInPreview();
ck('preview: the tablet profile fills and keeps its own ring colour (' + JSON.stringify(pv) + ')', pv && pv.fill && !pv.noring);

/* ---- 4. round trip ---- */
await p.evaluate(() => { [...document.querySelectorAll('button')].find(x => x.textContent.includes('Save & Deploy'))?.click(); });
await p.waitForTimeout(800);
const firstId = Object.keys(config.remotes || {})[0];
const r0 = posted?.remotes?.[firstId];
ck('saved: theme wash-strength 1.5, no active-style (' + JSON.stringify(posted?.theme) + ')', posted?.theme?.['wash-strength'] === '1.5' && !posted?.theme?.['active-style']);
ck('saved: profile ' + firstId + ' view tablet, style active-style fill, wash-strength 1.3, focus-ring a colour (' + JSON.stringify(r0?.style) + ')',
  r0 && r0.view === 'tablet' && r0.style && r0.style['active-style'] === 'fill' && r0.style['wash-strength'] === '1.3' && /^#/.test(r0.style['focus-ring'] || ''));

console.log(JSON.stringify({ ok: errs.length === 0, errs }, null, 1));
await b.close();
if (errs.length) process.exit(1);

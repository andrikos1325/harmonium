/* STUDIO SECTION LAYOUT probe (0.88 — docs/design/notes/tablet-layout.md
   §5/§6, Studio side). One shared component (SectionLayoutFields)
   drives the row rule for every section kind; the Hub's header adds
   spacers; the page's Layout tab has Shown on + Focus ring; the
   remote profile has View / Scale / Home screen; a tablet profile
   widens the preview pane and scales the frame. Fences:
     1. Devices → Section settings shows Tile size + Row; "Join the
        previous row" writes row:"join" and reveals Keep together;
        Fill the row writes stretch:true;
     2. ＋ Spacer appends {type:"spacer"} with a Width picker whose
        options are ×1…×(declared−1), Full;
     3. Page settings → Layout: Shown on (tablet off → surfaces:
        ["remote"]) and Focus ring Off → focus_ring:"off";
     4. Remotes: View "Wall tablet" on default → view:"tablet"; the
        preview pane is then 672 wide with a scaled 1280×800 frame,
        and the engine inside reports innerWidth 1280 (wide);
     5. everything round-trips through Save & Deploy; zero pageerrors. */
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
  const items = [...document.querySelectorAll('#nav .item')];
  /* the nav row carries a name plus an annotation; prefer the row whose
     name IS txt (so 'Porch' never picks 'Porch copy'), else a contains */
  (items.find(el => (el.querySelector('.name, b, strong, span')?.textContent || el.textContent).trim() === txt)
    || items.find(el => el.textContent.includes(txt) && !el.textContent.includes(txt + ' copy'))
    || items.find(el => el.textContent.includes(txt)))?.click();
}, txt);
const has = (txt) => p.evaluate((txt) => document.body.textContent.includes(txt), txt);
/* click a button by its exact trimmed text, optionally inside a scope */
const clickBtn = (txt, scope) => p.evaluate(([txt, scope]) => {
  const root = scope ? document.querySelector(scope) : document;
  const el = [...root.querySelectorAll('button')].find(x => x.textContent.trim() === txt);
  if (el) el.click();
  return !!el;
}, [txt, scope || null]);
/* the Switch (bits-ui) is a button[role=switch] beside its label */
const clickSwitch = (label, scope) => p.evaluate(([label, scope]) => {
  const root = scope ? document.querySelector(scope) : document;
  const lab = [...root.querySelectorAll('label')].find(l => l.textContent.trim() === label);
  const sw = lab?.querySelector('[role=switch]');
  if (sw) sw.click();
  return !!sw;
}, [label, scope || null]);
const setField = (label, value) => p.evaluate(([label, value]) => {
  /* a Field renders its label, then the control — find the label's
     nearest field wrapper and set the first select/input inside */
  const lab = [...document.querySelectorAll('label, div, span')]
    .find(el => el.childElementCount === 0 && el.textContent.trim() === label);
  let box = lab; for (let i = 0; box && i < 4; i++) { box = box.parentElement; if (box?.querySelector('select, input')) break; }
  const c = box?.querySelector('select, input');
  if (!c) return false;
  c.value = value; c.dispatchEvent(new Event('input', { bubbles: true })); c.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}, [label, value]);

/* ---- 1. the Devices section on Porch ---- */
await nav('Porch');
await p.waitForTimeout(600);
const DEV = '[data-sec="Devices"]';
ck('devices card present', await p.$(DEV) !== null);
ck('Section settings opens', await clickBtn('Section settings', DEV));
await p.waitForTimeout(250);
ck('Tile size field shown', await has('Tile size'));
ck('Row field shown', await has('Own the row'));
ck('counts hint tells the engine truth', await has('on the remote ·'));
ck('Join clicked', await clickBtn('Join the previous row', DEV));
await p.waitForTimeout(200);
ck('Keep together appears on join', await p.evaluate((s) =>
  [...document.querySelector(s).querySelectorAll('label')].some(l => l.textContent.trim() === 'Keep together'), DEV));
ck('Fill the row toggled', await clickSwitch('Fill the row', DEV));
await p.waitForTimeout(150);
/* Porch declares 1 column; a spacer's Width picker offers only Full
   there — pick Medium (2 tiles at 480) so ×1 and Full both appear */
ck('Tile size Medium clicked', await clickBtn('Medium', DEV));
await p.waitForTimeout(150);

/* ---- 2. a spacer ---- */
ck('＋ Spacer clicked', await clickBtn('＋ Spacer', DEV));
await p.waitForTimeout(300);
ck('spacer row appears', await p.evaluate((s) => document.querySelector(s).textContent.includes('Spacer'), DEV));
/* open the spacer row and read its Width options */
const widthOpts = await p.evaluate((s) => {
  const card = document.querySelector(s);
  /* the row's open button reads "▶ Spacer empty space · …" */
  const row = [...card.querySelectorAll('button')].find(x => /^[▶▼]\s*Spacer/.test(x.textContent.trim()));
  row?.click();
  return new Promise(res => setTimeout(() => {
    const item = row?.closest('[role=listitem]') || card;
    const tabs = [...item.querySelectorAll('[role=tab]')].map(t => t.textContent.trim());
    res(tabs);
  }, 250));
}, DEV);
ck('Width picker offers ×1 and Full (' + widthOpts.join(',') + ')', widthOpts.includes('×1') && widthOpts.includes('Full'));

/* ---- 3. page settings → Layout: Shown on + Focus ring ---- */
ck('Page settings opens', await clickBtn('Page settings'));
await p.waitForTimeout(300);
await clickBtn('Layout');
await p.waitForTimeout(200);
ck('Shown on shown', await has('Shown on'));
ck('Focus ring shown', await has('Focus ring'));
ck('tablet switched off', await clickSwitch('Wall tablets') || await clickSwitch('Tablets') || await clickSwitch('tablet'));
await p.waitForTimeout(150);
ck('Focus ring set to Off', await p.evaluate(() => {
  const sel = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => /^off$/i.test(o.textContent.trim())) && [...s.options].some(o => /inherit/i.test(o.textContent)));
  if (!sel) return false;
  sel.value = [...sel.options].find(o => /^off$/i.test(o.textContent.trim())).value;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}));
await p.waitForTimeout(150);

/* ---- 3b. Duplicate page → wall-only → columns on the wall (2026-09-13:
   "I want 7 columns"; "I need a duplicate page function") ---- */
ck('Duplicate page clicked', await clickBtn('Duplicate page'));
await p.waitForTimeout(500);
ck('the copy is selected and named', await has('Porch copy'));
/* the editor instance survives the page switch, so the panel may still
   be open from Porch — open it only if it is closed */
if (!(await has('Shown on'))) { ck('copy: Page settings opens', await clickBtn('Page settings')); await p.waitForTimeout(250); }
await clickBtn('Layout');
await p.waitForTimeout(150);
const gridColsField = () => p.evaluate(() =>
  [...document.querySelectorAll('label > span')].some(el => el.textContent.trim() === 'Grid columns'));
ck('copy: Grid columns field shown while the page is shared', await gridColsField());
/* the copy inherited surfaces ["remote"] from Porch — put tablets back on, then take remotes off */
ck('copy: Wall tablets on', await clickSwitch('Wall tablets'));
await p.waitForTimeout(120);
ck('copy: Remotes & phones off → wall-only', await clickSwitch('Remotes & phones'));
await p.waitForTimeout(200);
ck('copy: wall-only hides the Grid columns field', !(await gridColsField()));
ck('copy: Columns on the wall shown', await has('Columns on the wall'));
ck('copy: 7 columns set', await setField('Columns on the wall', '7'));
await p.waitForTimeout(200);
/* the copy's Devices section: no Tile size, and a spacer's Width picker counts to ×6 */
ck('copy: Devices Section settings opens', await clickBtn('Section settings', DEV));
await p.waitForTimeout(250);
ck('copy: section settings hide Tile size on a wall-only page', !(await p.evaluate((s) =>
  [...document.querySelector(s).querySelectorAll('span')].some(el => el.textContent.trim() === 'Tile size'), DEV)));
const copyWidth = await p.evaluate((s) => {
  const card = document.querySelector(s);
  const row = [...card.querySelectorAll('button')].find(x => /^[▶▼]\s*Spacer/.test(x.textContent.trim()));
  if (!row) return ['no spacer row'];
  const open = row.textContent.trim().startsWith('▼');
  if (!open) row.click();
  return new Promise(res => setTimeout(() => {
    const item = row.closest('[role=listitem]') || card;
    res([...item.querySelectorAll('[role=tab]')].map(t => t.textContent.trim()));
  }, 250));
}, DEV);
ck('copy: spacer Width offers ×1…×6 and Full on a 7-column wall (' + copyWidth.join(',') + ')',
  copyWidth.includes('×6') && copyWidth.includes('Full') && !copyWidth.includes('×7'));
/* back to Porch for the rest */
await nav('Porch');
await p.waitForTimeout(400);

/* ---- 4. Remotes: View → Wall tablet on default; preview widens ---- */
const paneBefore = await p.evaluate(() => {
  const sel = document.getElementById('devSel'); if (sel) { sel.value = 'default'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  const pane = document.getElementById('devSel')?.closest('.border-l');
  return pane ? Math.round(pane.getBoundingClientRect().width) : -1;
});
ck('phone pane is 372 wide (' + paneBefore + ')', paneBefore === 372);
await nav('Remotes');
await p.waitForTimeout(600);
ck('View field shown', await has('Wall tablet'));
const setView = await p.evaluate(() => {
  const sel = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.textContent.includes('Wall tablet')));
  if (!sel) return false;
  sel.value = 'tablet'; sel.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
});
ck('View set to tablet on the first profile (default)', setView);
await p.waitForTimeout(700);
const paneAfter = await p.evaluate(() => {
  const pane = document.getElementById('devSel')?.closest('.border-l');
  const f = [...document.querySelectorAll('iframe')].find(x => x.src.includes('/local/harmonium'));
  const box = f?.parentElement;
  return { w: pane ? Math.round(pane.getBoundingClientRect().width) : -1,
    frame: f ? { w: Math.round(f.getBoundingClientRect().width), h: Math.round(f.getBoundingClientRect().height), layoutW: f.offsetWidth } : null,
    box: box ? Math.round(box.getBoundingClientRect().width) : -1 };
});
ck('tablet pane is 672 wide (' + paneAfter.w + ')', paneAfter.w === 672);
ck('frame draws at 640×400 (' + JSON.stringify(paneAfter.frame) + ')', paneAfter.frame && paneAfter.frame.w === 640 && paneAfter.frame.h === 400);
ck('iframe layout width stays 1280', paneAfter.frame && paneAfter.frame.layoutW === 1280);
const inner = await (async () => {
  const fr = p.frames().find(f => f.url().includes('/local/harmonium'));
  if (!fr) return null;
  try { return await fr.evaluate(() => ({ w: innerWidth, wide: document.documentElement.classList.contains('wide'), tablet: document.documentElement.classList.contains('view-tablet') })); }
  catch { return null; }
})();
ck('engine inside sees 1280 and is wide + view-tablet (' + JSON.stringify(inner) + ')', inner && inner.w === 1280 && inner.wide && inner.tablet);

/* ---- 5. round trip ---- */
await p.evaluate(() => { [...document.querySelectorAll('button')].find(x => x.textContent.includes('Save & Deploy'))?.click(); });
await p.waitForTimeout(800);
ck('saved', !!posted);
const sec = posted?.screens?.porch?.sections?.find(s => s.role === 'devices' || s.title === 'Devices');
ck('row:join saved', sec?.row === 'join');
ck('stretch:true saved', sec?.stretch === true);
ck('columns:2 (Medium) saved', sec?.columns === 2);
ck('keep not written while on (default)', sec?.keep === undefined);
ck('spacer tile saved', Array.isArray(sec?.tiles) && sec.tiles.some(t => t.type === 'spacer'));
const pg = posted?.screens?.porch;
ck('surfaces saved as ["remote"] (' + JSON.stringify(pg?.surfaces) + ')', Array.isArray(pg?.surfaces) && pg.surfaces.length === 1 && pg.surfaces[0] === 'remote');
ck('focus_ring off saved (' + pg?.focus_ring + ')', pg?.focus_ring === 'off');
ck('view tablet saved on default', posted?.remotes?.default?.view === 'tablet');
/* the duplicate */
const cp = posted?.screens?.porch_2;
ck('copy saved as porch_2 named "Porch copy"', cp && cp.name === 'Porch copy');
ck('copy: surfaces ["tablet"] (' + JSON.stringify(cp?.surfaces) + ')', Array.isArray(cp?.surfaces) && cp.surfaces.length === 1 && cp.surfaces[0] === 'tablet');
ck('copy: grid.wide_columns 7 (' + cp?.grid?.wide_columns + ')', cp?.grid?.wide_columns === 7);
ck('copy: sits right after porch in screen_order', (() => { const o = posted?.screen_order || []; return o.indexOf('porch_2') === o.indexOf('porch') + 1; })());
const idsOf = (s) => (s?.sections || []).flatMap(x => (x.tiles || []).map(t => t.id)).concat((s?.tiles || []).map(t => t.id));
ck('copy: tile ids re-minted (none shared with porch)', cp && idsOf(cp).length === idsOf(pg).length && !idsOf(cp).some(i => idsOf(pg).includes(i)));
ck('copy: the activities band still names porch as its room', (cp?.sections || []).some(x => (x.tiles || []).some(t => t.type === 'activities' && t.room === 'porch')));
ck('porch itself unchanged by the duplicate (still 1 page of that name)', Object.values(posted?.screens || {}).filter(s => s.name === 'Porch').length === 1);

console.log(JSON.stringify({ ok: errs.length === 0, errs }, null, 1));
await b.close();
if (errs.length) process.exit(1);

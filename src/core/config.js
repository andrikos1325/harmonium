/* ================================================================
   CONFIG — loaded from config.json at boot. Everything user-
   specific (screens, sections, activities, keymap, theme) is data.
   ================================================================ */
let CONFIG = null;
let WS = "main";  /* WORKSPACE (v0.34) — which world this remote lives
                     in. main = the repo-built config.json; any other
                     id loads config.<ws>.json (Studio-published).
                     Provisioned like `device`: #ws=bedroom once →
                     localStorage. Rides along on harmonium.* service
                     calls so sequences run from the right workspace. */
let DEVICE = {};                              // active device profile
let CAPS = new Set(["touch", "pointer"]);     // its capabilities

let KEYMAP = {                    // default shell quirk table
  "ArrowUp": "up", "ArrowDown": "down", "Tab": "down",
  "ArrowLeft": "left", "ArrowRight": "right",
  "Enter": "select", " ": "select",
  "+": "vol_up", "=": "vol_up", "-": "vol_down",
  "PageUp": "ch_up", "PageDown": "ch_down",
  "m": "mute", "M": "mute",
  "`": "mute", "AudioVolumeMute": "mute",      // Astrion mute = backtick (kc 192)
  "[": "back", "Escape": "back", "Backspace": "back",
  "]": "home", ";": "home",
  "F1": "home", "BrowserHome": "home",          // Astrion home = F1 (kc 112)
  "{": "back_hold", "}": "home_hold",           // shell long-press keys
  "#": "menu",                                   // Astrion menu key
  "@": "menu_hold",                              // menu long-press (KeyMapper)
  "'": "ch_up_hold", "/": "ch_down_hold",        // CH long-press → LCD focus
  ",": "left_hold", ".": "right_hold",           // ◀▶ long-press (KeyMapper)
  "F2": "power", "p": "power", "P": "power",
  "o": "power_hold", "O": "power_hold"
};

async function loadConfig(ws) {
  /* a non-main workspace reads its own deployed file; if it isn't
     there (deleted, never published) fall back to main so the remote
     still boots — with a flag the caller can surface */
  if (ws && ws !== "main") {
    const r = await fetch("config." + ws + ".json", { cache: "no-store" });
    if (r.ok) return { cfg: await r.json(), ws };
  }
  const r = await fetch("config.json", { cache: "no-store" });
  if (!r.ok) throw new Error("config.json: HTTP " + r.status);
  return { cfg: await r.json(), ws: "main", missed: ws && ws !== "main" ? ws : null };
}

let THEMED = [];   /* vars set by the last applyTheme — cleared first so
                      a REMOVED key falls back to the stylesheet default
                      (live Studio editing relies on this) */
/* focus-ring (v0.87.0): a colour rides through as the --focus-ring
   token like any other key; the words off / none / false / 0 mean
   "no ring" and become html.noring instead (an invalid colour in the
   token would fall to currentColor and paint a WHITE ring — the
   opposite of what was asked). The class is recomputed on every
   apply, so a remote profile can switch it either way (remotes.<id>
   .style rides the same map: a touch-only phone turns it off while
   the d-pad remotes keep theirs). */
const RING_OFF = /^(off|none|false|0|no)$/i;
/* ---- PER-PROFILE AND PER-PAGE KNOBS (0.88, tablet-layout.md §6) ----
   A wall tablet is a fleet unit wearing a profile: remotes.<id> may
   carry `view` (remote | tablet — a label the engine branches on),
   `scale` (a zoom on the engine root; the density dial), and
   `home_screen` (where THIS remote boots and where Home goes).
   A page may carry `surfaces` (which views list it — a paging/list
   filter, never a lock) and `focus_ring` (a colour or off; precedence
   page → profile → theme, re-applied on every navigate). */
function deviceView() { return (DEVICE && DEVICE.view) || "remote"; }
function deviceScale() {
  const s = DEVICE && +DEVICE.scale;
  return s > 0 && s < 8 ? s : 1;
}
function homeScreen() {
  const h = DEVICE && DEVICE.home_screen;
  if (h && typeof screenOf === "function" && screenOf(h)) return h;
  return CONFIG ? CONFIG.home_screen : undefined;
}
function shownHere(sc) {
  if (!sc || !Array.isArray(sc.surfaces) || !sc.surfaces.length) return true;
  return sc.surfaces.indexOf(deviceView()) >= 0;
}
/* the page's ring override rides the same map as the theme and the
   profile: re-apply the merged theme with the page's word on top;
   `off` stays "transparent, not absent" (html.noring) */
/* THE MERGED THEME (0.88): theme → the profile's view defaults → the
   profile's style. A `view: tablet` profile turns the focus ring off
   unless its style says otherwise (tablet-layout.md §15 ruling 5: a
   wall has no d-pad, so the cursor is a ring stuck on the last tap);
   pages still override through applyPageRing. */
function themeBase() {
  const base = Object.assign({}, (CONFIG && CONFIG.theme) || {});
  if (DEVICE && DEVICE.view === "tablet") base["focus-ring"] = "off";
  return Object.assign(base, (DEVICE && DEVICE.style) || {});
}
function applyPageRing(sc) {
  const over = sc && sc.focus_ring != null && sc.focus_ring !== "" &&
    sc.focus_ring !== "inherit";
  if (!over && !S._pageRing) return;          /* nothing to apply or undo */
  S._pageRing = !!over;
  const base = themeBase();
  if (over) base["focus-ring"] = sc.focus_ring;
  applyTheme(base);
}
/* THE "ON" STATE AT TWO METRES (0.88 phase 3 — tablet-layout.md §7,
   ruling 6: "wash everywhere, the wall profile overlays fill"). Two
   theme keys, both overlayable per profile through remotes.<id>.style:
     active-style: wash | fill — fill paints a running/on tile in the
       solid identity colour (html.active-fill; the CSS does the rest);
       wash is today's bloom/tint.
     wash-strength: a multiplier on the ON-state wash alphas (0.5 =
       half as strong, 1.5 = half again, clamped to 1) — more wash
       without going solid. The RESTING alphas are untouched
       (2026-09-14 — Suresh: "Wash strength for Active is great, but
       Off seems to ratchet up too"): the knob is about the on state
       reading at two metres, and a resting tile that brightens with
       it takes the contrast away again. Applied here as numbers on
       the alpha tokens, not as calc() in rgba(): the Chromium 61
       floor has no calc() inside a colour function. The tokens'
       defaults are mirrored in WASH_ALPHAS; tokens.css stays the
       source of the values. */
const WASH_ALPHAS = { "wash-a-on": 0.75, "awash-a-on": 0.4, "wash-a-tint-on": 0.25 };
function applyTheme(theme) {
  for (const k of THEMED) document.documentElement.style.removeProperty(k);
  THEMED = [];
  let noring = false, fill = false, strength = 1;
  const setVar = (k, v) => {
    document.documentElement.style.setProperty("--" + k, v);
    THEMED.push("--" + k);
  };
  for (const [k, v] of Object.entries(theme || {})) {
    if (k === "focus-ring" && RING_OFF.test(String(v).trim())) { noring = true; continue; }
    if (k === "active-style") { fill = String(v).trim().toLowerCase() === "fill"; continue; }
    if (k === "wash-strength") {
      const n = parseFloat(v);
      if (n >= 0 && n !== 1) strength = Math.min(4, n);
      continue;
    }
    setVar(k, v);
  }
  if (strength !== 1)
    for (const [k, d] of Object.entries(WASH_ALPHAS))
      if (!(k in (theme || {}))) setVar(k, String(Math.min(1, +(d * strength).toFixed(3))));
  document.documentElement.classList.toggle("noring", noring);
  document.documentElement.classList.toggle("active-fill", fill);
}

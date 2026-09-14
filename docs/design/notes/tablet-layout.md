# Tablet layout — pages are pages

Status: **DESIGN for 0.88 (2026-09-11, second pass the same day), not
built.** Written from a discussion with Suresh; §2 is what he has
ruled, the rest is the proposal built on it. Supersedes the archived
thought `archive/design/tablet-mode.md` (the "projection" idea) on
the one point that matters — §1.

Prompted by his two hand-built Lovelace boards (a Pergola page: six
rows of small tiles under a row of large scene buttons; a Home page:
weather + clock + media summaries, then room sections two to a row)
and three mock-ups of the Music controller on a landscape tablet
(letterboxed; two columns; controls beside an on-screen remote).
Every card on the boards is already a Harmonium primitive except
weather and the clock.

## 1. The decision: separate pages, shared building blocks

The archived thought wanted one page drawn at two densities. The
fear behind it was the drift on the Lovelace board — dead cards,
Unavailable tiles. That drift was entity-level rot, and Harmonium
does not have it at the page level: a tile references a device, an
activity, a preset — building blocks with one definition and Studio
validation. Two pages that show the Lounge heater point at the same
heater.

What is left to share is LAYOUT, and layout is exactly what a
480×800 remote and a 1920 wall do not want to share: three to four
times the content, a different reading distance, no d-pad.

So: **a wall board is a page you build for the wall**, from the same
activities, devices, presets and controllers, with whatever layout
suits it. Not a "tablet page" type, not a mode, not an override
accordion. A page that happens to suit both surfaces (a simple room
page usually does) can be pointed at from both; nothing forbids it,
nothing requires it. Same workspace throughout — the board and the
remote must agree about what is running; workspaces stay for
genuinely different worlds.

Sharing between a remote page and a board page happens through the
building blocks, not through snippets: a snippet copies, and a copy
drifts. (§10 has the "instanced tile" idea that would make even
sections shareable by reference.)

## 2. Rulings so far (Suresh, 2026-09-11)

- Pages get their own focus-ring override.
- A section says one of two things about its row: **own the row**,
  or **join the previous row**. Own wins over join.
- A row does not need to be full. In a 7-column page, a 3-tile
  section plus a joined 2-tile section is a row with 5 of 7 filled.
  Stretching is explicit: the section says a tile scale (1.4, or
  7/5), otherwise gaps stay.
- **Keep together**: a joining section with more tiles than the row
  has room for either flows (tiles wrap into the next row) or, with
  Keep together on, joins only if all of it fits and otherwise starts
  its own row.
- Tile widths must not stretch with the screen: "a 50% tile on a
  remote makes sense; on a 1920 tablet it looks silly."
- Spacer / blank tiles.
- A section has an alignment (start / center / end).
- The subtle running wash is not enough at wall distance; an "on"
  palette or the knobs behind it.
- Band height, columns and tile size a board wants ("band 1: 200 px
  tall, 7 columns") are ordinary layout settings, not tablet ones.
- Controllers: letterboxing wastes the screen; combine a scale
  factor with column breakpoints; portrait tablets matter too.
- Simplicity over power where the two conflict here.

## 3. One unit: the tile column

Everything is measured in **standard tile columns** — the width one
×1 tile takes at the page's declared tile size. The page has C of
them at a given screen width (derived from the tile size, exactly as
the wide class does today: `columns: 2` at 480 is ~223 px per tile,
so 5 columns at 1280 and 8 at 1920). A section OCCUPIES some of
those columns; a tile SPANS some of its section's. No fractions
anywhere; the first-pass ½ / ⅓ model is withdrawn.

| Setting | Unit | Studio label |
|---|---|---|
| page / section `columns` | tile SIZE at 480 (1–4) | "Tile size: large / medium / small / tiny", with the derived counts shown ("2 on the remote · 5 on a tablet") |
| section `cols` | tile columns occupied (default: tiles across, capped at C) | "Takes: 3 columns" |
| section `tile_scale` | multiplier on the tile width inside this section (default 1; `stretch: true` computes C-remaining ÷ tiles) | "Stretch to fill" / "Tile scale" |
| tile `span` | tile columns of its section | "Width: ×1 · ×2 · ×3 · Full" |

**The change to v0.68's span rule.** v0.68 made every span a
fraction of the rendered count: ×2 of a declared 4 became a fifth of
ten columns at 1280 — two tiles wide there, five at 1920, the
billboard. New reading: span N below the declared count is N tile
columns at any size; span ≥ declared is **Full** — the whole of the
section's columns, the one word that stretches, for the hero, the
Now Playing band, a group that wants the row. `max_width` caps a
section (controllers use it today), so Full is full of the cap, not
the wall. At 480 nothing changes. On an existing tablet profile a
handful of ×2/×3 tiles get narrower than they were; the stored
numbers do not move, so nothing heals — one behavior line in the
audit covers it.

The config keeps `span`, `columns`, `tile_width` as they are; the
Studio relabels. No migration.

## 4. The section row rule

A section carries `row: "own" | "join"` (default own — every
existing page renders unchanged) and, for join, `keep: true | false`
(default true).

**Own.** Starts a new row, takes the full width (all C columns), and
the next section starts a new row whatever it asks for. Inner
`columns` untouched — own/join is about the row, `columns` is about
the tiles.

**Join, kept together** (`keep: true`). The section is a block of
`cols` columns. If the row has that many left, it sits beside the
previous section, header above its own tiles; otherwise it starts a
new row. 3 + 2 in 7 fits (2 columns stay empty); 3 + 5 does not, and
the 5 go to the next row.

**Join, flowing** (`keep: false`). The section's tiles continue in
the previous section's grid where it stopped, wrapping like text: 3
on the row, the next 5 fill the remaining 4 and one wraps. A flowing
section has no band header — it starts mid-row — so its `label`
either is not drawn or is drawn as a ×1 text-only label tile in the
flow (`label_style: "inline"`); default not drawn. Use flow for one
long run of small tiles under one heading split for styling, or a
strip of controls; use kept-together for anything with a heading.

Packing is greedy, in authored order, never reordered — flexbox
wrap, not masonry. A later section is never pulled up to fill a gap:
the moment sections can move, the page cannot be read top to bottom
and the stacked rendering would not be the same order.

**Rows need not be full.** Gaps are legal. A section that wants to
fill says `stretch: true` (its tiles scale to the remaining columns)
or a `tile_scale`. Joined sections are top-aligned, each as tall as
its own content; the row is as tall as the tallest; no equalizing.

**Alignment.** `align: "start" | "center" | "end"` (default start):
where an owning or kept-together section's tiles sit within the
columns it occupies when they do not fill them. A single power tile
`align: end` on a 7-column row sits at the right — no spacers
needed. A flowing section has no block of its own and no alignment.

**Spacers.** `type: "spacer"`, `span` as any tile: draws nothing (no
card, no border), takes its columns, never enters the focus walk.
Works everywhere, including the remote.

Edge cases: a join section that is first on a page starts the first
row and takes its columns. On the remote (C = 2 at 480; a phone in
landscape never reaches the wide class) nothing ever fits beside
anything: kept-together join means new row; flowing join simply
continues the two-column grid. The page is the stack it always was.

Worked example — his Home board: Pergola `own`; Lounge `join, keep,
cols 2`; Dining `join, keep, cols 2`; Porch `own`. His Pergola board:
six owning sections; the scene row is a section with `tile_h: 200`
and large tiles; nothing else new.

## 5. Layout fields on Section settings (the "accordion", dissolved)

The knobs a board needs already exist as grid keys and are honored
per page and per section — `columns`, `tile_width`, `tile_h`,
`row_h`, `tile_style`, `max_width` (the per-activity `views` tuning
spreads exactly these). They are not on the Section settings dialog.
Putting them there, with the row rule, is the whole layout job:

    Section settings
      Label · Enabled
      Tile size    [large ▾]        2 on the remote · 5 on a tablet
      Tile style   [card ▾]
      Height       [ 200 ] px       (tile_h for cards / row_h for rows)
      Row          (•) Own the row  ( ) Join the previous row
                     [x] Keep together      (join only)
      Takes        [ 3 ] columns    (default: as many as it has tiles)
      Stretch      [ ] fill the row  ·  Tile scale [1.0]
      Align        [start ▾]
      Max width    [     ] px
      Tiles        … ＋ Add tile  ＋ Add spacer

Nothing here is tablet-specific. A taller scene band that looks good
on the remote too is the same field.

## 6. Per-profile knobs — the wall is a fleet unit wearing a profile

- **`view`** — `remote | tablet` beside skin and keymap; the pairing
  flow can ask. It is a label the engine and the Studio branch on
  (key band, preview frame, defaults), not a layout.
- **`scale`** — a zoom on the engine root (1.0 remote; 1.3–1.5 for a
  tablet at arm's length). The archived note's "density dial", and
  the whole answer for a PORTRAIT tablet: 800 wide never reaches the
  wide class, so a portrait tablet is a big remote, and it only needs
  to be bigger.
- **`home_screen`** — the boot page for this remote (the tablet lands
  on the Home board, the Astrion on Porch). Falls back to the
  workspace's. Home key follows it.
- **Theme overlay** (exists) — `active_style` and `wash_strength` (§7)
  and `focus-ring` set here for the wall.
- **`capabilities`** (exists) — the absence of a physical d-pad is
  what shows the virtual key band (§8).

And per page: **`surfaces`** (`["remote","tablet"]`, default all) so
board pages stay out of the remote's page nav / rooms hub and room
pages out of the wall's — a nav/list filter only; a direct navigate
still works. **`focus_ring`** — a color or `off`, default inherit;
precedence page → profile → theme; applied on every `navigate()`
(today `applyTheme` sets `html.noring` once at boot); `off` stays
"transparent, not absent" per the 0.87 ruling so a d-pad remote
landing on a touch-styled page is not stranded.

## 7. The "on" state at two metres

The running wash and the resting badge were tuned for a remote in
the hand. At wall distance the wash reads as nothing. The fix is a
knob on the identity-palette math, not a second palette:

- `active_style: "wash" | "fill"` — fill draws the active tile in the
  solid pale accent (what his Lovelace board does for Lights On, Dog
  Mode); wash is today's.
- `wash_strength` — for more wash without going solid.

Both are theme tokens, so the wall profile overlays `fill` and the
Astrion keeps `wash`. The derivation stays in the identity-palette
note's math so the colors stay derived, not eyeballed.

## 8. Controllers on a tablet

His three mock-ups are three answers for three situations; the job
is the mechanism, not the picture.

**Letterbox** (mock-up 1) — what `max_width` does today, and right
for a PORTRAIT tablet, given `scale` (§6). No new mechanism.

**Columns** (mock-up 2: Now Playing, transport, volume on the left;
Zone Amps, Source, Presets on the right) — the controller's bands
flow into columns on a wide screen. A controller's bands are already
an ordered list (the Controller tab's ↑↓, the one order lever); the
proposal is that **bands are sections** and take the same fields —
`row`, `keep`, `cols`, `align`, `stretch` — instead of a parallel
vocabulary. Mock-up 2 is then: page columns 6, Now Playing owns 3,
transport and volume join beneath it in its column… which exposes a
gap: the row rule packs LEFT-TO-RIGHT, and mock-up 2 is two
top-to-bottom columns. Two ways to get there, for ruling: (a) a
`column` on each band (1 / 2 / auto) when the controller declares
`wide_columns: 2` — explicit, and the Controller tab draws it as two
lists; (b) row-packing only, with the author grouping bands into two
kept-together "column" sections. (a) is clearer to author and to
read; (b) needs no new concept. Leaning (a) for controllers, since a
controller's bands are generated and a column assignment is the one
thing the author actually decides.

**Soft remote** (mock-up 3: controls left, an on-screen d-pad with
OK, Back/Home, Vol, CH, Menu/Info, Power on the right) — the piece
that needs building. A tablet has no physical keys, so a TV activity
on a tablet has no d-pad at all today. The **virtual key band** is
the physical remote drawn on glass: every press routes through the
same ladder a physical key does — the control target, the dialect,
the pass-through chips, the TV-tuner switch — so it is not a second
key model. The engine has the pieces: the `dpad` widget, the TV
strip's BACK | HOME, volume and channel steppers; the Studio preview
already draws a soft remote for the same reason. What makes it
honest: the band is **conditional on the profile** — shown when the
remote's `capabilities` carry no physical d-pad, hidden on the
Astrion. Same controller, no fork. Default position: last in the
band order, movable like any band.

**No new stock controllers.** Column assignment plus the key band on
the existing stock TV and Music controllers cover all three
mock-ups; a custom copy is there for anyone who wants a different
arrangement. A "TV Media Player (wide)" stock would be the
double-authoring path again, inside stock.

## 9. New content the boards need

- **Weather tile** — its own design (fetch, cache, staleness); ruled
  earlier as a separate future design, now needed. Owns the top-left
  of his Home board.
- **Clock tile** — trivial; a text tile with a template that ticks.
- **Template tile** — the "sensor readout" building block from
  beta-gaps §6.3 (value + unit + name) with a template for the value;
  also stands in for the mini-graph slot (no graph).
- Media summaries (Porch TV / Porch Music / Deck Music) are Now
  Playing at compact density — the existing media tile in its row
  form; nothing new.

## 10. Open idea — instanced tiles ("cake and eat it too")

Suresh, 2026-09-11: "if we turn every activity and device tile into
something that can be instanced we could have our cake and eat it
too… maybe." The shape: a tile (or a whole section) is DEFINED once,
in a library, and PLACED on any page by reference, with
per-placement overrides (width, label, accent) — edit the
definition, every placement follows; snippets become links instead
of copies.

The pattern is not new here: controllers are templates that devices
adopt; activity presets are placed with `include`; `$device` and
`$context` are references resolved at render; `presets_from`
generates tiles from a source. What would be new is a tile catalog
with ids and a `ref:` in place of a full tile body, plus ownership
rules so an override survives a definition edit (the referee in
`ownership.js` and the fingerprint history already do this for stock
controllers).

Not for the first cut. Worth a design of its own once the board pages
exist and it is clear which sections people actually want on both
surfaces. Until then, reuse the page.

## 11. Studio

Section settings per §5, with a one-line hint under Row ("Join: sits
beside the section above when the screen is wide enough; stacks on a
remote"). Page settings: Shown on, Focus ring. Profile editor: view,
scale, home screen. Controller tab: the wide column assignment (§8a)
if ruled. The preview needs a **tablet frame** — 1280×800 and
1920×1080 landscape presets, plus portrait — beside the remote
skins, so rows can be seen forming; this is the largest single piece
of the work.

## 12. Open questions (for rulings, before any build)

1. Controller columns: (a) explicit per-band `column` under a
   `wide_columns` count, or (b) row-packing only (§8). Leaning (a).
2. Bands share the section fields (row / keep / cols / align /
   stretch) — confirm; it touches the Controller tab.
3. Virtual key band contents and default position (last?); does it
   also appear on a phone profile (touch, no d-pad) — leaning yes,
   since the rule is "no physical d-pad", not "is a tablet".
4. Tile width labels: whatever the section's tile size makes true
   (×1/×2 of 3 when 3-up) — leaning yes.
5. Wall profile turns the focus ring off by default (profile level,
   pages override) — leaning yes for `view: tablet`.
6. `active_style` defaults: `wash` everywhere, wall profile overlays
   `fill` — or `fill` whenever `view: tablet`? Leaning the overlay,
   set by the pairing flow's tablet choice.
7. Tablet preview frame: fixed presets, or the paired tablet's real
   viewport (the fleet already knows it)?
8. The ambient/idle layer (dim to clock + weather + Now Playing after
   N minutes) — the archived note's last item. Not 0.88; noted so it
   is not forgotten.

## 13. Sequencing

1. Engine: the tile-column model and the span reading (§3); `row`,
   `keep`, `cols`, `stretch`/`tile_scale`, `align` on sections;
   spacers; per-page focus ring and `surfaces`; per-profile `scale`,
   `home_screen`, `view`. Fences: a probe with his two boards as
   fixtures at 480, 1280 and 1920, including 3+2 fits / 3+5 wraps /
   3+5 kept starts a row.
2. Engine: bands as sections; the wide column assignment; the
   virtual key band gated on capabilities.
3. Theme: `active_style`, `wash_strength` through the identity
   palette.
4. Studio: Section settings fields; tablet preview frame; page,
   profile and Controller-tab settings.
5. Content: template tile, clock, then weather.
6. Docs: cookbook "Building a wall board" with his Home page as the
   walkthrough; the audit behavior line for the span change.

## 14. As built (2026-09-11) — steps 1 and 4 of §13, what differs from the text above

Step 1 (engine) and step 4 (Studio, minus the Controller tab) are
built, fenced and in the repo. Two things came out differently from
the wording above; the design is the same, the mechanics are not.

**Flowing join continues the PAGE grid, not the previous section's
inner grid.** §4 says a flowing section's tiles "continue in the
previous section's grid where it stopped". Built that way the flow
wrapped inside the previous block's box and never crossed into the
row's empty columns. As built, a flowing section's tiles are
appended straight into the page grid after the previous block (the
block is `grid-column: span N`, so CSS auto-placement puts the first
flowing tile in column N+1 of the same row and wraps the rest); they
carry class `flow` and are bottom-aligned so they sit level with
the previous block's last row. The optional inline heading is a
one-column label tile in the same stream. `probe-section-rows`
fixture `flow` checks the first flowing tile shares the previous
block's baseline.

**`tile_scale` is columns per tile.** A `tile_scale` of 1.4 on a
five-tile section makes the block seven columns wide and draws five
tiles across it (inner columns = round(N / scale)); on an owning
section it is the same arithmetic against the full width. Stretch
is the special case "scale so the tiles fill what is left of the
row". Anything else read as "a tile is 1.4 tiles wide" and produced
half-row tiles.

**Span reading (§3), as built.** `span: N` with N below the
section's declared tile size is N tile columns; N at or above it is
Full. The Studio's Width picker offers exactly ×1 … ×(declared−1)
and Full, so an author cannot write a value the engine reads
differently. A page or section declaring 1 column offers Full only.

**Studio.** One component, `SectionLayoutFields.svelte`, renders the
§5 fields inside the Hub editor's shared Section settings for
Activities, Presets, Devices and custom sections alike (the
controller bands take the same component in step 2). "＋ Spacer" is
a small header button on Devices, custom and flat sections. Page
settings → Layout has Shown on and Focus ring; the Remotes editor
has View, Scale and Home screen per profile. The preview: a profile
with `view: tablet` and no viewport of its own previews at 1280×800
landscape; the pane widens to 672 and the frame is drawn at half
size (CSS transform — the engine inside still measures 1280, so the
wide gate trips and rows form as on the panel). No 1920 or portrait
preset yet; a profile with a measured `viewport` uses it. Fences:
`tests/probe-studio-section-layout.mjs` (runs in the container from
`studio-src/build`).

**Not built yet.** Step 2 (bands as sections, the wide column
assignment, the virtual key band), step 3 (`active_style`,
`wash_strength`), step 5 (template, clock, weather), step 6 (docs),
and the tablet preview's 1920 / portrait presets. The §12 questions
still stand where they were.

## 15. Rulings on §12 (Suresh, 2026-09-13)

1. Controller columns: **(a)** — explicit per-band `column` under a
   `wide_columns` count.
2. Bands share the section fields (row / keep / cols / align /
   stretch): **yes**; the Controller tab takes the same component.
3. Virtual key band: **yes** — and it appears on any profile without
   a physical d-pad, phone included; the rule is "no physical d-pad",
   not "is a tablet". Default position last.
5. Focus ring off by default for `view: tablet`, at profile level,
   pages able to override: **yes**.
6. `active_style`: **the overlay** — `wash` everywhere, the wall
   profile overlays `fill`.
7. Tablet preview frame: **set when the remote profile is created**
   (a frame chosen at creation), because the wall is usually designed
   before a tablet is paired; when one IS paired, its real viewport
   is the better answer ("cool idea… but only works if there is
   one").

Item 4 (tile width labels follow the section's tile size) is as
built (§14). Item 8 (the ambient layer) stays parked.

## 16. Columns on the wall, and Duplicate page (2026-09-13)

Suresh, after the first walk-through: "I don't like #1. I have a
tablet view, I know for *this* dashboard the max number of tiles
(i.e. lets say heater devices) is 7. So I want 7 columns. Not just
what a preset Medium/Small gives me. Also I need a duplicate page
function. I'm wondering if we've taken a wrong turn and on tablet
mode pages, we should have a tablet tab? Because what looks great on
a tablet looks wrong on a physical remote."

The ruling: not a wrong turn, one knob short. The tile size earns its
keep on a page shared by a remote and a wall; a wall-only page gets
nothing from it. So:

**`wide_columns`** on a page (`grid.wide_columns`) and on a section is
an explicit count for wide panels — the author's number, the same at
1280 and 1920, ignored on a compact panel (where the tile size still
rules). When the page names its count a section's tile size is a
remote-only fact — the wall count is the wall count — unless the
section names its own `wide_columns`. Span reads against the same
number. Engine: `wideColumnsOf` in `tiles.js`, used by `render.js`
for the page count, the section count and the block's inner count;
`probe-section-rows` fixture `wall` (7 heaters on one row at 1280 and
1920, span 3 = three of seven, span 7 = the row, a section's own 3;
2 per row at 480).

**Studio.** Page settings → Layout: "Columns on the wall" beside Grid
columns; Section settings: the same field beside Tile size. On a page
shown only on wall tablets (Shown on: Remotes & phones off) the tile
size fields are hidden and the summary reads in columns. The Width
picker's declared count follows the engine (section `wide_columns` →
page `wide_columns` → section tile size → page tile size), so a
7-column wall offers ×1…×6 and Full. Unticking the last surface is
refused (a page shown nowhere is not a choice).

**Duplicate page.** A button beside Page settings: a deep copy under
`<id>_2`, named "<name> copy", right after the original in
`screen_order`, tile ids re-minted (intra-page references rewritten).
The activities band's `room` still names the original, so the copy
shows the original's activities; the editor lists them with a note
and sends "add" back to the owner. This is the wall-board workflow:
duplicate the room page → Shown on: wall tablets only → Columns on
the wall → tune. The remote never sees the copy; the wall never sees
the original.

**The tablet tab, declined.** A tab would be one page carrying two
layouts — the dual-purpose thing §1 chose against — and where every
setting grows a twin. Separate pages plus Duplicate give the same
workflow with no twins.

Fences: `probe-section-rows` (wall fixture),
`probe-studio-section-layout` (duplicate → wall-only → 7 columns →
Width picker → round trip). Still open from §12: nothing — phase 2
(bands as sections, wide column assignment, virtual key band) starts
on the §15 rulings.

## 17. Phase 2, as built (2026-09-14)

**Stacks (ruling 1, (a)).** `surface.wide_columns` (2–4) on the
activity and `surface.band_column.<band>` per band — the Controller
tab's "On the wall" select and a stack picker on every band row.
Unnamed bands stand in stack 1; the on-screen remote in the last, so
Two stacks on the stock TV is mock-up 3 with no clicks. A tile's or
section's own `column` wins (a custom controller's authored answer).
Each stack is its own tile grid at the page's tile size fitted to the
stack's width; stacks are independent in height; a compact panel
never stacks. The wide-column count of §16, when set on a controller,
is shared out across the stacks. Not built: "auto" as a third value —
unnamed = stack 1 is the auto.

**Bands share the section fields (ruling 2).** The controller
editor's sections carry "Section settings" with the same component
the Hub editor uses, and its Layout box has "Columns on the wall". A
band that is one full-width tile has nothing to say about rows; the
fields matter for the Device keys and Devices sections.

**The on-screen remote (ruling 3).** It already existed on the stock
TV — the `dpad` pad (d-pad, OK, info/menu, back/home, VOL, CH) and
the `buttons` strip (back/home/power), gated `unless: physical_dpad`
— so the band was named, not built: `remote` in the band vocabulary
gives it the Controller tab's switch, order arrows, label slot and
stack. It shows on any profile without a physical d-pad, phones
included. "Default position last" was read as the STACK: the remote
stands in the last stack by default; the stock TV's band order on a
phone is unchanged (moving the pad below Volume and Source would
push a phone's most-used control off the first screen). `keys` (the
dialect's Device keys section) joined the vocabulary the same way.
One known seam, unchanged: the pad's CH keys go to the d-pad device
through the dialect, while a physical CH key goes through the
control target's tuner switch — same device in practice.

Fences: `probe-controller-stacks` (480 no stacks; 1280 two stacks,
placement, full width per stack, tile `column` wins, `remote: false`,
band order within a stack, a handset never sees the pad but still
stacks, `keys: false`, no surface → no stacks) and
`probe-studio-controller-stacks` (Controller tab → Two stacks →
pickers → preview draws the stacks with the pad on the right →
Section settings on the controller editor → round trip).

Next: phase 3 (`active_style` / `wash_strength` through the identity
palette, the wall profile overlaying fill), then template, clock,
weather, then the cookbook.

## 18. Phase 3, as built (2026-09-14)

`active-style` (`wash` | `fill`) and `wash-strength` are theme keys,
overlayable per profile (`remotes.<id>.style`) — the §7 knobs, as
ruled in §15 (6: wash everywhere, the wall profile overlays fill).
Fill paints a running or on tile solid in its own identity triplet at
`--fill-a` (0.85); a bloom goes flat (an ellipse at 0.85 is a blob);
a tile with no identity fills with the accent at `--fill-a-plain`
(0.35); glyph and status line ride `--text`. Resting tiles keep their
wash — the on state is what has to read at two metres. Wash strength
multiplies the six wash alphas, clamped at 1, applied by the engine
as numbers (no calc() in a colour function on Chromium 61). Ruling 5
is in the engine: a `view: tablet` profile has the ring off unless
its style names one; pages override as before.

Studio: Theme → Colors gained Active style and Wash strength; a
remote profile gained Active style, Wash strength and Focus ring (the
same keys, one layer down); choosing Wall tablet overlays fill on a
profile that says nothing. The upgrade audit's behavior list for
0.88.0 gained the span reading, the tablet defaults and the remote
band's stack.

Fences: `probe-active-fill` (wash vs fill computed backgrounds at the
exact alphas, strength 2 → 0.8 and a clamp, 0.5 → 0.2, the tablet
ring default and its override) and `probe-studio-active-fill`.

Remaining from §13: step 5 (template tile, clock, weather), step 6
(the cookbook "Building a wall board"), and the preview's 1920 /
portrait frames (ruling 7).

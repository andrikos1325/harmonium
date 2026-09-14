<script>
  /* SECTION LAYOUT (0.88 — docs/design/notes/tablet-layout.md §5): the
     fields that say how a section sits on the page — tile SIZE, the
     wall's column COUNT, and the row rule (own the row / join the
     previous row, keep together, columns taken, stretch, tile scale,
     align). ONE component: the Hub editor's Section settings renders
     it for Activities, Presets, Devices and custom sections alike,
     and the controller editor's bands take the same fields in phase
     2 — never a second copy.

     Everything writes the section's own keys (`columns`,
     `wide_columns`, `row`, `keep`, `cols`, `stretch`, `tile_scale`,
     `align`) and deletes them at their defaults, so a section that
     says nothing stays exactly what it was. The counts beside Tile
     size are the ENGINE's own arithmetic (layout.js, twin of
     tiles.js colsFor), so the author sees what the remote and the
     wall will actually draw.

     COLUMNS ON THE WALL (2026-09-13 — Suresh: "I know for *this*
     dashboard the max number of tiles is 7. So I want 7 columns. Not
     just what a preset Medium/Small gives me."): an explicit count
     for wide panels, the page's by default, overridable here. On a
     page shown only on wall tablets the tile size is hidden — the
     page never draws on a remote, so the count is the whole story. */
  import Field from "./Field.svelte";
  import Segmented from "./Segmented.svelte";
  import Switch from "./Switch.svelte";
  import NumberField from "./NumberField.svelte";
  import Input from "./Input.svelte";
  import { colsAt, wallColsOf, wallWidthOf } from "../layout.js";
  import { app } from "../state.svelte.js";

  /* sec: the section object (mutated in place, like every editor);
     scr: the page (its grid.columns / grid.wide_columns / surfaces);
     tabletOnly: the page is wall-only (hide the remote tile size);
     onchange: the caller's edit() (preview refresh) */
  let { sec, scr = null, tabletOnly = false, onchange = null } = $props();
  const edit = () => onchange?.();

  const pageCols = $derived(scr?.grid?.columns ?? 2);
  const size = $derived(sec?.columns || pageCols || 2);
  /* the wall the hint describes: the previewed tablet's own width */
  const wallW = $derived(wallWidthOf(app.draft?.remotes, app.device));
  const wall = $derived(wallColsOf(scr, sec, wallW));
  const tileWidth = $derived(sec?.columns ? sec.tile_width : scr?.grid?.tile_width);
  const counts = $derived(colsAt(size, 480) + " on the remote · " + wall + " on the wall" +
    (sec?.wide_columns || scr?.grid?.wide_columns ? " (as told)"
      : +tileWidth > 0 ? " (from the " + tileWidth + "px tile width, " + wallW + " wide)"
      : " (derived from the size, " + wallW + " wide)"));
  const setTileWidth = (v) => { const n = parseInt(v); if (n > 0) sec.tile_width = n; else delete sec.tile_width; edit(); };
  const wallAuto = $derived(wallColsOf(scr, sec ? { columns: sec.columns } : null, wallW));

  const SIZES = [{ value: 0, label: "inherit" }, { value: 1, label: "Large" },
    { value: 2, label: "Medium" }, { value: 3, label: "Small" }, { value: 4, label: "Tiny" }];
  const rowMode = $derived(sec?.row === "join" ? "join" : "own");
  const keep = $derived(sec?.keep !== false);
  const setWide = (v) => { const n = parseInt(v); if (n > 0) sec.wide_columns = n; else delete sec.wide_columns; edit(); };
  const setRow = (v) => { if (v === "join") sec.row = "join"; else { delete sec.row; delete sec.keep; } edit(); };
  const setKeep = (v) => { if (v) delete sec.keep; else sec.keep = false; edit(); };
  const setCols = (v) => { const n = parseInt(v); if (n > 0) sec.cols = n; else delete sec.cols; edit(); };
  const setStretch = (v) => { if (v) { sec.stretch = true; delete sec.tile_scale; } else delete sec.stretch; edit(); };
  const setScale = (v) => { const n = parseFloat(v); if (n > 0 && n !== 1) { sec.tile_scale = n; delete sec.stretch; } else delete sec.tile_scale; edit(); };
  const setAlign = (v) => { if (v && v !== "start") sec.align = v; else delete sec.align; edit(); };
</script>

{#if sec}
  <div class="flex flex-wrap items-start gap-6">
    {#if !tabletOnly}
      <Field label="Tile size" hint={counts + " — a size, not a count"}>
        <Segmented value={sec.columns ?? 0} options={SIZES}
          onchange={(v) => { if (v) sec.columns = v; else delete sec.columns; edit(); }} />
      </Field>
    {/if}
    {#if !tabletOnly}
      <!-- the explicit width (v0.68 `tile_width`) — it WINS over the
           size on a wall, so it must be visible here -->
      <Field label="Tile width" hint={sec.tile_width ? "an explicit width — wins over the size on a wall; blank lets the size decide" : "blank: the size decides"}>
        <NumberField min={60} max={1200} suffix="px" placeholder="auto"
          value={sec.tile_width ?? ""} onchange={setTileWidth} />
      </Field>
    {/if}
    <Field label="Columns on the wall" hint={tabletOnly
        ? "how many tile columns this section has (blank: the page's " + (scr?.grid?.wide_columns || wallAuto) + ")"
        : "blank: the page's count, or one derived from the tile size"}>
      <NumberField min={1} max={24} suffix="cols" placeholder={String(scr?.grid?.wide_columns || wallAuto)}
        value={sec.wide_columns ?? ""} onchange={setWide} />
    </Field>
  </div>
  <Field label="Row" hint={rowMode === "join"
      ? "sits beside the section above when the screen is wide enough; stacks on a remote"
      : "a new row, the full width — the next section starts a new row too"}>
    <div class="flex flex-wrap items-center gap-3">
      <Segmented value={rowMode}
        options={[{ value: "own", label: "Own the row" }, { value: "join", label: "Join the previous row" }]}
        onchange={setRow} />
      {#if rowMode === "join"}
        <Switch checked={keep} label="Keep together" onCheckedChange={setKeep}
          title="on: joins only if all of it fits, else starts its own row. off: its tiles flow on from the section above, wrapping like text (no heading)" />
      {/if}
    </div>
  </Field>
  {#if rowMode === "join" && !keep}
    <Field label="Flowing heading" hint="a flowing section starts mid-row, so its heading is not a band; inline draws it as a one-column label in the flow">
      <Segmented value={sec.label_style === "inline" ? "inline" : "none"}
        options={[{ value: "none", label: "None" }, { value: "inline", label: "Inline" }]}
        onchange={(v) => { if (v === "inline") sec.label_style = "inline"; else delete sec.label_style; edit(); }} />
    </Field>
  {:else}
    <Field label="Takes" hint="page columns this section occupies — blank: as many as it has tiles across">
      <NumberField min={1} max={24} suffix="cols" placeholder="auto"
        value={sec.cols ?? ""} onchange={setCols} />
    </Field>
    <Field label="Stretch" hint="fill the rest of the row: the tiles grow. Or a tile scale — each tile this many columns wide (7 columns for 5 tiles = 1.4)">
      <div class="flex flex-wrap items-center gap-3">
        <Switch checked={!!sec.stretch} label="Fill the row" onCheckedChange={setStretch} />
        <span class="text-[11px] text-dim">or scale</span>
        <Input type="number" min="0.5" max="6" step="0.1" placeholder="1"
          value={sec.tile_scale ?? ""} class="w-[88px] font-mono text-[12px]"
          onchange={(e) => setScale(e.target.value)} />
      </div>
    </Field>
    <Field label="Align" hint="where the tiles sit in the columns this section takes when they do not fill them">
      <Segmented value={sec.align || "start"}
        options={[{ value: "start", label: "Start" }, { value: "center", label: "Center" }, { value: "end", label: "End" }]}
        onchange={setAlign} />
    </Field>
  {/if}
{/if}

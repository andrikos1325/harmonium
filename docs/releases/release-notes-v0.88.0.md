# Harmonium v0.88.0 — (working title)

*Draft — opened 2026-09-11 on top of v0.87.0. Add to it as the round goes; the Errata list is what has landed so far.*

## Errata

- **`run_preset` works for presets on an activity.** Presets made on an activity's Presets tab are found now and start their activity first, the same as a tap. Reported by a beta tester on 0.87.0 — thank you.
- **The Actions tab knows the service fields.** `set_activity` offers *Start the activity*, and `run_preset` is described with its *Preset* and *Workspace* fields.
- **An updated integration now replaces an old remote engine.** If a HACS update updated the Studio but left the remote on an older engine, the updater was protecting that file as if you had put it there by hand. It now replaces an engine from an older release, and if it ever leaves one alone it says so in Settings → Logs, with the fix. Reported by a beta tester on 0.87.0 — thank you.

## Wall tablets (new in this round)

- **A page for the wall.** Duplicate any page (the new *Duplicate page* button beside Page settings), set *Shown on* to wall tablets only, and say how many columns it has (*Columns on the wall*). The remote never sees the copy; the wall never sees the original.
- **Sections that share a row.** A section can *Join the previous row* (kept together, or flowing on like text), take a number of columns, fill the rest of the row, scale its tiles, or align them — Section settings, on any section. On a phone everything still stacks as it always did.
- **Spacers** — an empty tile that pushes the next one along.
- **A remote profile can be a wall tablet** (Remotes → View), with its own scale and home screen; pages can turn the focus ring off or recolour it.
- **Controllers on the wall.** In an activity's Controller tab, *On the wall* puts the bands in two or three stacks side by side, each band in the stack you pick; the on-screen remote (the d-pad, OK, back/home/power on glass) is a band of its own now — switch, order, label, stack — and appears on any remote without a physical d-pad, phones included.
- **The on state, readable from across the room.** Theme → Colors has *Active style*: Wash (the bloom and tint you have today) or Fill, which paints a running or on tile solid in its own colour. *Wash strength* turns the wash up or down without going solid. Both can be set per remote, and a Wall tablet profile fills by default. A wall tablet also has the focus ring off unless you say otherwise.
- **Tile widths are sizes now, except Full.** A ×2 tile is two tiles wide on the wall as on the remote; Full is the whole row. Configs don't change; what changed is what a ×2 means on a wide panel.

## Upgrading

Restart Home Assistant after updating — this release changes the integration.

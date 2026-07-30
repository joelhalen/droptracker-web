/**
 * Stylesheet for the recap poster (`components/recap-card.tsx`).
 *
 * Deliberately plain CSS in a template string rather than Tailwind utilities,
 * for three reasons specific to this component:
 *
 *  1. **It is an image, not a page.** The card's whole job is to be
 *     screenshotted into a PNG that gets posted to Discord and to look
 *     identical on the page the post links to. Site theme tokens
 *     (`--dt-*`, swapped by `data-theme`) would make the artifact change
 *     appearance depending on who opened the page — so the poster carries its
 *     own frozen palette and nothing here reads a theme variable.
 *  2. **Fluid scaling.** Every dimension is `calc(var(--u) * n)`, where `--u`
 *     is 16px in a fixed-width context (the 1100px capture page) and
 *     `100cqw / 68.75` inside the fluid wrapper the public page uses. Because
 *     `--u` resolves to a length rather than an `em`, nested elements don't
 *     compound it, so the entire poster — type, rules, icon slots, gaps —
 *     scales as one unit. The page is then literally the same image at a
 *     different size, down to a phone.
 *  3. Arbitrary-value utilities for this many one-off dimensions would be
 *     unreadable, and `next build` does not lint the result.
 */
export const RECAP_CARD_CSS = `
.dtrc-fit { container-type: inline-size; width: 100%; }
.dtrc-fit > .dtrc { width: 100%; --u: calc(100cqw / 68.75); }

.dtrc {
  /* Design unit: 1100px poster = 68.75u. */
  --u: 16px;
  width: calc(var(--u) * 68.75);
  box-sizing: border-box;

  /* Frozen palette — mossy stone, weathered bronze, lantern gold. */
  --ink: #070b08;
  --stone-hi: #33412f;
  --stone: #1d271f;
  --stone-lo: #121a14;
  --slate: #0f1712;
  --bronze: #7c6135;
  --bronze-hi: #c49a55;
  --gold: #ffd166;
  --gold-dim: #d9a53c;
  --parch: #efe6d2;
  --dim: #a1997f;
  --good: #7fc47f;
  --bad: #e07a63;

  position: relative;
  padding: calc(var(--u) * 1.35);
  color: var(--parch);
  font-family: var(--font-figtree), "Trebuchet MS", "Segoe UI", system-ui, sans-serif;
  font-size: calc(var(--u) * 0.875);
  line-height: 1.2;
  -webkit-font-smoothing: antialiased;
  background:
    repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.13) 0 calc(var(--u) * 0.09), rgba(0, 0, 0, 0) calc(var(--u) * 0.09) calc(var(--u) * 6.25)),
    linear-gradient(180deg, #4b5940 0%, #33402f 5%, #253026 35%, #1c251c 75%, #141b15 100%);
  box-shadow:
    inset 0 calc(var(--u) * 0.125) 0 rgba(255, 240, 200, 0.22),
    inset 0 calc(var(--u) * -0.2) 0 rgba(0, 0, 0, 0.65),
    inset calc(var(--u) * 0.125) 0 0 rgba(255, 240, 200, 0.08),
    inset calc(var(--u) * -0.125) 0 0 rgba(0, 0, 0, 0.5),
    inset 0 0 0 calc(var(--u) * 1.15) rgba(0, 0, 0, 0),
    inset 0 0 calc(var(--u) * 2.5) rgba(0, 0, 0, 0.45);
}

/* Carved-stone grain over the frame. Inline SVG turbulence: no network fetch,
   which matters because the screenshotter blocks on outstanding images. */
.dtrc::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.5;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/></filter><rect width='140' height='140' filter='url(%23n)' opacity='0.55'/></svg>");
}

/* ── inner panel ─────────────────────────────────────────────────────────── */
.dtrc-in {
  position: relative;
  overflow: hidden;
  border: calc(var(--u) * 0.125) solid rgba(178, 140, 76, 0.95);
  outline: calc(var(--u) * 0.0625) solid rgba(0, 0, 0, 0.65);
  border-radius: calc(var(--u) * 0.5);
  padding: calc(var(--u) * 1.4) calc(var(--u) * 1.5) calc(var(--u) * 1.1);
  background:
    radial-gradient(120% 70% at 50% -10%, #22301f 0%, #16201a 45%, #0d1310 100%);
  box-shadow:
    inset 0 0 0 calc(var(--u) * 0.0625) rgba(0, 0, 0, 0.7),
    inset 0 calc(var(--u) * 0.125) calc(var(--u) * 1.5) rgba(0, 0, 0, 0.55);
}

/* Lantern glow, echoing the two lamps on the concept frame. */
.dtrc-lamp {
  position: absolute;
  top: calc(var(--u) * -8);
  width: calc(var(--u) * 26);
  height: calc(var(--u) * 26);
  pointer-events: none;
  background: radial-gradient(circle, rgba(255, 209, 102, 0.3) 0%, rgba(255, 209, 102, 0.08) 45%, rgba(255, 209, 102, 0) 72%);
}
.dtrc-lamp-l { left: calc(var(--u) * -5); }
.dtrc-lamp-r { right: calc(var(--u) * -5); }

/* Corner brackets. */
.dtrc-cnr {
  position: absolute;
  width: calc(var(--u) * 1.1);
  height: calc(var(--u) * 1.1);
  border: calc(var(--u) * 0.125) solid rgba(196, 154, 85, 0.55);
  pointer-events: none;
}
.dtrc-cnr-tl { top: calc(var(--u) * 0.4); left: calc(var(--u) * 0.4); border-right: 0; border-bottom: 0; }
.dtrc-cnr-tr { top: calc(var(--u) * 0.4); right: calc(var(--u) * 0.4); border-left: 0; border-bottom: 0; }
.dtrc-cnr-bl { bottom: calc(var(--u) * 0.4); left: calc(var(--u) * 0.4); border-right: 0; border-top: 0; }
.dtrc-cnr-br { bottom: calc(var(--u) * 0.4); right: calc(var(--u) * 0.4); border-left: 0; border-top: 0; }

/* ── header ──────────────────────────────────────────────────────────────── */
.dtrc-hd { position: relative; text-align: center; }
.dtrc-eyebrow {
  font-size: calc(var(--u) * 0.6875);
  letter-spacing: calc(var(--u) * 0.19);
  text-transform: uppercase;
  color: var(--gold-dim);
  opacity: 0.85;
}
.dtrc-title {
  margin-top: calc(var(--u) * 0.2);
  font-family: var(--font-cinzel), "Trebuchet MS", Georgia, serif;
  font-weight: 700;
  font-size: calc(var(--u) * 2.5);
  line-height: 1.05;
  letter-spacing: calc(var(--u) * 0.02);
  color: var(--gold);
  overflow-wrap: anywhere;
  text-wrap: balance;
  text-shadow:
    0 calc(var(--u) * 0.09) 0 rgba(0, 0, 0, 0.85),
    0 0 calc(var(--u) * 1.6) rgba(255, 209, 102, 0.28);
}
.dtrc-period {
  margin-top: calc(var(--u) * 0.15);
  font-size: calc(var(--u) * 1);
  color: var(--parch);
  opacity: 0.82;
}
/* Player cards: the clan line, deliberately quieter than the period so the
   hierarchy stays name → period → affiliation. */
.dtrc-clans {
  margin-top: calc(var(--u) * 0.1);
  font-size: calc(var(--u) * 0.75);
  letter-spacing: calc(var(--u) * 0.04);
  color: var(--gold-dim);
  opacity: 0.9;
}
/* Diamond-flanked rule, the concept art's section divider. */
.dtrc-orn {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 0.45);
  margin: calc(var(--u) * 0.7) 0 calc(var(--u) * 0.9);
}
.dtrc-orn i {
  flex: 1;
  height: calc(var(--u) * 0.0625);
  background: linear-gradient(90deg, rgba(196, 154, 85, 0) 0%, rgba(207, 168, 98, 0.95) 50%, rgba(196, 154, 85, 0) 100%);
  box-shadow: 0 calc(var(--u) * 0.0625) 0 rgba(0, 0, 0, 0.5);
}
.dtrc-orn b {
  width: calc(var(--u) * 0.375);
  height: calc(var(--u) * 0.375);
  transform: rotate(45deg);
  background: var(--bronze-hi);
  opacity: 0.8;
}

/* ── hero band ───────────────────────────────────────────────────────────── */
.dtrc-hero {
  display: grid;
  grid-template-columns: calc(var(--u) * 22) 1fr;
  gap: calc(var(--u) * 0.75);
  align-items: stretch;
}
.dtrc-plaque {
  position: relative;
  border: calc(var(--u) * 0.0625) solid rgba(124, 97, 53, 0.65);
  border-radius: calc(var(--u) * 0.3);
  background: linear-gradient(180deg, rgba(38, 50, 38, 0.85) 0%, rgba(15, 23, 18, 0.9) 100%);
  box-shadow:
    inset 0 calc(var(--u) * 0.0625) 0 rgba(255, 236, 190, 0.08),
    inset 0 calc(var(--u) * -0.0625) 0 rgba(0, 0, 0, 0.5);
}
.dtrc-hero-main {
  padding: calc(var(--u) * 0.8) calc(var(--u) * 1);
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.dtrc-lbl {
  font-size: calc(var(--u) * 0.625);
  letter-spacing: calc(var(--u) * 0.115);
  text-transform: uppercase;
  color: var(--dim);
}
.dtrc-hero-num {
  margin-top: calc(var(--u) * 0.1);
  font-weight: 800;
  font-size: calc(var(--u) * 3.25);
  line-height: 1;
  letter-spacing: calc(var(--u) * -0.04);
  color: var(--gold);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 calc(var(--u) * 1.5) rgba(255, 209, 102, 0.25);
}
.dtrc-hero-exact {
  margin-top: calc(var(--u) * 0.2);
  font-size: calc(var(--u) * 0.6875);
  color: var(--dim);
  font-variant-numeric: tabular-nums;
}
.dtrc-chip {
  align-self: flex-start;
  margin-top: calc(var(--u) * 0.45);
  padding: calc(var(--u) * 0.15) calc(var(--u) * 0.45);
  border-radius: calc(var(--u) * 0.2);
  border: calc(var(--u) * 0.0625) solid currentColor;
  font-size: calc(var(--u) * 0.6875);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.dtrc-chip-up { color: var(--good); }
.dtrc-chip-down { color: var(--bad); }

.dtrc-hero-side {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: calc(var(--u) * 0.75);
}
.dtrc-mini {
  padding: calc(var(--u) * 0.55) calc(var(--u) * 0.7);
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.dtrc-mini-num {
  margin-top: calc(var(--u) * 0.1);
  font-weight: 700;
  font-size: calc(var(--u) * 1.375);
  line-height: 1.05;
  color: var(--parch);
  font-variant-numeric: tabular-nums;
}
.dtrc-mini-hint {
  font-size: calc(var(--u) * 0.6875);
  color: var(--dim);
}

/* ── body columns ────────────────────────────────────────────────────────── */
.dtrc-body {
  display: grid;
  gap: calc(var(--u) * 0.75);
  margin-top: calc(var(--u) * 0.75);
}
.dtrc-body-2 { grid-template-columns: 1fr calc(var(--u) * 20.5); }
.dtrc-col { display: flex; flex-direction: column; gap: calc(var(--u) * 0.75); min-width: 0; }
.dtrc-panel-grow { flex: 1; }

.dtrc-panel {
  display: flex;
  flex-direction: column;
  border: calc(var(--u) * 0.0625) solid rgba(124, 97, 53, 0.55);
  border-radius: calc(var(--u) * 0.3);
  background: linear-gradient(180deg, rgba(24, 33, 26, 0.9) 0%, rgba(13, 19, 15, 0.92) 100%);
  padding: calc(var(--u) * 0.7) calc(var(--u) * 0.8) calc(var(--u) * 0.8);
  min-width: 0;
}
.dtrc-ptitle {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 0.45);
  margin-bottom: calc(var(--u) * 0.6);
  font-family: var(--font-cinzel), "Trebuchet MS", Georgia, serif;
  font-weight: 600;
  font-size: calc(var(--u) * 0.75);
  letter-spacing: calc(var(--u) * 0.11);
  text-transform: uppercase;
  color: var(--gold-dim);
  white-space: nowrap;
}
.dtrc-ptitle i {
  flex: 1;
  height: calc(var(--u) * 0.0625);
  background: linear-gradient(90deg, rgba(196, 154, 85, 0.5) 0%, rgba(196, 154, 85, 0) 100%);
}

/* ── loot gallery ────────────────────────────────────────────────────────── */
.dtrc-gal {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: calc(var(--u) * 0.5);
}
.dtrc-slot {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 0.15);
  padding: calc(var(--u) * 0.5) calc(var(--u) * 0.25) calc(var(--u) * 0.4);
  border: calc(var(--u) * 0.0625) solid rgba(160, 126, 70, 0.6);
  border-radius: calc(var(--u) * 0.25);
  background:
    radial-gradient(85% 70% at 50% 0%, rgba(86, 106, 79, 0.75) 0%, rgba(32, 44, 34, 0.9) 55%, rgba(14, 21, 16, 0.95) 100%);
  box-shadow:
    inset 0 calc(var(--u) * 0.0625) 0 rgba(255, 240, 200, 0.12),
    inset 0 calc(var(--u) * -0.0625) 0 rgba(0, 0, 0, 0.55);
  min-width: 0;
}
.dtrc-slot-img { height: calc(var(--u) * 3); display: flex; align-items: center; }
.dtrc-slot-img img {
  height: calc(var(--u) * 3);
  width: auto;
  filter: drop-shadow(0 calc(var(--u) * 0.09) calc(var(--u) * 0.09) rgba(0, 0, 0, 0.85));
}
.dtrc-slot-val {
  font-weight: 700;
  font-size: calc(var(--u) * 0.8125);
  color: var(--gold);
  font-variant-numeric: tabular-nums;
}
.dtrc-slot-name {
  max-width: 100%;
  font-size: calc(var(--u) * 0.6875);
  color: var(--dim);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dtrc-slot-q {
  position: absolute;
  top: calc(var(--u) * 0.15);
  left: calc(var(--u) * 0.3);
  font-size: calc(var(--u) * 0.625);
  font-weight: 700;
  color: var(--gold);
  text-shadow: 0 calc(var(--u) * 0.06) 0 #000;
}
/* Receiver line. Sits below the item name, one step down the hierarchy — the
   item is the subject of the slot, the person is the attribution. Dimmer and
   smaller than the name so the gallery still reads as loot at a glance, and
   still legible at Discord's ~550px embed width (where --u is ~half the
   capture's). Fixed single line: names are capped at 12 chars in game, so this
   only ellipsises for the "+N others" suffix. */
.dtrc-slot-who {
  max-width: 100%;
  font-size: calc(var(--u) * 0.625);
  /* Dimmer than --dim (the item name) so the person reads as attribution rather
     than competing with the item for the eye. */
  color: rgba(161, 153, 127, 0.72);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dtrc-slot-who b {
  font-weight: 600;
  color: var(--dim);
}

/* ── list rows ───────────────────────────────────────────────────────────── */
.dtrc-rows { display: flex; flex-direction: column; flex: 1; justify-content: space-between; }
.dtrc-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 0.4);
  padding: calc(var(--u) * 0.28) 0;
  font-size: calc(var(--u) * 0.8125);
  border-top: calc(var(--u) * 0.0625) solid rgba(124, 97, 53, 0.22);
  min-width: 0;
}
.dtrc-row:first-child { border-top: 0; }
.dtrc-row-fill {
  position: absolute;
  left: 0;
  top: calc(var(--u) * 0.1);
  bottom: calc(var(--u) * 0.1);
  border-radius: calc(var(--u) * 0.12);
  background: linear-gradient(90deg, rgba(255, 209, 102, 0.16) 0%, rgba(255, 209, 102, 0.03) 100%);
  pointer-events: none;
}
.dtrc-row-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dtrc-row-sub { font-size: calc(var(--u) * 0.75); color: var(--dim); }
.dtrc-row-val {
  flex-shrink: 0;
  font-weight: 700;
  color: var(--gold);
  font-variant-numeric: tabular-nums;
}
.dtrc-rank {
  flex-shrink: 0;
  width: calc(var(--u) * 1.15);
  height: calc(var(--u) * 1.15);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: calc(var(--u) * 0.2);
  font-size: calc(var(--u) * 0.6875);
  font-weight: 700;
  color: #17200f;
  background: linear-gradient(180deg, #6c7361 0%, #4a5142 100%);
}
.dtrc-rank-1 { background: linear-gradient(180deg, #ffe08a 0%, #d9a53c 100%); }
.dtrc-rank-2 { background: linear-gradient(180deg, #e2e6ea 0%, #a3adb5 100%); }
.dtrc-rank-3 { background: linear-gradient(180deg, #e0a575 0%, #a9682f 100%); }

/* ── milestones ──────────────────────────────────────────────────────────── */
/* auto-FIT (collapsing empty tracks) so one class serves both contexts: two
   columns in the narrow member rail, and — as a full-width band — however many
   milestones exist stretched into an even footer strip, the way the concept
   art's bottom row of panels reads. Most periods only have three of the seven
   sources filled today (pets/quests/diaries/deaths are still rolling out), so
   the strip fills out on its own as the pipeline catches up. */
.dtrc-mstones {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(calc(var(--u) * 8.5), 1fr));
  gap: calc(var(--u) * 0.4);
  align-content: start;
}
.dtrc-mstone {
  padding: calc(var(--u) * 0.35) calc(var(--u) * 0.5);
  border: calc(var(--u) * 0.0625) solid rgba(124, 97, 53, 0.4);
  border-radius: calc(var(--u) * 0.22);
  background: rgba(0, 0, 0, 0.28);
  min-width: 0;
}
.dtrc-mstone-num {
  font-weight: 700;
  font-size: calc(var(--u) * 1.0625);
  color: var(--gold);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.dtrc-mstone-lbl {
  font-size: calc(var(--u) * 0.6875);
  color: var(--dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── month bars (annual) ─────────────────────────────────────────────────── */
.dtrc-bars { display: flex; align-items: flex-end; gap: calc(var(--u) * 0.3); height: calc(var(--u) * 5.5); }
.dtrc-bar { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: calc(var(--u) * 0.2); min-width: 0; height: 100%; }
/* The plot area the fills are a percentage OF. It must be the only thing in the
   column that can flex, hence flex:1 plus min-height:0 — without the latter its
   auto min-height would refuse to shrink below the fill's requested height and
   reintroduce the overflow this exists to prevent. padding-top reserves room for
   the peak's value label, which is out of flow and so cannot make space for
   itself. box-sizing is stated rather than inherited from Tailwind's preflight:
   this card is also rendered standalone (Discord capture, previews), where no
   reset is loaded.
   NB: this whole stylesheet is a TS template literal — no backticks in comments. */
.dtrc-bar-track {
  flex: 1;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
  padding-top: calc(var(--u) * 0.95);
  display: flex;
  align-items: flex-end;
}
.dtrc-bar-fill {
  position: relative;
  width: 100%;
  border-radius: calc(var(--u) * 0.12) calc(var(--u) * 0.12) 0 0;
  background: linear-gradient(180deg, rgba(124, 97, 53, 0.95) 0%, rgba(70, 56, 32, 0.8) 100%);
  box-shadow: inset 0 calc(var(--u) * 0.0625) 0 rgba(255, 236, 190, 0.15);
}
.dtrc-bar-peak { background: linear-gradient(180deg, var(--gold) 0%, var(--gold-dim) 100%); }
.dtrc-bar-lbl { font-size: calc(var(--u) * 0.5625); color: var(--dim); }
/* Out of flow and anchored to the top of the fill it labels — in flow it was a
   third flex child and stole ~19px from the very bar it was annotating. */
.dtrc-bar-peak-val {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: calc(var(--u) * 0.15);
  font-size: calc(var(--u) * 0.625);
  font-weight: 700;
  color: var(--gold);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* ── featured drop ───────────────────────────────────────────────────────── */
.dtrc-feat {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 0.85);
  margin-top: calc(var(--u) * 0.75);
  padding: calc(var(--u) * 0.65) calc(var(--u) * 0.85);
  border: calc(var(--u) * 0.0625) solid rgba(217, 165, 60, 0.55);
  border-radius: calc(var(--u) * 0.3);
  background:
    linear-gradient(90deg, rgba(72, 57, 26, 0.55) 0%, rgba(20, 28, 21, 0.9) 55%, rgba(20, 28, 21, 0.9) 100%);
  box-shadow: inset 0 0 calc(var(--u) * 2) rgba(255, 209, 102, 0.08);
  min-width: 0;
}
.dtrc-feat-slot {
  flex-shrink: 0;
  width: calc(var(--u) * 3.4);
  height: calc(var(--u) * 3.4);
  display: flex;
  align-items: center;
  justify-content: center;
  border: calc(var(--u) * 0.0625) solid rgba(217, 165, 60, 0.5);
  border-radius: calc(var(--u) * 0.25);
  background: radial-gradient(70% 70% at 50% 30%, rgba(255, 209, 102, 0.16) 0%, rgba(8, 12, 9, 0.9) 100%);
}
.dtrc-feat-slot img {
  height: calc(var(--u) * 2.6);
  width: auto;
  filter: drop-shadow(0 calc(var(--u) * 0.09) calc(var(--u) * 0.12) rgba(0, 0, 0, 0.9));
}
.dtrc-feat-mid { flex: 1; min-width: 0; }
.dtrc-feat-name {
  font-family: var(--font-cinzel), "Trebuchet MS", Georgia, serif;
  font-weight: 700;
  font-size: calc(var(--u) * 1.375);
  color: var(--gold);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dtrc-feat-meta {
  margin-top: calc(var(--u) * 0.15);
  font-size: calc(var(--u) * 0.75);
  color: var(--dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dtrc-feat-val {
  flex-shrink: 0;
  text-align: right;
}
.dtrc-feat-val b {
  display: block;
  font-weight: 800;
  font-size: calc(var(--u) * 1.75);
  color: var(--gold);
  font-variant-numeric: tabular-nums;
  line-height: 1.05;
}
.dtrc-feat-proof {
  flex-shrink: 0;
  width: calc(var(--u) * 12);
  height: calc(var(--u) * 6.75);
  border: calc(var(--u) * 0.0625) solid rgba(196, 154, 85, 0.45);
  border-radius: calc(var(--u) * 0.2);
  overflow: hidden;
  background: #000;
}
.dtrc-feat-proof img { width: 100%; height: 100%; object-fit: cover; display: block; }

/* ── footer ──────────────────────────────────────────────────────────────── */
.dtrc-ft {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--u) * 0.75);
  margin-top: calc(var(--u) * 0.9);
  padding-top: calc(var(--u) * 0.6);
  border-top: calc(var(--u) * 0.0625) solid rgba(124, 97, 53, 0.4);
  font-size: calc(var(--u) * 0.75);
  color: var(--dim);
}
.dtrc-ft-brand {
  font-family: var(--font-cinzel), "Trebuchet MS", Georgia, serif;
  font-weight: 700;
  letter-spacing: calc(var(--u) * 0.06);
  color: var(--gold-dim);
  text-transform: uppercase;
}
.dtrc-ft-note { flex: 1; text-align: center; opacity: 0.8; }
.dtrc-ft-right { text-align: right; font-variant-numeric: tabular-nums; }
`;

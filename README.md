# Console Printout

Console Printout packages the animated console macro into a full Foundry VTT v13 module. Drop a printout tile onto any scene, edit the message inside a rich-text window, and control everything from typing cadence to glitch intensity and screen colors.

## Requirements

- Foundry Virtual Tabletop core v13+
- No supporting modules required

## Installation

1. Copy this project into your Foundry `Data/modules` directory (or zip it and install manually).
2. Ensure the folder name matches the module id in `module.json` (`console-printout`).
3. Launch your world and enable **Console Printout** from Module Management.

## Usage

### Create and Configure a Tile
1. Activate a scene and switch to the **Tiles** controls.
2. Click the **Create Console Printout Tile** button (printer icon) to spawn a utility tile centered on the scene. The tile sheet opens automatically.
3. Scroll to the **Console Printout** panel on the sheet or click the **Console Printout** footer button to jump back later.
4. Author your copy in the rich-text field. Hit Enter twice to insert blank paragraphs for dramatic pauses.
5. Tweak the effect sliders (typing cadence, glitch chance, cursor blink, flicker, audio beeps) and the panel styling (font presets, border, padding, color).
6. Save. Open the **Console Printout Manager** (Tiles toolbar button or `Ctrl+Shift+P`) to preview the overlay live, pick a text effect, adjust its sliders, and record a WebM when you're satisfied.

### Console Printout Manager
- Open it from the Tiles toolbar button, the tile sheet footer button, or the `Ctrl+Shift+P` keybinding.
- The left column lists every tile on the scene; tiles that already store Console Printout settings show a **Configured** tag.
- A dropdown at the top of the settings pane lets you pick the **Effect Mode**. Switching modes reveals only the sliders and toggles that matter for that style.
- Flip on **Live Preview** to stream edits to the canvas while you manipulate fonts, effects, and panel controls; turn it off if you want to pause the overlay while editing text.
- Use the sidebar buttons to **Create**, **Focus Tile**, **Open Tile Sheet**, or **Record Tile (WebM)** without leaving the manager.

### Effect Modes
- **Glitch Terminal** – the original typed terminal overlay (the only mode that honors Style/Panel controls). Ideal for in-world monitors or holo panels.
- **Script Writer** – cinematic typewriter with fading lines.
- **Starfield Crawl** – perspective crawl reminiscent of classic space briefings.
- **Arcane Runes** – glowing glyphs that cool to blue and flick embers.
- **Scrying Pool** – watery ripple reveal that sinks away.
- **Telemetry Sweep** – radar sweep that emits transient status lines.

Each mode exposes only the relevant controls (duration, character delay, ripple strength, etc.). Live Preview instantly reloads the effect when you tweak those sliders.

### Render to WebM
1. Open the manager, pick a tile, and click **Render to WebM**.
2. Choose dimensions (defaults to the tile size) and let the dialog run. Rendering uses an off-screen PIXI canvas, so Foundry stays responsive.
3. A progress window appears with live percentage updates. Once recording finishes it switches to **Encoding and uploading... XX%** - that phase can sit on the screen for a bit while the WebM file is assembled and sent to storage, but the percentage will keep creeping upward until the tile updates.
4. When finished, the tile's texture automatically swaps to the generated video stored in `worlds/<world-id>/console-printout/console-*.webm`.

The preview overlay is GM-only and temporary. Closing the manager or starting another preview automatically clears it, so only the recorded WebM ever plays for players.
Effect durations are driven by the mode-specific sliders (e.g., Crawl Duration, Script Writer Hold). Lengthen those if you need a longer capture window.

## Notes

- Panel position/size are saved as ratios, so overlays stay proportional across different map dimensions.
- Console tiles use Foundry's default terminal icon at low alpha; feel free to swap the art if you want a visible handle on the scene.
- Rendering progress may briefly show "Preparing renderer... please be patient" while PIXI spins up. Recording displays a percent readout, then the dialog switches to "Encoding and uploading... XX%" so you know the export is still running until it hits 100%.
- The **Reset to defaults** button in the manager restores the original macro styling and text.

## What's New

- Console Printout Manager window (Ctrl+Shift+P or Tiles toolbar) is now the single hub for previewing settings and recording tiles.
- Sidebar actions were pared down to editing + recording tasks so the workflow is "dial in the live preview, then capture it".
- A Tiles toolbar control spins up new console tiles with sensible defaults.
- The overlay renders on the UI layer and ignores pointer events, keeping Foundry navigation and selection intact.
- Toggle "Enable Visual Effects" in the tile sheet to disable flicker, glitches, or beeps for accessibility.
- Added WebM rendering with a progress dialog so you can export the animation as a video straight onto the tile.





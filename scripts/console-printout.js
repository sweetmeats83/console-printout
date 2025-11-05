import { PrintoutEffectsManager } from "./printout-effects.js";

/* console-printout | Foundry VTT v13+ compatible
 * - Safe Scene Controls registration
 * - Glitchy terminal overlay (PIXI)
 * - Manager with sliders, text, panel controls, and Live Preview
 */

(() => {
  'use strict';

  const MODULE_ID = "console-printout";
  const FLAG_KEY = "printout";
  const FLAG_PATH = `flags.${MODULE_ID}.${FLAG_KEY}`;
  const DEFAULT_TILE_IMAGE = `modules/${MODULE_ID}/templates/terminal.svg`;
  const DEFAULT_BEEP_SRC = "";
  const LEGACY_TILE_TEXTURES = new Set(["icons/svg/terminal.svg"]);

  const CREATE_TOOL_NAME  = "consolePrintoutCreate";
  const MANAGER_TOOL_NAME = "consolePrintoutManager";

  const DEFAULT_LINES = [
    "COUNSLE SYS/CONSOLE :: ACCESS LEVEL: TECHNICIAN",
    "BOOTSTRAP: INIT KERNEL >>> OK",
    "CHECK: ENV/HAB-02 PRESSURE VARIANCE :: WARNING",
    "PING: REACTOR COOLANT PUMP A :: TIMEOUT",
    "LOG: DOCKING AIRLOCK 1 OVERRIDE REQUEST @ 03:17",
    "",
    ">> AWAITING OPERATOR INPUT_"
  ];

  const DEFAULT_TEXT = DEFAULT_LINES.map((line) => (line ? `<p>${line}</p>` : `<p>&nbsp;</p>`)).join("");

  const EFFECT_PRESETS = {
    default:   { label: "Default",     effects: { enabled: true,  loop: false, charDelay: 55, charDelayJitter: 20, glitchChance: 0.18, glitchFrames: 2,  cursorBlinkMs: 380, lineDelay: 700,  paragraphDelay: 1100, flickerAmount: 0.06, jitterPx: 0.6, beepVolume: 0.25, holdMs: 2000 } },
    fast:      { label: "Fast Type",   effects: { enabled: true,  loop: false, charDelay: 30, charDelayJitter: 10, glitchChance: 0.08, glitchFrames: 1,  cursorBlinkMs: 300, lineDelay: 400,  paragraphDelay: 800,  flickerAmount: 0.04, jitterPx: 0.4, beepVolume: 0.15, holdMs: 1200 } },
    cinematic: { label: "Cinematic",   effects: { enabled: true,  loop: true,  charDelay: 70, charDelayJitter: 25, glitchChance: 0.24, glitchFrames: 3,  cursorBlinkMs: 420, lineDelay: 900,  paragraphDelay: 1500, flickerAmount: 0.09, jitterPx: 0.8, beepVolume: 0.2,  holdMs: 2600 } },
    calm:      { label: "Calm",        effects: { enabled: false, loop: false, charDelay: 65, charDelayJitter: 10, glitchChance: 0,    glitchFrames: 0,  cursorBlinkMs: 500, lineDelay: 800,  paragraphDelay: 1400, flickerAmount: 0,    jitterPx: 0,   beepVolume: 0,    holdMs: 3000 } },
  };

  const FONT_PRESETS = [
    { id: "share-tech", label: "Share Tech Mono", value: "Share Tech Mono, Menlo, Consolas, monospace" },
    { id: "space-mono", label: "Space Mono", value: "'Space Mono', monospace" },
    { id: "ibm-plex", label: "IBM Plex Mono", value: "'IBM Plex Mono', 'Menlo', 'Consolas', monospace" },
    { id: "fira-code", label: "Fira Code", value: "'Fira Code', 'Menlo', 'Consolas', monospace" },
    { id: "vt323", label: "VT323", value: "'VT323', monospace" },
    { id: "roboto-mono", label: "Roboto Mono", value: "'Roboto Mono', 'Menlo', 'Consolas', monospace" }
  ];
  const FONT_PRESET_MAP = Object.freeze(Object.fromEntries(FONT_PRESETS.map((preset) => [preset.id, preset.value])));

  function clone(obj) {
    if (!obj) return obj;
    if (foundry?.utils?.deepClone) return foundry.utils.deepClone(obj);
    return JSON.parse(JSON.stringify(obj));
  }

  const EFFECT_MODE_CONFIG = {
    terminal: { label: "Glitch Terminal" },
    script: {
      label: "Script Writer",
      hint: "Typewriter text that fades away line by line.",
      defaults: {
        perCharMs: 16,
        holdMs: 900,
        fadeMs: 450,
        maxVisibleLines: 8,
        lineSpacing: 6
      },
      controls: [
        { type: "range", name: "perCharMs", label: "Character Delay (ms)", min: 2, max: 120, step: 1 },
        { type: "range", name: "holdMs", label: "Hold After Line (ms)", min: 0, max: 5000, step: 50 },
        { type: "range", name: "fadeMs", label: "Fade Duration (ms)", min: 50, max: 3000, step: 50 },
        { type: "range", name: "maxVisibleLines", label: "Visible Lines", min: 2, max: 12, step: 1 },
        { type: "range", name: "lineSpacing", label: "Line Spacing (px)", min: 0, max: 20, step: 1 }
      ]
    },
    crawl: {
      label: "Starfield Crawl",
      hint: "Cinematic space crawl that recedes into the distance.",
      defaults: {
        durationMs: 30000,
        fadeTop: 0.8,
        fadeBottom: 0.08,
        startScale: 1.2,
        endScale: 0.25
      },
      controls: [
        { type: "range", name: "durationMs", label: "Duration (ms)", min: 5000, max: 60000, step: 1000 },
        { type: "range", name: "fadeTop", label: "Fade Start (0-1)", min: 0.3, max: 0.95, step: 0.01 },
        { type: "range", name: "fadeBottom", label: "Fade Bottom Alpha", min: 0, max: 0.5, step: 0.01 }
      ]
    },
    runes: {
      label: "Arcane Runes",
      hint: "Mystic glyphs inscribed with glowing embers.",
      defaults: {
        perCharMs: 20,
        holdMs: 600,
        fadeMs: 600,
        emberCountMin: 3,
        emberCountMax: 6,
        emberDurMin: 500,
        emberDurMax: 1200
      },
      controls: [
        { type: "range", name: "perCharMs", label: "Character Delay (ms)", min: 5, max: 120, step: 1 },
        { type: "range", name: "holdMs", label: "Hold After Line (ms)", min: 0, max: 4000, step: 50 },
        { type: "range", name: "fadeMs", label: "Fade Duration (ms)", min: 50, max: 4000, step: 50 },
        { type: "range", name: "emberCountMin", label: "Min Embers", min: 0, max: 10, step: 1 },
        { type: "range", name: "emberCountMax", label: "Max Embers", min: 0, max: 12, step: 1 },
        { type: "range", name: "emberDurMin", label: "Min Ember Life (ms)", min: 100, max: 2000, step: 50 },
        { type: "range", name: "emberDurMax", label: "Max Ember Life (ms)", min: 200, max: 4000, step: 50 }
      ]
    },
    scry: {
      label: "Scrying Pool",
      hint: "Rippling water reveal that sinks away.",
      defaults: {
        durationMs: 6000,
        rippleStrength: 36,
        sinkPx: 60
      },
      controls: [
        { type: "range", name: "durationMs", label: "Duration (ms)", min: 1000, max: 20000, step: 500 },
        { type: "range", name: "rippleStrength", label: "Ripple Strength", min: 5, max: 80, step: 1 },
        { type: "range", name: "sinkPx", label: "Sink Distance (px)", min: 0, max: 160, step: 5 }
      ]
    },
    telemetry: {
      label: "Telemetry Sweep",
      hint: "Radar sweep that prints transient status lines.",
      defaults: {
        holdMs: 900,
        fadeMs: 350,
        sweepSpeed: 0.06
      },
      controls: [
        { type: "range", name: "holdMs", label: "Line Hold (ms)", min: 100, max: 4000, step: 50 },
        { type: "range", name: "fadeMs", label: "Line Fade (ms)", min: 50, max: 2000, step: 25 },
        { type: "range", name: "sweepSpeed", label: "Sweep Speed", min: 0.01, max: 0.2, step: 0.005 }
      ]
    }
  };

  const EFFECT_DEFAULT_OPTIONS = (() => {
    const base = {};
    for (const [mode, def] of Object.entries(EFFECT_MODE_CONFIG)) {
      if (!def.defaults) continue;
      base[mode] = clone(def.defaults);
    }
    return base;
  })();

  const DEFAULT_CONFIG = {
    effectMode: "terminal",
    effectOptions: clone(EFFECT_DEFAULT_OPTIONS),
    text: DEFAULT_TEXT,
    style: {
      fontFamily: "Share Tech Mono, Menlo, Consolas, monospace",
      fontSize: 28,
      textColor: "#00ff9a",
      strokeColor: "#003f2e",
      strokeThickness: 3,
      lineHeight: 36,
      padding: 24
    },
    effects: {
      charDelay: 55,
      charDelayJitter: 20,
      glitchChance: 0.18,
      glitchFrames: 2,
      loop: false,
      cursorChar: "_",
      cursorBlinkMs: 380,
      lineDelay: 700,
      paragraphDelay: 1100,
      flickerAmount: 0.06,
      jitterPx: 0.6,
      beepSrc: DEFAULT_BEEP_SRC,
      beepVolume: 0.25,
      holdMs: 2000,
      enabled: true
    },
    panel: {
      useTileRect: true,
      xRatio: 0.9,
      yRatio: 0.5,
      widthRatio: 0.3,
      heightRatio: 0.3,
      bgColor: "#000000",
      bgAlpha: 0.85,
      borderColor: "#00ff9a",
      borderAlpha: 0.15,
      borderWidth: 2,
      cornerRadius: 12
    }
  };

  const GLITCH_GLYPHS = Array.from("!@#$%^&*()[]{}<>/\\+=-|~:;?");
  const FAILED_AUDIO_SRCS = new Set();
  let ACTIVE_OVERLAY = null;
  let CANVAS_EFFECT_MANAGER = null;

  const TextEditorImpl =
    foundry?.applications?.ux?.TextEditor?.implementation ??
    foundry?.applications?.api?.TextEditor ??
    globalThis.TextEditor ?? null;

  /* ----------------- helpers ----------------- */

  function decodeHtml(html) {
    if (typeof html !== "string") return html ?? "";
    if (TextEditorImpl?.decodeHTML) return TextEditorImpl.decodeHTML(html);
    if (foundry?.utils?.decodeHTML) return foundry.utils.decodeHTML(html);
    const textarea = document.createElement("textarea");
    textarea.innerHTML = html;
    return textarea.value;
  }

  function toBoolean(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value === "true" || value === "on" || value === "1";
    return Boolean(value);
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback ?? min;
    if (typeof min === "number" && number < min) return min;
    if (typeof max === "number" && number > max) return max;
    return number;
  }

  function plainTextToHtml(text) {
    if (!text) return "<p>&nbsp;</p>";
    const esc = foundry?.utils?.escapeHTML ?? ((str) => String(str).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    }[ch] ?? ch)));
    const lines = String(text)
      .split(/\r?\n/)
      .map((line) => (line.trim() ? `<p>${esc(line)}</p>` : "<p>&nbsp;</p>"));
    return lines.join("") || "<p>&nbsp;</p>";
  }

  function ensurePreviewText(text) {
    const trimmed = (text ?? "").trim();
    return trimmed ? text : "BOOTSTRAP: PREVIEW ONLINE\n>> TYPE TO EDIT_";
  }

  async function extractPlainText(html) {
    if (!html) return "";
    const decoded = decodeHtml(html);
    const div = document.createElement("div");
    div.innerHTML = decoded;
    div.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
    div.querySelectorAll("p,div,li,ul,ol,blockquote,pre,code,section,article,header,footer,table,tr,td,th,h1,h2,h3,h4,h5,h6")
      .forEach((el) => el.append("\n"));
    let text = div.textContent ?? "";
    text = text
      .replace(/\u00A0/g, " ")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return text;
  }

  function hexToNumber(hex, fallback = 0xffffff) {
    if (!hex || typeof hex !== "string") return fallback;
    const normalized = hex.trim().replace(/^#/, "");
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback;
    return parseInt(normalized, 16);
  }

  function mergeConfig(flagData = {}) {
    const merged = foundry.utils.mergeObject(
      foundry.utils.deepClone(DEFAULT_CONFIG),
      flagData,
      { inplace: false, recursive: true }
    );
    if (!merged.effects) merged.effects = {};
    if (!merged.effects.beepSrc) merged.effects.beepSrc = DEFAULT_BEEP_SRC;
    merged.effectMode ??= "terminal";
    merged.effectOptions = ensureEffectOptions(merged.effectOptions);
    return merged;
  }

  function ensureEffectOptions(existing = {}) {
    const result = {};
    for (const [mode, def] of Object.entries(EFFECT_MODE_CONFIG)) {
      if (mode === "terminal") continue;
      const defaults = def.defaults ?? {};
      result[mode] = clone(defaults);
      if (existing[mode]) {
        foundry.utils.mergeObject(result[mode], existing[mode], { inplace: true });
      }
    }
    return result;
  }

  function applyEffectOptionsFromForm(target, formData = {}) {
    if (!target) return;
    for (const [mode, values] of Object.entries(formData)) {
      if (mode === "terminal") continue;
      const def = EFFECT_MODE_CONFIG[mode];
      if (!def) continue;
      const controls = def.controls ?? [];
      const dest = target[mode] ?? clone(def.defaults ?? {});
      controls.forEach((control) => {
        if (!(control.name in values)) return;
        dest[control.name] = coerceControlValue(control, values[control.name]);
      });
      target[mode] = dest;
    }
  }

  function coerceControlValue(control, value) {
    if (value === undefined || value === null) return value;
    if (typeof value === "number") return value;
    switch (control.type) {
      case "range":
      case "number":
        return Number(value);
      case "checkbox":
        return value === true || value === "true" || value === "on";
      default:
        return value;
    }
  }

  function getEffectMode(config) {
    return config?.effectMode ?? "terminal";
  }

  function getEffectOptions(config, mode) {
    if (mode === "terminal") return {};
    const stored = config?.effectOptions?.[mode];
    const def = EFFECT_MODE_CONFIG[mode];
    if (!def) return stored ?? {};
    const defaults = def.defaults ?? {};
    const merged = clone(defaults);
    if (stored) foundry.utils.mergeObject(merged, stored, { inplace: true });
    return merged;
  }

  function getPrintoutConfig(tileDocument) {
    return mergeConfig(tileDocument.getFlag(MODULE_ID, FLAG_KEY));
  }

  function needsTextureMigration(tileDocument) {
    if (!tileDocument) return false;
    const src = tileDocument.texture?.src;
    return !src || LEGACY_TILE_TEXTURES.has(src);
  }

  function buildEffectPayload(mode, plainText) {
    const trimmed = (plainText ?? "").trim();
    switch (mode) {
      case "script":
      case "runes": {
        const lines = trimmed
          ? trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
          : DEFAULT_LINES;
        return lines;
      }
      case "crawl":
        return trimmed || DEFAULT_LINES.join("\n\n");
      case "scry":
        return trimmed || "The water keeps secrets.";
      case "telemetry": {
        const lines = trimmed
          ? trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
          : [
              "DOCK-CTRL: Vector lock nominal.",
              "COMM: Relay jitter detected.",
              "NAV: Corridor yaw within ±0.4°."
            ];
        return lines;
      }
      default:
        return trimmed;
    }
  }

  function buildEffectOptions(mode, config, context = {}) {
    if (mode === "terminal") return {};
    const base = getEffectOptions(config, mode);
    const dims = context.viewport ?? getViewportDimensions(context);
    if (dims) {
      base.viewportWidth = dims.width;
      base.viewportHeight = dims.height;
    }
    if (context.renderer) base.renderer = context.renderer;
    switch (mode) {
      case "runes": {
        base.emberCount = [base.emberCountMin, base.emberCountMax];
        base.emberDur = [base.emberDurMin, base.emberDurMax];
        break;
      }
      default:
        break;
    }
    return base;
  }

  function getViewportDimensions(context = {}) {
    if (context.viewportWidth && context.viewportHeight) {
      return { width: context.viewportWidth, height: context.viewportHeight };
    }
    if (context.width && context.height) {
      return { width: context.width, height: context.height };
    }
    const screen = canvas?.screenDimensions;
    if (screen) {
      return { width: screen[0], height: screen[1] };
    }
    const dims = canvas?.dimensions;
    if (dims) {
      return { width: dims.sceneWidth, height: dims.sceneHeight };
    }
    return { width: 1920, height: 1080 };
  }

  function estimateTerminalDurationMs(textLines, effects) {
    const fx = effects ?? {};
    const charDelay = Math.max(1, Number(fx.charDelay ?? DEFAULT_CONFIG.effects.charDelay));
    const lineDelay = Math.max(0, Number(fx.lineDelay ?? DEFAULT_CONFIG.effects.lineDelay));
    const paragraphDelay = Math.max(0, Number(fx.paragraphDelay ?? DEFAULT_CONFIG.effects.paragraphDelay));
    const holdMs = Math.max(0, Number(fx.holdMs ?? DEFAULT_CONFIG.effects.holdMs));

    let totalMs = 0;
    textLines.forEach((line) => {
      const chars = (line ?? "").length + 1;
      totalMs += chars * charDelay;
      const delay = line.trim() === "" ? paragraphDelay : lineDelay;
      totalMs += delay;
    });
    totalMs += holdMs + 250;
    return totalMs;
  }

  function estimateEffectDurationMs(mode, config, textLines, plainText) {
    if (mode === "terminal") {
      return estimateTerminalDurationMs(textLines, config.effects);
    }
    const payload = buildEffectPayload(mode, plainText);
    const opts = getEffectOptions(config, mode);
    switch (mode) {
      case "script": {
        const lines = Array.isArray(payload) ? payload : [String(payload ?? "")];
        const chars = lines.reduce((sum, line) => sum + line.length, 0);
        return (
          chars * (opts.perCharMs ?? 16) +
          lines.length * ((opts.holdMs ?? 600) + (opts.fadeMs ?? 400)) +
          1000
        );
      }
      case "crawl":
        return opts.durationMs ?? 30000;
      case "runes": {
        const lines = Array.isArray(payload) ? payload : [String(payload ?? "")];
        const chars = lines.reduce((sum, line) => sum + line.length, 0);
        return (
          chars * (opts.perCharMs ?? 18) +
          lines.length * ((opts.holdMs ?? 500) + (opts.fadeMs ?? 500)) +
          1500
        );
      }
      case "scry":
        return opts.durationMs ?? 6000;
      case "telemetry": {
        const lines = Array.isArray(payload) ? payload.length : 3;
        const perLine = (opts.holdMs ?? 900) + (opts.fadeMs ?? 350) + 400;
        return Math.max(4000, lines * perLine + 2000);
      }
      default:
        return 8000;
    }
  }

  function renderEffectModeBlocks(config, activeMode) {
    return Object.entries(EFFECT_MODE_CONFIG)
      .filter(([mode]) => mode !== "terminal")
      .map(([mode, def]) => {
        const opts = getEffectOptions(config, mode);
        const controls = (def.controls ?? [])
          .map((ctl) => renderEffectControl(mode, ctl, opts))
          .join("");
        const hint = def.hint
          ? `<p class="effect-hint">${foundry.utils.escapeHTML(def.hint)}</p>`
          : "";
        const display = activeMode === mode ? "" : 'style="display:none"';
        return `
          <fieldset class="form-group effect-mode-block" data-effect-block="${mode}" ${display}>
            <legend>${def.label}</legend>
            ${hint}
            <div class="effect-controls">${controls || "<p>No adjustable parameters.</p>"}</div>
          </fieldset>
        `;
      })
      .join("");
  }

  function renderEffectControl(mode, control, values) {
    const value = values?.[control.name] ?? "";
    const valueNumber = Number(value ?? 0);
    const escaped = foundry.utils.escapeHTML
      ? foundry.utils.escapeHTML(String(value ?? ""))
      : String(value ?? "");
    const name = `effectOptions.${mode}.${control.name}`;
    const label = control.label ?? control.name;
    switch (control.type) {
      case "range":
        return `
          <label class="effect-control">
            ${label}
            <input data-live type="range" name="${name}" min="${control.min}" max="${control.max}" step="${control.step ?? 1}" value="${valueNumber}">
          </label>
        `;
      case "number":
        return `
          <label class="effect-control">
            ${label}
            <input data-live type="number" name="${name}" value="${valueNumber}" min="${control.min ?? ""}" max="${control.max ?? ""}" step="${control.step ?? 1}">
          </label>
        `;
      case "checkbox":
        return `
          <label class="effect-control checkbox">
            <input data-live type="checkbox" name="${name}" ${value ? "checked" : ""}>
            ${label}
          </label>
        `;
      default:
        return `
          <label class="effect-control">
            ${label}
            <input data-live type="text" name="${name}" value="${escaped}">
          </label>
        `;
    }
  }

  async function migrateTileTexture(tileDocument) {
    if (!tileDocument?.isOwner) return;
    if (!needsTextureMigration(tileDocument)) return;
    try {
      await tileDocument.update({ "texture.src": DEFAULT_TILE_IMAGE });
    } catch (error) {
      console.warn(`${MODULE_ID} | failed to migrate tile texture`, tileDocument.id, error);
    }
  }

  async function migrateLegacyTileTextures(scene) {
    if (!game.user?.isGM) return;
    const sceneDoc = scene ?? canvas?.scene;
    if (!sceneDoc) return;

    const docs = sceneDoc.tiles?.contents ?? [];
    const updates = docs
      .filter((doc) => doc.getFlag(MODULE_ID, FLAG_KEY))
      .filter((doc) => needsTextureMigration(doc))
      .map((doc) => ({ _id: doc.id, "texture.src": DEFAULT_TILE_IMAGE }));

    if (!updates.length) return;

    try {
      await sceneDoc.updateEmbeddedDocuments("Tile", updates);
      console.log(`${MODULE_ID} | Updated ${updates.length} console tile texture(s) to bundled icon`);
    } catch (err) {
      console.warn(`${MODULE_ID} | bulk tile texture migration failed`, err);
    }
  }

  function createRenderProgressDialog(initialText = "Preparing renderer... This may take a minute; please be patient.") {
    const esc = foundry.utils?.escapeHTML ?? ((str) => String(str));
    const content = `
      <div class="console-render-progress">
        <p class="console-render-progress__status">${esc(initialText)}</p>
        <progress class="console-render-progress__bar"></progress>
      </div>
    `;
    const dialog = new Dialog({
      title: "Rendering Console Printout",
      content,
      buttons: {},
      close: () => {}
    }, { jQuery: true });
    dialog.render(true);

    const update = (text, determinateValue = null) => {
      const $el = dialog.element;
      if (!$el?.length) return;
      if (text) $el.find(".console-render-progress__status").text(text);
      const $bar = $el.find(".console-render-progress__bar");
      if ($bar?.length) {
        if (Number.isFinite(determinateValue)) {
          $bar.attr("value", determinateValue);
          $bar.attr("max", 100);
        } else {
          $bar.removeAttr("value");
        }
      }
    };

    return {
      update,
      done(text = "Render complete") {
        update(text, 100);
        setTimeout(() => dialog.close(), 750);
      },
      fail(text = "Render failed") {
        update(text, 100);
        setTimeout(() => dialog.close(), 1200);
      },
      close() {
        if (dialog.rendered) dialog.close();
      }
    };
  }

  async function renderTileConsoleToWebM(tileDocument, overrideData = null, opts = {}) {
    if (!tileDocument) throw new Error("No tile document provided.");

    const progress = createRenderProgressDialog("Preparing renderer... This may take a minute; please be patient.");
    let app;
    let recordingIntervalId = null;
    let encodingIntervalId = null;
    const clearRecordingInterval = () => {
      if (recordingIntervalId !== null) {
        globalThis.clearInterval(recordingIntervalId);
        recordingIntervalId = null;
      }
    };
    const clearEncodingInterval = () => {
      if (encodingIntervalId !== null) {
        globalThis.clearInterval(encodingIntervalId);
        encodingIntervalId = null;
      }
    };
    try {
      const base = getPrintoutConfig(tileDocument);
      const data = overrideData ? mergeConfig(overrideData) : base;
      const effectMode = getEffectMode(data);
      if (data.effects) {
        data.effects.beepSrc = "";
        data.effects.beepVolume = 0;
        data.effects.loop = false;
      }

      const plainText = await extractPlainText(data.text ?? DEFAULT_CONFIG.text);
      const terminalLines = plainText.replace(/\r\n/g, "\n").split("\n");
      const estimatedMs = Math.max(1000, estimateEffectDurationMs(effectMode, data, terminalLines, plainText));
      const targetSeconds = Math.max(1, Number(opts.seconds ?? (estimatedMs / 1000)));

      const fps = Math.min(60, Math.max(5, Number(opts.fps ?? 30)));
      const width = Math.max(320, Math.floor(Number(opts.width ?? 1280)));
      const height = Math.max(240, Math.floor(Number(opts.height ?? 720)));
      const uploadDir = opts.uploadDir || `worlds/${game.world?.id}/console-printout`;

      const offscreenCanvas = document.createElement("canvas");
      offscreenCanvas.width = width;
      offscreenCanvas.height = height;

      if (typeof PIXI.Application?.prototype?.init === "function") {
        progress.update("Initializing off-screen renderer…");
        app = new PIXI.Application();
        await app.init({
          view: offscreenCanvas,
          width,
          height,
          backgroundAlpha: 0,
          antialias: true,
          resolution: 1,
          preserveDrawingBuffer: true
        });
      } else {
        app = new PIXI.Application({
          view: offscreenCanvas,
          width,
          height,
          backgroundAlpha: 0,
          antialias: true,
          resolution: 1,
          preserveDrawingBuffer: true
        });
      }

      progress.update("Building overlay…");
      let overlay = null;
      let effectManager = null;
      let effectPromise;
      if (effectMode === "terminal") {
        const cfg = buildOverlayConfig(tileDocument, data);
        cfg.x = 0;
        cfg.y = 0;
        cfg.width = width;
        cfg.height = height;
        cfg.padding = Math.max(8, Number(cfg.padding ?? data?.style?.padding ?? DEFAULT_CONFIG.style.padding));
        overlay = new ConsolePrintoutOverlay(cfg, terminalLines, app.stage, { muteAudio: true });
        effectPromise = overlay.run();
      } else {
        effectManager = new PrintoutEffectsManager(app.stage);
        const payload = buildEffectPayload(effectMode, plainText);
        const effectOpts = buildEffectOptions(effectMode, data, { viewportWidth: width, viewportHeight: height, renderer: app.renderer });
        effectPromise = effectManager.play(effectMode, payload, effectOpts);
      }

      const stream = offscreenCanvas.captureStream(fps);
      const preferredMime =
        MediaRecorder.isTypeSupported?.("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" :
        MediaRecorder.isTypeSupported?.("video/webm;codecs=vp8") ? "video/webm;codecs=vp8" :
        "video/webm";

      progress.update("Recording overlay... 0%", 0);
      const recorder = new MediaRecorder(stream, {
        mimeType: preferredMime,
        videoBitsPerSecond: Number(opts.bitrate ?? 4_000_000)
      });

      const chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size) chunks.push(event.data);
      };
      const recorderStopped = new Promise((resolve) => { recorder.onstop = resolve; });

      recorder.start();

      const recordingPhaseMax = 85;
      const recordingStartMs = performance?.now?.() ?? Date.now();
      const updateRecordingProgress = () => {
        const now = performance?.now?.() ?? Date.now();
        const elapsedSeconds = Math.max(0, (now - recordingStartMs) / 1000);
        const ratio = targetSeconds > 0 ? Math.min(1, elapsedSeconds / targetSeconds) : 0;
        const percent = Math.max(0, Math.min(recordingPhaseMax, Math.round(ratio * recordingPhaseMax)));
        progress.update(`Recording overlay... ${percent}%`, percent);
      };
      updateRecordingProgress();
      recordingIntervalId = globalThis.setInterval(updateRecordingProgress, 500);

      const timer = new Promise((resolve) => setTimeout(resolve, targetSeconds * 1000));
      await Promise.race([effectPromise ?? Promise.resolve(), timer]);
      if (overlay) overlay.destroy();
      if (effectManager) effectManager.destroyCurrent();
      clearRecordingInterval();

      recorder.stop();
      await recorderStopped;

      const encodingPhaseCap = 97;
      let encodingPercent = recordingPhaseMax + 5;
      const tickEncodingProgress = () => {
        encodingPercent = Math.min(encodingPhaseCap, encodingPercent + 1);
        progress.update(`Encoding and uploading... ${encodingPercent}%`, encodingPercent);
      };
      progress.update(`Encoding and uploading... ${encodingPercent}%`, encodingPercent);
      encodingIntervalId = globalThis.setInterval(tickEncodingProgress, 750);

      const blob = new Blob(chunks, { type: preferredMime });
      const fileName = `console-${Date.now()}.webm`;
      const file = new File([blob], fileName, { type: preferredMime });

      try { await FilePicker.createDirectory("data", uploadDir); }
      catch (err) { /* ignore existing dir */ }

      const uploaded = await FilePicker.upload("data", uploadDir, file);
      clearEncodingInterval();
      const videoPath = uploaded?.path || `${uploadDir}/${fileName}`;

      progress.update("Updating tile...", Math.min(encodingPhaseCap + 1, 98));
      await tileDocument.update({
        "texture.src": videoPath,
        "alpha": 1,
        "hidden": false
      });

      ui.notifications?.info(`Console video rendered: ${videoPath}`);
      progress.done();
      return videoPath;
    } catch (error) {
      console.error(`${MODULE_ID} | render to WebM failed`, error);
      progress.fail(error?.message ? `Render failed: ${error.message}` : undefined);
      throw error;
    } finally {
      clearRecordingInterval();
      clearEncodingInterval();
      try { app?.destroy(true); } catch (_) {}
    }
  }

  const debounce = (fn, ms=150) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  /* ----------------- overlay ----------------- */

  class ConsolePrintoutOverlay {
    constructor(config, lines, stageOverride = null, options = {}) {
      this.cfg = config;
      this.effectsEnabled = config.effectsEnabled ?? true;
      this.lines = lines;
      this.muteAudio = Boolean(options.muteAudio);
      this.maxTextHeight = Math.max(16, (this.cfg.height ?? 0) - 2 * (this.cfg.padding ?? 0));
      this._renderTail = "";

      this.root = new PIXI.Container();
      this.root.name = `${MODULE_ID}-overlay`;
      this.root.eventMode = "passive";
      this._stage = stageOverride || canvas.stage;
      this._stage.addChild(this.root);

      this.panel = new PIXI.Graphics();
      this.#drawPanel();
      this.root.addChild(this.panel);

      this.text = this.#createTextObject();
      this.root.addChild(this.text);

      this.baseAlpha = this.text.alpha;
      this.cursorVisible = true;
      this.cursorTimer = null;
      this.buffer = "";
      this.destroyed = false;

      this.flickerHandler = this.#flickerTick.bind(this);
      PIXI.Ticker.shared.add(this.flickerHandler);
    }

    async run() {
      try {
        this.#startCursor();
        do {
          this.buffer = "";
          this.#renderCurrent();
          for (let i = 0; i < this.lines.length; i++) {
            const line = this.lines[i] ?? "";
            const payload = `${line}\n`;
            for (const ch of payload) {
              await this.#typeChar(ch);
              if (this.destroyed) return;
            }
            const delay = line.trim() === "" ? this.cfg.paragraphDelay : this.cfg.lineDelay;
            await this.#sleep(delay);
            if (this.destroyed) return;
          }
          await this.#sleep(this.cfg.holdMs ?? 0);
          await this.#sleep(250);
        } while (this.cfg.loop && !this.destroyed);
      } finally {
        this.#stopCursor();
        this.#renderCurrent("");
      }
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      try { this.#stopCursor(); } catch (_) {}
      try { PIXI.Ticker.shared.remove(this.flickerHandler); } catch (_) {}
      try { if (this.root.parent) this.root.parent.removeChild(this.root); } catch (_) {}
      try { this.root.destroy({ children: true }); } catch (_) {}
    }

    #drawPanel() {
      const g = this.panel;
      const cfg = this.cfg;
      g.clear();
      g.lineStyle(cfg.borderWidth, cfg.borderColor, cfg.borderAlpha);
      g.beginFill(cfg.bgColor, cfg.bgAlpha);
      g.drawRoundedRect(cfg.x, cfg.y, cfg.width, cfg.height, cfg.cornerRadius);
      g.endFill();
    }

    #createTextObject() {
      const cfg = this.cfg;
      const style = new PIXI.TextStyle({
        fontFamily: cfg.fontFamily,
        fontSize: cfg.fontSize,
        fill: cfg.textColor,
        lineHeight: cfg.lineHeight,
        stroke: cfg.strokeColor,
        strokeThickness: cfg.strokeThickness,
        dropShadow: true,
        dropShadowColor: "#00140e",
        dropShadowBlur: 1,
        dropShadowDistance: 0
      });
      const text = new PIXI.Text("", style);
      text.x = cfg.x + cfg.padding;
      text.y = cfg.y + cfg.padding;
      text.alpha = 0.95;
      text.resolution = 2;
      text.wordWrap = true;
      text.wordWrapWidth = cfg.width - cfg.padding * 2;
      return text;
    }

    #renderCurrent(tail = "") {
      if (this.destroyed) return;
      this._renderTail = tail;
      const cursor = this.cursorVisible ? this.cfg.cursorChar : " ";
      this.text.text = `${this.buffer}${tail}${cursor}`;
      this.#trimOverflow();
    }

    #startCursor() {
      this.#stopCursor();
      this.cursorTimer = window.setInterval(() => {
        this.cursorVisible = !this.cursorVisible;
        this.#renderCurrent();
      }, this.cfg.cursorBlinkMs);
    }

    #stopCursor() {
      if (this.cursorTimer) window.clearInterval(this.cursorTimer);
      this.cursorTimer = null;
    }

    #flickerTick() {
      if (this.destroyed) return;
      if (!this.effectsEnabled || !this.cfg.flickerAmount) {
        this.text.alpha = this.baseAlpha;
        return;
      }
      this.text.alpha = this.baseAlpha - Math.random() * this.cfg.flickerAmount;
    }

    async #typeChar(ch) {
      if (this.destroyed) return;
      const baseX = this.text.x;
      if (this.effectsEnabled && this.cfg.jitterPx) {
        this.text.x = baseX + (Math.random() * this.cfg.jitterPx - this.cfg.jitterPx / 2);
      }

      const delay = Math.max(4, this.cfg.charDelay + (Math.random() * this.cfg.charDelayJitter * 2 - this.cfg.charDelayJitter));

      if (this.effectsEnabled && this.cfg.glitchFrames > 0 && ch !== "\n" && Math.random() < this.cfg.glitchChance) {
        for (let i = 0; i < this.cfg.glitchFrames; i++) {
          this.#renderCurrent(this.#pick(GLITCH_GLYPHS));
          await this.#sleep(12 + Math.random() * 28);
          if (this.destroyed) return;
        }
      }

      if (ch === "\n") {
        this.buffer += "\n";
      } else {
        this.buffer += ch;
        await this.#beep();
      }

      this.#renderCurrent();
      this.text.x = baseX;
      await this.#sleep(delay);
    }

    async #beep() {
      if (this.muteAudio) return;
      if (!this.effectsEnabled || !this.cfg.beepSrc || !this.cfg.beepVolume) return;
      if (FAILED_AUDIO_SRCS.has(this.cfg.beepSrc)) return;
      try {
        await AudioHelper.play(
          { src: this.cfg.beepSrc, volume: this.cfg.beepVolume, autoplay: true, loop: false },
          true
        );
      } catch (err) {
        console.warn(`${MODULE_ID} | beep failed`, err);
        FAILED_AUDIO_SRCS.add(this.cfg.beepSrc);
      }
    }

    #sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
    #pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    #trimOverflow() {
      if (!this.text || !Number.isFinite(this.maxTextHeight) || this.maxTextHeight <= 0) return;
      const maxHeight = this.maxTextHeight;
      if (this.text.height <= maxHeight) return;
      let safety = 0;
      while (this.text.height > maxHeight && safety < 5000) {
        const idx = this.buffer.indexOf("\n");
        if (idx >= 0) this.buffer = this.buffer.slice(idx + 1);
        else this.buffer = this.buffer.slice(1);
        safety++;
        const cursor = this.cursorVisible ? this.cfg.cursorChar : " ";
        this.text.text = `${this.buffer}${this._renderTail ?? ""}${cursor}`;
      }
    }
  }

  async function playOverlayForTile(tileDocument, overrideData=null) {
    destroyActiveOverlay();
    const base = getPrintoutConfig(tileDocument);
    const data = overrideData ? mergeConfig(overrideData) : base;
    const effectMode = getEffectMode(data);
    const plainText = await extractPlainText(data.text ?? DEFAULT_CONFIG.text);

    if (effectMode === "terminal") {
      const cfg = buildOverlayConfig(tileDocument, data);
      const lines = plainText.replace(/\r\n/g, "\n").split("\n");
      const overlay = new ConsolePrintoutOverlay(cfg, lines);
      ACTIVE_OVERLAY = overlay;
      await overlay.run();
      if (ACTIVE_OVERLAY === overlay) destroyActiveOverlay();
      return;
    }

    const payload = buildEffectPayload(effectMode, plainText);
    const manager = getCanvasEffectManager();
    const options = buildEffectOptions(effectMode, data, { viewport: getViewportDimensions() });
    ACTIVE_OVERLAY = manager;
    await manager.play(effectMode, payload, options);
  }

  function buildOverlayConfig(tileDocument, data) {
    const dims = canvas?.dimensions;
    if (!dims) throw new Error("Canvas dimensions are not available.");

    const panel = data.panel;
    const style = data.style;
    const effects = data.effects;
    const effectsEnabled = toBoolean(effects.enabled ?? DEFAULT_CONFIG.effects.enabled);
    const useTileRect = toBoolean(panel.useTileRect ?? DEFAULT_CONFIG.panel.useTileRect);

    let x, y, width, height;
    if (useTileRect && tileDocument) {
      x = Number(tileDocument.x ?? 0);
      y = Number(tileDocument.y ?? 0);
      width  = Number(tileDocument.width  ?? Math.floor(dims.sceneWidth  * DEFAULT_CONFIG.panel.widthRatio));
      height = Number(tileDocument.height ?? Math.floor(dims.sceneHeight * DEFAULT_CONFIG.panel.heightRatio));
    } else {
      x = Math.floor(dims.sceneWidth  * (panel.xRatio     ?? DEFAULT_CONFIG.panel.xRatio));
      y = Math.floor(dims.sceneHeight * (panel.yRatio     ?? DEFAULT_CONFIG.panel.yRatio));
      width  = Math.floor(dims.sceneWidth  * (panel.widthRatio  ?? DEFAULT_CONFIG.panel.widthRatio));
      height = Math.floor(dims.sceneHeight * (panel.heightRatio ?? DEFAULT_CONFIG.panel.heightRatio));
    }

    return {
      x, y, width, height,
      bgColor:      hexToNumber(panel.bgColor,      hexToNumber(DEFAULT_CONFIG.panel.bgColor)),
      bgAlpha:      Number(panel.bgAlpha      ?? DEFAULT_CONFIG.panel.bgAlpha),
      borderColor:  hexToNumber(panel.borderColor, hexToNumber(DEFAULT_CONFIG.panel.borderColor)),
      borderAlpha:  Number(panel.borderAlpha  ?? DEFAULT_CONFIG.panel.borderAlpha),
      borderWidth:  Number(panel.borderWidth  ?? DEFAULT_CONFIG.panel.borderWidth),
      cornerRadius: Number(panel.cornerRadius ?? DEFAULT_CONFIG.panel.cornerRadius),

      fontFamily:      style.fontFamily      ?? DEFAULT_CONFIG.style.fontFamily,
      fontSize:        Number(style.fontSize ?? DEFAULT_CONFIG.style.fontSize),
      textColor:       hexToNumber(style.textColor,  hexToNumber(DEFAULT_CONFIG.style.textColor)),
      strokeColor:     hexToNumber(style.strokeColor,hexToNumber(DEFAULT_CONFIG.style.strokeColor)),
      strokeThickness: Number(style.strokeThickness ?? DEFAULT_CONFIG.style.strokeThickness),
      lineHeight:      Number(style.lineHeight      ?? DEFAULT_CONFIG.style.lineHeight),
      padding:         Number(style.padding         ?? DEFAULT_CONFIG.style.padding),

      charDelay:        Number(effects.charDelay        ?? DEFAULT_CONFIG.effects.charDelay),
      charDelayJitter:  Number(effects.charDelayJitter  ?? DEFAULT_CONFIG.effects.charDelayJitter),
      glitchChance:     effectsEnabled ? Number(effects.glitchChance ?? DEFAULT_CONFIG.effects.glitchChance) : 0,
      glitchFrames:     effectsEnabled ? Number(effects.glitchFrames ?? DEFAULT_CONFIG.effects.glitchFrames) : 0,
      loop:             toBoolean(effects.loop          ?? DEFAULT_CONFIG.effects.loop),
      cursorChar:              effects.cursorChar       ?? DEFAULT_CONFIG.effects.cursorChar,
      cursorBlinkMs:     Number(effects.cursorBlinkMs   ?? DEFAULT_CONFIG.effects.cursorBlinkMs),
      lineDelay:         Number(effects.lineDelay       ?? DEFAULT_CONFIG.effects.lineDelay),
      paragraphDelay:    Number(effects.paragraphDelay  ?? DEFAULT_CONFIG.effects.paragraphDelay),
      flickerAmount:     effectsEnabled ? Number(effects.flickerAmount ?? DEFAULT_CONFIG.effects.flickerAmount) : 0,
      jitterPx:          effectsEnabled ? Number(effects.jitterPx ?? DEFAULT_CONFIG.effects.jitterPx) : 0,
      beepSrc:           effectsEnabled ? (effects.beepSrc ?? "") : "",
      beepVolume:        effectsEnabled ? Number(effects.beepVolume ?? DEFAULT_CONFIG.effects.beepVolume) : 0,
      holdMs:            Number(effects.holdMs ?? DEFAULT_CONFIG.effects.holdMs),
      effectsEnabled
    };
  }

  function destroyActiveOverlay() {
    if (ACTIVE_OVERLAY?.destroy) {
      try { ACTIVE_OVERLAY.destroy(); } catch (_) {}
    }
    ACTIVE_OVERLAY = null;
    CANVAS_EFFECT_MANAGER?.destroyCurrent();
  }

  function getCanvasEffectManager() {
    if (!CANVAS_EFFECT_MANAGER) CANVAS_EFFECT_MANAGER = new PrintoutEffectsManager(canvas.stage);
    return CANVAS_EFFECT_MANAGER;
  }

  async function createPrintoutTile() {
    if (!canvas?.scene) { ui.notifications?.warn("Canvas is not ready."); return; }
    const scene = canvas.scene;
    const width = 200, height = 200;
    const x = (canvas.dimensions.sceneWidth  - width)  / 2;
    const y = (canvas.dimensions.sceneHeight - height) / 2;

    const flagConfig = foundry.utils.deepClone(DEFAULT_CONFIG);

    const tileData = {
      x, y, width, height,
      alpha: 0.25,
      hidden: false,
      texture: {
        src: DEFAULT_TILE_IMAGE,
        tint: null, rotation: 0, scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0
      },
      occlusion: {
        mode: foundry?.CONST?.TILE_OCCLUSION_MODES?.NONE ?? CONFIG.Tile?.occlusionModes?.NONE ?? 0,
        alpha: 0
      },
      flags: { [MODULE_ID]: flagConfig }
    };

    try {
      const created = await scene.createEmbeddedDocuments("Tile", [tileData]);
      const tileDocument = created?.[0];
      if (tileDocument) {
        await migrateTileTexture(tileDocument);
        ui.notifications?.info("Console printout tile created. Configure it from the tile sheet or open the Manager.");
        tileDocument.sheet?.render(true);
        return tileDocument;
      }
    } catch (err) {
      console.error(`${MODULE_ID} | Tile creation failed`, err);
      ui.notifications?.error("Failed to create the Console printout tile. Check the console for details.");
    }
    return null;
  }

  /* --------------- Manager (FormApplication with inline UI) --------------- */

  class ConsolePrintoutManagerForm extends FormApplication {
    constructor(options = {}) {
      super(options);
      this.selectedTileId = options.tileId ?? null;
      this.livePreview = true;
      this._previewDebounced = debounce(this._doLivePreview.bind(this), 180);
    }

    static #instance;
    static getInstance() { return this.#instance ??= new this(); }
    static renderSingleton(tileId = null) {
      const instance = this.getInstance();
      if (tileId) instance.selectedTileId = tileId;
      if (instance.rendered) { instance.bringToTop(); instance.render(false); return instance; }
      instance.render(true); return instance;
    }

    async close(options) {
      this.livePreview = false;
      destroyActiveOverlay();
      return super.close(options);
    }

    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        title: "Console Printout Manager",
        template: null,               // We'll return inner content only
        width: 820,
        height: 780,
        resizable: true,
        classes: ["console-printout-manager"],
        submitOnChange: false,
        closeOnSubmit: false
      });
    }

    async getData() {
      const scene = canvas?.scene;
      const tilesData = [];
      let selectedTile = null;

      if (scene) {
        const docs = scene.tiles?.contents ?? [];
        const consoleDocs = docs.filter(d => d.getFlag(MODULE_ID, FLAG_KEY));
        const target = consoleDocs.length ? consoleDocs : docs;

        const hasTagger = game.modules.get("tagger")?.active;

        target.forEach((doc, idx) => {
          const cfg = doc.getFlag(MODULE_ID, FLAG_KEY);
          const configured = Boolean(cfg);
          const tags = hasTagger ? doc.getFlag("tagger", "tags") : null;
          const label =
            (doc.name && doc.name.trim()) ||
            tags?.[0] ||
            (doc.texture?.src ? doc.texture.src.split("/").pop() : null) ||
            `Tile ${idx + 1}`;
          tilesData.push({ id: doc.id, label, configured });
        });

        if (!this.selectedTileId && tilesData.length) {
          this.selectedTileId = tilesData[0].id;
        }

        if (this.selectedTileId) {
          const doc = docs.find(d => d.id === this.selectedTileId);
          if (doc) {
            const cfg = getPrintoutConfig(doc);
            const textPlain = await extractPlainText(cfg.text ?? DEFAULT_CONFIG.text);
            const fontValueRaw = (cfg?.style?.fontFamily ?? DEFAULT_CONFIG.style.fontFamily) || "";
            const fontValue = fontValueRaw.trim();
            const fontMatch = FONT_PRESETS.find((preset) => preset.value.toLowerCase() === fontValue.toLowerCase());
            selectedTile = {
              id: doc.id,
              label: tilesData.find(t => t.id === doc.id)?.label ?? (doc.name || doc.id),
              config: cfg,
              textPlain,
              fontPreset: fontMatch?.id ?? "__custom__",
              fontFamily: fontValue || DEFAULT_CONFIG.style.fontFamily
            };
          }
        }
      }

      const selectedFontPresetId = selectedTile?.fontPreset ?? "__custom__";
      const fontPresets = FONT_PRESETS.map((preset) => ({
        id: preset.id,
        label: preset.label,
        value: preset.value,
        selected: preset.id === selectedFontPresetId
      }));

      return {
        tiles: tilesData,
        selectedTile,
        effectPresets: Object.entries(EFFECT_PRESETS).map(([id, preset]) => ({ id, label: preset.label })),
        fontPresets,
        customFontSelected: selectedFontPresetId === "__custom__",
        hasTiles: tilesData.length > 0,
        live: this.livePreview
      };
    }

    async _renderInner(data) {
      const sel = data.selectedTile;
      const effects = sel?.config?.effects ?? DEFAULT_CONFIG.effects;
      const style   = sel?.config?.style   ?? DEFAULT_CONFIG.style;
      const panel   = sel?.config?.panel   ?? DEFAULT_CONFIG.panel;
      const effectMode = sel?.config?.effectMode ?? "terminal";
      const effectModeOptions = Object.entries(EFFECT_MODE_CONFIG).map(([mode, def]) => (
        `<option value="${mode}" ${mode === effectMode ? "selected" : ""}>${def.label}</option>`
      )).join("");
      const effectBlocksHtml = renderEffectModeBlocks(sel?.config ?? DEFAULT_CONFIG, effectMode);
      const effectsSectionStyle = effectMode === "terminal" ? "" : "style=\"display:none\"";

      const tilesList = data.tiles.map(t => `
        <li class="flex items-center justify-between py-1">
          <button type="button" data-action="select-tile" data-tile-id="${t.id}" class="button">${foundry.utils.escapeHTML(t.label)}</button>
          ${t.configured ? `<span class="tag">Configured</span>` : ``}
        </li>`).join("");

      const presets = data.effectPresets.map(p => `
        <button type="button" class="button" data-action="preset" data-preset="${p.id}">${p.label}</button>
      `).join("");

      const fontValueRaw = (style.fontFamily ?? DEFAULT_CONFIG.style.fontFamily) || "";
      const fontValue = fontValueRaw.trim();
      const fontMatch = FONT_PRESETS.find((preset) => preset.value.toLowerCase() === fontValue.toLowerCase());
      const selectedFontPreset = fontMatch?.id ?? "__custom__";
      const fontPresetOptions = FONT_PRESETS.map((preset) => `
        <option value="${preset.id}" ${preset.id === selectedFontPreset ? "selected" : ""}>
          ${foundry.utils.escapeHTML(preset.label)}
        </option>
      `).join("");

      // IMPORTANT: Return only inner content (no <form> wrapper).
      const html = `
          <section class="flexrow">
            <div class="pane" style="flex: 0 0 260px; margin-right: 12px;">
              <h3>Tiles</h3>
              <ul class="directory-list">${tilesList || `<li>No tiles found.</li>`}</ul>
              <div class="flexcol gap">
                <button type="button" data-action="create" class="button"><i class="fas fa-print"></i> Create Tile</button>
                <button type="button" data-action="focus" class="button" ${sel ? "" : "disabled"}>Focus Tile</button>
                <button type="button" data-action="open" class="button" ${sel ? "" : "disabled"}>Open Tile Sheet</button>
                <button type="button" data-action="render-webm" class="button" ${sel ? "" : "disabled"}><i class="fas fa-video"></i> Record Tile (WebM)</button>
              </div>
              <hr/>
              <label style="display:flex;align-items:center;gap:8px;">
                <input type="checkbox" name="livePreview" ${data.live ? "checked" : ""}/>
                Live Preview
              </label>
            </div>

            <div class="pane" style="flex: 1;">
              <h3>Glitchy Terminal Settings</h3>
              ${sel ? `
              <div class="form-group">
                <label>Effect Mode
                  <select name="effectMode">
                    ${effectModeOptions}
                  </select>
                </label>
              </div>

              <fieldset class="form-group">
                <legend>Text</legend>
                <textarea name="text" rows="8" style="width:100%;">${foundry.utils.escapeHTML(sel.textPlain || "")}</textarea>
              </fieldset>

              <div class="effect-mode-container">
                ${effectBlocksHtml || ""}
              </div>

              <div class="grid grid-2 gap" data-terminal-only ${effectsSectionStyle}>
                <fieldset class="form-group">
                  <legend>Effects</legend>
                  <label><input type="checkbox" name="effects.enabled" ${effects.enabled ? "checked" : ""}/> Use Effects</label>
                  <label><input data-live type="checkbox" name="effects.loop" ${effects.loop ? "checked" : ""}/> Loop Playback</label>
                  <div class="cp-field-grid">
                    <label>Char Delay (ms) <input data-live type="range" min="5" max="400" step="1" name="effects.charDelay" value="${effects.charDelay}"/></label>
                    <label>Char Jitter (ms) <input data-live type="range" min="0" max="200" step="1" name="effects.charDelayJitter" value="${effects.charDelayJitter}"/></label>
                    <label>Glitch Chance <input data-live type="range" min="0" max="1" step="0.01" name="effects.glitchChance" value="${effects.glitchChance}"/></label>
                    <label>Glitch Frames <input data-live type="range" min="0" max="12" step="1" name="effects.glitchFrames" value="${effects.glitchFrames}"/></label>
                    <label>Cursor <input data-live type="text" name="effects.cursorChar" maxlength="3" value="${foundry.utils.escapeHTML(effects.cursorChar || "_")}"/></label>
                    <label>Cursor Blink (ms) <input data-live type="range" min="80" max="3000" step="10" name="effects.cursorBlinkMs" value="${effects.cursorBlinkMs}"/></label>
                    <label>Line Delay (ms) <input data-live type="range" min="0" max="15000" step="10" name="effects.lineDelay" value="${effects.lineDelay}"/></label>
                  <label>Paragraph Delay (ms) <input data-live type="range" min="0" max="20000" step="10" name="effects.paragraphDelay" value="${effects.paragraphDelay}"/></label>
                  <label>Flicker Amount <input data-live type="range" min="0" max="0.5" step="0.01" name="effects.flickerAmount" value="${effects.flickerAmount}"/></label>
                  <label>Jitter (px) <input data-live type="range" min="0" max="6" step="0.1" name="effects.jitterPx" value="${effects.jitterPx}"/></label>
                  <label>Beep Volume <input data-live type="range" min="0" max="1" step="0.01" name="effects.beepVolume" value="${effects.beepVolume}"/></label>
                  <label>Beep Src <input data-live type="text" name="effects.beepSrc" value="${foundry.utils.escapeHTML(effects.beepSrc || "")}"/></label>
                  <label>Hold (ms) <input data-live type="range" min="0" max="20000" step="100" name="effects.holdMs" value="${effects.holdMs ?? DEFAULT_CONFIG.effects.holdMs}"/></label>
                </div>
                  <div class="flexrow gap" style="margin-top:6px;">${presets}</div>
                </fieldset>

                <fieldset class="form-group">
                  <legend>Style</legend>
                  <label>Font Preset
                    <select data-live name="style.fontPreset">
                      ${fontPresetOptions}
                      <option value="__custom__" ${selectedFontPreset === "__custom__" ? "selected" : ""}>Custom</option>
                    </select>
                  </label>
                  <label>Font Family <input data-live type="text" name="style.fontFamily" value="${foundry.utils.escapeHTML(fontValue || DEFAULT_CONFIG.style.fontFamily)}"/></label>
                  <div class="cp-field-grid">
                    <label>Font Size <input data-live type="range" min="8" max="96" step="1" name="style.fontSize" value="${style.fontSize}"/></label>
                    <label>Line Height <input data-live type="range" min="8" max="128" step="1" name="style.lineHeight" value="${style.lineHeight}"/></label>
                    <label>Padding <input data-live type="range" min="0" max="96" step="1" name="style.padding" value="${style.padding}"/></label>
                    <label>Text Color <input data-live type="color" name="style.textColor" value="${style.textColor}"/></label>
                    <label>Stroke Color <input data-live type="color" name="style.strokeColor" value="${style.strokeColor}"/></label>
                    <label>Stroke Thickness <input data-live type="range" min="0" max="12" step="1" name="style.strokeThickness" value="${style.strokeThickness}"/></label>
                  </div>
                </fieldset>
              </div>

              <fieldset class="form-group" data-terminal-only ${effectsSectionStyle}>
                <legend>Panel</legend>
                <label><input data-live type="checkbox" name="panel.useTileRect" ${panel.useTileRect ? "checked" : ""}/> Use Tile Rectangle</label>
                <div class="cp-field-grid">
                  <label>X Ratio <input data-live type="range" min="0" max="1" step="0.01" name="panel.xRatio" value="${panel.xRatio}"/></label>
                  <label>Y Ratio <input data-live type="range" min="0" max="1" step="0.01" name="panel.yRatio" value="${panel.yRatio}"/></label>
                  <label>Width Ratio <input data-live type="range" min="0.05" max="1" step="0.01" name="panel.widthRatio" value="${panel.widthRatio}"/></label>
                  <label>Height Ratio <input data-live type="range" min="0.05" max="1" step="0.01" name="panel.heightRatio" value="${panel.heightRatio}"/></label>
                  <label>BG Color <input data-live type="color" name="panel.bgColor" value="${panel.bgColor}"/></label>
                  <label>BG Alpha <input data-live type="range" min="0" max="1" step="0.01" name="panel.bgAlpha" value="${panel.bgAlpha}"/></label>
                  <label>Border Color <input data-live type="color" name="panel.borderColor" value="${panel.borderColor}"/></label>
                  <label>Border Alpha <input data-live type="range" min="0" max="1" step="0.01" name="panel.borderAlpha" value="${panel.borderAlpha}"/></label>
                  <label>Border Width <input data-live type="range" min="0" max="12" step="1" name="panel.borderWidth" value="${panel.borderWidth}"/></label>
                  <label>Corner Radius <input data-live type="range" min="0" max="48" step="1" name="panel.cornerRadius" value="${panel.cornerRadius}"/></label>
                </div>
              </fieldset>

              <div class="form-group">
                <button type="submit" class="button button-primary"><i class="fas fa-save"></i> Save</button>
              </div>
              ` : `<p>Select or create a tile.</p>`}
            </div>
          </section>
          <style>
            .console-printout-manager .pane h3 { margin: 0 0 6px; }
            .console-printout-manager .directory-list { max-height: 260px; overflow:auto; margin-bottom:8px; }
            .console-printout-manager .tag { background: #2f4050; color:#cde; padding: 0 6px; border-radius: 6px; font-size: 11px;}
            .console-printout-manager .grid { display:grid; }
            .console-printout-manager .grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
            .console-printout-manager .gap { gap: 8px; }
            .console-printout-manager .form-group { margin: 8px 0; }
            .console-printout-manager label { display:block; margin: 6px 0; }
            .console-printout-manager .cp-field-grid {
              display:grid;
              grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
              gap: 8px;
              align-items: flex-start;
            }
            .console-printout-manager .cp-field-grid label {
              margin: 0;
              display:flex;
              flex-direction:column;
              gap:4px;
            }
            .console-printout-manager input[type="number"],
            .console-printout-manager input[type="text"],
            .console-printout-manager input[type="color"],
            .console-printout-manager textarea { width: 100%; }
            .console-printout-manager input[type="range"] { width: 100%; }
            .console-printout-manager .button { margin: 2px 0; }
            .console-printout-manager .button-primary { background: #1b6; color: white; }
          </style>
      `;

      // Wrap in a div so FormApplication can insert it inside its own <form>
      return $(`<form class="console-form" autocomplete="off">${html}</form>`);
    }

    activateListeners(html) {
      super.activateListeners(html);

      const $root = html instanceof jQuery ? html : $(html);
      // Ensure FormApplication knows our form element
      if (!this.form) this.form = $root.is("form") ? $root[0] : $root.find("form")[0];
      const $form = $(this.form);

      // --- Hardwire Save to submit the FormApplication (prevents no-op)
      $root.find("button[type='submit'], .button.button-primary").off("click.console")
        .on("click.console", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          try { this.submit({ preventClose: true }); }
          catch (err) {
            console.error("console-printout | submit error", err);
            ui.notifications?.error("Saving failed — check console for details.");
          }
        });

      const selectTile = (tileId) => { this.selectedTileId = tileId; this.render(false); };

      // Tile list
      $root.find("[data-action='select-tile']").on("click", (event) => {
        event.preventDefault();
        const tileId = event.currentTarget.dataset.tileId;
        if (tileId) selectTile(tileId);
      });

      $root.find("[name='livePreview']").on("change", (ev) => {
        this.livePreview = ev.currentTarget.checked;
        if (this.livePreview) this._previewDebounced($form);
      });

      const refreshEffectVisibility = () => {
        const mode = $form.find("[name='effectMode']").val() || "terminal";
        $form.find("[data-effect-block]").hide().filter(`[data-effect-block='${mode}']`).show();
        const showTerminal = mode === "terminal";
        $form.find("[data-terminal-only]").toggle(showTerminal);
      };
      refreshEffectVisibility();
      $root.find("[name='effectMode']").on("change", (event) => {
        refreshEffectVisibility();
        if (this.livePreview) this._previewDebounced($form);
      });

      // Buttons
      $root.find("[data-action='focus']").on("click", (event) => {
        event.preventDefault();
        const tileId = this.selectedTileId; if (!tileId) return;
        const tile = canvas.tiles.get(tileId); if (!tile) return;
        tile.control({ releaseOthers: true });
        const center = tile.center ?? { x: tile.x + tile.width / 2, y: tile.y + tile.height / 2 };
        canvas.animatePan({ x: center.x, y: center.y, duration: 500 });
      });

      $root.find("[data-action='open']").on("click", (event) => {
        event.preventDefault();
        const tileId = this.selectedTileId; if (!tileId) return;
        const tile = canvas.scene?.tiles?.get(tileId);
        tile?.sheet?.render(true);
      });

      $root.find("[data-action='render-webm']").on("click", async (event) => {
        event.preventDefault();
        const tileId = this.selectedTileId;
        if (!tileId) return;
        const tile = canvas.scene?.tiles?.get(tileId);
        if (!tile) return;
        const data = this._collectFormData($form);

        const width = Math.max(320, Math.floor(tile.width ?? 1280));
        const height = Math.max(240, Math.floor(tile.height ?? 720));

        const previousLive = this.livePreview;
        this.livePreview = false;
        destroyActiveOverlay();

        try {
          ui.notifications?.info("Rendering Console Printout to WebM...");
          await renderTileConsoleToWebM(tile, data, { fps: 30, width, height });
          await this.close({ force: true });
        } catch (error) {
          console.error("console-printout | render to WebM failed", error);
          ui.notifications?.error("Render failed — check console for details.");
          this.livePreview = previousLive;
          if (this.livePreview) this._previewDebounced($form);
        }
      });

      $root.find("[data-action='create']").on("click", async (event) => {
        event.preventDefault();
        try {
          const created = await createPrintoutTile();
          if (created?.id) { this.selectedTileId = created.id; this.render(false); }
        } catch (error) {
          console.error("console-printout | create from manager failed", error);
        }
      });

      // Presets -> write into real form fields
      $root.find("[data-action='preset']").on("click", (event) => {
        event.preventDefault();
        const key = event.currentTarget.dataset.preset;
        const preset = EFFECT_PRESETS[key];
        if (!preset) return;
        const effects = preset.effects ?? {};
        Object.entries(effects).forEach(([field, value]) => {
          const $input = $form.find(`[name="effects.${field}"]`);
          if (!$input.length) return;
          if ($input.is(":checkbox")) $input.prop("checked", Boolean(value));
          else $input.val(value);
        });
        if (this.livePreview) this._previewDebounced($form);
      });

      $root.find("[name='style.fontPreset']").on("change", (event) => {
        const presetValue = FONT_PRESET_MAP[event.currentTarget.value];
        if (presetValue) {
          const $input = $form.find("[name='style.fontFamily']");
          if ($input.length) $input.val(presetValue);
        }
        if (this.livePreview) this._previewDebounced($form);
      });

      $root.find("[name='style.fontFamily']").on("input", (event) => {
        const current = (event.currentTarget.value || "").trim().toLowerCase();
        const match = FONT_PRESETS.find((preset) => preset.value.toLowerCase() === current);
        const $select = $form.find("[name='style.fontPreset']");
        if ($select.length) {
          const target = match ? match.id : "__custom__";
          if ($select.val() !== target) $select.val(target);
        }
      });

      // Live preview inputs (read from actual form)
      $form.on("input change", "textarea[name='text'], input[name='effects.enabled'], input[name='panel.useTileRect'], [data-live], input[type='color']", () => {
        if (this.livePreview) this._previewDebounced($form);
      });

      // Trigger one preview after render (if possible)
      this._kickPreviewOnce($form);
    }

    _kickPreviewOnce($form) {
      if (!this.livePreview || !this.selectedTileId) return;
      if (!canvas?.ready) {
        const once = () => { Hooks.off("canvasReady", once); try { this._previewDebounced($form); } catch(e){} };
        Hooks.on("canvasReady", once);
        return;
      }
      try { this._previewDebounced($form); } catch (e) {}
    }

    _collectFormData($form) {
      const formEl = $form[0];
      const fd = new FormData(formEl);
      const flat = {};
      for (const [k, v] of fd.entries()) flat[k] = v;

      const expanded = foundry.utils.expandObject(flat);
      const data = foundry.utils.deepClone(DEFAULT_CONFIG);
      data.text = plainTextToHtml(expanded.text ?? "");
      data.effectMode = expanded.effectMode ?? data.effectMode ?? "terminal";
      data.effectOptions = ensureEffectOptions(data.effectOptions);
      applyEffectOptionsFromForm(data.effectOptions, expanded.effectOptions);

      const ei = expanded.effects ?? {};
      Object.assign(data.effects, {
        enabled: toBoolean(ei.enabled ?? data.effects.enabled),
        loop: toBoolean(ei.loop ?? data.effects.loop),
        charDelay: clampNumber(ei.charDelay ?? data.effects.charDelay, 5, 400, data.effects.charDelay),
        charDelayJitter: clampNumber(ei.charDelayJitter ?? data.effects.charDelayJitter, 0, 200, data.effects.charDelayJitter),
        glitchChance: clampNumber(ei.glitchChance ?? data.effects.glitchChance, 0, 1, data.effects.glitchChance),
        glitchFrames: clampNumber(ei.glitchFrames ?? data.effects.glitchFrames, 0, 12, data.effects.glitchFrames),
        cursorChar: (ei.cursorChar ?? data.effects.cursorChar ?? "_").toString().slice(0, 3) || "_",
        cursorBlinkMs: clampNumber(ei.cursorBlinkMs ?? data.effects.cursorBlinkMs, 80, 3000, data.effects.cursorBlinkMs),
        lineDelay: clampNumber(ei.lineDelay ?? data.effects.lineDelay, 0, 15000, data.effects.lineDelay),
        paragraphDelay: clampNumber(ei.paragraphDelay ?? data.effects.paragraphDelay, 0, 20000, data.effects.paragraphDelay),
        flickerAmount: clampNumber(ei.flickerAmount ?? data.effects.flickerAmount, 0, 0.5, data.effects.flickerAmount),
        jitterPx: clampNumber(ei.jitterPx ?? data.effects.jitterPx, 0, 6, data.effects.jitterPx),
        beepSrc: ei.beepSrc ?? data.effects.beepSrc ?? "",
        beepVolume: clampNumber(ei.beepVolume ?? data.effects.beepVolume, 0, 1, data.effects.beepVolume),
        holdMs: clampNumber(ei.holdMs ?? data.effects.holdMs, 0, 60000, data.effects.holdMs)
      });

      const si = expanded.style ?? {};
      let fontFamily = (si.fontFamily ?? data.style.fontFamily) || data.style.fontFamily;
      const presetKey = si.fontPreset;
      if (presetKey && FONT_PRESET_MAP[presetKey]) fontFamily = FONT_PRESET_MAP[presetKey];
      Object.assign(data.style, {
        fontFamily,
        fontSize: clampNumber(si.fontSize ?? data.style.fontSize, 8, 96, data.style.fontSize),
        lineHeight: clampNumber(si.lineHeight ?? data.style.lineHeight, 8, 128, data.style.lineHeight),
        padding: clampNumber(si.padding ?? data.style.padding, 0, 96, data.style.padding),
        textColor: si.textColor ?? data.style.textColor,
        strokeColor: si.strokeColor ?? data.style.strokeColor,
        strokeThickness: clampNumber(si.strokeThickness ?? data.style.strokeThickness, 0, 12, data.style.strokeThickness)
      });

      const pi = expanded.panel ?? {};
      Object.assign(data.panel, {
        useTileRect: toBoolean(pi.useTileRect ?? data.panel.useTileRect),
        xRatio: clampNumber(pi.xRatio ?? data.panel.xRatio, 0, 1, data.panel.xRatio),
        yRatio: clampNumber(pi.yRatio ?? data.panel.yRatio, 0, 1, data.panel.yRatio),
        widthRatio: clampNumber(pi.widthRatio ?? data.panel.widthRatio, 0.05, 1, data.panel.widthRatio),
        heightRatio: clampNumber(pi.heightRatio ?? data.panel.heightRatio, 0.05, 1, data.panel.heightRatio),
        bgColor: pi.bgColor ?? data.panel.bgColor,
        bgAlpha: clampNumber(pi.bgAlpha ?? data.panel.bgAlpha, 0, 1, data.panel.bgAlpha),
        borderColor: pi.borderColor ?? data.panel.borderColor,
        borderAlpha: clampNumber(pi.borderAlpha ?? data.panel.borderAlpha, 0, 1, data.panel.borderAlpha),
        borderWidth: clampNumber(pi.borderWidth ?? data.panel.borderWidth, 0, 12, data.panel.borderWidth),
        cornerRadius: clampNumber(pi.cornerRadius ?? data.panel.cornerRadius, 0, 48, data.panel.cornerRadius)
      });

      return data;
    }

    async _doLivePreview($form) {
      if (!this.selectedTileId) return;
      const doc = canvas.scene?.tiles?.get(this.selectedTileId);
      if (!doc) return;

      const data = this._collectFormData($form);
      const plain = await extractPlainText(data.text);
      const mode = getEffectMode(data);

      if (mode === "terminal") {
        data.text = plainTextToHtml(ensurePreviewText(plain));
        const fx = data.effects ?? (data.effects = {});
        fx.charDelay = Math.min(Number(fx.charDelay ?? 55), 20);
        fx.charDelayJitter = Math.min(Number(fx.charDelayJitter ?? 20), 8);
        fx.lineDelay = Math.min(Number(fx.lineDelay ?? 700), 250);
        fx.paragraphDelay = Math.min(Number(fx.paragraphDelay ?? 1100), 400);
      } else {
        data.text = plainTextToHtml(plain);
      }

      destroyActiveOverlay();
      await playOverlayForTile(doc, data, { broadcast: false });
    }

    async _updateObject(event, formData) {
      // Prevent overlay from lingering over the UI during/after save.
      destroyActiveOverlay();

      if (!this.selectedTileId) {
        ui.notifications?.warn("Select a tile before saving Console Printout settings.");
        return;
      }

      const tileDoc = canvas.scene?.tiles?.get(this.selectedTileId);
      if (!tileDoc) {
        ui.notifications?.warn("The selected tile no longer exists.");
        return;
      }

      const expanded = foundry.utils.expandObject(formData);
      const currentConfig = getPrintoutConfig(tileDoc);
      const updated = foundry.utils.deepClone(currentConfig);

      updated.text = plainTextToHtml(expanded.text ?? "");
      updated.effectMode = expanded.effectMode ?? updated.effectMode ?? "terminal";
      updated.effectOptions = ensureEffectOptions(updated.effectOptions);
      applyEffectOptionsFromForm(updated.effectOptions, expanded.effectOptions);

      const ei = expanded.effects ?? {};
      const effects = updated.effects ?? foundry.utils.deepClone(DEFAULT_CONFIG.effects);
      effects.enabled         = toBoolean(ei.enabled ?? effects.enabled);
      effects.loop            = toBoolean(ei.loop ?? effects.loop);
      effects.charDelay       = clampNumber(ei.charDelay ?? effects.charDelay, 5, 400, effects.charDelay);
      effects.charDelayJitter = clampNumber(ei.charDelayJitter ?? effects.charDelayJitter, 0, 200, effects.charDelayJitter);
      effects.glitchChance    = clampNumber(ei.glitchChance ?? effects.glitchChance, 0, 1, effects.glitchChance);
      effects.glitchFrames    = clampNumber(ei.glitchFrames ?? effects.glitchFrames, 0, 12, effects.glitchFrames);
      effects.cursorChar      = (ei.cursorChar ?? effects.cursorChar ?? "_").toString().slice(0, 3) || "_";
      effects.cursorBlinkMs   = clampNumber(ei.cursorBlinkMs ?? effects.cursorBlinkMs, 80, 3000, effects.cursorBlinkMs);
      effects.lineDelay       = clampNumber(ei.lineDelay ?? effects.lineDelay, 0, 15000, effects.lineDelay);
      effects.paragraphDelay  = clampNumber(ei.paragraphDelay ?? effects.paragraphDelay, 0, 20000, effects.paragraphDelay);
      effects.flickerAmount   = clampNumber(ei.flickerAmount ?? effects.flickerAmount, 0, 0.5, effects.flickerAmount);
      effects.jitterPx        = clampNumber(ei.jitterPx ?? effects.jitterPx, 0, 6, effects.jitterPx);
      effects.beepSrc         = ei.beepSrc ?? effects.beepSrc ?? "";
      effects.beepVolume      = clampNumber(ei.beepVolume ?? effects.beepVolume, 0, 1, effects.beepVolume);
      effects.holdMs          = clampNumber(ei.holdMs ?? effects.holdMs, 0, 60000, effects.holdMs);
      updated.effects = effects;

      const si = expanded.style ?? {};
      const style = updated.style ?? foundry.utils.deepClone(DEFAULT_CONFIG.style);
      let fontFamily = si.fontFamily ?? style.fontFamily;
      const presetKey = si.fontPreset;
      if (presetKey && FONT_PRESET_MAP[presetKey]) fontFamily = FONT_PRESET_MAP[presetKey];
      style.fontFamily      = fontFamily;
      style.fontSize        = clampNumber(si.fontSize        ?? style.fontSize, 8, 96, style.fontSize);
      style.lineHeight      = clampNumber(si.lineHeight      ?? style.lineHeight, 8, 128, style.lineHeight);
      style.padding         = clampNumber(si.padding         ?? style.padding, 0, 96, style.padding);
      style.textColor       = si.textColor       ?? style.textColor;
      style.strokeColor     = si.strokeColor     ?? style.strokeColor;
      style.strokeThickness = clampNumber(si.strokeThickness ?? style.strokeThickness, 0, 12, style.strokeThickness);
      updated.style = style;

      const pi = expanded.panel ?? {};
      const panel = updated.panel ?? foundry.utils.deepClone(DEFAULT_CONFIG.panel);
      panel.useTileRect  = toBoolean(pi.useTileRect ?? panel.useTileRect);
      panel.xRatio       = clampNumber(pi.xRatio ?? panel.xRatio, 0, 1, panel.xRatio);
      panel.yRatio       = clampNumber(pi.yRatio ?? panel.yRatio, 0, 1, panel.yRatio);
      panel.widthRatio   = clampNumber(pi.widthRatio ?? panel.widthRatio, 0.05, 1, panel.widthRatio);
      panel.heightRatio  = clampNumber(pi.heightRatio ?? panel.heightRatio, 0.05, 1, panel.heightRatio);
      panel.bgColor      = pi.bgColor ?? panel.bgColor;
      panel.bgAlpha      = clampNumber(pi.bgAlpha ?? panel.bgAlpha, 0, 1, panel.bgAlpha);
      panel.borderColor  = pi.borderColor ?? panel.borderColor;
      panel.borderAlpha  = clampNumber(pi.borderAlpha ?? panel.borderAlpha, 0, 1, panel.borderAlpha);
      panel.borderWidth  = clampNumber(pi.borderWidth ?? panel.borderWidth, 0, 12, panel.borderWidth);
      panel.cornerRadius = clampNumber(pi.cornerRadius ?? panel.cornerRadius, 0, 48, panel.cornerRadius);
      updated.panel = panel;

      if (Object.prototype.hasOwnProperty.call(updated, "enabled")) delete updated.enabled;
      await tileDoc.setFlag(MODULE_ID, FLAG_KEY, updated);
      await migrateTileTexture(tileDoc);
      ui.notifications?.info("Console Printout settings saved.");
      this.render(false);
    }
  }

  /* --------------- Scene Controls: SAFE registration --------------- */

  Hooks.on("getSceneControlButtons", (controlsArg) => {
    const controls = Array.isArray(controlsArg) ? controlsArg : controlsArg?.controls ?? [];
    if (!Array.isArray(controls)) return;

    const tiles = controls.find(c => c && (c.name === "tiles" || c.layer === "TilesLayer"));
    if (!tiles) return;

    tiles.tools ??= [];
    const exists = (n) => tiles.tools.some(t => t?.name === n);

    if (!exists(CREATE_TOOL_NAME)) {
      tiles.tools.push({
        name: CREATE_TOOL_NAME,
        title: "Create Console Printout Tile",
        icon: "fas fa-print",
        button: true,
        visible: game.user?.isGM ?? true,
        onClick: () => createPrintoutTile()
      });
    }

    if (!exists(MANAGER_TOOL_NAME)) {
      tiles.tools.push({
        name: MANAGER_TOOL_NAME,
        title: "Console Printout Manager",
        icon: "fas fa-terminal",
        button: true,
        visible: true,
        onClick: () => ConsolePrintoutManagerForm.renderSingleton()
      });
    }
  });

  /* --------------- HUD buttons (hardened) --------------- */
  function attachManagerButtonToTileSheet(app, html) {
    const doc = app?.document ?? app?.object;
    if (!doc?.isOwner) return;

    const containerSelectors = [
      "footer.sheet-footer",
      "footer.form-footer",
      ".sheet-footer",
      ".form-footer",
      ".window-footer",
      "[data-region='footer']",
      "section[data-region='footer']",
      ".form-actions",
      ".form-buttons",
      ".sheet-buttons"
    ];

    const isShadowRoot = (node) => (typeof ShadowRoot !== "undefined") && node instanceof ShadowRoot;
    const isDocumentFragment =
      (node) => (typeof DocumentFragment !== "undefined") && node instanceof DocumentFragment;
    const normalizeNodes = (candidate) => {
      if (!candidate) return [];
      if (candidate.jquery) return candidate.get().filter(Boolean);
      if (Array.isArray(candidate)) return candidate.filter(Boolean);
      return [candidate];
    };

    const rootsSet = new Set();
    const addCandidate = (candidate) => {
      for (const node of normalizeNodes(candidate)) {
        if (!node) continue;
        if (node instanceof Element || isShadowRoot(node)) {
          rootsSet.add(node);
        } else if (isDocumentFragment(node)) {
          addCandidate(Array.from(node.children ?? []));
        }
      }
    };

    addCandidate(html);
    addCandidate(app?.element);
    addCandidate(app?.form);
    addCandidate(app?.sheet);

    const ensureButton = (rootNode) => {
      if (!rootNode) return false;
      const scope = rootNode;
      const query = scope.querySelector ? scope.querySelector.bind(scope) : null;
      const form = scope instanceof HTMLFormElement ? scope : query?.("form");

      const searchScopes = [];
      if (form) searchScopes.push(form);
      searchScopes.push(scope);

      let container = null;
      for (const searchScope of searchScopes) {
        if (!searchScope?.querySelector) continue;
        for (const selector of containerSelectors) {
          const candidate = searchScope.querySelector(selector);
          if (candidate) { container = candidate; break; }
        }
        if (container) break;
      }

      if (!container && form) container = form;
      if (!container && scope?.querySelector) container = scope;
      if (!container) return false;

      if (container.querySelector("[data-action='console-printout-config']")) return true;

      const button = container.ownerDocument?.createElement("button") ?? document.createElement("button");
      button.type = "button";
      button.className = "console-printout-button button";
      button.dataset.action = "console-printout-config";
      button.innerHTML = `<i class="fas fa-terminal"></i> Console Printout`;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        ConsolePrintoutManagerForm.renderSingleton(doc.id);
      });

      const submit = container.querySelector("button[type='submit'], button[name='submit']");
      if (submit?.parentElement === container) container.insertBefore(button, submit);
      else container.appendChild(button);
      return true;
    };

    const roots = Array.from(rootsSet);
    let attached = false;
    for (const root of roots) {
      attached = ensureButton(root) || attached;
      if (attached) break;
    }

    if (!attached && roots.length) {
      requestAnimationFrame(() => {
        for (const root of roots) {
          if (ensureButton(root)) break;
        }
      });
    }
  }
  Hooks.on("renderTileConfig", attachManagerButtonToTileSheet);
  Hooks.on("renderTileSheet", attachManagerButtonToTileSheet);
  Hooks.on("renderTileSheetV2", attachManagerButtonToTileSheet);
  Hooks.on("renderTileDocumentSheet", attachManagerButtonToTileSheet);
  Hooks.on("renderTileDocumentSheetV2", attachManagerButtonToTileSheet);

  /* --------------- Hooks --------------- */

  Hooks.once("init", () => {
    console.log(`${MODULE_ID} | script loaded`);

    // Keybindings must be registered by init (v13+)
    game.keybindings.register(MODULE_ID, "toggleManager", {
      name: "Toggle Console Printout Manager",
      hint: "Open or close the Console Printout manager window.",
      editable: [{ key: "KeyP", modifiers: ["Control", "Shift"] }],
      onDown: () => { ConsolePrintoutManagerForm.renderSingleton(); return true; },
      restricted: true
    });
  });

  Hooks.once("ready", () => {
    const module = game.modules.get(MODULE_ID);
    if (module) {
      module.api = module.api ?? {};
      module.api.createPrintoutTile = createPrintoutTile;
      module.api.openManager = () => ConsolePrintoutManagerForm.renderSingleton();
    }
  });

  Hooks.on("canvasInit", destroyActiveOverlay);
  Hooks.on("canvasTearDown", destroyActiveOverlay);

  Hooks.on("canvasReady", () => {
    migrateLegacyTileTextures(canvas.scene);
  });

})();

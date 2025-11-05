
// printout-effects.js
// Collection of PIXI-based text effects plus a manager for switching between them.

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (u) => 1 - Math.pow(1 - u, 3);

function getRenderer(explicit) {
  return (
    explicit ??
    canvas?.app?.renderer ??
    globalThis.app?.renderer ??
    PIXI.Renderer?.shared ??
    PIXI.autoDetectRenderer?.()
  );
}

function makeVerticalGradientTexture(opts = {}) {
  const {
    width = 1,
    height = 1,
    topAlpha = 0,
    bottomAlpha = 1,
    renderer: rendererOverride
  } = opts;
  const renderer = getRenderer(rendererOverride);
  const rt = PIXI.RenderTexture.create({ width, height });
  const g = new PIXI.Graphics();
  const steps = 64;
  for (let i = 0; i < steps; i++) {
    const a = topAlpha + (bottomAlpha - topAlpha) * (i / (steps - 1));
    g.beginFill(0xffffff, a);
    const y = (i / steps) * height;
    g.drawRect(0, y, width, Math.ceil(height / steps) + 1);
    g.endFill();
  }
  renderer?.render(g, { renderTexture: rt, clear: true });
  g.destroy();
  return rt;
}

function safeDestroy(displayObject, options = {}) {
  if (!displayObject || typeof displayObject.destroy !== "function") return;
  if (displayObject.destroyed) return;
  try {
    displayObject.destroy(options);
  } catch (err) {
    try { displayObject.destroy(); }
    catch (_) { /* ignore */ }
  }
}

function destroyTextObject(text) {
  safeDestroy(text, { children: true, texture: false, baseTexture: false });
}

export class ScriptWriter {
  constructor(parent, opts = {}) {
    this.parent = parent;
    this.opts = {
      x: 80,
      y: 80,
      width: 900,
      fontSize: 24,
      fontFamily: "IBM Plex Mono, Menlo, monospace",
      fill: 0x99ffcc,
      align: "left",
      perCharMs: 12,
      holdMs: 1000,
      fadeMs: 400,
      maxVisibleLines: 8,
      lineSpacing: 6,
      shadowColor: 0x003322,
      shadowAlpha: 0.6,
      ...opts
    };
    this.container = new PIXI.Container();
    this.parent.addChild(this.container);
    this.lines = [];
    this._destroyed = false;
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.lines.forEach((t) => destroyTextObject(t));
    this.lines.length = 0;
    safeDestroy(this.container, { children: true });
  }

  async write(line) {
      if (this._destroyed) return;
      this._layout();
      const style = new PIXI.TextStyle({
        fontFamily: this.opts.fontFamily,
        fontSize: this.opts.fontSize,
        fill: this.opts.fill,
        wordWrap: true,
        wordWrapWidth: this.opts.width,
        align: this.opts.align,
        dropShadow: true,
        dropShadowDistance: 1,
        dropShadowAngle: Math.PI * 0.5,
        dropShadowColor: this.opts.shadowColor,
        dropShadowAlpha: this.opts.shadowAlpha
      });
      const t = new PIXI.Text("", style);
      t.alpha = 1;
      this.container.addChild(t);
      this.lines.push(t);
      this._layout();
      const perChar = Math.max(0, this.opts.perCharMs | 0);
      for (let i = 1; i <= line.length; i++) {
        if (this._destroyed) return;
        t.text = line.slice(0, i);
        await sleep(perChar);
      }
      await sleep(this.opts.holdMs);
      await tweenNumber({
        from: 1,
        to: 0,
        dur: this.opts.fadeMs,
        onUpdate: (v) => (t.alpha = v)
      });
      const idx = this.lines.indexOf(t);
      if (idx >= 0) this.lines.splice(idx, 1);
      destroyTextObject(t);
      while (this.lines.length > this.opts.maxVisibleLines) {
        const oldest = this.lines.shift();
        destroyTextObject(oldest);
      }
      this._layout();
  }

  async writeMany(lines) {
    for (const l of lines) {
      await this.write(l);
    }
  }

  _layout() {
    const spacing = this.opts.lineSpacing | 0;
    const heights = this.lines.map((t) => t.height);
    let totalH =
      heights.reduce((a, b) => a + b, 0) +
      Math.max(0, (this.lines.length - 1) * spacing);
    let y = this.opts.y + Math.max(0, totalH);
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const t = this.lines[i];
      const h = heights[i];
      y -= h;
      t.x = this.opts.x;
      t.y = y;
      y -= spacing;
    }
  }
}

export class StarWarsCrawl {
  constructor(parent, text, opts = {}) {
    this.parent = parent;
    const w = opts.viewportWidth ?? canvas?.screenDimensions?.[0] ?? 1920;
    const h = opts.viewportHeight ?? canvas?.screenDimensions?.[1] ?? 1080;
    this.opts = {
      x: w * 0.5,
      y: h * 0.88,
      width: 1100,
      fontSize: 42,
      fontFamily: "News Cycle, Inter, sans-serif",
      fill: 0xffe08a,
      skew: -0.72,
      startScale: 1.2,
      endScale: 0.25,
      startY: 0,
      endY: -1800,
      durationMs: 30000,
      fadeTop: 0.8,
      fadeBottom: 0.08,
      renderer: null,
      ...opts
    };
    this.container = new PIXI.Container();
    this.container.x = this.opts.x;
    this.container.y = this.opts.y;
    this.block = new PIXI.Text(
      text,
      new PIXI.TextStyle({
        fontFamily: this.opts.fontFamily,
        fontSize: this.opts.fontSize,
        fill: this.opts.fill,
        wordWrap: true,
        wordWrapWidth: this.opts.width,
        align: "center",
        letterSpacing: 1,
        dropShadow: true,
        dropShadowColor: 0x3a2a00,
        dropShadowAlpha: 0.7,
        dropShadowDistance: 2
      })
    );
    this.block.anchor.set(0.5, 1);
    this.block.skew.x = this.opts.skew;
    const gradTex = makeVerticalGradientTexture({
      width: this.opts.width * 1.4,
      height: 800,
      topAlpha: this.opts.fadeBottom,
      bottomAlpha: 1,
      renderer: this.opts.renderer
    });
    const grad = new PIXI.Sprite(gradTex);
    grad.anchor.set(0.5, 1);
    grad.x = 0;
    grad.y = 0;
    this.container.addChild(this.block, grad);
    this.block.mask = grad;
    this.parent.addChild(this.container);
    this._start = performance.now();
    this._raf = requestAnimationFrame(this._tick.bind(this));
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    destroyTextObject(this.block);
    if (this.container?.parent) this.parent.removeChild(this.container);
    safeDestroy(this.container, { children: true });
  }

  _tick(ts) {
    const t = Math.min(1, (ts - this._start) / this.opts.durationMs);
    const u = easeOutCubic(t);
    const y = lerp(this.opts.startY, this.opts.endY, u);
    const s = lerp(this.opts.startScale, this.opts.endScale, u);
    this.block.y = y;
    this.block.scale.set(s);
    if (this.opts.fadeTop != null) {
      const ft = this.opts.fadeTop;
      const fadeU = Math.max(0, (u - ft) / (1 - ft));
      this.block.alpha = 1 - fadeU;
    }
    if (t < 1) this._raf = requestAnimationFrame(this._tick.bind(this));
  }
}

export class ArcaneRunes {
  constructor(parent, opts = {}) {
    this.parent = parent;
    this.opts = {
      x: 80,
      y: 120,
      width: 900,
      fontSize: 32,
      fontFamily: "Cinzel, Georgia, serif",
      hot: 0xfff0c0,
      cool: 0x88aaff,
      perCharMs: 18,
      holdMs: 500,
      fadeMs: 500,
      emberCount: [3, 6],
      emberDur: [500, 1200],
      lineSpacing: 8,
      maxLines: 6,
      ...opts
    };
    this.container = new PIXI.Container();
    this.parent.addChild(this.container);
    this.lines = [];
  }

  destroy() {
    this.lines.forEach((t) => destroyTextObject(t));
    this.lines.length = 0;
    safeDestroy(this.container, { children: true });
  }

  async inscribe(line) {
    const style = new PIXI.TextStyle({
      fontFamily: this.opts.fontFamily,
      fontSize: this.opts.fontSize,
      fill: this.opts.hot,
      wordWrap: true,
      wordWrapWidth: this.opts.width
    });
    const t = new PIXI.Text("", style);
    this.container.addChild(t);
    this.lines.push(t);
    this._layout();
    for (let i = 1; i <= line.length; i++) {
      t.text = line.slice(0, i);
      await sleep(this.opts.perCharMs);
    }
    await tweenNumber({
      from: 0,
      to: 1,
      dur: 300,
      onUpdate: (u) => {
        if (!t || t.destroyed || !t.style) return;
        const r = (this.opts.hot >> 16) & 255;
        const g = (this.opts.hot >> 8) & 255;
        const b = this.opts.hot & 255;
        const r2 = (this.opts.cool >> 16) & 255;
        const g2 = (this.opts.cool >> 8) & 255;
        const b2 = this.opts.cool & 255;
        const c = PIXI.utils.rgb2hex([
          lerp(r, r2, u) / 255,
          lerp(g, g2, u) / 255,
          lerp(b, b2, u) / 255
        ]);
        t.style.fill = c;
      }
    });
    this._spawnEmbers(t.getBounds());
    await sleep(this.opts.holdMs);

    await tweenNumber({
      from: 1,
      to: 0,
      dur: this.opts.fadeMs,
      onUpdate: (v) => {
        if (!t || t.destroyed) return;
        t.alpha = v;
      }
    });
    this.lines = this.lines.filter((x) => x !== t);
    destroyTextObject(t);
    while (this.lines.length > this.opts.maxLines) {
      const old = this.lines.shift();
      destroyTextObject(old);
    }
    this._layout();
  }

  async inscribeMany(lines) {
    for (const line of lines) {
      await this.inscribe(line);
    }
  }

  _layout() {
    const spacing = this.opts.lineSpacing;
    let y = this.opts.y;
    for (const t of this.lines) {
      t.x = this.opts.x;
      t.y = y;
      y += t.height + spacing;
    }
  }

  _spawnEmbers(bounds) {
    const [minC, maxC] = this.opts.emberCount;
    const [minD, maxD] = this.opts.emberDur;
    const n = Math.floor(minC + Math.random() * (maxC - minC + 1));
    for (let i = 0; i < n; i++) {
      const dot = new PIXI.Graphics()
        .beginFill(0xffd080, 0.9)
        .drawCircle(0, 0, 1 + Math.random() * 1.5)
        .endFill();
      dot.x = bounds.x + bounds.width * Math.random();
      dot.y = bounds.y + bounds.height * Math.random() * 0.6;
      this.parent.addChild(dot);
      const dy = -(20 + Math.random() * 40);
      const drift = Math.random() * 20 - 10;
      const dur = Math.floor(minD + Math.random() * (maxD - minD));
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / dur);
        dot.y = dot.y + dy * t * 0.05;
        dot.x = dot.x + drift * 0.02;
        dot.alpha = 1 - t;
        if (t < 1) PIXI.Ticker.shared.addOnce(() => tick(performance.now()));
        else safeDestroy(dot);
      };
      tick(start);
    }
  }
}

export class ScryingPool {
  constructor(parent, text, opts = {}) {
    this.parent = parent;
    const w = opts.viewportWidth ?? canvas?.screenDimensions?.[0] ?? 1920;
    const h = opts.viewportHeight ?? canvas?.screenDimensions?.[1] ?? 1080;
    this.opts = {
      x: 0.5,
      y: 0.6,
      width: 900,
      fontSize: 36,
      fontFamily: "Cormorant Garamond, Georgia, serif",
      fill: 0xe8f2ff,
      rippleStrength: 30,
      durationMs: 5000,
      sinkPx: 50,
      renderer: null,
      ...opts
    };
    this.container = new PIXI.Container();
    this.container.x = w * this.opts.x;
    this.container.y = h * this.opts.y;
    this.text = new PIXI.Text(
      text,
      new PIXI.TextStyle({
        fontFamily: this.opts.fontFamily,
        fontSize: this.opts.fontSize,
        fill: this.opts.fill,
        wordWrap: true,
        wordWrapWidth: this.opts.width,
        align: "center"
      })
    );
    this.text.anchor.set(0.5, 0.5);
    const rippleG = new PIXI.Graphics();
    const R = 128;
    for (let r = R; r > 0; r -= 6) {
      const a = r % 12 === 0 ? 0.35 : 0.15;
      rippleG.lineStyle(2, 0xffffff, a).drawCircle(0, 0, r);
    }
    rippleG.position.set(R + 2, R + 2);
    const rippleRT = PIXI.RenderTexture.create({ width: R * 2 + 4, height: R * 2 + 4 });
    getRenderer(this.opts.renderer)?.render(rippleG, {
      renderTexture: rippleRT,
      clear: true
    });
    rippleG.destroy();
    const rippleSprite = new PIXI.Sprite(rippleRT);
    rippleSprite.anchor.set(0.5);
    rippleSprite.x = 0;
    rippleSprite.y = 0;
    this.disp = new PIXI.filters.DisplacementFilter(rippleSprite);
    this.text.filters = [this.disp];
    this.container.addChild(this.text, rippleSprite);
    this.parent.addChild(this.container);
    this._start = performance.now();
    const animate = (now) => {
      const t = Math.min(1, (now - this._start) / this.opts.durationMs);
      rippleSprite.scale.set(1 + t * 1.2);
      rippleSprite.rotation += 0.002;
      const s = this.opts.rippleStrength * (1 - t);
      this.disp.scale.set(s, s);
      this.text.alpha = 1 - Math.max(0, (t - 0.6) / 0.4);
      this.text.y = lerp(0, this.opts.sinkPx, t);
      if (t < 1) this._raf = requestAnimationFrame(animate);
    };
    this._raf = requestAnimationFrame(animate);
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    if (this.container?.parent) this.parent.removeChild(this.container);
    safeDestroy(this.container, { children: true });
  }
}

export class TelemetrySweep {
  constructor(parent, opts = {}) {
    this.parent = parent;
    const w = opts.viewportWidth ?? canvas?.screenDimensions?.[0] ?? 1920;
    const h = opts.viewportHeight ?? canvas?.screenDimensions?.[1] ?? 1080;
    this.opts = {
      cx: w * 0.18,
      cy: h * 0.72,
      radius: 220,
      color: 0x79ffd6,
      columnX: w * 0.28,
      columnY: h * 0.46,
      lineWidth: 760,
      fontFamily: "IBM Plex Mono, Menlo, monospace",
      fontSize: 22,
      fill: 0xb8fff2,
      holdMs: 800,
      fadeMs: 350,
      sweepSpeed: 0.06,
      queue: [],
      ...opts
    };
    this.container = new PIXI.Container();
    this.parent.addChild(this.container);
    this.hud = new PIXI.Graphics();
    this.container.addChild(this.hud);
    this.arm = new PIXI.Graphics();
    this.container.addChild(this.arm);
    this.angle = 0;
    this._pending = [...this.opts.queue];
    this._activeTexts = [];
    this.hud
      .lineStyle(1, this.opts.color, 0.4)
      .drawCircle(this.opts.cx, this.opts.cy, this.opts.radius)
      .drawCircle(this.opts.cx, this.opts.cy, this.opts.radius * 0.5)
      .moveTo(this.opts.cx - 10, this.opts.cy)
      .lineTo(this.opts.cx + 10, this.opts.cy)
      .moveTo(this.opts.cx, this.opts.cy - 10)
      .lineTo(this.opts.cx, this.opts.cy + 10);
    this._tick = (d) => {
      this.angle = (this.angle + this.opts.sweepSpeed * d) % (Math.PI * 2);
      const a0 = this.angle - 0.1;
      const a1 = this.angle + 0.02;
      this.arm
        .clear()
        .lineStyle(2, this.opts.color, 0.8)
        .arc(this.opts.cx, this.opts.cy, this.opts.radius, a0, a1);
      const trigger = -Math.PI / 2;
      const crossed =
        Math.abs(
          Math.atan2(Math.sin(this.angle - trigger), Math.cos(this.angle - trigger))
        ) < 0.03;
      if (crossed && this._pending.length) this._spawnLine(this._pending.shift());
      this._activeTexts = this._activeTexts.filter((t) => t.parent);
    };
    PIXI.Ticker.shared.add(this._tick);
  }

  destroy() {
    PIXI.Ticker.shared.remove(this._tick);
    this._activeTexts.forEach((t) => destroyTextObject(t));
    if (this.container?.parent) this.parent.removeChild(this.container);
    safeDestroy(this.container, { children: true });
  }

  async _spawnLine(text) {
    const t = new PIXI.Text(
      text,
      new PIXI.TextStyle({
        fontFamily: this.opts.fontFamily,
        fontSize: this.opts.fontSize,
        fill: this.opts.fill,
        wordWrap: true,
        wordWrapWidth: this.opts.lineWidth
      })
    );
    const baseY = this.opts.columnY;
    const spacing = t.height * 1.1;
    const idx = this._activeTexts.length;
    t.x = this.opts.columnX;
    t.y = baseY + idx * spacing;
    t.alpha = 0;
    this.container.addChild(t);
    this._activeTexts.push(t);
    await tweenNumber({
      from: 0,
      to: 1,
      dur: 120,
      onUpdate: (v) => (t.alpha = v)
    });
    await sleep(this.opts.holdMs);
    await tweenNumber({
      from: 1,
      to: 0,
      dur: this.opts.fadeMs,
      onUpdate: (v) => (t.alpha = v)
    });
    destroyTextObject(t);
    this._activeTexts = this._activeTexts.filter((x) => x.parent);
    this._activeTexts.forEach(
      (x, i) => (x.y = baseY + i * spacing)
    );
  }
}

export class PrintoutEffectsManager {
  constructor(parent = canvas.stage) {
    this.parent = parent;
    this.current = null;
  }

  destroyCurrent() {
    if (this.current?.destroy) this.current.destroy();
    this.current = null;
  }

  async play(mode, payload, options = {}) {
    this.destroyCurrent();
    switch (mode) {
      case "script": {
        const eff = new ScriptWriter(this.parent, options);
        this.current = eff;
        if (Array.isArray(payload)) await eff.writeMany(payload);
        else if (typeof payload === "string") await eff.write(payload);
        return eff;
      }
      case "crawl": {
        const eff = new StarWarsCrawl(this.parent, String(payload ?? ""), options);
        this.current = eff;
        return eff;
      }
      case "runes": {
        const eff = new ArcaneRunes(this.parent, options);
        this.current = eff;
        if (Array.isArray(payload)) await eff.inscribeMany(payload);
        else if (typeof payload === "string") await eff.inscribe(payload);
        return eff;
      }
      case "scry": {
        const eff = new ScryingPool(this.parent, String(payload ?? ""), options);
        this.current = eff;
        return eff;
      }
      case "telemetry": {
        const eff = new TelemetrySweep(this.parent, {
          ...options,
          queue: Array.isArray(payload) ? payload : options.queue ?? []
        });
        this.current = eff;
        return eff;
      }
      default:
        ui?.notifications?.warn?.(`Unknown effect mode: ${mode}`);
        return null;
    }
  }
}

async function tweenNumber({ from, to, dur, onUpdate, ease = (x) => x }) {
  const start = performance.now();
  return new Promise((resolve) => {
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const v = from + (to - from) * ease(t);
      onUpdate?.(v, t);
      if (t >= 1) return resolve();
      PIXI.Ticker.shared.addOnce(() => step(performance.now()));
    };
    step(start);
  });
}

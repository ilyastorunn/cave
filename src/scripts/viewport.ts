/**
 * Lightweight DOM canvas viewport: pan + zoom for an infinite board.
 *
 * World coordinates are mapped to screen as: screen = world * scale + (x, y).
 * The `world` element gets one CSS transform; the dot grid is a background on
 * the `stage` element whose size/position follow the same transform.
 *
 * Input (FigJam-like):
 *  - drag empty space (mouse/pen/touch, or space/middle-button + drag) → pan
 *  - wheel / trackpad two-finger scroll → pan
 *  - ctrl/⌘ + wheel, trackpad pinch → zoom at cursor
 *  - two-finger touch pinch → zoom + pan
 *  - keys: +/- zoom, 0 reset to 100%, 1 fit to origin
 */

export interface ViewState {
  x: number;
  y: number;
  scale: number;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 4;
const GRID = 24; // world units between dots

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export class Viewport {
  readonly stage: HTMLElement;
  readonly world: HTMLElement;
  state: ViewState;

  private listeners = new Set<(s: ViewState) => void>();
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchStart: { dist: number; scale: number; mid: { x: number; y: number }; vx: number; vy: number } | null =
    null;
  private spaceDown = false;
  private raf = 0;

  constructor(stage: HTMLElement, world: HTMLElement, initial?: Partial<ViewState>) {
    this.stage = stage;
    this.world = world;
    const r = stage.getBoundingClientRect();
    // Default: world origin at the center of the stage.
    this.state = { x: r.width / 2, y: r.height / 2, scale: 1, ...initial };
    this.bind();
    this.apply();
  }

  onChange(fn: (s: ViewState) => void) {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  /** Screen point (relative to stage) → world point. */
  toWorld(sx: number, sy: number) {
    const { x, y, scale } = this.state;
    return { x: (sx - x) / scale, y: (sy - y) / scale };
  }

  set(next: Partial<ViewState>) {
    this.state = { ...this.state, ...next, scale: clamp(next.scale ?? this.state.scale, MIN_SCALE, MAX_SCALE) };
    this.schedule();
  }

  panBy(dx: number, dy: number) {
    this.set({ x: this.state.x + dx, y: this.state.y + dy });
  }

  /** Zoom to `scale`, keeping the stage point (sx, sy) fixed on screen. */
  zoomAt(scale: number, sx: number, sy: number) {
    const s = clamp(scale, MIN_SCALE, MAX_SCALE);
    const w = this.toWorld(sx, sy);
    this.set({ scale: s, x: sx - w.x * s, y: sy - w.y * s });
  }

  zoomBy(factor: number, sx?: number, sy?: number) {
    const r = this.stage.getBoundingClientRect();
    this.zoomAt(this.state.scale * factor, sx ?? r.width / 2, sy ?? r.height / 2);
  }

  /** Fit a world-space rectangle into the stage with padding, never zooming past `maxScale`. */
  fit(b: { x: number; y: number; w: number; h: number }, pad = 80, maxScale = 1) {
    const r = this.stage.getBoundingClientRect();
    const scale = clamp(
      Math.min((r.width - pad * 2) / Math.max(b.w, 1), (r.height - pad * 2) / Math.max(b.h, 1), maxScale),
      MIN_SCALE,
      MAX_SCALE,
    );
    this.set({ scale, x: r.width / 2 - (b.x + b.w / 2) * scale, y: r.height / 2 - (b.y + b.h / 2) * scale });
  }

  reset() {
    const r = this.stage.getBoundingClientRect();
    this.set({ x: r.width / 2, y: r.height / 2, scale: 1 });
  }

  private schedule() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.apply();
    });
  }

  /** Apply pending state now instead of next frame (use for the initial view, to avoid a flash). */
  flush() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.apply();
  }

  private apply() {
    const { x, y, scale } = this.state;
    this.world.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;

    // Keep dot spacing readable: double the grid step when dots get too dense.
    let step = GRID * scale;
    while (step < 12) step *= 2;
    this.stage.style.backgroundSize = `${step}px ${step}px`;
    this.stage.style.backgroundPosition = `${x}px ${y}px`;

    for (const fn of this.listeners) fn(this.state);
  }

  private local(e: { clientX: number; clientY: number }) {
    const r = this.stage.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /**
   * Whether a press on `target` should pan. UI chrome and interactive content
   * (embeds, links) never pan. Items pan in view mode; in edit mode they are
   * dragged by the editor instead.
   */
  editable = false;
  private isBackground(target: EventTarget | null) {
    if (!(target instanceof Element)) return true;
    if (target.closest('[data-ui], [data-interactive]')) return false;
    return this.editable ? !target.closest('[data-item]') : true;
  }

  private bind() {
    const { stage } = this;

    stage.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const p = this.local(e);
        if (e.ctrlKey || e.metaKey) {
          // Trackpad pinch arrives as ctrl+wheel with small deltas.
          // Mouse wheels send big deltas (~100); clamp so one notch is ≤ ~1.28x.
          const d = clamp(e.deltaY * (e.deltaMode === 1 ? 5 : 1), -25, 25);
          const factor = Math.exp(-d * 0.01);
          this.zoomAt(this.state.scale * factor, p.x, p.y);
        } else {
          const k = e.deltaMode === 1 ? 16 : 1;
          const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
          const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
          this.panBy(-dx * k, -dy * k);
        }
      },
      { passive: false },
    );

    // Safari trackpad pinch.
    let gestureScale = 1;
    stage.addEventListener('gesturestart', (e) => {
      e.preventDefault();
      gestureScale = 1;
    });
    stage.addEventListener('gesturechange', (e) => {
      e.preventDefault();
      const ge = e as unknown as { scale: number; clientX: number; clientY: number };
      const p = this.local(ge);
      this.zoomAt(this.state.scale * (ge.scale / gestureScale), p.x, p.y);
      gestureScale = ge.scale;
    });

    stage.addEventListener('pointerdown', (e) => {
      const panButton = e.button === 0 || e.button === 1;
      if (!panButton) return;
      if (e.button === 0 && !this.spaceDown && !this.isBackground(e.target)) return;
      e.preventDefault();
      stage.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, this.local(e));
      stage.dataset.panning = 'true';
      if (this.pointers.size === 2) this.startPinch();
    });

    stage.addEventListener('pointermove', (e) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const cur = this.local(e);
      this.pointers.set(e.pointerId, cur);

      if (this.pointers.size >= 2 && this.pinchStart) {
        this.updatePinch();
      } else if (this.pointers.size === 1) {
        this.panBy(cur.x - prev.x, cur.y - prev.y);
      }
    });

    const end = (e: PointerEvent) => {
      if (!this.pointers.delete(e.pointerId)) return;
      if (this.pointers.size < 2) this.pinchStart = null;
      if (this.pointers.size === 0) delete stage.dataset.panning;
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);

    window.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.code === 'Space' && !e.repeat) {
        this.spaceDown = true;
        stage.dataset.grab = 'true';
        e.preventDefault();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) {
        if (e.key === '=' || e.key === '+') (e.preventDefault(), this.zoomBy(1.25));
        else if (e.key === '-') (e.preventDefault(), this.zoomBy(0.8));
        else if (e.key === '0') (e.preventDefault(), this.reset());
        return;
      }
      if (e.key === '=' || e.key === '+') this.zoomBy(1.25);
      else if (e.key === '-') this.zoomBy(0.8);
      else if (e.key === '0') this.reset();
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.spaceDown = false;
        delete stage.dataset.grab;
      }
    });

    // Keep the view centered on the same world point when the stage resizes.
    let last = stage.getBoundingClientRect();
    new ResizeObserver(() => {
      const r = stage.getBoundingClientRect();
      this.panBy((r.width - last.width) / 2, (r.height - last.height) / 2);
      last = r;
    }).observe(stage);
  }

  private startPinch() {
    const [a, b] = [...this.pointers.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.pinchStart = {
      dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      scale: this.state.scale,
      mid,
      vx: this.state.x,
      vy: this.state.y,
    };
  }

  private updatePinch() {
    const ps = this.pinchStart!;
    const [a, b] = [...this.pointers.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const scale = clamp(ps.scale * (Math.hypot(a.x - b.x, a.y - b.y) / ps.dist), MIN_SCALE, MAX_SCALE);
    // World point under the starting midpoint stays under the current midpoint.
    const wx = (ps.mid.x - ps.vx) / ps.scale;
    const wy = (ps.mid.y - ps.vy) / ps.scale;
    this.set({ scale, x: mid.x - wx * scale, y: mid.y - wy * scale });
  }
}

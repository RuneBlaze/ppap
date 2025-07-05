// Particle System inspired by pico-ps (Lua) → TypeScript implementation for Phaser 3
// NOTE: This deliberately avoids Phaser's built-in particle system. We keep close parity
// with the original API so existing emitter configs defined for pico-ps can be re-used.
// The sprite blit helper (`blt`) is currently a stub – replace with real implementation
// when a sprite sheet becomes available.

import Phaser from "phaser";
import { PsPaletteArray } from "./ps_palette";

/* -------------------------------------------------------------------------
 * Utility helpers
 * -------------------------------------------------------------------------*/

const rand = (n: number): number => Math.random() * n;
const randSpread = (spread: number): number => rand(Math.abs(spread)) * Math.sign(spread);
const TAU = Math.PI * 2;

function toRadians(anglePico: number): number {
  // In pico-ps, angles were supplied in a 0-360 scale but converted with a magic
  // constant (1131). For simplicity we assume the incoming angle is already 0-360.
  return (anglePico / 360) * TAU;
}

/* -------------------------------------------------------------------------
 * Types mimicking the original system
 * -------------------------------------------------------------------------*/

export interface EmitterConfig {
  frequency: number; // particles per frame (use <1 for slower rates)
  max_p: number;
  size: [number, number, number?, number?] | number; // initial, final, spreadInit, spreadFinal
  speed: number | [number, number, number?, number?];
  life: number | [number, number]; // seconds or [life, spread]
  colors?: number[]; // palette indices (0-15)
  sprites?: number[]; // sprite indices for blitting
  area?: [number, number]; // spawn area width, height
  burst?: [boolean, number];
  angle?: [number, number] | number; // degrees, or [angle, spread]
  gravity?: boolean;
  duration?: number; // seconds emitter keeps emitting, undefined => forever
  delta_x?: number;
  delta_y?: number;
  appear_delay?: number; // frames
  rnd_color?: boolean;
}

interface Vec2 { x: number; y: number }

// HD-2D priming: interfaces for sprite illumination and flash effects
export interface IlluminationTarget {
  sprite: Phaser.GameObjects.Sprite;
  baseIntensity: number;
  currentIntensity: number;
  updateIllumination(intensity: number): void;
}

export interface FlashEvent {
  timing: number; // frame timing
  intensity: number; // flash intensity
  duration: number; // flash duration in frames
  triggered: boolean;
}

/* -------------------------------------------------------------------------
 * Global draw-call queue – mimics pico-8 draw list to decouple simulation from
 * rendering.  Each call is flushed exactly once per frame by Anim.draw(scene).
 * -------------------------------------------------------------------------*/

type DrawCall =
  | { t: "circfill"; x: number; y: number; r: number; c: number }
  | { t: "spr"; n: number; x: number; y: number };

const drawCalls: DrawCall[] = [];

export function circfill(x: number, y: number, r: number, c: number) {
  drawCalls.push({ t: "circfill", x, y, r, c });
}

export function spr(n: number, x: number, y: number) {
  drawCalls.push({ t: "spr", n, x, y });
}

/* Placeholder for sprite-sheet blit – replace later */
function blt(scene: Phaser.Scene, _n: number, x: number, y: number) {
  // TODO: Replace with actual sprite-sheet render. For now, draw a tiny square.
  const g = scene.add.graphics();
  g.fillStyle(0xffffff);
  g.fillRect(x, y, 4, 4);
  g.destroy();
}

/* -------------------------------------------------------------------------
 * Particle
 * -------------------------------------------------------------------------*/

class Particle {
  pos: Vec2;
  vel: Vec2;
  size: number;
  life: number; // remaining seconds
  gravity: boolean;
  colour: number | undefined; // palette index
  sprite: number | undefined; // sprite index

  // For interpolation over lifetime
  private lifeInitial: number;
  private sizeInitial: number;
  private sizeFinal: number;
  private velInitial: Vec2;
  private velFinal: Vec2;

  constructor(params: {
    x: number;
    y: number;
    gravity: boolean;
    colours?: number[];
    sprites?: number[];
    life: number;
    angle: number;
    speedInitial: number;
    speedFinal: number;
    sizeInitial: number;
    sizeFinal: number;
  }) {
    this.pos = { x: params.x, y: params.y };
    this.gravity = params.gravity;
    this.life = params.life;
    this.lifeInitial = params.life;

    this.size = params.sizeInitial;
    this.sizeInitial = params.sizeInitial;
    this.sizeFinal = params.sizeFinal;

    const rad = toRadians(params.angle);
    this.vel = {
      x: Math.cos(rad) * params.speedInitial,
      y: -Math.sin(rad) * params.speedInitial, // negative because screen y+ is down
    };
    this.velInitial = { ...this.vel };
    this.velFinal = {
      x: Math.cos(rad) * params.speedFinal,
      y: -Math.sin(rad) * params.speedFinal,
    };

    // Pick colour / sprite
    if (params.sprites && params.sprites.length) {
      this.sprite = params.sprites[Math.floor(rand(params.sprites.length))];
    }
    if (params.colours && params.colours.length) {
      this.colour = params.colours[Math.floor(rand(params.colours.length))];
    }
  }

  update(dt: number) {
    this.life -= dt;
    if (this.life <= 0) return;

    // interpolate size
    if (this.sizeInitial !== this.sizeFinal) {
      const dSize = (this.sizeInitial - this.sizeFinal) / this.lifeInitial;
      this.size -= dSize * dt;
    }

    // interpolate velocity
    if (this.velInitial.x !== this.velFinal.x) {
      const dVx = (this.velInitial.x - this.velFinal.x) / this.lifeInitial;
      const dVy = (this.velInitial.y - this.velFinal.y) / this.lifeInitial;
      this.vel.x -= dVx * dt;
      this.vel.y -= dVy * dt;
    }

    if (this.gravity) {
      this.vel.y += 50 * dt; // constant gravity
    }

    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
  }

  draw() {
    if (this.life <= 0) return;

    if (this.sprite !== undefined) {
      spr(this.sprite, this.pos.x, this.pos.y);
    } else if (this.colour !== undefined) {
      circfill(this.pos.x, this.pos.y, this.size, this.colour);
    }
  }
}

/* -------------------------------------------------------------------------
 * Emitter
 * -------------------------------------------------------------------------*/

class Emitter {
  config: EmitterConfig;
  particles: Particle[] = [];
  toRemove: Particle[] = [];

  // emitter state
  emitting = true;
  emitTimeAcc = 0; // how much emit quota has accumulated (frames)
  burstDone = false;
  pos: Vec2;
  
  // HD-2D priming: burst callback support
  onBurstCallback?: () => void;

  constructor(x: number, y: number, config: EmitterConfig) {
    this.pos = { x, y };
    this.config = config;
  }

  update(dt: number): number {
    let totalSpawned = 0;
    // spawn logic – similar to pico-ps
    if (this.emitting) {
      if (this.config.burst?.[0] && !this.burstDone) {
        const amount = Math.min(this.config.burst[1], this.config.max_p);
        totalSpawned += this.spawn(amount);
        this.burstDone = true;
        this.emitting = false;
        
        // HD-2D priming: trigger burst callback
        if (this.onBurstCallback) {
          this.onBurstCallback();
        }
      } else {
        this.emitTimeAcc += this.config.frequency * dt * 60; // frequency is #/frame, convert to # per sec
        const amount = Math.floor(this.emitTimeAcc);
        if (amount > 0) {
          totalSpawned += this.spawn(amount);
          this.emitTimeAcc -= amount;
        }
      }
    }

    // update particles
    for (const p of this.particles) {
      p.update(dt);
      if (p.life <= 0) this.toRemove.push(p);
    }
    // remove dead
    if (this.toRemove.length) {
      this.particles = this.particles.filter((p) => !this.toRemove.includes(p));
      this.toRemove.length = 0;
    }

    return totalSpawned;
  }

  draw() {
    for (const p of this.particles) {
      p.draw();
    }
  }

  private spawn(n: number): number {
    if (this.particles.length >= this.config.max_p) return 0;
    const allowed = Math.min(n, this.config.max_p - this.particles.length);

    for (let i = 0; i < allowed; i++) {
      this.particles.push(this.createParticle());
    }

    return allowed;
  }

  private createParticle(): Particle {
    const cfg = this.config;

    // area spawn offset
    let x = this.pos.x + (cfg.delta_x ?? 0);
    let y = this.pos.y + (cfg.delta_y ?? 0);
    if (cfg.area) {
      const [w, h] = cfg.area;
      x += rand(w) - w / 2;
      y += rand(h) - h / 2;
    }

    // life
    const life = Array.isArray(cfg.life)
      ? cfg.life[0] + randSpread(cfg.life[1])
      : cfg.life;

    // size
    const sizeParams = Array.isArray(cfg.size)
      ? cfg.size
      : [cfg.size, cfg.size];
    const sizeInit = sizeParams[0] as number;
    const sizeFinal = (sizeParams[1] ?? sizeInit) as number;
    const sizeSpreadInit = (sizeParams[2] ?? 0) as number;
    const sizeSpreadFinal = (sizeParams[3] ?? sizeSpreadInit) as number;

    const sInit = sizeInit + randSpread(sizeSpreadInit);
    const sFinal = sizeFinal + randSpread(sizeSpreadFinal);

    // speed
    const speedParams = Array.isArray(cfg.speed) ? cfg.speed : [cfg.speed, cfg.speed];
    const speedInit = speedParams[0] as number;
    const speedFinal = (speedParams[1] ?? speedInit) as number;
    const speedSpreadInit = (speedParams[2] ?? 0) as number;
    const speedSpreadFinal = (speedParams[3] ?? speedSpreadInit) as number;

    const spInit = speedInit + randSpread(speedSpreadInit);
    const spFinal = speedFinal + randSpread(speedSpreadFinal);

    // angle
    const angleParams = Array.isArray(cfg.angle) ? cfg.angle : [cfg.angle ?? 0, 360];
    const angleBase = angleParams[0] as number;
    const angleSpread = (angleParams[1] ?? 0) as number;
    const angle = angleBase + randSpread(angleSpread);

    return new Particle({
      x,
      y,
      gravity: cfg.gravity ?? false,
      colours: cfg.colors,
      sprites: cfg.sprites,
      life,
      angle,
      speedInitial: spInit,
      speedFinal: spFinal,
      sizeInitial: sInit,
      sizeFinal: sFinal,
    });
  }
}

/* -------------------------------------------------------------------------
 * Anim – orchestrates a collection of emitters, supports delayed appear.
 * -------------------------------------------------------------------------*/

export class Anim {
  emitters: Emitter[] = [];
  queued: { emitter: Emitter; delay: number }[] = [];
  timer = 0; // frames
  dead = false;
  emitting = true;
  previouslyEmitting = true;
  playSpeed = 1;
  
  // HD-2D priming: illumination and flash timing hooks
  private illuminationTargets: Set<IlluminationTarget> = new Set();
  private flashEvents: FlashEvent[] = [];
  private burstCallbacks: ((intensity?: number) => void)[] = [];
  private emissionHistory: number[] = []; // rolling 1-second history of emissions
  private lastBurstFrame: number = -Infinity; // frame index of last detected burst

  constructor(x: number, y: number, emitterConfigs: EmitterConfig[], playSpeed = 1) {
    this.playSpeed = playSpeed;

    for (const ec of emitterConfigs) {
      const e = new Emitter(x, y, ec);
      const delay = ec.appear_delay ?? 0;
      
      // NOTE: We no longer forward emitter-level burst events directly. A
      // statistical detector below will identify significant peaks across all
      // emitters and invoke burst callbacks at most once per second.
      
      if (delay > 0) {
        this.queued.push({ emitter: e, delay });
      } else {
        this.emitters.push(e);
      }
    }
    this.queued.sort((a, b) => a.delay - b.delay);
  }

  update(dt: number) {
    // dt provided by Phaser is ms – convert to seconds if needed. We assume dt is seconds here.
    // Manage queued emitters
    this.timer += dt * 60; // convert to frames equivalent

    while (this.queued.length && this.queued[0].delay <= this.timer) {
      this.emitters.push(this.queued.shift()!.emitter);
    }

    let allDead = true;
    let frameSpawned = 0;
    for (const e of this.emitters) {
      const spawned = e.update(dt * this.playSpeed);
      frameSpawned += spawned;
      e.draw();
      if (e.particles.length > 0 || e.emitting) {
        allDead = false;
      }
    }
    if (allDead && this.queued.length === 0) {
      this.dead = true;
    }

    // -------------------------------------------------------------------
    // Burst detection — identify emission peaks and trigger callbacks
    // -------------------------------------------------------------------
    const histLen = this.emissionHistory.length;
    let histMean = 0;
    let histMax = 0;

    if (histLen > 0) {
      for (const v of this.emissionHistory) {
        histMean += v;
        if (v > histMax) histMax = v;
      }
      histMean /= histLen;
    }

    let histStd = 0;
    if (histLen > 1) {
      let variance = 0;
      for (const v of this.emissionHistory) {
        variance += (v - histMean) * (v - histMean);
      }
      histStd = Math.sqrt(variance / histLen);
    }
    
    const threshold = histMean + histStd * 1.5;
    const minThreshold = 5;

    // Ensure at most one big burst per second (>=60 frames apart)
    if (frameSpawned > Math.max(threshold, minThreshold) && (this.timer - this.lastBurstFrame) >= 20) {
      // Use history's max or current spawn count to normalize intensity.
      const maxForIntensity = Math.max(histMax, frameSpawned);
      const intensity = maxForIntensity > 0 ? Math.min(frameSpawned / maxForIntensity, 1) : 0;
      this.burstCallbacks.forEach(cb => cb(intensity));
      this.lastBurstFrame = this.timer;
    }
    
    // Update history for the next frame
    this.emissionHistory.push(frameSpawned);
    if (this.emissionHistory.length > 60) {
      this.emissionHistory.shift(); // keep ~1 second of history (60 fps)
    }

    // HD-2D priming: update illumination and flash effects
    this.updateIllumination();
    this.processFlashEvents();
  }

  stop() {
    for (const e of this.emitters) {
      e.emitting = false;
    }
  }

  // HD-2D priming: illumination and flash management
  addIlluminationTarget(target: IlluminationTarget) {
    this.illuminationTargets.add(target);
  }

  removeIlluminationTarget(target: IlluminationTarget) {
    this.illuminationTargets.delete(target);
  }

  addFlashEvent(timing: number, intensity: number, duration: number = 0.1) {
    this.flashEvents.push({ timing, intensity, duration, triggered: false });
  }

  onBurst(callback: (intensity?: number) => void) {
    this.burstCallbacks.push(callback);
  }

  private updateIllumination() {
    // Calculate particle-based illumination intensity
    let totalIntensity = 0;
    for (const emitter of this.emitters) {
      totalIntensity += emitter.particles.length * 0.1; // Base illumination per particle
    }
    
    // Apply to all illumination targets
    for (const target of this.illuminationTargets) {
      target.updateIllumination(totalIntensity);
    }
  }

  private processFlashEvents() {
    for (const flash of this.flashEvents) {
      if (!flash.triggered && this.timer >= flash.timing) {
        flash.triggered = true;
        // Trigger flash on all illumination targets
        for (const target of this.illuminationTargets) {
          target.updateIllumination(flash.intensity);
        }
      }
    }
  }

  /**
   * Flush all queued draw calls using Phaser friendly GameObjects.
   *
   * - Circles are rendered through a single persistent Graphics object that
   *   is cleared each frame.
   * - Sprite calls are batched via a Blitter using the `ps_particle` sprite
   *   sheet (8×8 cells). All bobs are cleared each frame.
   *
   * This keeps the external API identical while avoiding the extremely costly
   * create-->draw-->destroy cycle that the previous stub implementation used.
   */
  static flushDrawCalls(scene: Phaser.Scene) {
    // ---------------------------------------------------------------------
    // Resolve / create the graphics map (one Graphics per palette colour)   
    // ---------------------------------------------------------------------
    const GRAPHICS_MAP_KEY = "__psGraphicsMap";
    let gMap = scene.data.get(GRAPHICS_MAP_KEY) as Map<number, Phaser.GameObjects.Graphics> | undefined;
    if (!gMap) {
      gMap = new Map();
      scene.data.set(GRAPHICS_MAP_KEY, gMap);
    }

    // Helper to lazily create a Graphics for a given palette index
    const getGraphicsForColour = (paletteIdx: number): Phaser.GameObjects.Graphics => {
      let g = gMap!.get(paletteIdx);
      if (!g) {
        g = scene.add.graphics();
        g.setDepth(9500);

        // Derive the colour hex for bloom (e.g. 0xff00ff)
        const colHex = Phaser.Display.Color.HexStringToColor(PsPaletteArray[paletteIdx]).color;

        // Attach bloom using the circle's own colour
        try {
        //   g.postFX.addBloom(colHex, 2, 2, 2, 2, 6);
            // g.postFX.addGlow(colHex, 2);
        } catch (err) {
          console.warn("Bloom FX unsupported on Graphics:", err);
        }

        gMap!.set(paletteIdx, g);
      }
      return g;
    };

    // Clear all existing graphics for this frame
    for (const g of gMap.values()) {
      g.clear();
    }

    // ---------------------------------------------------------------------
    // Resolve / create the shared Blitter for spritesheet rendering          
    // ---------------------------------------------------------------------
    const BLITTER_KEY = "__psBlitter";
    let blitter = scene.data.get(BLITTER_KEY) as Phaser.GameObjects.Blitter | undefined;
    if (!blitter) {
      if (scene.textures.exists("ps_particle")) {
        blitter = scene.add.blitter(0, 0, "ps_particle");
        blitter.setDepth(9501);
        scene.data.set(BLITTER_KEY, blitter);

        // Use white bloom so sprites keep their own colours
        try {
          blitter.postFX.addBloom(0xffffff, 2, 2, 2, 2, 6);
        } catch (err) {
          console.warn("Bloom FX unsupported on Blitter:", err);
        }
      }
    }

    // ---------------------------------------------------------------------
    // Replay queued immediate-mode calls                                     
    // ---------------------------------------------------------------------
    for (const dc of drawCalls) {
      if (dc.t === "circfill") {
        const graphics = getGraphicsForColour(dc.c);
        graphics.fillStyle(Phaser.Display.Color.HexStringToColor(PsPaletteArray[dc.c]).color, 1);
        graphics.fillCircle(dc.x, dc.y, dc.r);
      } else if (dc.t === "spr") {
        if (blitter) {
          blitter.create(dc.x, dc.y, dc.n);
        }
      }
    }

    // Important: reset the call queue for the next frame
    drawCalls.length = 0;
  }
}

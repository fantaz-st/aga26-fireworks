// Port of atos (github.com/manthrax/atos): src/main.js + utils/renderer.js
// + utils/PostProcessing.js, wrapped so a React component can mount and
// dispose it.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";
import { Flow } from "./flow";
import { LineDrawer } from "./LineDrawer";
import { FireworksAudio } from "./audio";

const { abs, min, random } = Math;
const rrng = (n = 0, p = 1) => random() * (p - n) + n;
const irrng = (n = 0, p = 1) => (random() * (p - n) + n) | 0;
const GRAV = -0.0098;

/**
 * @param {HTMLElement} container
 * @param {{ bombText?: string, lineWidth?: number, growFrom?: number, growDuration?: number }} opts
 *   bombText: optional word that ~1 in 20 shells burst into (atos used "thrax")
 *   lineWidth: trail thickness in pixels (default 3; atos was 1)
 *   growFrom: starting size of the fireworks, 0–1 (default 1 = no ramp)
 *   growDuration: seconds to grow from growFrom to full size (default 20)
 */
export function createFireworks(container, opts = {}) {
  // ---------- renderer / scene / camera (utils/renderer.js) ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setClearColor(0);
  Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%" });
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.01, 1000);
  scene.add(camera);
  camera.position.set(-24, 54, -26);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 40, 0);
  controls.enableDamping = true;
  controls.minDistance = 1;
  controls.maxDistance = 130;

  // ---------- bloom (utils/PostProcessing.js) ----------
  const composer = new EffectComposer(renderer);
  composer.renderTarget1.samples = 8;
  composer.renderTarget2.samples = 8;
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.5, 0.4, 0.85);
  bloom.threshold = 0.1;
  bloom.strength = 0.8;
  bloom.radius = 0.5;
  const bfac = bloom.compositeMaterial.uniforms.bloomFactors.value;
  for (let i = 0; i < 5; i++) bfac[i] = 10.1 - 2.02 * i;
  bloom.compositeMaterial.uniforms.bloomRadius.value = bloom.radius;
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const flow = new Flow();
  let baseLineWidth = opts.lineWidth ?? 3;
  const dd = new LineDrawer(100000, baseLineWidth);

  // size ramp: all fireworks live in a group scaled around the centre of the
  // burst area, so early shells look smaller / further away, then grow
  const growFrom = opts.growFrom ?? 1;
  const growMs = (opts.growDuration ?? 20) * 1000;
  let growStart = 0;
  const fx = new THREE.Group();
  fx.position.copy(controls.target);
  dd.lines.position.copy(controls.target).negate();
  fx.add(dd.lines);
  scene.add(fx);
  const applySize = (k) => {
    fx.scale.setScalar(k);
    dd.lineWidth = Math.max(1, baseLineWidth * k); // thinner trails when small
  };
  applySize(growFrom);
  const audio = new FireworksAudio(camera);

  const sfx = (
    name,
    position,
    { minGain = 0.05, maxGain = 0.3, minDetune = -700, maxDetune = -200 } = {},
  ) => audio.play(name, position, rrng(minGain, maxGain), rrng(minDetune, maxDetune));

  // ---------- particle system (src/main.js) ----------
  class Sys {
    nodes = [];
    now = performance.now() / 1000;
    dt = 0;
    ndt = 1;
    step() {
      const now = performance.now() / 1000;
      this.dt = now - this.now;
      this.now = now;
      this.ndt = min(this.dt / (1 / 60), 3); // clamp so a hidden tab doesn't explode
      let w = 0;
      for (let i = 0; i < this.nodes.length; i++) {
        const n = this.nodes[i];
        if (!n.step()) this.nodes[w++] = n;
      }
      this.nodes.length = w;
    }
    emit(fn, ctx) {
      const n = new Node(this);
      const f = flow.start(fn, n, ctx);
      f.onDone = () => (n.dead = true);
      n.velocity.randomDirection();
      n.velocity.x *= 0.1;
      n.velocity.z *= 0.1;
      n.velocity.y = abs(n.velocity.y) * 0.4;
      this.nodes.push(n);
      return n;
    }
  }

  const _p = new THREE.Vector3();
  const _n = new THREE.Vector3();

  class Node {
    life = 0.2;
    mass = 1;
    drag = 0;
    power = 1;
    dead = false;
    hidden = false; // physics only, no trail (the launcher)
    position = new THREE.Vector3();
    velocity = new THREE.Vector3();
    color = (random() * (1 << 24)) | 0;
    prims = new Array(8);
    ptop = 0;
    constructor(sys) {
      this.sys = sys;
      this.spawntime = sys.now;
    }
    erase(p) {
      dd.clearSeg(p);
    }
    dispose() {
      const t = min(this.ptop, this.prims.length);
      for (let i = 0; i < t; i++) this.erase(this.prims[i]);
    }
    step() {
      dd.color.set(this.color);
      const age = min(1, (this.sys.now - this.spawntime) / this.life);
      const len = this.prims.length;

      if (this.hidden) {
        this.position.addScaledVector(this.velocity, this.sys.ndt);
        return this.dead;
      }

      if (this.ptop >= len) this.erase(this.prims[this.ptop % len]);
      this.prims[this.ptop % len] = dd.top();
      this.ptop++;

      dd.moveto(this.position);
      _p.copy(this.velocity).multiplyScalar(this.sys.ndt);
      this.position.add(_p);
      dd.lineto(this.position);

      this.velocity.y += GRAV * this.mass * this.sys.ndt;
      if (this.position.y < 0) {
        this.position.y = -this.position.y;
        this.velocity.y *= -1;
        this.velocity.multiplyScalar(0.5);
      } else if (this.drag) {
        this.velocity.multiplyScalar(this.drag);
      }

      // fade the trail oldest → newest, all dimming with age.
      // (atos indexed past the recorded slots for a spark's first frames, so
      // those segments never faded — invisible at 1px, blobs on fat lines)
      const t = min(len, this.ptop);
      for (let i = 0; i < t; i++) {
        const p = this.prims[(this.ptop - t + i) % len];
        dd.pushtop(p);
        dd.lineCol(dd.color, (i / t) * ((1 - age) ** 2 * 2));
        dd.poptop();
      }

      if (this.dead) {
        this.dispose();
        return true;
      }
      return false;
    }
  }

  function* spark(n, shell) {
    n.position.copy(shell.position);
    n.velocity.randomDirection().multiplyScalar(0.23 * shell.power);
    n.velocity.add(shell.velocity);
    n.life = rrng(0.8, 1);
    n.mass = rrng(0.5, 1);
    n.drag = rrng(0.95, 0.99);
    yield n.life * 1000;
  }

  let textBomb = null;

  function* shell(s) {
    s.velocity.y += 0.7;
    s.velocity.x *= 1.5;
    s.velocity.z *= 1.5;
    s.power = rrng(1, 2);
    s.life = 1.05 * s.power;
    yield s.life * 1000;
    s.dead = true;
    sfx(random() > 0.1 ? "boom0" : "pop0", s.position, {
      minDetune: -2000,
      maxDetune: 500,
      minGain: 0.5,
      maxGain: 0.7,
    });
    if (textBomb && !irrng(0, 20)) s.sys.emit(textBomb, s);
    for (let i = 0; i < 50; i++) s.sys.emit(spark, s);
  }

  function* launcher(l) {
    l.hidden = true;
    l.velocity.set(0, 0, 0);
    while (true) {
      yield irrng(10, 30);
      if (rrng() > 0.95) yield 3000;
      sfx("launch0", l.position, { minDetune: -500, maxDetune: 3500 });
      l.sys.emit(shell, l);
    }
  }

  const msys = new Sys();
  flow.start(function* () {
    while (true) {
      msys.step();
      yield 0;
    }
  });

  // ---------- optional text-shaped bursts ----------
  let disposed = false;
  let textMesh = null;
  if (opts.bombText) {
    new FontLoader().load("/fonts/helvetiker_regular.typeface.json", (font) => {
      if (disposed) return;
      const geometry = new TextGeometry(opts.bombText, {
        font,
        size: 16,
        depth: 1,
        curveSegments: 2,
        bevelEnabled: true,
        bevelThickness: 0.1,
        bevelSize: 0.1,
        bevelOffset: 0,
        bevelSegments: 1,
      });
      textMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
      geometry.computeBoundingBox();
      geometry.boundingBox.getCenter(_p);
      geometry.translate(-_p.x, -_p.y, -_p.z);
      geometry.boundingBox.getSize(_p);
      const sc = 1 / _p.x;
      geometry.scale(sc, sc, sc);
      const sampler = new MeshSurfaceSampler(textMesh).build();

      function* meshSpark(n, s) {
        sampler.sample(_p, _n);
        _p.applyQuaternion(camera.quaternion); // letters face the camera
        n.position.copy(s.position).add(_p);
        n.velocity.copy(_p.multiplyScalar(1.5)).add(s.velocity);
        n.life = rrng(1.5, 3);
        n.mass = 1.2;
        n.drag = 0.99;
        yield n.life * 1000;
      }
      textBomb = function* (n, s) {
        for (let i = 0; i < 300; i++) n.sys.emit(meshSpark, s).color = n.color;
      };
    });
  }

  // ---------- loop ----------
  renderer.setAnimationLoop(() => {
    flow.updateAll();
    dd.update();
    if (growStart && growFrom < 1) {
      const t = min(1, (performance.now() - growStart) / growMs);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; // ease in-out
      applySize(growFrom + (1 - growFrom) * e);
    }
    controls.update();
    composer.render();
  });

  let started = false;

  return {
    /** call from a click handler — browsers block audio until a user gesture */
    enableAudio: () => audio.enable(),
    setMuted: (m) => (audio.muted = m),
    setLineWidth: (px) => {
      baseLineWidth = px;
      applySize(fx.scale.x);
    },
    /** begin launching shells */
    start() {
      if (started) return;
      started = true;
      growStart = performance.now();
      msys.emit(launcher, null);
    },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      flow.clear();
      audio.dispose();
      controls.dispose();
      composer.dispose();
      bloom.dispose();
      dd.dispose();
      textMesh?.geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

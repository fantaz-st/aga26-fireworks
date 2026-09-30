// Port of atos/src/utils/DebugDrawer.js — a ring buffer of additive
// line segments. Sparks write their trail segments into it and later
// rewrite their colours to fade them out.
//
// Drawn with three's LineSegments2 ("fat lines") so the trails can be
// thicker than WebGL's fixed 1px lines. `lineWidth` is in pixels.
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

export class LineDrawer {
  color = new THREE.Color("white");
  #cursor = new THREE.Vector3();
  #top = 0;
  #stack = [];
  #version = 0;
  #lastVersion = 0;

  /**
   * @param {number} count      max vertices (2 per segment)
   * @param {number} lineWidth  trail thickness in pixels
   */
  constructor(count = 100000, lineWidth = 3) {
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.col = new Float32Array(count * 3);

    // each segment = 6 floats [start xyz, end xyz], one instance per segment
    this.posBuf = new THREE.InstancedInterleavedBuffer(this.pos, 6, 1).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.colBuf = new THREE.InstancedInterleavedBuffer(this.col, 6, 1).setUsage(
      THREE.DynamicDrawUsage,
    );

    const geometry = new LineSegmentsGeometry();
    geometry.setAttribute("instanceStart", new THREE.InterleavedBufferAttribute(this.posBuf, 3, 0));
    geometry.setAttribute("instanceEnd", new THREE.InterleavedBufferAttribute(this.posBuf, 3, 3));
    geometry.setAttribute("instanceColorStart", new THREE.InterleavedBufferAttribute(this.colBuf, 3, 0));
    geometry.setAttribute("instanceColorEnd", new THREE.InterleavedBufferAttribute(this.colBuf, 3, 3));
    geometry.instanceCount = 0;

    const material = new LineMaterial({
      linewidth: lineWidth,
      vertexColors: true,
      toneMapped: false,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.lines = new LineSegments2(geometry, material);
    this.lines.frustumCulled = false;
  }

  /** push changed vertex data to the GPU — call once per frame before rendering */
  update() {
    if (this.#version === this.#lastVersion) return;
    this.lines.geometry.instanceCount =
      this.#top >= this.count ? this.count / 2 : Math.ceil(this.#top / 2);
    this.posBuf.needsUpdate = true;
    this.colBuf.needsUpdate = true;
    this.#lastVersion = this.#version;
  }

  set lineWidth(px) {
    this.lines.material.linewidth = px;
  }

  top() {
    return this.#top % this.count;
  }
  pushtop(n) {
    this.#stack.push(this.#top);
    this.#top = n;
  }
  poptop() {
    this.#top = this.#stack.pop() ?? 0;
  }

  #setCol(i, r, g, b) {
    i *= 3;
    this.col[i] = r;
    this.col[i + 1] = g;
    this.col[i + 2] = b;
  }

  #vt(p, c = this.color) {
    const i = this.#top % this.count;
    this.pos[i * 3] = p.x;
    this.pos[i * 3 + 1] = p.y;
    this.pos[i * 3 + 2] = p.z;
    this.#setCol(i, c.r, c.g, c.b);
    this.#top++;
  }

  /** blank the segment starting at vertex index i (position and colour) */
  clearSeg(i) {
    this.pos.fill(0, i * 3, i * 3 + 6);
    this.col.fill(0, i * 3, i * 3 + 6);
    this.#version++;
  }

  moveto(p) {
    this.#cursor.copy(p);
  }

  lineto(p) {
    this.#vt(this.#cursor);
    this.#cursor.copy(p);
    this.#vt(this.#cursor);
    this.#version++;
  }

  /** recolour the segment at the current top (two vertices) */
  lineCol(c, scl = 1) {
    const r = c.r * scl, g = c.g * scl, b = c.b * scl;
    this.#setCol(this.#top % this.count, r, g, b);
    this.#top++;
    this.#setCol(this.#top % this.count, r, g, b);
    this.#top++;
    this.#version++;
  }

  dispose() {
    this.lines.geometry.dispose();
    this.lines.material.dispose();
  }
}

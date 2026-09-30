// Port of atos/src/utils/flow.js — a tiny generator scheduler.
// A flow yields a number of milliseconds to wait (0 = next frame);
// returning ends it.

class FlowInstance {
  constructor(gen) {
    this.gen = gen;
    this.wakeAt = 0;
    this.onDone = null;
  }
  /** returns false when the flow has finished */
  update(now) {
    if (now < this.wakeAt) return true;
    const r = this.gen.next();
    if (r.done) return false;
    this.wakeAt = now + (r.value ?? 0);
    return true;
  }
}

export class Flow {
  flows = [];

  start(fn, ...args) {
    const fi = new FlowInstance(fn(...args));
    this.flows.push(fi);
    return fi;
  }

  updateAll(now = performance.now()) {
    const fl = this.flows;
    let w = 0;
    for (let i = 0; i < fl.length; i++) {
      const f = fl[i];
      if (f.update(now)) fl[w++] = f;
      else f.onDone?.();
    }
    fl.length = w;
  }

  clear() {
    this.flows.length = 0;
  }
}

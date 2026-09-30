// Port of atos/src/utils/audio.js. Browsers only allow audio after a user
// gesture, so call `enable()` from a click handler.
import * as THREE from "three";

const FILES = {
  boom0: "/sfx/boom0.mp3",
  launch0: "/sfx/launch0.mp3",
  pop0: "/sfx/pop0.mp3",
};

export class FireworksAudio {
  #sounds = {};
  #listener = null;
  #active = new Set();
  muted = false;

  constructor(camera) {
    this.camera = camera;
  }

  enable() {
    if (this.#listener) return;
    this.#listener = new THREE.AudioListener();
    this.camera.add(this.#listener);
    this.#listener.context.resume(); // we're inside the click, so this is allowed
    const loader = new THREE.AudioLoader();
    Object.entries(FILES).forEach(([name, url]) =>
      loader.load(url, (buffer) => {
        this.#sounds[name] = { buffer, maxInstances: 6, instanceCount: 0 };
      }),
    );
  }

  play(name, position, gain, detune) {
    const snd = this.#sounds[name];
    if (!snd || !this.#listener || this.muted) return;
    if (snd.instanceCount >= snd.maxInstances) return;

    const sound = new THREE.PositionalAudio(this.#listener);
    sound.setBuffer(snd.buffer);
    sound.setRefDistance(5);
    if (detune) sound.setDetune(detune);
    if (gain) sound.gain.gain.value = gain;
    if (position) sound.position.copy(position);
    this.camera.parent?.add(sound);
    sound.play();
    snd.instanceCount++;
    this.#active.add(sound);
    sound.source.onended = () => {
      sound.disconnect();
      sound.removeFromParent();
      snd.instanceCount--;
      this.#active.delete(sound);
    };
  }

  dispose() {
    this.#active.forEach((s) => {
      try {
        s.stop();
      } catch {}
    });
    this.#active.clear();
    // three.js shares one AudioContext app-wide, so it is left open here
    if (this.#listener) this.camera.remove(this.#listener);
  }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudioPlayer} from '../public/audio-player.mjs';

test('audio is lazy, reports failure, retries the source and supports pause', async t => {
  let instance, count = 0;
  class FakeAudio extends EventTarget {
    constructor(src) { super(); this.src = src; this.loads = 0; instance = this; count++; }
    play() {
      if (!this.loads) return Promise.reject(new Error('network error'));
      this.dispatchEvent(new Event('play'));
      return Promise.resolve();
    }
    pause() { this.dispatchEvent(new Event('pause')); }
    load() { this.loads++; }
  }
  const original = globalThis.Audio;
  globalThis.Audio = FakeAudio;
  t.after(() => { if (original) globalThis.Audio = original; else delete globalThis.Audio; });
  const changes = [];
  const player = createAudioPlayer({card:{audioAvailable:true,audioUrl:'./audio/test.mp3'},onStateChange:s=>changes.push(s.state)});
  assert.equal(count,0);
  player.play();
  await Promise.resolve();
  assert.equal(player.getState(),'error');
  player.play();
  assert.equal(instance.loads,1);
  assert.equal(player.getState(),'playing');
  player.pause();
  assert.equal(player.getState(),'paused');
  player.dispose();
  assert.equal(player.getState(),'unavailable');
  assert.deepEqual(changes.slice(0,3),['error','playing','paused']);
});

test('missing audio remains unavailable without claiming playback', () => {
  const player = createAudioPlayer({card:{audioAvailable:false}});
  assert.equal(player.isAvailable(),false);
  assert.equal(player.play().success,false);
});

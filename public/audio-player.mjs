/**
 * 音频播放器接口
 * 规划要求：缺少授权音频时只交付接口与清晰的不可用状态，不编造素材或播放成功反馈
 */

export function createAudioPlayer({ card, onStateChange = () => {} } = {}) {
  let audio = null;
  let state = 'unavailable'; // unavailable | ready | playing | paused | error

  // 检查音频是否可用
  const available = card?.audioAvailable === true && card?.audioUrl && typeof card.audioUrl === 'string';

  if (!available) {
    state = 'unavailable';
    onStateChange({ state, available: false, reason: 'no-audio-file' });
    return {
      isAvailable: () => false,
      getState: () => 'unavailable',
      play: () => ({ success: false, reason: 'no-audio-file' }),
      pause: () => ({ success: false, reason: 'no-audio-file' }),
      stop: () => ({ success: false, reason: 'no-audio-file' }),
      dispose: () => {}
    };
  }

  // 音频可用时准备播放器；Audio 对象延迟到首次播放才构造——没有用户手势就不发起任何音频请求
  const bind = () => {
    audio.addEventListener('play', () => {
      state = 'playing';
      onStateChange({ state, available: true });
    });

    audio.addEventListener('pause', () => {
      state = 'paused';
      onStateChange({ state, available: true });
    });

    audio.addEventListener('ended', () => {
      state = 'ready';
      onStateChange({ state, available: true, ended: true });
    });

    audio.addEventListener('error', (e) => {
      state = 'error';
      onStateChange({ state, available: true, error: e.error || e.message });
    });
  };

  const ensure = () => {
    if (audio) return audio;
    audio = new Audio(card.audioUrl);
    bind();
    return audio;
  };
  state = 'ready';

  return {
    isAvailable: () => true,
    getState: () => state,
    play() {
      try {
        if (state === 'error' && audio) {
          audio.load();
          state = 'ready';
        }
        const a = ensure();
        const promise = a.play();
        if (promise) {
          promise.catch(err => {
            state = 'error';
            onStateChange({ state, available: true, error: err.message });
          });
        }
        return { success: true };
      } catch (e) {
        state = 'error';
        onStateChange({ state, available: true, error: e.message });
        return { success: false, reason: 'play-failed', error: e.message };
      }
    },
    pause() {
      if (!audio) return { success: false, reason: 'audio-not-ready' };
      try {
        audio.pause();
        return { success: true };
      } catch (e) {
        return { success: false, reason: 'pause-failed', error: e.message };
      }
    },
    stop() {
      if (!audio) return { success: false, reason: 'audio-not-ready' };
      try {
        audio.pause();
        audio.currentTime = 0;
        state = 'ready';
        onStateChange({ state, available: true });
        return { success: true };
      } catch (e) {
        return { success: false, reason: 'stop-failed', error: e.message };
      }
    },
    dispose() {
      if (audio) {
        try {
          audio.pause();
          audio.src = '';
          audio.load();
        } catch (e) {
          console.warn('Audio dispose error:', e);
        }
        audio = null;
      }
      state = 'unavailable';
    }
  };
}

/**
 * 获取音频状态的用户友好文本
 */
export function getAudioStateMessage(state) {
  const messages = {
    unavailable: '此花卡暂无配音内容',
    ready: '点击播放',
    playing: '播放中',
    paused: '已暂停',
    error: '音频加载失败'
  };
  return messages[state] || '未知状态';
}

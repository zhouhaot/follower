import { visitorNavigation } from './visitor-navigation.mjs';
import { scanURL } from './flow.mjs';
import { cardByKey } from './cards.mjs';
import { getStatus, hasCollected, addCollection, removeCollection, recordView, subscribe } from './collection-store-v2.mjs';
import { createAudioPlayer, getAudioStateMessage } from './audio-player.mjs';

import { renderCollectionNotice, collectionFailureMessage } from './collection-feedback.mjs';

// 从 URL 参数获取花卡 key
const params = new URLSearchParams(window.location.search);
const flowerKey = params.get('key');
const card = cardByKey(flowerKey);
if (card) document.title = `${card.title} · 花的故事 | 花开有声`;

if (!card) {
  document.getElementById('app').innerHTML = `
    <main style="padding:60px;text-align:center">
      <h1>花卡不存在</h1>
      <p><a href="./index.html">返回首页</a></p>
    </main>
  `;
  throw new Error('Invalid flower key');
}

// 记录浏览
recordView({ key: card.key, source: 'detail' });

// 创建音频播放器
let audioPlayer = null;

if (card.audioAvailable) {
  audioPlayer = createAudioPlayer({
    card,
    onStateChange: () => {
      updateAudioUI();
    }
  });
}

function updateAudioUI() {
  const audioBtn = document.getElementById('audio-btn');
  const audioStatus = document.getElementById('audio-status');

  if (!audioBtn || !audioStatus) return;

  if (!card.audioAvailable || !audioPlayer?.isAvailable()) {
    audioBtn.disabled = true;
    audioBtn.textContent = '暂无配音';
    audioStatus.textContent = getAudioStateMessage('unavailable');
  } else {
    audioBtn.disabled = false;
    const state = audioPlayer.getState();
    audioBtn.textContent = state === 'playing' ? '暂停' : '播放故事';
    audioStatus.textContent = getAudioStateMessage(state);
  }
}

function toggleAudio() {
  if (!audioPlayer?.isAvailable()) return;

  const state = audioPlayer.getState();
  if (state === 'playing') {
    audioPlayer.pause();
  } else {
    audioPlayer.play();
  }
}

function updateCollectionUI() {
  const collectBtn = document.getElementById('collect-btn');
  const collected = hasCollected(card.key);

  if (collectBtn) {
    collectBtn.textContent = collected ? '已收藏' : '收藏这朵花';
    collectBtn.classList.toggle('collected', collected);
    collectBtn.disabled = getStatus().kind !== 'ready';
  }
  if (collectBtn) collectBtn.setAttribute('aria-pressed', String(collected));
  renderCollectionNotice(document.getElementById('collection-notice'), getStatus());
}

function toggleCollection() {
  const collected = hasCollected(card.key);

  if (collected) {
    const result = removeCollection(card.key);
    if (result.saved) {
      updateCollectionUI();
      document.getElementById('collection-status').textContent = collected ? '已取消收藏，最近浏览仍保留。' : '已收藏，可在“我的花册”找回。';
    } else {
      alert(collectionFailureMessage(result.reason));
    }
  } else {
    const result = addCollection({ key: card.key });
    if (result.saved) {
      updateCollectionUI();
      document.getElementById('collection-status').textContent = collected ? '已取消收藏，最近浏览仍保留。' : '已收藏，可在“我的花册”找回。';
    } else {
      alert(collectionFailureMessage(result.reason));
    }
  }
}

// 订阅收藏变化
const unsubscribe = subscribe(() => {
  updateCollectionUI();
});

// 渲染页面
function render() {
  const app = document.getElementById('app');

  app.innerHTML = `
    ${visitorNavigation('detail')}
    <main id="main" class="visitor-main">
      <a class="detail-back" href="./catalogue.html">← 返回花卡图录</a>
      <div id="collection-notice"></div>
      <div class="flower-detail-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:start">
        <div class="flower-exhibit">
          <img src="${card.image}" alt="${card.title}" width="1100" height="1881" class="detail-art">
        </div>
        <div class="flower-info">
          <h1 style="font-size:2.5rem;margin:0 0 10px">${card.title}</h1>
          <p style="color:#999;margin:0 0 30px">${card.english}</p>

          <div style="margin-bottom:30px;padding:20px;background:#1a1a1a;border-radius:8px">
            <p style="color:#ccc;line-height:1.8;margin:0">${card.description}</p>
          </div>

          <div style="margin-bottom:30px">
            <h2 style="font-size:1.2rem;margin:0 0 15px;color:#ccc">花的故事</h2>
            <p style="color:#999;line-height:1.8;margin:0">${card.story}</p>
          </div>

          <div class="audio-panel" style="margin-bottom:30px;padding:20px;background:#1a1a1a;border-radius:8px">
            <h3 style="font-size:1rem;margin:0 0 15px;color:#ccc">听花</h3>
            <div class="flower-audio-controls" style="display:flex;gap:10px;align-items:center;margin-bottom:10px">
              <button id="audio-btn" style="padding:10px 20px;background:#444;color:#fff;border:none;border-radius:4px;cursor:pointer">
                ${card.audioAvailable ? '播放故事' : '暂无配音'}
              </button>
              <span id="audio-status" role="status" style="color:#999;font-size:0.9rem"></span>
            </div>
            ${!card.audioAvailable ? '<p style="color:#999;font-size:0.85rem;margin:10px 0 0">当前暂无配音，完整故事已在上方呈现。</p>' : ''}
          </div>

          <div class="flower-actions" style="display:flex;gap:15px;margin-bottom:30px">
            <button id="collect-btn" style="padding:12px 30px;background:#16753a;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:1rem">
              收藏这朵花
            </button>
            <a href="./preview.html?card=${card.key}" style="padding:12px 30px;background:#444;color:#fff;text-decoration:none;border-radius:4px;display:inline-block">
              观赏三维花卡
            </a>
          </div>

          <p id="collection-status" role="status" aria-live="polite" class="save-status"></p>
          <p class="detail-followup"><a href="./collection.html">到我的花册查看 →</a><span>收藏仅保存在当前浏览器</span></p>
          <details class="optional-scan"><summary>有实体花卡？</summary><p>实体卡扫描仍为候选体验，扫描记录尚未接入新版花册。</p><a href="${scanURL(card.key, {from:'detail'})}">进入扫描准备页 →</a></details>
          <div style="padding:20px;background:#1a1a1a;border-radius:8px;font-size:0.85rem;color:#999">
            <p style="margin:0 0 5px"><strong>原作：</strong>${card.artwork}</p>
            <p style="margin:0"><strong>来源：</strong>${card.credit}</p>
          </div>
        </div>
      </div>

      <div style="margin-top:60px;padding-top:40px;border-top:1px solid #333;text-align:center">
        <a href="./catalogue.html" class="visitor-link">浏览全部五朵花 →</a>
      </div>
    </main>
  `;

  // 绑定事件
  document.getElementById('audio-btn')?.addEventListener('click', toggleAudio);
  document.getElementById('collect-btn')?.addEventListener('click', toggleCollection);

  // 初始化 UI 状态
  updateAudioUI();
  updateCollectionUI();
}

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  audioPlayer?.dispose();
  unsubscribe();
});

render();

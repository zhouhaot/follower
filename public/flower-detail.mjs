import {pearlCard} from './pearl-card.mjs';
import { initDetailExhibit } from './detail-exhibit.mjs';
import { visitorNavigation } from './visitor-navigation.mjs';
import { scanURL } from './flow.mjs';
import { cards, cardByKey } from './cards.mjs';
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

const observations = {
  flowers: '从花瓶向上看，找一找花朵与枝叶是怎样散开的。',
  peony: '先看中央盛开的主花，再找两侧花苞：它们怎样围绕花瓶展开？',
  chrysanthemum: '沿着橙黄色花瓣看一圈，哪些向内卷，哪些向外舒展？',
  lotus: '看看中央荷花、两侧圆叶与下方瓶形，怎样围绕中轴展开？',
  leaves: '沿着斜向花枝找到花朵，再找一片五裂叶，看看它们的方向。'
};
const otherCards = cards.filter(item => item.key !== card.key);
const nextCard = otherCards[Math.floor(Math.random() * otherCards.length)];
let exhibit;

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
      <header class="detail-title">
        <h1>${card.title}</h1>
        <p>${card.english}</p>
      </header>
      <div class="flower-detail-grid story-exhibit-grid">
        <section class="flower-exhibit" aria-label="${card.title}展台">
          <div class="exhibit-switch" role="group" aria-label="选择花卡展示方式">
            <button type="button" data-exhibit-view="pearl" aria-pressed="true">珠光花卡</button>
            <button type="button" data-exhibit-view="original" aria-pressed="false">原作花卡</button>
            <button type="button" data-exhibit-view="bloom" aria-pressed="false">立体花朵</button>
            ${card.key === 'lotus' ? '<button type="button" data-exhibit-view="relief" aria-pressed="false">金属花卡</button>' : ''}
          </div>
          <div class="detail-stage">
            <div id="detail-pearl" class="detail-media detail-pearl">${pearlCard(card,{interactive:true,priority:true})}</div>
            <div id="detail-original" class="detail-media" hidden>
              <img src="${card.image}" alt="${card.title}完整原作" width="1100" height="1881" class="detail-art" fetchpriority="high">
            </div>
            <div id="detail-model" class="detail-media detail-model" role="img" aria-label="${card.title}立体花朵" hidden>
              <img class="model-fallback" src="./assets/renders/${card.key}-bloom.png" alt="${card.title}立体花朵静态效果图">
            </div>
          </div>
          <div class="pearl-detail-tools" role="group" aria-label="观察珠光花卡"><button class="pearl-button pearl-demo" type="button" id="detail-pearl-demo" disabled>演示光影</button><button class="pearl-button" type="button" id="detail-pearl-reset">归正</button><button class="pearl-button" type="button" id="detail-pearl-original">完整原作</button></div>
          <div class="view-tools" role="group" aria-label="调整模型视角" hidden>
            <button type="button" data-exhibit-adjust="left" aria-label="向左转动模型">左转</button>
            <button type="button" data-exhibit-adjust="right" aria-label="向右转动模型">右转</button>
            <button type="button" data-exhibit-adjust="in" aria-label="放大模型">放大</button>
            <button type="button" data-exhibit-adjust="out" aria-label="缩小模型">缩小</button>
            <button type="button" data-exhibit-adjust="reset" aria-label="重置模型视角">重置</button>
          </div>
          <p id="exhibit-status" class="exhibit-status" role="status" aria-live="polite">原作完整呈现。选择“立体花朵”，换个角度看花。</p>
          <button type="button" id="exhibit-reload" class="exhibit-reload" hidden>重新加载页面</button>
          <aside class="flower-observation" aria-labelledby="observation-title">
            <h2 id="observation-title">观察提示</h2>
            <p>${observations[card.key]}</p>
            <span>可以对照原作与立体花朵，慢慢看。</span>
          </aside>
        </section>
        <section class="flower-info" aria-labelledby="story-title">
          <p class="detail-description">${card.description}</p>
          <div class="flower-story">
            <h2 id="story-title">花的故事</h2>
            <p>${card.story}</p>
          </div>
          <div class="flower-actions">
            <button id="collect-btn" type="button">收藏这朵花</button>
            <a href="./collection.html">到我的花册查看 <span class="arrow-north arrow-right" aria-hidden="true"></span></a>
          </div>
          <p id="collection-status" role="status" aria-live="polite" class="save-status"></p>
          <p class="detail-save-note">收藏仅保存在当前浏览器，不会跨设备同步。</p>
          <div class="audio-panel detail-audio">
            <div class="flower-audio-controls">
              <button id="audio-btn" type="button">${card.audioAvailable ? '播放故事' : '暂无配音'}</button>
              <span id="audio-status" role="status"></span>
            </div>
            ${!card.audioAvailable ? '<p>当前暂无配音，完整故事已在上方呈现。</p>' : ''}
          </div>
          <dl class="detail-provenance"><div><dt>原作</dt><dd>${card.artwork}</dd></div><div><dt>来源</dt><dd>${card.credit}</dd></div></dl>
          <details class="optional-scan"><summary>有实体花卡？</summary><p>实体卡扫描仍为候选体验，扫描记录尚未接入新版花册。</p><a href="${scanURL(card.key, {from:'detail'})}">进入扫描准备页 →</a></details>
        </section>
      </div>
      <nav class="discovery-next" aria-label="继续探索花卡">
        <div><p>换一朵花，继续看看。</p><a id="meet-another" href="./flower-detail.html?key=${nextCard.key}" class="discovery-link">再遇一朵 <span class="arrow-north arrow-right" aria-hidden="true"></span><small>${nextCard.title}</small></a></div>
        <a href="./catalogue.html" class="visitor-link">浏览全部五朵花 <span class="arrow-north arrow-right" aria-hidden="true"></span></a>
      </nav>
    </main>
  `;

  // 绑定事件
  document.getElementById('audio-btn')?.addEventListener('click', toggleAudio);
  document.getElementById('collect-btn')?.addEventListener('click', toggleCollection);

  // 初始化 UI 状态
  updateAudioUI();
  updateCollectionUI();
  exhibit = initDetailExhibit({ card, initialView: params.get('view') });
}

// 页面卸载时清理
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  exhibit?.dispose();
  audioPlayer?.dispose();
  unsubscribe();
});

render();

import {pearlCard} from './pearl-card.mjs';
import { initDetailExhibit } from './detail-exhibit.mjs';
import { siteHeader, siteFooter } from './site-chrome.mjs';
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
const designStories = {
  lotus: [
    {
      step: '01 · 历史原型',
      photo: { src: './assets/originals/origins/museum-8400.jpg', alt: '都江堰市博物馆石刻拓片展墙，其中有《荷花图》拓片', caption: '都江堰市博物馆《荷花图》石刻拓片 · 图源 zevth.work' },
      text: '原型不是一张画，而是一块石刻：一瓶、一荷、两侧圆叶，线条由凿刻生出，转折硬朗，拓片上只剩黑白。'
    },
    {
      step: '02 · 提取纹样',
      text: '保留瓶插的骨架——中央荷花、两侧圆叶、下方瓶形，把刻线的转折整理成干净的色块轮廓，纹样仍是原构图的回声。'
    },
    {
      step: '03 · 为什么这样配色',
      text: '深藏青为底，取石刻青石的夜色；花瓣留白偏蓝，圆叶取青绿，让纹样像在石面上自己发光。数字版再以珠光让光随视角流转。'
    },
    {
      step: '04 · 最终作品',
      text: '实体花卡是含二维码与说明文字的平面设计稿，供印刷制作；你在这页看到的珠光呈现，是它在屏幕上的样子。'
    }
  ]
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
    audioStatus.textContent = '';
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
    ${siteHeader('flower-detail', card.key)}
    <main id="main" class="visitor-main">
      <a class="detail-back" href="./catalogue.html">← 返回花卡图录</a>
      <div id="collection-notice"></div>
      <header class="detail-title">
        <h1>${card.title}</h1>
        <p>${card.english}</p>
      </header>
      <div class="flower-detail-grid story-exhibit-grid">
        <section class="flower-exhibit" aria-label="${card.title}展台">
          <div class="detail-stage">
            <div id="detail-pearl" class="detail-media detail-pearl">${pearlCard(card,{interactive:true,priority:true})}</div>
            <div id="detail-original" class="detail-media" hidden>
              <img src="${card.image}" alt="${card.title}实体花卡设计稿完整正面" width="1100" height="1881" class="detail-art" fetchpriority="high">
            </div>
            <div id="detail-model" class="detail-media detail-model" role="img" aria-label="${card.title}立体花朵" hidden>
              <img class="model-fallback" src="./assets/renders/${card.key}-bloom.png" alt="${card.title}立体花朵静态效果图">
            </div>
          </div>
          <p id="exhibit-status" class="exhibit-status" role="status" aria-live="polite">珠光作品呈现中。</p>
          <div class="exhibit-switch" role="group" aria-label="换个角度看${card.title}">
            <span class="exhibit-switch-label">换个角度看</span>
            <button type="button" data-exhibit-view="pearl" aria-pressed="true">作品</button>
            <button type="button" data-exhibit-view="bloom" aria-pressed="false">立体花朵</button>
            ${card.key === 'lotus' ? '<button type="button" data-exhibit-view="relief" aria-pressed="false">金属花卡</button>' : ''}
            <button type="button" data-exhibit-view="original" aria-pressed="false">实体花卡</button>
          </div>
          <div class="pearl-detail-tools" role="group" aria-label="观察珠光花卡"><button class="pearl-button pearl-demo" type="button" id="detail-pearl-demo" disabled>演示光影</button><button class="pearl-button" type="button" id="detail-pearl-reset">归正</button></div>
          <div class="view-tools" role="group" aria-label="调整模型视角" hidden>
            <button type="button" data-exhibit-adjust="left" aria-label="向左转动模型">左转</button>
            <button type="button" data-exhibit-adjust="right" aria-label="向右转动模型">右转</button>
            <button type="button" data-exhibit-adjust="in" aria-label="放大模型">放大</button>
            <button type="button" data-exhibit-adjust="out" aria-label="缩小模型">缩小</button>
            <button type="button" data-exhibit-adjust="reset" aria-label="重置模型视角">重置</button>
          </div>
          <button type="button" id="exhibit-reload" class="exhibit-reload" hidden>重新加载页面</button>
          <aside class="flower-observation" aria-labelledby="observation-title">
            <h2 id="observation-title">观察提示</h2>
            <p>${observations[card.key]}</p>
            <span>可以对照实体花卡与立体花朵，慢慢看。</span>
          </aside>
        </section>
        <section class="flower-info" aria-labelledby="story-title">
          <p class="detail-description">${card.description}</p>
          ${designStories[card.key] ? `
          <div class="design-process" aria-label="从原型到作品的设计过程">
            <h2 class="design-process-title">从原型到作品</h2>
            ${designStories[card.key].map(block => `
              <article class="design-step">
                <h3>${block.step}</h3>
                ${block.photo ? `<figure class="design-photo"><img src="${block.photo.src}" alt="${block.photo.alt}" loading="lazy" width="961" height="1280"><figcaption>${block.photo.caption}</figcaption></figure>` : ''}
                <p>${block.text}</p>
              </article>
            `).join('')}
          </div>` : ''}
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
          </div>
          <dl class="detail-provenance"><div><dt>纹样原型</dt><dd>《${card.artwork}》</dd></div><div><dt>馆藏</dt><dd>${card.credit}</dd></div><div><dt>实体花卡</dt><dd>现代平面设计稿 · 原作图像来自 zevth.work</dd></div></dl>
          <details class="optional-scan"><summary>有实体花卡？</summary><p>实体卡扫描仍为候选体验，扫描记录尚未接入新版花册。</p><a href="${scanURL(card.key, {from:'detail'})}">进入扫描准备页 →</a></details>
        </section>
      </div>
      <nav class="discovery-next" aria-label="继续探索花卡">
        <div><p>换一朵花，继续看看。</p><a id="meet-another" href="./flower-detail.html?key=${nextCard.key}" class="discovery-link">再遇一朵 <span class="arrow-north arrow-right" aria-hidden="true"></span><small>${nextCard.title}</small></a></div>
        <a href="./catalogue.html" class="visitor-link">浏览全部五朵花 <span class="arrow-north arrow-right" aria-hidden="true"></span></a>
      </nav>
    </main>
    ${siteFooter()}
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

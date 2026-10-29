import {pearlCard} from './pearl-card.mjs';
import { initDetailExhibit } from './detail-exhibit.mjs';
import { siteHeader, siteFooter } from './site-chrome.mjs';
import { scanURL } from './flow.mjs';
import { cards, cardByKey } from './cards.mjs';
import { getStatus, hasCollected, addCollection, removeCollection, recordView, subscribe } from './collection-store-v2.mjs';
import { createAudioPlayer } from './audio-player.mjs';

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

const no = String(cards.indexOf(card) + 1).padStart(2, '0');
const observations = {
  flowers: '从花瓶向上看，找一找花朵与枝叶是怎样散开的。',
  peony: '先看中央盛开的主花，再找两侧花苞：它们怎样围绕花瓶展开？',
  chrysanthemum: '沿着橙黄色花瓣看一圈，哪些向内卷，哪些向外舒展？',
  lotus: '看看中央荷花、两侧圆叶与下方瓶形，怎样围绕中轴展开？',
  leaves: '沿着斜向花枝找到花朵，再找一片五裂叶，看看它们的方向。'
};

// ② 知道它从哪里来：真实馆藏原型与出处（照片来源记录于 assets.json）
const originBlocks = {
  flowers: {
    photo: null,
    text: '纹样原型是都江堰博物馆《瓶插花卉图》石刻：一瓶、一花、几段枝叶，构图疏朗。这一朵还没有可使用的原型照片，先以纹样本身说话。'
  },
  peony: {
    photo: { src: './assets/originals/origins/museum-8399.jpg', alt: '都江堰市博物馆石刻拓片展墙，其中有《瓶插牡丹图》拓片', caption: '都江堰市博物馆《瓶插牡丹图》石刻拓片 · 图源 zevth.work' },
    text: '原型是馆藏《瓶插牡丹图》石刻拓片：主花居中盛开，两侧花苞含蓄待放，插在一只修长的瓶里。'
  },
  chrysanthemum: {
    photo: { src: './assets/originals/origins/museum-8399.jpg', alt: '都江堰市博物馆石刻拓片展墙，其中有《摘枝菊花图》拓片', caption: '都江堰市博物馆《摘枝菊花图》石刻拓片 · 图源 zevth.work' },
    text: '原型是馆藏《摘枝菊花图》石刻拓片：一枝菊花从画面斜入，花瓣层层向内卷起，枝叶舒展。'
  },
  lotus: {
    photo: { src: './assets/originals/origins/museum-8400.jpg', alt: '都江堰市博物馆石刻拓片展墙，其中有《荷花图》拓片', caption: '都江堰市博物馆《荷花图》石刻拓片 · 图源 zevth.work' },
    text: '原型不是一张画，而是一块石刻：一瓶、一荷、两侧圆叶，线条由凿刻生出，转折硬朗，拓片上只剩黑白。'
  },
  leaves: {
    photo: { src: './assets/originals/origins/museum-8400.jpg', alt: '都江堰市博物馆石刻拓片展墙，其中有《芙蓉花图》拓片', caption: '都江堰市博物馆《芙蓉花图》石刻拓片 · 图源 zevth.work' },
    text: '原型是馆藏《芙蓉花图》石刻拓片：花枝斜出，花与叶沿枝分布，姿态轻盈。'
  }
};

// ③ 看懂你的创作：纹样结构标注（目前只做了清荷，逐张推进）
const creationBlocks = {
  lotus: {
    intro: '把原型石刻和最终设计并排看：哪些留下、哪些重组、为什么用这些颜色。',
    markers: [
      { id: 'bloom', x: 50, y: 29, name: '中央荷花', note: '保留：主花仍在中轴最高处，花瓣的层叠关系来自石刻的刻线走向，只是把白线翻成了蓝白花瓣。' },
      { id: 'leaves', x: 26, y: 49, name: '两侧圆叶', note: '重组：原型里的侧叶大小不一，设计稿把两侧圆叶对称化，像围绕花的一对耳饰，画面因此更稳。' },
      { id: 'vase', x: 50, y: 88, name: '瓶形', note: '保留：修长的瓶仍是构图的底座。瓶身的环状纹被简化成两道色带，守住"瓶"的识别又不抢戏。' },
      { id: 'axis', x: 50, y: 60, name: '中轴结构', note: '保留：荷花、瓶口、瓶底落在同一条中轴上，这是原型构图的骨架，也是整张卡安静感的来源。' }
    ],
    color: '配色：深藏青为底，取石刻青石的夜色；花瓣留白偏蓝，圆叶取青绿，让纹样像在石面上自己发光。数字版再以珠光让光随视角流转。',
    note: '实体花卡是含二维码与说明文字的平面设计稿，供印刷制作；页面里的珠光与三维，是这件设计在屏幕上的呈现方式。'
  }
};

const narrationTranscript = card.audioAvailable ? `清荷入梦，从一块石刻开始。它的原型，是都江堰市博物馆藏的《荷花图》拓片：一瓶，一荷，两侧圆叶，线条是凿出来的。设计保留了瓶插的骨架。中央的荷花，仍在最高的位置；修长的瓶，仍是画面的底座；花、瓶口与瓶底，落在同一条中轴上。重组的是两侧的圆叶——原型里它们大小不一，设计稿把它们对称化。配色取石刻的夜色：深藏青为底，花瓣留白偏蓝，圆叶用青绿。实体花卡是供印刷的平面设计稿；页面上的珠光是它在屏幕上的样子。` : '';

// 解说音频：按需创建，绝不自动播放
let audioPlayer = null;
if (card.audioAvailable) {
  audioPlayer = createAudioPlayer({ card, onStateChange: () => updateAudioUI() });
}

function updateAudioUI() {
  const audioBtn = document.getElementById('audio-btn');
  const audioStatus = document.getElementById('audio-status');
  if (!audioBtn || !audioStatus) return;
  if (!audioPlayer?.isAvailable()) {
    audioBtn.disabled = true;
    audioStatus.textContent = '解说音频加载失败，完整解说见下方文字。';
    return;
  }
  const state = audioPlayer.getState();
  audioBtn.disabled = false;
  audioBtn.textContent = state === 'error' ? '重试解说' : state === 'playing' ? '暂停解说' : '听设计解说';
  audioStatus.textContent = { ready: 'AI 合成语音 · 约 74 秒', playing: '播放中 · AI 合成语音', paused: '已暂停，完整文字在下方', error: '音频加载失败，可重试或阅读下方完整解说。' }[state] || '';
}

function toggleNarration() {
  if (!audioPlayer?.isAvailable()) return;
  if (audioPlayer.getState() === 'playing') audioPlayer.pause();
  else audioPlayer.play();
}

const otherCards = cards.filter(item => item.key !== card.key);
const nextCard = otherCards[Math.floor(Math.random() * otherCards.length)];
let exhibit;

// 记录浏览
recordView({ key: card.key, source: 'detail' });

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
      document.getElementById('collection-status').textContent = '已取消收藏，最近浏览仍保留。';
    } else {
      alert(collectionFailureMessage(result.reason));
    }
  } else {
    const result = addCollection({ key: card.key });
    if (result.saved) {
      updateCollectionUI();
      document.getElementById('collection-status').textContent = '已收藏，可在“我的花册”找回。';
    } else {
      alert(collectionFailureMessage(result.reason));
    }
  }
}

// 订阅收藏变化
const unsubscribe = subscribe(() => {
  updateCollectionUI();
});

function bindCreation() {
  const section = document.querySelector('.detail-creation');
  if (!section) return;
  const markers = [...section.querySelectorAll('.creation-marker')];
  const items = [...section.querySelectorAll('.creation-legend button')];
  const setActive = id => {
    markers.forEach(m => { const active = m.dataset.creationMarker === id; m.classList.toggle('active', active); m.setAttribute('aria-pressed', String(active)); });
    items.forEach(button => { const active = button.dataset.creationStep === id; button.closest('li').classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
    const note = section.querySelector('.creation-note');
    const current = creationBlocks[card.key]?.markers.find(m => m.id === id);
    if (note && current) {
      note.textContent = current.note;
      note.dataset.activeName = current.name;
    }
  };
  markers.forEach(m => m.addEventListener('click', () => setActive(m.dataset.creationMarker)));
  items.forEach(button => button.addEventListener('click', () => setActive(button.dataset.creationStep)));
  if (markers.length) setActive(markers[0].dataset.creationMarker);
}

// 渲染页面：按参观顺序展开——看见作品 → 知道它从哪里来 → 看懂你的创作 →（体验入口在展台）→ 留下记忆
function render() {
  const app = document.getElementById('app');
  const creation = creationBlocks[card.key];
  const origin = originBlocks[card.key];

  app.innerHTML = `
    ${siteHeader('flower-detail', card.key)}
    <main id="main" class="visitor-main">
      <a class="detail-back" href="./catalogue.html"><span class="arrow-north arrow-left" aria-hidden="true"></span>返回五花图录</a>
      <div id="collection-notice"></div>

      <section class="detail-opening" aria-label="看见作品">
        <header class="detail-heading">
          <p class="work-position">${no} / 05</p>
          <h1>${card.title}</h1>
          <p class="flower-english">${card.english}</p>
        </header>
        <div class="flower-exhibit" aria-label="${card.title}展台">
          <div class="detail-stage">
            <div id="detail-artwork" class="detail-media detail-artwork">
              <img src="${card.artworkImage}" alt="${card.title}纹样作品" width="987" height="1407" class="detail-art" fetchpriority="high">
            </div>
            <div id="detail-pearl" class="detail-media detail-pearl" hidden>${pearlCard(card,{interactive:true})}</div>
            <div id="detail-original" class="detail-media" hidden>
              <img src="${card.image}" alt="${card.title}实体花卡平面设计稿完整正面" width="1100" height="1881" class="detail-art">
            </div>
            <div id="detail-model" class="detail-media detail-model" role="img" aria-label="${card.title}立体花朵" hidden>
              <img class="model-fallback" src="./assets/renders/${card.key}-bloom.png" alt="${card.title}立体花朵静态效果图">
            </div>
          </div>
          <p id="exhibit-status" class="exhibit-status" role="status" aria-live="polite">作品画面呈现。</p>
          <div class="exhibit-switch" role="group" aria-label="换个角度看${card.title}">
            <span class="exhibit-switch-label">换个角度看</span>
            <button type="button" data-exhibit-view="artwork" aria-pressed="true">作品</button>
            <button type="button" data-exhibit-view="pearl" aria-pressed="false">珠光光影</button>
            <details class="exhibit-more"><summary>更多观看方式</summary><div><button type="button" data-exhibit-view="bloom" aria-pressed="false">立体花朵</button>
            ${card.key === 'lotus' ? '<button type="button" data-exhibit-view="relief" aria-pressed="false">金属花卡</button>' : ''}
            <button type="button" data-exhibit-view="original" aria-pressed="false">实体花卡</button></div></details>
          </div>
          <div class="pearl-detail-tools" role="group" aria-label="观察珠光花卡" hidden><button class="pearl-button pearl-demo" type="button" id="detail-pearl-demo" disabled>演示光影</button><button class="pearl-button" type="button" id="detail-pearl-reset">归正</button></div>
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
          </aside>
        </div>
        <aside class="flower-intro" aria-label="${card.title}简介">
          <p class="flower-lead">${card.description}</p>
          <div class="intro-actions"><button id="collect-btn" type="button">收藏这朵花</button><a href="#origin-title">读作品故事</a></div><p id="collection-status" role="status" aria-live="polite" class="save-status"></p>

            ${card.audioAvailable ? `<div class="narration-panel"><div class="narration-controls"><button id="audio-btn" type="button">听设计解说</button><span id="audio-status" role="status"></span></div><details class="narration-transcript"><summary>解说全文</summary><p>${narrationTranscript}</p></details></div>` : ''}
        </aside>
      </section>

      <section class="detail-origin" aria-labelledby="origin-title">
        <h2 id="origin-title">它从哪里来</h2>
        <div class="origin-body">
          ${origin.photo ? `<figure class="design-photo"><img src="${origin.photo.src}" alt="${origin.photo.alt}" loading="lazy" width="961" height="1280"><figcaption>${origin.photo.caption}</figcaption></figure>` : ''}
          <div class="origin-text">
            <p>${origin.text}</p>
            <div class="flower-story">
              <h3>花的故事</h3>
              <p>${card.story}</p>
            </div>
            <dl class="detail-provenance"><div><dt>纹样原型</dt><dd>《${card.artwork}》</dd></div><div><dt>馆藏</dt><dd>${card.credit}</dd></div><div><dt>实体花卡</dt><dd>现代平面设计稿 · 原作图像来自 zevth.work</dd></div></dl>
          </div>
        </div>
      </section>

      ${creation ? `
      <section class="detail-creation" id="creation" aria-labelledby="creation-title">
        <h2 id="creation-title">看懂这幅设计</h2>
        <p class="creation-intro">${creation.intro}</p>
        <div class="creation-layout">
          <div class="creation-stage">
            <img src="${card.artworkImage}" alt="${card.title}纹样结构标注图" width="987" height="1407">
            <span class="creation-axis" aria-hidden="true"></span>
            ${creation.markers.map(m => `<button type="button" class="creation-marker" data-creation-marker="${m.id}" style="--x:${m.x}%;--y:${m.y}%" aria-label="${m.name}" aria-pressed="false" aria-controls="creation-note">${creation.markers.indexOf(m) + 1}</button>`).join('')}
          </div>
          <div class="creation-side">
            <ol class="creation-legend">
              ${creation.markers.map(m => `<li><button type="button" data-creation-step="${m.id}" aria-pressed="false" aria-controls="creation-note">${m.name}</button></li>`).join('')}
            </ol>
            <p id="creation-note" class="creation-note" role="status"></p>
            <p class="creation-color">${creation.color}</p>

            <p class="creation-note-final quiet">${creation.note}</p>
          </div>
        </div>
      </section>` : ''}

      <section class="detail-memory" aria-labelledby="memory-title">
        <h2 id="memory-title">留下记忆</h2>
        <div class="memory-actions">
          <a class="pill-link" href="#main">返回作品</a>
          <a id="meet-another" href="./flower-detail.html?key=${nextCard.key}" class="memory-next">继续看下一朵<small>${nextCard.title}</small></a>
        </div>

        <div class="memory-links">
          <a href="./collection.html">到我的花册查看</a>
          <a href="./catalogue.html">浏览全部五朵花</a>
        </div>
        <p class="memory-note quiet">收藏保存在当前浏览器，不会跨设备同步。</p>
        <details class="optional-scan"><summary>有实体花卡？</summary><p>实体卡识别成功后记入花册的“扫描相遇”；实体卡追踪仍待真机验收。</p><a href="${scanURL(card.key, {from:'detail'})}">进入扫描准备页 <span class="arrow-north arrow-right" aria-hidden="true"></span></a></details>
      </section>
    </main>
    ${siteFooter()}
  `;

  document.getElementById('collect-btn')?.addEventListener('click', toggleCollection);
  document.getElementById('audio-btn')?.addEventListener('click', toggleNarration);
  updateAudioUI();
  bindCreation();

  updateCollectionUI();
  if (['bloom','relief','original'].includes(params.get('view'))) document.querySelector('.exhibit-more').open = true;
  exhibit = initDetailExhibit({ card, initialView: params.get('view') });
}

// 页面卸载时清理
window.addEventListener('pagehide', event => {
  audioPlayer?.pause();
  if (event.persisted) return;
  exhibit?.dispose();
  audioPlayer?.dispose();
  unsubscribe();
});

render();

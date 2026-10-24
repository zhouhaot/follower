import { siteHeader, siteFooter } from './site-chrome.mjs';
import { cards } from './cards.mjs';
import { getData, getStatus, hasCollected, addCollection, removeCollection, subscribe } from './collection-store-v2.mjs';

import { renderCollectionNotice, collectionFailureMessage } from './collection-feedback.mjs';

let unsubscribe = null;

function toggleCollection(key, event) {
  event.stopPropagation();

  const collected = hasCollected(key);

  if (collected) {
    const result = removeCollection(key);
    if (!result.saved) {
      alert(collectionFailureMessage(result.reason));
    }
  } else {
    const result = addCollection({ key });
    if (!result.saved) {
      alert(collectionFailureMessage(result.reason));
    }
  }
}

function renderCard(card, data) {
  const collected = data?.collections.some(c => c.key === card.key) || false;
  const no = String(cards.indexOf(card) + 1).padStart(2, '0');

  return `
    <article class="flower-card" data-key="${card.key}">
      <a class="flower-card-art" href="./flower-detail.html?key=${card.key}" aria-label="阅读${card.title}的故事">
        <img src="${card.artworkImage}" alt="${card.title}插画纹样" width="987" height="1407">
        <span class="card-index">${no} / 05</span>
      </a>
      <div class="flower-card-body">
        <div class="flower-card-head">
          <div>
            <h3><a href="./flower-detail.html?key=${card.key}">${card.title}</a></h3>
            <p>${card.english}</p>
          </div>
          <button type="button" class="collect-btn ${collected ? 'collected' : ''}" data-key="${card.key}" aria-pressed="${collected}" onclick="event.stopPropagation();window.catalogueToggleCollection('${card.key}', event)">${collected ? '已收藏' : '收藏'}</button>
        </div>
        <div class="flower-card-links">
          <a href="./flower-detail.html?key=${card.key}">读设计与故事</a>
          <a href="./flower-detail.html?key=${card.key}&view=original">查看实体花卡</a>
        </div>
      </div>
    </article>
  `;
}

function render() {
  const app = document.getElementById('app');
  const focusedKey = document.activeElement?.matches('.collect-btn') ? document.activeElement.dataset.key : null;
  const data = getData();
  const state = getStatus();

  app.innerHTML = `
    ${siteHeader('catalogue')}
    <main id="main" class="light-page catalogue-page">
      <section class="page-wrap">
        <div class="page-heading">
          <p class="eyebrow">THE COLLECTION / 全部五款</p>
          <h1>五种纹样，<br><em>各自成诗。</em></h1>
          <p class="lead">循着花枝与叶脉，走进五张花卡的世界。</p>
        </div>
        <div id="collection-notice"></div>
        <div class="catalogue-cardwall">
          ${cards.map(card => renderCard(card, data)).join('')}
        </div>
        <p class="catalogue-footnote quiet">点击花卡阅读故事与设计来源 · 收藏后可在“我的花册”找回</p>
      </section>
    </main>
    ${siteFooter()}
  `;
  renderCollectionNotice(document.getElementById('collection-notice'), state);
  for (const button of app.querySelectorAll('.collect-btn')) {
    button.disabled = state.kind !== 'ready';
    button.setAttribute('aria-pressed', String(data?.collections.some(c => c.key === button.dataset.key) || false));
    if (button.dataset.key === focusedKey && !button.disabled) button.focus({preventScroll:true});
  }
}

// 暴露全局函数供内联事件调用
window.catalogueToggleCollection = toggleCollection;

// 订阅收藏变化并重新渲染
unsubscribe = subscribe(() => {
  render();
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  unsubscribe?.();
});

render();

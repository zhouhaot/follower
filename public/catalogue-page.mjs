import { visitorNavigation } from './visitor-navigation.mjs';
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

  return `
    <div class="flower-card" data-key="${card.key}" style="
      position:relative;
      background:#1a1a1a;
      border-radius:8px;
      overflow:hidden;
    ">
      <a href="./flower-detail.html?key=${card.key}" aria-label="阅读${card.title}的故事"><img src="${card.image}" alt="${card.title}" style="
        width:100%;
        height:300px;
        padding:16px;
        object-fit:contain;
      "></a>
      <div style="padding:20px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
          <div>
            <h3 style="margin:0 0 5px;font-size:1.3rem"><a href="./flower-detail.html?key=${card.key}">${card.title}</a></h3>
            <p style="margin:0;color:#999;font-size:0.85rem">${card.english}</p>
          </div>
          <button
            class="collect-btn ${collected ? 'collected' : ''}"
            data-key="${card.key}"
            onclick="event.stopPropagation();window.catalogueToggleCollection('${card.key}', event)"
            style="
              padding:8px 16px;
              background:${collected ? '#16753a' : '#444'};
              color:#fff;
              border:none;
              border-radius:4px;
              cursor:pointer;
              font-size:0.85rem;
              white-space:nowrap;
            ">
            ${collected ? '已收藏' : '收藏'}
          </button>
        </div>
        <p style="color:#ccc;font-size:0.9rem;line-height:1.6;margin:10px 0 0">${card.description}</p>
      </div>
    </div>
  `;
}

function render() {
  const app = document.getElementById('app');
  const focusedKey = document.activeElement?.matches('.collect-btn') ? document.activeElement.dataset.key : null;
  const data = getData();
  const state = getStatus();

  app.innerHTML = `
    ${visitorNavigation('catalogue')}
    <main id="main" class="visitor-main">
      <h1 style="font-size:2.5rem;margin:0 0 10px;text-align:center">五花图录</h1>
      <p style="text-align:center;color:#999;margin:0 0 40px">选一张花卡，阅读故事；喜欢就收藏。</p>

      <div id="collection-notice"></div>
      <div style="
        display:grid;
        grid-template-columns:repeat(auto-fit, minmax(min(100%, 300px), 1fr));
        gap:30px;
      ">
        ${cards.map(card => renderCard(card, data)).join('')}
      </div>

      <div style="margin-top:60px;padding-top:40px;border-top:1px solid #333;text-align:center">
        <p style="color:#999;font-size:0.9rem">点击原作或名称阅读故事 · 点击收藏按钮加入花册</p>
      </div>
    </main>
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

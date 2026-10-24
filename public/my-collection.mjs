import { siteHeader, siteFooter } from './site-chrome.mjs';
import { cards, cardByKey } from './cards.mjs';
import { getData, getStatus, removeCollection, subscribe } from './collection-store-v2.mjs';

import { renderCollectionNotice, collectionFailureMessage } from './collection-feedback.mjs';

let unsubscribe = null;

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function removeFromCollection(key, event) {
  event.stopPropagation();

  if (!confirm('确定要取消收藏这朵花吗？')) return;

  const result = removeCollection(key);
  if (!result.saved) {
    alert(collectionFailureMessage(result.reason));
  }
}

function renderCollectionCard(collection) {
  const card = cardByKey(collection.key);
  if (!card) return '';

  const sourceLabel = {
    manual: '主动收藏',
    legacy: '历史收藏',
    unknown: '来源未知'
  }[collection.source] || collection.source;

  return `
    <div class="collection-card">
      <a href="./flower-detail.html?key=${card.key}" aria-label="阅读${card.title}的故事"><img src="${card.image}" alt="${card.title}"></a>
      <div>
        <h3><a href="./flower-detail.html?key=${card.key}">${card.title}</a></h3>
        <p class="card-english">${card.english}</p>
        <p class="card-description">${card.description}</p>
        <div class="collection-meta">
          <span>${sourceLabel} · ${formatDate(collection.collectedAt)}</span>
          <button type="button" onclick="event.stopPropagation();window.myCollectionRemove('${card.key}', event)">取消收藏</button>
        </div>
      </div>
    </div>
  `;
}

function renderEncounterCard(encounter) {
  const card = cardByKey(encounter.key);
  if (!card) return '';

  const sourceLabel = encounter.source === 'camera' ? '扫描识别' : encounter.source;

  return `
    <div class="encounter-card">
      <a href="./flower-detail.html?key=${card.key}" aria-label="阅读${card.title}的故事"><img src="${card.image}" alt="${card.title}"></a>
      <div>
        <h4><a href="./flower-detail.html?key=${card.key}">${card.title}</a></h4>
        <p>${sourceLabel} · ${formatTime(encounter.recognizedAt)}</p>
      </div>
    </div>
  `;
}

function renderRecentViewCard(view) {
  const card = cardByKey(view.key);
  if (!card) return '';

  const sourceLabel = {
    catalogue: '目录浏览',
    detail: '详情查看',
    manual: '手动访问'
  }[view.source] || view.source;

  return `
    <div class="view-card">
      <a href="./flower-detail.html?key=${card.key}" aria-label="阅读${card.title}的故事"><img src="${card.image}" alt="${card.title}"></a>
      <div>
        <h4><a href="./flower-detail.html?key=${card.key}">${card.title}</a></h4>
        <p>${sourceLabel} · ${formatTime(view.viewedAt)}</p>
      </div>
    </div>
  `;
}

function render() {
  const app = document.getElementById('app');
  const loaded = getData();
  const state = getStatus();
  const data = loaded || { collections: [], encounters: [], recentViews: [] };

  const hasAnyData = data && (
    data.collections.length > 0 ||
    data.encounters.length > 0 ||
    data.recentViews.length > 0
  );

  app.innerHTML = `
    ${siteHeader('collection')}
    <main id="main" class="light-page collection-page">
      <section class="page-wrap">
        <div class="page-heading">
          <p class="eyebrow">YOUR COLLECTION / 我的收藏</p>
          <h1>把相遇，<br><em>留在这里。</em></h1>
          <p class="lead">你收藏的花、相遇的花和最近看过的花，都保存在这台浏览器。</p>
        </div>
        <div id="collection-notice"></div>
        ${loaded && state.kind === 'ready' && !hasAnyData ? `
          <div class="collection-empty">
            <p>花册还是空的</p>
            <a class="pill-link dark-pill" href="./catalogue.html">开始探索五朵花</a>
          </div>
        ` : ''}

        ${loaded && state.kind === 'ready' && hasAnyData && data.collections.length === 0 ? '<p class="no-collections">还没有主动收藏的花。最近浏览会留在下方，打开详情即可收藏。</p>' : ''}
        ${data.collections.length > 0 ? `
          <section class="collection-section">
            <h2>我的收藏 <span>(${data.collections.length})</span></h2>
            <div class="collection-list">
              ${data.collections.map(c => renderCollectionCard(c)).join('')}
            </div>
          </section>
        ` : ''}

        ${data.encounters.length > 0 ? `
          <section class="collection-section">
            <h2>扫描相遇 <span>(${data.encounters.length})</span></h2>
            <div class="collection-strip">
              ${data.encounters.map(e => renderEncounterCard(e)).join('')}
            </div>
          </section>
        ` : ''}

        ${data.recentViews.length > 0 ? `
          <section class="collection-section">
            <h2>最近浏览 <span>(${data.recentViews.length})</span></h2>
            <div class="collection-strip">
              ${data.recentViews.map(v => renderRecentViewCard(v)).join('')}
            </div>
          </section>
        ` : ''}

        <p class="collection-storage-note quiet">收藏与浏览记录仅保存在当前浏览器的本地存储；清除浏览器数据会一并清除，暂不支持跨设备同步。</p>
      </section>
    </main>
    ${siteFooter()}
  `;
  renderCollectionNotice(document.getElementById('collection-notice'), state);
  for (const button of app.querySelectorAll('.collection-card button')) button.disabled = state.kind !== 'ready';
}

// 暴露全局函数供内联事件调用
window.myCollectionRemove = removeFromCollection;

// 订阅收藏变化并重新渲染
unsubscribe = subscribe(() => {
  render();
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  unsubscribe?.();
});

render();

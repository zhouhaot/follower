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
    <article class="collection-card album-plate">
      <a href="./flower-detail.html?key=${card.key}" aria-label="阅读${card.title}的故事"><img src="${card.artworkImage}" alt="${card.title}纹样"></a>
      <div class="plate-caption">
        <h3><a href="./flower-detail.html?key=${card.key}">${card.title}</a></h3>
        <p class="plate-trait">${card.trait || ''}</p>
        <p class="plate-date">${sourceLabel} · ${formatDate(collection.collectedAt)}</p>
        <button type="button" onclick="event.stopPropagation();window.myCollectionRemove('${card.key}', event)">取消收藏</button>
      </div>
    </article>
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
          <p class="lead">${data.collections.length > 0 ? `已收藏 <strong>${data.collections.length} / ${cards.length}</strong> 朵${data.collections.length < cards.length ? '，还有 ' + (cards.length - data.collections.length) + ' 朵在等你。' : '，五朵齐了。'}` : '你收藏的花、相遇的花和最近看过的花，都保存在这台浏览器。'}</p>
          ${data.collections.length > 0 ? '<button type="button" class="pill-link dark-pill keepsake-print-btn" onclick="window.print()">做成纪念页 · 打印带走</button>' : ''}
        </div>
        <div id="collection-notice"></div>
        ${loaded && state.kind === 'ready' && !hasAnyData ? `
          <div class="collection-empty">
            <p>花册还是空的</p>
            <p class="collection-empty-hint">从最完整的一朵开始：清荷入梦。</p>
            <a class="pill-link dark-pill" href="./flower-detail.html?key=lotus">看第一朵 · 清荷入梦</a>
            <a class="text-link" href="./catalogue.html">或浏览五花图录</a>
          </div>
        ` : ''}

        ${loaded && state.kind === 'ready' && hasAnyData && data.collections.length === 0 ? '<p class="no-collections">还没有主动收藏的花。最近浏览会留在下方，打开详情即可收藏。</p>' : ''}
        ${loaded && state.kind === 'ready' && data.collections.length === 0 ? `
          <section class="collection-section" aria-label="收藏画册">
            <div class="album">
              <div class="album-page">
                <div class="album-plate album-plate-empty">
                  <span class="plate-empty-mark" aria-hidden="true"></span>
                  <p>第一朵，还没有贴进来。</p>
                </div>
              </div>
            </div>
          </section>
        ` : ''}
        ${data.collections.length > 0 ? `
          <section class="collection-section" aria-label="收藏画册">
            <div class="album">
              <div class="album-page">
                ${data.collections.map(c => renderCollectionCard(c)).join('')}
              </div>
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
        ${data.collections.length > 0 ? `
        <section class="keepsake" aria-label="参观纪念页">
          <header class="keepsake-head">
            <h2>花开有声 · 参观纪念</h2>
            <p>${new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })} · 已收藏 ${data.collections.length} / ${cards.length} 朵</p>
          </header>
          <div class="keepsake-flowers">
            ${data.collections.map(collection => {
              const c = cardByKey(collection.key);
              if (!c) return '';
              return `<figure><img src="${c.artworkImage}" alt="${c.title}纹样"><figcaption><strong>${c.title}</strong><span>${c.trait || ''}</span><small>收藏于 ${formatDate(collection.collectedAt)}</small></figcaption></figure>`;
            }).join('')}
          </div>
          <footer class="keepsake-foot">纹样原型：都江堰市博物馆馆藏 · 原型图像与作品名称来自 zevth.work<br>花开有声 · 数字花卡探索 · 本数字衍生品未经博物馆审定</footer>
        </section>` : ''}
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

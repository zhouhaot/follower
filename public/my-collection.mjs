import { visitorNavigation } from './visitor-navigation.mjs';
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
    <div class="collection-card" style="
      display:flex;
      gap:20px;
      padding:20px;
      background:#1a1a1a;
      border-radius:8px;
    ">
      <a href="./flower-detail.html?key=${card.key}" aria-label="阅读${card.title}的故事"><img src="${card.image}" alt="${card.title}" style="
        width:120px;
        height:160px;
        object-fit:contain;
        border-radius:4px;
      "></a>
      <div style="flex:1">
        <h3 style="margin:0 0 5px;font-size:1.2rem"><a href="./flower-detail.html?key=${card.key}">${card.title}</a></h3>
        <p style="margin:0 0 10px;color:#999;font-size:0.85rem">${card.english}</p>
        <p style="margin:0 0 10px;color:#ccc;font-size:0.9rem;line-height:1.6">${card.description}</p>
        <div class="collection-meta" style="display:flex;justify-content:space-between;align-items:center;margin-top:15px">
          <span style="color:#999;font-size:0.85rem">
            ${sourceLabel} · ${formatDate(collection.collectedAt)}
          </span>
          <button onclick="event.stopPropagation();window.myCollectionRemove('${card.key}', event)" style="
            padding:6px 12px;
            background:#444;
            color:#fff;
            border:none;
            border-radius:4px;
                  font-size:0.85rem;
          ">取消收藏</button>
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
    <div class="encounter-card" style="
      display:flex;
      gap:15px;
      padding:15px;
      background:#1a1a1a;
      border-radius:8px;
    ">
      <a href="./flower-detail.html?key=${card.key}" aria-label="阅读${card.title}的故事"><img src="${card.image}" alt="${card.title}" style="
        width:80px;
        height:100px;
        object-fit:contain;
        border-radius:4px;
      "></a>
      <div style="flex:1">
        <h4 style="margin:0 0 5px;font-size:1rem"><a href="./flower-detail.html?key=${card.key}">${card.title}</a></h4>
        <p style="margin:0;color:#999;font-size:0.85rem">
          ${sourceLabel} · ${formatTime(encounter.recognizedAt)}
        </p>
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
    <div class="view-card" style="
      display:flex;
      gap:15px;
      padding:15px;
      background:#1a1a1a;
      border-radius:8px;
    ">
      <a href="./flower-detail.html?key=${card.key}" aria-label="阅读${card.title}的故事"><img src="${card.image}" alt="${card.title}" style="
        width:80px;
        height:100px;
        object-fit:contain;
        border-radius:4px;
      "></a>
      <div style="flex:1">
        <h4 style="margin:0 0 5px;font-size:1rem"><a href="./flower-detail.html?key=${card.key}">${card.title}</a></h4>
        <p style="margin:0;color:#999;font-size:0.85rem">
          ${sourceLabel} · ${formatTime(view.viewedAt)}
        </p>
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
    ${visitorNavigation('collection')}
    <main id="main" class="visitor-main">
      <h1 style="font-size:2.5rem;margin:0 0 10px">我的花册</h1>
      <p style="color:#999;margin:0 0 40px">你收藏的花、相遇的花和最近看过的花</p>

      <div id="collection-notice"></div>
      ${loaded && state.kind === 'ready' && !hasAnyData ? `
        <div style="text-align:center;padding:60px 20px;background:#1a1a1a;border-radius:8px">
          <p style="color:#999;font-size:1.1rem;margin:0 0 20px">花册还是空的</p>
          <a href="./catalogue.html" style="
            display:inline-block;
            padding:12px 30px;
            background:#16753a;
            color:#fff;
            text-decoration:none;
            border-radius:4px;
          ">开始探索五朵花</a>
        </div>
      ` : ''}

      ${loaded && state.kind === 'ready' && hasAnyData && data.collections.length === 0 ? '<p class="no-collections">还没有主动收藏的花。最近浏览会留在下方，打开详情即可收藏。</p>' : ''}
      ${data.collections.length > 0 ? `
        <section style="margin-bottom:60px">
          <h2 style="font-size:1.5rem;margin:0 0 20px;padding-bottom:10px;border-bottom:1px solid #333">
            我的收藏 <span style="color:#999;font-size:1rem">(${data.collections.length})</span>
          </h2>
          <div style="display:grid;gap:20px">
            ${data.collections.map(c => renderCollectionCard(c)).join('')}
          </div>
        </section>
      ` : ''}

      ${data.encounters.length > 0 ? `
        <section style="margin-bottom:60px">
          <h2 style="font-size:1.5rem;margin:0 0 20px;padding-bottom:10px;border-bottom:1px solid #333">
            扫描相遇 <span style="color:#999;font-size:1rem">(${data.encounters.length})</span>
          </h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(min(100%, 300px), 1fr));gap:15px">
            ${data.encounters.map(e => renderEncounterCard(e)).join('')}
          </div>
        </section>
      ` : ''}

      ${data.recentViews.length > 0 ? `
        <section style="margin-bottom:60px">
          <h2 style="font-size:1.5rem;margin:0 0 20px;padding-bottom:10px;border-bottom:1px solid #333">
            最近浏览 <span style="color:#999;font-size:1rem">(${data.recentViews.length})</span>
          </h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(min(100%, 300px), 1fr));gap:15px">
            ${data.recentViews.map(v => renderRecentViewCard(v)).join('')}
          </div>
        </section>
      ` : ''}

      <div style="padding:30px;background:#1a1a1a;border-radius:8px;font-size:0.9rem;color:#999">
        <p style="margin:0 0 10px"><strong style="color:#ccc">数据保存说明</strong></p>
        <p style="margin:0 0 5px">• 所有数据保存在当前浏览器的本地存储中</p>
        <p style="margin:0 0 5px">• 清除浏览器数据可能导致数据丢失</p>
        <p style="margin:0">• 暂不支持跨设备同步或导出，请保留此浏览器的数据</p>
      </div>
    </main>
  `;
  renderCollectionNotice(document.getElementById('collection-notice'), state);
  for (const button of app.querySelectorAll('.collection-card button')) button.disabled = state.kind !== 'ready';
}

// 暴露全局函数
window.myCollectionRemove = removeFromCollection;

// 订阅数据变化
unsubscribe = subscribe(() => {
  render();
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  unsubscribe?.();
});

render();

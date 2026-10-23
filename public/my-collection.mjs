import { cards, cardByKey } from './cards.mjs';
import { getData, removeCollection, subscribe } from './collection-store-v2.mjs';

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
    alert('取消收藏失败：' + (result.reason || '未知错误'));
  }
}

function goToDetail(key) {
  window.location.href = `./flower-detail.html?key=${key}`;
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
      cursor:pointer;
    " onclick="window.myCollectionGoToDetail('${card.key}')">
      <img src="${card.image}" alt="${card.title}" style="
        width:120px;
        height:160px;
        object-fit:cover;
        border-radius:4px;
      ">
      <div style="flex:1">
        <h3 style="margin:0 0 5px;font-size:1.2rem">${card.title}</h3>
        <p style="margin:0 0 10px;color:#999;font-size:0.85rem">${card.english}</p>
        <p style="margin:0 0 10px;color:#ccc;font-size:0.9rem;line-height:1.6">${card.description}</p>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:15px">
          <span style="color:#666;font-size:0.85rem">
            ${sourceLabel} · ${formatDate(collection.collectedAt)}
          </span>
          <button onclick="event.stopPropagation();window.myCollectionRemove('${card.key}', event)" style="
            padding:6px 12px;
            background:#444;
            color:#fff;
            border:none;
            border-radius:4px;
            cursor:pointer;
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
      cursor:pointer;
    " onclick="window.myCollectionGoToDetail('${card.key}')">
      <img src="${card.image}" alt="${card.title}" style="
        width:80px;
        height:100px;
        object-fit:cover;
        border-radius:4px;
      ">
      <div style="flex:1">
        <h4 style="margin:0 0 5px;font-size:1rem">${card.title}</h4>
        <p style="margin:0;color:#666;font-size:0.85rem">
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
      cursor:pointer;
    " onclick="window.myCollectionGoToDetail('${card.key}')">
      <img src="${card.image}" alt="${card.title}" style="
        width:80px;
        height:100px;
        object-fit:cover;
        border-radius:4px;
      ">
      <div style="flex:1">
        <h4 style="margin:0 0 5px;font-size:1rem">${card.title}</h4>
        <p style="margin:0;color:#666;font-size:0.85rem">
          ${sourceLabel} · ${formatTime(view.viewedAt)}
        </p>
      </div>
    </div>
  `;
}

function render() {
  const app = document.getElementById('app');
  const data = getData();

  const hasAnyData = data && (
    data.collections.length > 0 ||
    data.encounters.length > 0 ||
    data.recentViews.length > 0
  );

  app.innerHTML = `
    <header style="padding:20px;border-bottom:1px solid #333">
      <div style="max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center">
        <a href="./index.html" style="color:#fff;text-decoration:none">← 返回首页</a>
        <a href="./catalogue.html" style="color:#2a5;text-decoration:none">浏览图录</a>
      </div>
    </header>
    <main style="max-width:1200px;margin:0 auto;padding:40px 20px">
      <h1 style="font-size:2.5rem;margin:0 0 10px">我的花册</h1>
      <p style="color:#999;margin:0 0 40px">你收藏的花、相遇的花和最近看过的花</p>

      ${!hasAnyData ? `
        <div style="text-align:center;padding:60px 20px;background:#1a1a1a;border-radius:8px">
          <p style="color:#666;font-size:1.1rem;margin:0 0 20px">花册还是空的</p>
          <a href="./catalogue.html" style="
            display:inline-block;
            padding:12px 30px;
            background:#2a5;
            color:#fff;
            text-decoration:none;
            border-radius:4px;
          ">开始探索五朵花</a>
        </div>
      ` : ''}

      ${data.collections.length > 0 ? `
        <section style="margin-bottom:60px">
          <h2 style="font-size:1.5rem;margin:0 0 20px;padding-bottom:10px;border-bottom:1px solid #333">
            我的收藏 <span style="color:#666;font-size:1rem">(${data.collections.length})</span>
          </h2>
          <div style="display:grid;gap:20px">
            ${data.collections.map(c => renderCollectionCard(c)).join('')}
          </div>
        </section>
      ` : ''}

      ${data.encounters.length > 0 ? `
        <section style="margin-bottom:60px">
          <h2 style="font-size:1.5rem;margin:0 0 20px;padding-bottom:10px;border-bottom:1px solid #333">
            扫描相遇 <span style="color:#666;font-size:1rem">(${data.encounters.length})</span>
          </h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(300px, 1fr));gap:15px">
            ${data.encounters.map(e => renderEncounterCard(e)).join('')}
          </div>
        </section>
      ` : ''}

      ${data.recentViews.length > 0 ? `
        <section style="margin-bottom:60px">
          <h2 style="font-size:1.5rem;margin:0 0 20px;padding-bottom:10px;border-bottom:1px solid #333">
            最近浏览 <span style="color:#666;font-size:1rem">(${data.recentViews.length})</span>
          </h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(300px, 1fr));gap:15px">
            ${data.recentViews.map(v => renderRecentViewCard(v)).join('')}
          </div>
        </section>
      ` : ''}

      <div style="padding:30px;background:#1a1a1a;border-radius:8px;font-size:0.9rem;color:#666">
        <p style="margin:0 0 10px"><strong style="color:#ccc">数据保存说明</strong></p>
        <p style="margin:0 0 5px">• 所有数据保存在当前浏览器的本地存储中</p>
        <p style="margin:0 0 5px">• 清除浏览器数据可能导致数据丢失</p>
        <p style="margin:0">• 建议定期导出备份（功能开发中）</p>
      </div>
    </main>
  `;
}

// 暴露全局函数
window.myCollectionRemove = removeFromCollection;
window.myCollectionGoToDetail = goToDetail;

// 订阅数据变化
unsubscribe = subscribe(() => {
  render();
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  unsubscribe?.();
});

render();

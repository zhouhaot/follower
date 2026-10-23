import { cards } from './cards.mjs';
import { hasCollected, addCollection, removeCollection, subscribe } from './collection-store-v2.mjs';

let unsubscribe = null;

function toggleCollection(key, event) {
  event.stopPropagation(); // 防止触发卡片点击

  const collected = hasCollected(key);

  if (collected) {
    const result = removeCollection(key);
    if (!result.saved) {
      alert('取消收藏失败：' + (result.reason || '未知错误'));
    }
  } else {
    const result = addCollection({ key });
    if (!result.saved) {
      alert('收藏失败：' + (result.reason || '未知错误'));
    }
  }
}

function goToDetail(key) {
  window.location.href = `./flower-detail.html?key=${key}`;
}

function renderCard(card) {
  const collected = hasCollected(card.key);

  return `
    <div class="flower-card" data-key="${card.key}" style="
      position:relative;
      background:#1a1a1a;
      border-radius:8px;
      overflow:hidden;
      cursor:pointer;
      transition:transform 0.2s;
    " onclick="window.catalogueGoToDetail('${card.key}')">
      <img src="${card.image}" alt="${card.title}" style="
        width:100%;
        height:300px;
        object-fit:cover;
      ">
      <div style="padding:20px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
          <div>
            <h3 style="margin:0 0 5px;font-size:1.3rem">${card.title}</h3>
            <p style="margin:0;color:#999;font-size:0.85rem">${card.english}</p>
          </div>
          <button
            class="collect-btn ${collected ? 'collected' : ''}"
            data-key="${card.key}"
            onclick="event.stopPropagation();window.catalogueToggleCollection('${card.key}', event)"
            style="
              padding:8px 16px;
              background:${collected ? '#2a5' : '#444'};
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

  app.innerHTML = `
    <header style="padding:20px;border-bottom:1px solid #333">
      <div style="max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center">
        <a href="./index.html" style="color:#fff;text-decoration:none">← 返回首页</a>
        <a href="./collection.html" style="color:#2a5;text-decoration:none">我的花册</a>
      </div>
    </header>
    <main style="max-width:1200px;margin:0 auto;padding:40px 20px">
      <h1 style="font-size:2.5rem;margin:0 0 10px;text-align:center">五花图录</h1>
      <p style="text-align:center;color:#999;margin:0 0 40px">探索五朵来自石刻的数字花卡</p>

      <div style="
        display:grid;
        grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));
        gap:30px;
      ">
        ${cards.map(card => renderCard(card)).join('')}
      </div>

      <div style="margin-top:60px;padding-top:40px;border-top:1px solid #333;text-align:center">
        <p style="color:#666;font-size:0.9rem">点击卡片查看详情 · 点击收藏按钮加入花册</p>
      </div>
    </main>
  `;
}

// 暴露全局函数供内联事件调用
window.catalogueToggleCollection = toggleCollection;
window.catalogueGoToDetail = goToDetail;

// 订阅收藏变化并重新渲染
unsubscribe = subscribe(() => {
  render();
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  unsubscribe?.();
});

render();

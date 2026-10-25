/** 展签落地页：展厅二维码的目标页。一朵花、一句话、一个进入故事的入口。 */
import { cards, cardByKey } from './cards.mjs';

const params = new URLSearchParams(window.location.search);
const card = cardByKey(params.get('key'));
const no = c => String(cards.indexOf(c) + 1).padStart(2, '0');
const app = document.getElementById('app');

if (!card) {
  app.innerHTML = `<main class="label-page"><section class="label-card"><p class="label-eyebrow">EXHIBIT LABEL / 展签</p><h1>这朵花不在图录里</h1><a class="label-primary" href="./catalogue.html">浏览五花图录</a></section></main>`;
} else {
  document.title = `${card.title} · 展签 | 花开有声`;
  app.innerHTML = `
  <main class="label-page">
    <section class="label-card">
      <p class="label-eyebrow">EXHIBIT LABEL / 展签 · ${no(card)} / 05</p>
      <figure class="label-art"><img src="${card.artworkImage}" alt="${card.title}纹样" width="987" height="1407"></figure>
      <header class="label-head">
        <h1>${card.title}</h1>
        <p>${card.english}</p>
      </header>
      <p class="label-trait">${card.trait || ''}</p>
      <p class="label-source">纹样原型 ·《${card.artwork}》 · ${card.credit}</p>
      <a class="label-primary" href="./flower-detail.html?key=${card.key}">走进它的故事</a>
      <a class="label-secondary" href="./catalogue.html">先看看全部五朵花</a>
    </section>
    <footer class="label-foot">花开有声 · 数字花卡探索<br>纹样原型：都江堰市博物馆馆藏 · 图源 zevth.work · 未经博物馆审定</footer>
  </main>`;
}

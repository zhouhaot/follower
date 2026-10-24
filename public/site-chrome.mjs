/** Shared site chrome: the one header and footer every page wears. */
import { cards, cardByKey } from './cards.mjs';
import { requestFor, scanURL } from './flow.mjs';

const icon = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 12h10" stroke="currentColor" stroke-width="1.3"/></svg>`;
const arrow = '<span class="arrow-north" aria-hidden="true"></span>';

const NAV_ITEMS = [
  ['home', 'index.html', '展览首页'],
  ['catalogue', 'catalogue.html', '花卡图录'],
  ['collection', 'collection.html', '我的花册'],
  ['guide', 'guide.html', '参观指南'],
];

export function siteHeader(page, cardKey = 'lotus', search = window.location.search) {
  const selected = cardByKey(cardKey) || cardByKey('lotus');
  const current = page === 'journey' ? 'guide' : page === 'backup' ? 'collection' : page === 'flower-detail' ? 'catalogue' : page;
  const from = page === 'flower-detail' ? 'detail' : page;
  const scanFrom = ['home', 'catalogue', 'collection', 'work', 'preview', 'detail'].includes(from)
    ? from
    : page === 'scan' ? requestFor(search).from : 'catalogue';
  const scanHref = scanURL(selected?.key || 'lotus', {
    from: scanFrom,
    backCard: page === 'scan' ? requestFor(search).backCard : selected?.key || 'lotus',
  });
  return `<a class="skip" href="#main">跳到主要内容</a><header class="site-header"><a href="index.html" class="brand" aria-label="花开有声 首页"><span class="brand-mark">花</span><span>花开有声<small>FLOWERS SPEAK</small></span></a><nav aria-label="主导航" class="glass-nav">${NAV_ITEMS.map(([id, url, label]) => `<a href="${url}" ${current === id ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav><a class="scan-nav" aria-label="扫描花卡" href="${scanHref}">${icon}<span>扫描花卡</span></a></header>`;
}

export function siteFooter() {
  return `<footer><a href="index.html" class="footer-brand">花开有声<span>FLOWERS SPEAK</span></a><p>让古老的纹样，在此刻重新生长。</p><div><a href="guide.html">参观指南</a><a href="catalogue.html">全部花卡 ${arrow}</a></div><small>数字花卡探索 · 本地图录候选<br>原作图像与作品名称来自 zevth.work</small></footer>`;
}

export { cards, arrow, icon };

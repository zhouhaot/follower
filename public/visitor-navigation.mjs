/** Consistent landmarks for the reading and collection journey. */
export function visitorNavigation(current) {
  return `<a class="skip" href="#main">跳到主要内容</a><header class="visitor-header"><a class="visitor-brand" href="./index.html">花开有声<span>返回首页</span></a><nav aria-label="主导航"><a href="./catalogue.html" ${current === 'catalogue' ? 'aria-current="page"' : ''}>花卡图录</a><a href="./collection.html" ${current === 'collection' ? 'aria-current="page"' : ''}>我的花册</a></nav></header>`;
}

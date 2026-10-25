/** Detail-page presentation only: never writes recognition or collection data. */
export function initDetailExhibit({card, initialView} = {}) {
  const artwork = document.getElementById('detail-artwork');
  const original = document.getElementById('detail-original');
  const model = document.getElementById('detail-model');
  const pearl = document.getElementById('detail-pearl');
  const pearlTools = document.querySelector('.pearl-detail-tools');
  const pearlDemo = document.getElementById('detail-pearl-demo');
  const status = document.getElementById('exhibit-status');
  const toolbar = document.querySelector('.view-tools');
  const reload = document.getElementById('exhibit-reload');
  const buttons = [...document.querySelectorAll('[data-exhibit-view]')];
  const touch = matchMedia('(pointer: coarse)');
  const narrow = matchMedia('(max-width: 700px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let view = 'artwork', viewer = null, loading = null, disposed = false, pearlGallery = null;

  function update() {
    if (disposed) return;
    const isArtwork = view === 'artwork';
    const isOriginal = view === 'original';
    const isPearl = view === 'pearl';
    const isModel = !isOriginal && !isPearl && !isArtwork;
    const fallback = model.classList.contains('fallback-only');
    artwork.hidden = !isArtwork;
    original.hidden = !isOriginal;
    pearl.hidden = !isPearl;
    model.hidden = !isModel;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.exhibitView === view)));
    toolbar.hidden = !isModel || !viewer || fallback;
    pearlTools.hidden = !isPearl;
    pearlDemo.disabled = !pearlGallery || pearl.querySelector('[data-pearl]').dataset.pearlState !== 'ready';
    reload.hidden = !isModel || !fallback;
    model.setAttribute('aria-busy', String(isModel && !viewer && !fallback));
    // While the viewer is fetching, the model buttons wait with the card instead of
    // taking more clicks; they re-open on ready or on the static fallback.
    const modelPending = isModel && !viewer && !fallback;
    buttons.forEach(button => {
      const isModelButton = ['bloom', 'relief'].includes(button.dataset.exhibitView);
      button.disabled = isModelButton && modelPending;
    });
    if (isArtwork) {
      status.textContent = '作品画面呈现。想在光里看它，选择「珠光光影」。';
    } else if (isPearl) {
      const state = pearl.querySelector('[data-pearl]').dataset.pearlState;
      status.textContent = state === 'fallback' ? (pearl.querySelector('img').naturalWidth ? '珠光暂不可用，已保留花卉纹样。仍可回到作品、阅读故事或收藏。' : '花卡图片暂不可用。仍可回到作品、阅读故事或收藏。') : state !== 'ready' ? '纹样已呈现，正在准备珠光。' : reduced.matches ? '已减少动态效果，静态呈现珠光。' : '横向轻拖或使用方向键，观察局部珠光；按 Home 归正。竖向滑动继续阅读。';
    } else if (isOriginal) {
      status.textContent = '实体花卡平面设计稿完整呈现——含二维码与说明文字的印刷版式。';
    } else if (fallback) {
      status.textContent = '三维暂不可用，当前显示静态效果图。仍可回到作品、阅读故事或收藏。';
    } else if (!viewer) {
      status.textContent = '正在加载三维画面，故事仍可阅读…';
    } else {
      status.textContent = touch.matches || navigator.maxTouchPoints > 0 && narrow.matches ? '单指转动 · 双指缩放。滑动正文可继续阅读。' : '拖动旋转 · 滚轮缩放，也可使用视角按钮。';
    }
    if (isModel) model.setAttribute('aria-label', `${card.title}${view === 'relief' ? '金属花卡' : '立体花朵'}${fallback ? '静态效果图' : '，可使用视角按钮调整'}`);
  }

  function fallbackImage() {
    const image = model.querySelector('.model-fallback');
    image.src = view === 'relief' ? './assets/renders/lotus-transparent.png' : `./assets/renders/${card.key}-bloom.png`;
    image.alt = `${card.title}${view === 'relief' ? '金属花卡' : '立体花朵'}静态效果图`;
  }

  function ensurePearl() {
    if (pearlGallery || disposed) return;
    import('./pearl-gallery.mjs').then(({initPearlGallery})=>{
      if (disposed) return;
      pearlGallery = initPearlGallery(pearl, {enabled:view==='pearl', onState:update});
      update();
    }).catch(()=>{if(!disposed){pearl.querySelector('[data-pearl]').dataset.pearlState='fallback';update();}});
  }

  function select(next) {
    if (disposed || !buttons.some(button => button.dataset.exhibitView === next)) return;
    view = next;
    const isModel = view === 'bloom' || view === 'relief';
    if (isModel) fallbackImage();
    update();
    pearlGallery?.setEnabled(view === 'pearl');
    if (view === 'pearl') { ensurePearl(); return; }
    if (!isModel) return;
    if (viewer) { viewer.setView(view); update(); return; }
    if (loading) return;
    loading = import('./model-viewer.mjs')
      .then(({createViewer}) => disposed ? null : createViewer(model, {interactive:true, cardKey:card.key}))
      .then(result => {
        if (disposed) { result?.dispose(); return; }
        viewer = result;
        if (viewer && (view === 'bloom' || view === 'relief')) viewer.setView(view);
        update();
      })
      .catch(() => {
        if (disposed) return;
        model.classList.add('fallback-only');
        fallbackImage();
        update();
      });
  }

  const events = new AbortController();
  buttons.forEach(button => button.addEventListener('click', () => select(button.dataset.exhibitView), {signal:events.signal}));
  pearlDemo.addEventListener('click',()=>pearlGallery?.demo(),{signal:events.signal});
  document.getElementById('detail-pearl-reset').addEventListener('click',()=>pearlGallery?.reset(),{signal:events.signal});
  document.querySelectorAll('[data-exhibit-adjust]').forEach(button => button.addEventListener('click', () => {
    if (!isModelView() || !viewer || model.classList.contains('fallback-only')) return;
    const action = button.dataset.exhibitAdjust;
    if (action === 'reset') viewer.setView('reset');
    else viewer.adjustView?.({turn:action === 'left' ? Math.PI / 8 : action === 'right' ? -Math.PI / 8 : 0, zoom:action === 'in' ? .8 : action === 'out' ? 1.25 : 1});
  }, {signal:events.signal}));
  function isModelView() { return view === 'bloom' || view === 'relief'; }
  reload.addEventListener('click', () => location.reload(), {signal:events.signal});
  touch.addEventListener('change', update, {signal:events.signal});
  narrow.addEventListener('change', update, {signal:events.signal});
  reduced.addEventListener('change', update, {signal:events.signal});
  // The shared renderer switches to a still image after WebGL context loss.
  const observer = new MutationObserver(update);
  observer.observe(model, {attributes:true, attributeFilter:['class']});
  select(buttons.some(button=>button.dataset.exhibitView===initialView) ? initialView : 'artwork');
  return {dispose() {disposed = true;events.abort();observer.disconnect();viewer?.dispose();pearlGallery?.dispose();}};
}

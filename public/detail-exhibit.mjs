/** Detail-page presentation only: never writes recognition or collection data. */
export function initDetailExhibit({card, initialView} = {}) {
  const original = document.getElementById('detail-original');
  const model = document.getElementById('detail-model');
  const status = document.getElementById('exhibit-status');
  const toolbar = document.querySelector('.view-tools');
  const reload = document.getElementById('exhibit-reload');
  const buttons = [...document.querySelectorAll('[data-exhibit-view]')];
  const touch = matchMedia('(pointer: coarse)');
  const narrow = matchMedia('(max-width: 700px)');
  let view = 'original', viewer = null, loading = null, disposed = false;

  function update() {
    if (disposed) return;
    const isOriginal = view === 'original';
    const fallback = model.classList.contains('fallback-only');
    original.hidden = !isOriginal;
    model.hidden = isOriginal;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.exhibitView === view)));
    toolbar.hidden = isOriginal || !viewer || fallback;
    reload.hidden = isOriginal || !fallback;
    model.setAttribute('aria-busy', String(!isOriginal && !viewer && !fallback));
    if (isOriginal) {
      status.textContent = '原作完整呈现。选择“立体花朵”，换个角度看花。';
    } else if (fallback) {
      status.textContent = '三维暂不可用，当前显示静态效果图。仍可切换原作、阅读故事或收藏。';
    } else if (!viewer) {
      status.textContent = '正在加载三维画面，故事仍可阅读…';
    } else {
      status.textContent = touch.matches || navigator.maxTouchPoints > 0 && narrow.matches ? '单指转动 · 双指缩放。滑动正文可继续阅读。' : '拖动旋转 · 滚轮缩放，也可使用视角按钮。';
    }
    if (!isOriginal) model.setAttribute('aria-label', `${card.title}${view === 'relief' ? '金属花卡' : '立体花朵'}${fallback ? '静态效果图' : '，可使用视角按钮调整'}`);
  }

  function fallbackImage() {
    const image = model.querySelector('.model-fallback');
    image.src = view === 'relief' ? './assets/renders/lotus-transparent.png' : `./assets/renders/${card.key}-bloom.png`;
    image.alt = `${card.title}${view === 'relief' ? '金属花卡' : '立体花朵'}静态效果图`;
  }

  function select(next) {
    if (disposed || !buttons.some(button => button.dataset.exhibitView === next)) return;
    view = next;
    if (view !== 'original') fallbackImage();
    update();
    if (view === 'original') return;
    if (viewer) { viewer.setView(view); update(); return; }
    if (loading) return;
    loading = import('./model-viewer.mjs')
      .then(({createViewer}) => disposed ? null : createViewer(model, {interactive:true, cardKey:card.key}))
      .then(result => {
        if (disposed) { result?.dispose(); return; }
        viewer = result;
        if (viewer && view !== 'original') viewer.setView(view);
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
  document.querySelectorAll('[data-exhibit-adjust]').forEach(button => button.addEventListener('click', () => {
    if (view === 'original' || !viewer || model.classList.contains('fallback-only')) return;
    const action = button.dataset.exhibitAdjust;
    if (action === 'reset') viewer.setView('reset');
    else viewer.adjustView?.({turn:action === 'left' ? Math.PI / 8 : action === 'right' ? -Math.PI / 8 : 0, zoom:action === 'in' ? .8 : action === 'out' ? 1.25 : 1});
  }, {signal:events.signal}));
  reload.addEventListener('click', () => location.reload(), {signal:events.signal});
  touch.addEventListener('change', update, {signal:events.signal});
  narrow.addEventListener('change', update, {signal:events.signal});
  // The shared renderer switches to a still image after WebGL context loss.
  const observer = new MutationObserver(update);
  observer.observe(model, {attributes:true, attributeFilter:['class']});
  select(initialView === 'bloom' || initialView === 'relief' && card.key === 'lotus' ? initialView : 'original');
  return {dispose() {disposed = true;events.abort();observer.disconnect();viewer?.dispose();}};
}

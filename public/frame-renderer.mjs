/** On-demand drawing: keep the latest input, at most one draw per display frame. */
export function createFrameRenderer(draw, {
  requestFrame = callback => requestAnimationFrame(callback),
  cancelFrame = id => cancelAnimationFrame(id),
  canRender = () => true,
} = {}) {
  let pending = null, disposed = false;
  function cancel() {
    if (pending !== null) cancelFrame(pending);
    pending = null;
  }
  function request() {
    if (disposed || pending !== null || !canRender()) return;
    pending = requestFrame(() => {
      pending = null;
      if (!disposed && canRender()) draw();
    });
  }
  return {request, cancel, dispose() {disposed = true;cancel();}};
}

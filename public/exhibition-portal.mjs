import { cards } from './cards.mjs';
import { pearlCard } from './pearl-card.mjs';
import { initPearlGallery } from './pearl-gallery.mjs';

/** One bounded light field; artwork and navigation never depend on WebGL. */
export function initPortal(root) {
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController(), signal = events.signal;
  const listen = (node, type, fn, options = {}) => node.addEventListener(type, fn, { ...options, signal });
  const stage = root.querySelector('.portal-stage');
  const canvas = root.querySelector('#portal-field');
  const main = root.querySelector('.home-main-card');
  const status = root.querySelector('#home-pearl-status');
  const cardButtons = [...root.querySelectorAll('[data-portal-card]')];
  let gallery, current = cards.findIndex(c => c.key === 'lotus');
  let requested = current, selection = 0, transition, selectionMessage = null;
  function mountGallery() {
    gallery?.dispose();
    const mainCard = main.querySelector('[data-pearl]');
    gallery = initPearlGallery(root, { onState(state, element) {
      if (element !== mainCard) return;
      if (state === 'ready') gallery.demo(element);
      if (selectionMessage) return;
      status.textContent = state === 'fallback' ? '光影暂不可用，仍可进入故事。' : state === 'ready' ? '移动光，慢慢看。轻触作品，走进故事。' : '原作已呈现，正在准备光影。';
    } });
  }
  async function select(index, updateURL = true) {
    requested = (index + cards.length) % cards.length;
    const id = ++selection, nextIndex = requested, card = cards[nextIndex];
    if (nextIndex === current) { selectionMessage = null; status.textContent = '轻触作品，走进故事。'; return; }
    const container = document.createElement('div');
    container.innerHTML = pearlCard(card, { priority: true });
    const incoming = container.firstElementChild;
    status.textContent = selectionMessage = `正在准备${card.title}，当前作品仍可观看。`;
    try { await incoming.querySelector('img').decode(); }
    catch {
      if (id === selection) { requested = current; status.textContent = selectionMessage = '这张作品暂未加载，请再次选择重试；当前作品仍可观看。'; }
      return;
    }
    if (id !== selection) return;
    transition?.cancel();
    main.querySelector('.portal-outgoing')?.remove();
    const outgoing = main.querySelector('[data-pearl]');
    gallery?.dispose();
    outgoing.removeAttribute('data-pearl');
    outgoing.classList.add('portal-outgoing');
    outgoing.setAttribute('aria-hidden', 'true');
    main.append(incoming);
    current = nextIndex; selectionMessage = null;
    main.href = `flower-detail.html?key=${card.key}`;
    main.setAttribute('aria-label', `阅读${card.title}的故事`);
    root.querySelector('#portal-title').textContent = card.title;
    root.querySelector('#portal-artwork').textContent = `纹样原型 ·《${card.artwork}》`;
    root.querySelector('#portal-description').textContent = card.trait || card.description;
    root.querySelector('#portal-enter').href = main.href;
    root.querySelector('#portal-start').href = main.href;
    root.querySelector('#portal-number').textContent = `${String(current + 1).padStart(2, '0')} / 05`;
    root.querySelector('#portal-bloom').href = `flower-detail.html?key=${card.key}&view=bloom`;
    cardButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.portalCard === card.key)));
    if (updateURL) history.replaceState(null, '', `#${card.key}`);
    if (media.matches) outgoing.remove();
    else {
      transition = incoming.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.16,1,.3,1)' });
      transition.onfinish = () => outgoing.remove();
    }
    mountGallery();
    wake();
  }
  cardButtons.forEach(button => listen(button, 'click', () => select(cards.findIndex(c => c.key === button.dataset.portalCard))));
  listen(root.querySelector('#portal-previous'), 'click', () => select(requested - 1));
  listen(root.querySelector('#portal-next'), 'click', () => select(requested + 1));

  let gl, program, buffer, frame = null, until = 0, visible = true, lost = false;
  let mouse = [.63, .56], target = [...mouse], phase = 0;
  const locations = {};
  function draw(time) {
    frame = null;
    if (!gl || lost || document.hidden || !visible) return;
    mouse = mouse.map((n, i) => n + (target[i] - n) * .09);
    phase += !media.matches ? .008 : 0;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(locations.resolution, canvas.width, canvas.height);
    gl.uniform2f(locations.pointer, mouse[0], mouse[1]);
    gl.uniform1f(locations.phase, phase);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (!media.matches && time < until) frame = requestAnimationFrame(draw);
  }
  function wake() {
    if (!gl || lost || document.hidden || !visible) return;
    until = performance.now() + 900;
    if (frame === null) frame = requestAnimationFrame(draw);
  }
  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    const width = Math.round(stage.clientWidth * ratio), height = Math.round(stage.clientHeight * ratio);
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width; canvas.height = height;
    // Resizing clears a canvas: repaint in this callback, before the browser presents it.
    cancelAnimationFrame(frame); frame = null;
    draw(performance.now());
  }
  try {
    gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
    if (gl) {
      const sources = [
        [gl.VERTEX_SHADER, 'attribute vec2 position; varying vec2 uv; void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}'],
        [gl.FRAGMENT_SHADER, `precision mediump float;
          varying vec2 uv; uniform vec2 resolution; uniform vec2 pointer; uniform float phase;
          void main(){
            vec2 p=uv; float aspect=resolution.x/resolution.y;
            float bend=sin(p.x*4.2+phase*.2)*.18+sin(p.x*7.-phase*.1)*.04;
            float wave=p.y-.44-bend-(pointer.y-.5)*.16;
            float ribbon=exp(-abs(wave)*10.0);
            float filament=pow(max(0.,cos(wave*142.+sin(p.x*14.+phase)*.65)),20.)*exp(-abs(wave)*13.);
            vec2 focus=vec2((p.x-pointer.x)*aspect,p.y-pointer.y);
            float attention=exp(-dot(focus,focus)*2.4);
            vec3 ink=vec3(.026,.054,.12);
            vec3 blue=vec3(.10,.18,.39)*ribbon;
            vec3 green=vec3(.16,.29,.30)*filament*.30;
            vec3 color=ink+blue+green+vec3(.02,.052,.075)*attention;
            float edge=smoothstep(1.,.05,length((p-.5)*vec2(.8,1.)));
            gl_FragColor=vec4(color*(.72+.28*edge),1.);
          }`]
      ];
      program = gl.createProgram();
      for (const [type, source] of sources) {
        const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error('shader');
        gl.attachShader(program, shader); gl.deleteShader(shader);
      }
      gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error('program');
      gl.useProgram(program); buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'position'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      for (const name of ['resolution', 'pointer', 'phase']) locations[name] = gl.getUniformLocation(program, name);
      canvas.dataset.fieldState = 'ready';
    }
  } catch {
    gl?.deleteBuffer(buffer); gl?.deleteProgram(program); gl = null; canvas.hidden = true;
  }
  if (!gl) canvas.dataset.fieldState = 'fallback';
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) wake(); else { cancelAnimationFrame(frame); frame = null; } });
  observer.observe(stage);
  const sizes = new ResizeObserver(resize); sizes.observe(stage);
  listen(stage, 'pointermove', event => { if (media.matches) return; const rect = stage.getBoundingClientRect(); target = [(event.clientX - rect.left) / rect.width, 1 - (event.clientY - rect.top) / rect.height]; wake(); }, { passive: true });
  listen(media, 'change', () => { transition?.finish(); cancelAnimationFrame(frame); frame = null; wake(); });
  listen(canvas, 'webglcontextlost', () => { lost = true; cancelAnimationFrame(frame); frame = null; canvas.hidden = true; });
  listen(document, 'visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(frame); frame = null; } else wake(); });
  listen(window, 'pagehide', event => {
    cancelAnimationFrame(frame); frame = null;
    if (event.persisted) return;
    selection++; transition?.cancel(); gallery?.dispose(); observer.disconnect(); sizes.disconnect(); events.abort(); gl?.deleteBuffer(buffer); gl?.deleteProgram(program);
  });
  listen(window, 'pageshow', () => wake());
  const restored = cards.findIndex(c => `#${c.key}` === location.hash);
  mountGallery();
  if (restored !== -1) select(restored, false);
}

const dimensions={flowers:[900,1260],peony:[877,1222],chrysanthemum:[875,1228],lotus:[884,1255],leaves:[881,1255]};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function pearlCard(card,{interactive=false,priority=false}={}){
  const [width,height]=dimensions[card.key];
  return `<span class="pearl-card" data-pearl="${card.key}" ${interactive?`tabindex="0" role="group" aria-label="${escape(card.title)}珠光花卡，横向拖动或用方向键转动，Home归正"`:''}>
    <span class="pearl-face"><span class="pearl-art" style="aspect-ratio:${width}/${height}"><img src="${escape(card.target)}" alt="${escape(card.title)}完整花卉纹样" width="${width}" height="${height}" decoding="async" ${priority?'fetchpriority="high"':'loading="lazy"'}><canvas class="pearl-canvas" aria-hidden="true"></canvas></span><span class="pearl-caption"><span>${escape(card.title)}</span><small>${escape(card.artwork)}</small></span></span>
  </span>`;
}

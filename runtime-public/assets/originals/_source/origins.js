export function renderOrigins(cards,onPreview){
 const grid=document.getElementById('origins-grid');if(!grid)return;
 grid.replaceChildren(...cards.filter(c=>c.photo).map(c=>{
  const item=document.createElement('article');item.className='origin-item';item.id='origin-'+c.id;
  item.innerHTML=`<div class="origin-pair"><figure><div class="source-photo"><svg viewBox="${c.viewBox}" role="img" aria-label="${c.museum}《${c.sourceName}》石刻实拍局部" preserveAspectRatio="xMidYMid meet"><image href="${c.photo}" width="960" height="1280"/></svg></div><figcaption>文物原型 · 实拍局部</figcaption></figure><span class="origin-arrow" aria-hidden="true">→</span><figure><img class="design-photo" src="${c.target}" alt="${c.name}卡片纹样设计" loading="lazy"><figcaption>纹样再设计 · ${c.name}</figcaption></figure></div><span class="origin-museum">${c.museum}</span><h3>《${c.sourceName}》</h3><p>${c.description}</p><div class="origin-actions"><a href="${c.photo}" target="_blank" rel="noopener">查看完整实拍 ↗</a><button>预览这张花卡 ↗</button></div>`;
  item.querySelector('button').onclick=()=>onPreview(cards.indexOf(c));return item;
 }));
}
export function openOrigin(card,onPreview){
 const dialog=document.getElementById('origin-dialog');
 document.getElementById('origin-dialog-title').textContent=`《${card.sourceName}》`;
 document.getElementById('origin-dialog-subtitle').textContent=`${card.museum} · ${card.name}的纹样原型`;
 const body=document.getElementById('origin-dialog-body');
 body.innerHTML=card.photo?`<div class="dialog-photo"><svg viewBox="${card.viewBox}" role="img" aria-label="《${card.sourceName}》石刻实拍局部" preserveAspectRatio="xMidYMid meet"><image href="${card.photo}" width="960" height="1280"/></svg></div><p class="dialog-photo-caption">文物实拍局部 · 聚焦展示</p><p class="dialog-description">${card.description}</p><a class="full-photo-link" href="${card.photo}" target="_blank" rel="noopener">查看完整实拍照片 ↗</a>`:`<div class="missing-origin"><span aria-hidden="true">✳</span><p>《${card.sourceName}》的原型实拍暂未收录。</p><p>你仍可以查看这张花卡的 AR 效果。</p></div>`;
 document.getElementById('origin-dialog-preview').onclick=()=>{dialog.close();onPreview()};
 if(!dialog.open)dialog.showModal();
}

from pathlib import Path
root=Path(__file__).resolve().parents[2]
s=(root/'public/index.html').read_text()
setup='''<base href="/public/"><script>
// QA-only authored simulation; no browser preference or application source is changed.
const nativeMatchMedia=window.matchMedia.bind(window);
window.matchMedia=query=>query.includes('prefers-reduced-motion')?{matches:true,media:query,onchange:null,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return false}}:nativeMatchMedia(query);
</script>'''
s=s.replace('<head>','<head>'+setup)
s=s.replace('</head>','''<script>
// Apply the author's reduced-motion CSS declarations verbatim for this fixture.
const reduced=[];for(const sheet of document.styleSheets){for(const rule of sheet.cssRules){if(rule.type===CSSRule.MEDIA_RULE&&/prefers-reduced-motion\\s*:\\s*reduce/.test(rule.conditionText))reduced.push(...Array.from(rule.cssRules,r=>r.cssText))}}
const qaReducedStyle=document.createElement('style');qaReducedStyle.dataset.qa='synthetic-reduced-motion';qaReducedStyle.textContent=reduced.join('\\n');document.head.append(qaReducedStyle);
</script></head>''')
(root/'reports/qa/handheld-reduced-motion-fixture.html').write_text(s)

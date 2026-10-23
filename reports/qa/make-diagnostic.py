from pathlib import Path
import json,re
r=Path(__file__).resolve().parents[2];q=r/'reports/qa'
asset='/reports/hand-rig/front-facing-front-preview/'
(q/'diagnostic-palm-manifest.json').write_text(json.dumps({'diagnostic':True,'note':'Only three low-resolution pose samples, not production sequence QA.','frames':[asset+f'hand-{i:03d}.png' for i in [0,16,31]]},indent=2))
app=(r/'public/app.mjs').read_text().replace("from './","from '/public/").replace("import('./","import('/public/")
app=app.replace("'./assets/hand-sequence/manifest.json'","'/reports/qa/diagnostic-palm-manifest.json'").replace('./assets/hand-sequence/hand-000.webp',asset+'hand-000.png')
(q/'diagnostic-app.mjs').write_text(app)
html=(r/'public/index.html').read_text().replace('<head>','<head><base href="/public/">').replace('src="./app.mjs"','src="/reports/qa/diagnostic-app.mjs"')
(q/'front-facing-diagnostic.html').write_text(html)
s=(q/'front-facing-source-audit.html').read_text()
s=re.sub(r"const routes=\[.*?;", "const routes=['/reports/qa/front-facing-diagnostic.html'];", s,count=1)
s=s.replace("[...routes,'/reports/qa/handheld-reduced-motion-fixture.html']","routes")
s=s.replace('FRONT-FACING PALM QA','DIAGNOSTIC · THREE POSES ONLY')
s=s.replace('</style>','#run,#motion,#perf-start,#perf-stop,#reduced,#download{display:none}</style>',1)
(q/'front-facing-diagnostic-audit.html').write_text(s)

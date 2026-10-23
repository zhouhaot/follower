import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {cards,cardByKey} from '../public/cards.mjs';
import {scanURL,requestFor} from '../public/flow.mjs';
test('exact original identities and source artwork names',()=>{
 assert.deepEqual(cards.map(c=>[c.key,c.title,c.artwork]),[['flowers','花开有声','瓶插花卉图'],['peony','牡丹承瑞','瓶插牡丹图'],['chrysanthemum','菊影流金','摘枝菊花图'],['lotus','清荷入梦','荷花图'],['leaves','花叶生辉','芙蓉花图']]);
 assert.deepEqual(cards.filter(c=>c.scanSupported).map(c=>c.key),['flowers','peony','chrysanthemum','lotus','leaves']);
 assert.equal(cards.every(c=>c.trackingValidated===false),true);
});
test('every original front and target exists and retains source checksum',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../public/assets/originals/assets.json',import.meta.url)));
 for(const card of manifest.cards)for(const key of ['imageAsset','targetAsset']){const asset=card[key];const bytes=await readFile(new URL('../public'+asset.localPath,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);}
});
test('all seven route entrypoints exist',async()=>{for(const p of ['index','catalogue','work','collection','guide','preview','scan'])await access(new URL('../public/'+p+'.html',import.meta.url))});
test('each scan link preserves work and preview return card',()=>{for(const card of cards){for(const from of ['work','preview']){const url=scanURL(card.key,{from});const req=requestFor(url.split('?')[1]);assert.equal(req.card.key,card.key);assert.equal(req.returnURL,`${from}.html?card=${card.key}`)}}});
test('untrusted navigation parameters cannot escape candidate',()=>{const req=requestFor('?card=lotus&from=https://bad.example&backCard=<script>');assert.equal(req.returnURL,'catalogue.html');assert.equal(req.backCard,'lotus');assert.equal(requestFor('?card=unknown').supported,false);assert.throws(()=>scanURL('unknown'))});
test('supplied recovered flow baseline remains byte-identical',async()=>{const bytes=await readFile(new URL('../docs/restored/flow.mjs',import.meta.url));assert.equal(bytes.length,820);assert.equal(createHash('sha256').update(bytes).digest('hex'),'83b84ccd3fdd0fafa071e99a890c53b9d9c6104dcf79876f832572d422afb1dd')});
test('preview code never invokes recognition storage writer',async()=>{const app=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');const viewer=await readFile(new URL('../public/model-viewer.mjs',import.meta.url),'utf8');assert.equal(app.includes('recordRecognition('),false);assert.equal(viewer.includes('recordRecognition('),false)});

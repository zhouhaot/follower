import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const read=(p)=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const manifest=()=>read('public/assets/hand-sequence/manifest.json');
test('hand sequence uses 32 uniform absolute poses from one 25-joint mesh',()=>{
 const m=manifest();assert.equal(m.frameCount,32);assert.equal(m.frames.length,32);assert.deepEqual(m.dimensions,[720,960]);assert.equal(m.geometry.weightedJointCount,25);assert.equal(m.geometry.fingerCount,5);assert.equal(m.geometry.independentGeneratedPoses,false);
 for(let i=0;i<32;i++)assert.equal(m.frames[i].progress,i/31);
});
test('every hand asset is local, unique and hash-verified',()=>{
 const m=manifest();const hashes=new Set();
 for(const frame of m.frames){assert.match(frame.src,/^\.\/assets\/hand-sequence\/hand-\d{3}\.webp$/);assert.equal(frame.foreground,frame.src);const b=fs.readFileSync(path.join(root,'public',frame.src));assert.equal(b.subarray(0,4).toString(),'RIFF');assert.equal(b.subarray(8,12).toString(),'WEBP');const h=crypto.createHash('sha256').update(b).digest('hex');assert.equal(h,frame.sha256);hashes.add(h);}
 assert.equal(hashes.size,32);
});
test('hand source license and stable source digest are retained',()=>{
 const m=manifest();assert.equal(m.source.sha256,'291790c14f7f88a7f9bd35330c47392ed8e8d395ae6728f4bb7089f1bc1f2b96');const license=fs.readFileSync(path.join(root,'public/assets/hand-sequence/LICENSE.txt'),'utf8');assert.match(license,/MIT License/);assert.match(license,/Copyright \(c\) 2019 Amazon/);
});
test('the complete hand remains in front of the immutable card in all 32 checked poses',()=>{
 const report=read('reports/hand-rig/clearance-32-poses.json');assert.equal(report.frame_count,32);assert.ok(report.minimumFrontClearanceM>.020);assert.ok(report.minimumSeparatingPlaneClearanceM>.020);assert.equal(report.maximumPalmNormalCameraAxisDegrees,0);assert.equal(report.stableUvMaximumError,0);assert.equal(report.source_card_sha256,'4d0b0e912d24dafb5186d62569a58729b34407352f11f871b960c593e4fd9ac3');
});
test('render package validates exact alpha and continuous distinct frame motion',()=>{
 const report=read('reports/hand-rig/sequence-validation.json');assert.equal(report.frames,32);assert.equal(report.uniquePoseHashes,32);assert.equal(report.alphaLossless,true);assert.equal(report.firstLastDifferent,true);assert.equal(report.adjacentMeanAbsoluteRgbaDifferences.length,31);assert.ok(report.adjacentMeanAbsoluteRgbaDifferences.every(v=>v>0));assert.ok(report.totalBytes<4*1024*1024);
});
test('hand faces the camera and gently descends during a lateral planar fan',()=>{
 const m=manifest(),state=read('reports/hand-rig/render-state.json');assert.deepEqual(m.rootMotion.translationFrom,[0,0,0]);assert.equal(m.poseVariant,'FRONT');assert.deepEqual(m.rootMotion.translationTo,state.rootDisplacement);assert.equal(m.rootMotion.rootDropMeters,.017);assert.equal(m.palmAlignment.angleDegrees,0);assert.equal(m.palmAlignment.lockedThroughoutOpening,true);const camera=read('public/assets/renders/handheld-card.metadata.json').camera;assert.deepEqual(m.camera,camera);
});
test('the preserved source GLB contains one actual weighted 25-joint hand',()=>{
 const b=fs.readFileSync(path.join(root,'tests/fixtures/hand-rig/generic-hand-right.glb'));assert.equal(crypto.createHash('sha256').update(b).digest('hex'),'291790c14f7f88a7f9bd35330c47392ed8e8d395ae6728f4bb7089f1bc1f2b96');assert.equal(b.readUInt32LE(0),0x46546c67);const json=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());assert.equal(json.skins.length,1);assert.equal(json.skins[0].joints.length,25);assert.equal(json.meshes.length,1);const attrs=json.meshes[0].primitives[0].attributes;assert.ok(Number.isInteger(attrs.JOINTS_0));assert.ok(Number.isInteger(attrs.WEIGHTS_0));assert.equal(json.accessors[attrs.POSITION].count,1360);for(const name of ['wrist','thumb-tip','index-finger-tip','middle-finger-tip','ring-finger-tip','pinky-finger-tip'])assert.ok(json.nodes.some(n=>n.name===name));
});
test('the final renderer hash and pose variant agree across deliverable records',()=>{
 const m=manifest(),state=read('reports/hand-rig/render-state.json'),clearance=read('reports/hand-rig/clearance-32-poses.json');const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'scripts/render-hand-sequence.py'))).digest('hex');assert.equal(m.render_script_sha256,hash);assert.equal(state.render_script_sha256,hash);assert.equal(clearance.render_script_sha256,hash);assert.equal(state.poseVariant,'FRONT');assert.deepEqual(state.fingerAnglesStart,[12,6,2]);assert.equal(state.preserveVolume,true);assert.equal(state.clearedCustomNormals,true);assert.equal(state.nailPlateCount,0);
});

test('the saved skeletal fan separates its fingertip spread without camera pitch',()=>{
 const report=read('reports/hand-rig/clearance-32-poses.json');
 assert.equal(report.frames.length,32);assert.ok(report.frames.every(frame=>frame.palmNormalCameraAxisDegrees<.1));
 assert.ok(report.frames.at(-1).fourFingerTipScreenWidth>report.frames[0].fourFingerTipScreenWidth*2);
 for(const frame of report.frames){for(const [x,y] of Object.values(frame.tipScreenCoordinates)){assert.ok(x>0&&x<1);assert.ok(y>0&&y<1);}const order=['pinky-finger','ring-finger','middle-finger','index-finger','thumb'].map(n=>frame.tipScreenCoordinates[n][0]);assert.ok(order.every((x,i)=>i===0||x>order[i-1]));}
 assert.ok(report.frames.every((frame,i)=>i===0||frame.fourFingerTipScreenWidth>report.frames[i-1].fourFingerTipScreenWidth));
 assert.equal(report.physicalGraspClaim,false);assert.equal(report.sourceCardGeometryChanged,false);
});

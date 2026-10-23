/** New geometric bloom candidates. Availability is not physical tracking validation. */
import {createFlowersBloom,FLOWERS_BLOOM_SPEC} from './flowers-bloom.mjs';
import {createPeonyBloom,PEONY_BLOOM_SPEC} from './peony-bloom.mjs';
import {createChrysanthemumBloom,CHRYSANTHEMUM_BLOOM_SPEC} from './chrysanthemum-bloom.mjs';
import {createLotusBloom,LOTUS_BLOOM_SPEC} from './lotus-bloom.mjs';
import {createLeavesBloom,LEAVES_BLOOM_SPEC} from './leaves-bloom.mjs';
export const B = Object.freeze({
 flowers:Object.freeze({key:'flowers',title:'花开有声',create:createFlowersBloom,spec:FLOWERS_BLOOM_SPEC,staticImage:'./assets/renders/flowers-bloom.png'}),
 peony:Object.freeze({key:'peony',title:'牡丹承瑞',create:createPeonyBloom,spec:PEONY_BLOOM_SPEC,staticImage:'./assets/renders/peony-bloom.png'}),
 chrysanthemum:Object.freeze({key:'chrysanthemum',title:'菊影流金',create:createChrysanthemumBloom,spec:CHRYSANTHEMUM_BLOOM_SPEC,staticImage:'./assets/renders/chrysanthemum-bloom.png'}),
 lotus:Object.freeze({key:'lotus',title:'清荷入梦',create:createLotusBloom,spec:LOTUS_BLOOM_SPEC,staticImage:'./assets/renders/lotus-bloom.png'}),
 leaves:Object.freeze({key:'leaves',title:'花叶生辉',create:createLeavesBloom,spec:LEAVES_BLOOM_SPEC,staticImage:'./assets/renders/leaves-bloom.png'}),
});
export const BLOOMS=B;
export function bloomAvailable(key){return Object.hasOwn(B,key)&&typeof B[key].create==='function'}
export function createBloomFor(key){if(!bloomAvailable(key))throw new Error('Unknown bloom: '+key);const bloom=B[key].create();bloom.userData.cardKey=key;return bloom}

import {cardByKey} from './cards.mjs';
const pages={home:'index.html',catalogue:'catalogue.html',work:'work.html',collection:'collection.html',preview:'preview.html'};
export function requestFor(search=''){
 const p=new URLSearchParams(search),key=p.get('card')||'lotus',card=cardByKey(key),from=Object.hasOwn(pages,p.get('from'))?p.get('from'):'catalogue',backCard=cardByKey(p.get('backCard'))?.key||card?.key||'lotus';
 return {key,card,from,backCard,supported:!!card?.scanSupported,returnURL:from==='work'?`work.html?card=${backCard}`:from==='preview'?`preview.html?card=${backCard}`:pages[from]};
}
export function scanURL(key,{from='catalogue',backCard=key}={}){
 if(!cardByKey(key))throw Error('Unknown card');const c=requestFor(new URLSearchParams({card:key,from,backCard}));return 'scan.html?'+new URLSearchParams({card:key,from:c.from,backCard:c.backCard});
}

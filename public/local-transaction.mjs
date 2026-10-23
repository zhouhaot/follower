import {DataIssue,demand,parseJSON,fields,isoDate} from './business-data.mjs';
/** One-level journal plus compare-before-write, confined to two caller-owned keys. */
export function createLocalTransaction({key,journalKey,getStorage=()=>globalThis.localStorage,now=()=>new Date().toISOString(),validate=()=>{}}){
 function storage(){try{const s=getStorage();demand(s&&typeof s.getItem==='function'&&typeof s.setItem==='function'&&typeof s.removeItem==='function','storage-unavailable');return s}catch{throw new DataIssue('storage-unavailable')}}
 function read(){try{return storage().getItem(key)}catch{throw new DataIssue('storage-unavailable')}}
 function put(s,target,value){if(value===null)s.removeItem(target);else s.setItem(target,value);if(s.getItem(target)!==value)throw new DataIssue('storage-unavailable')}
 function checkpoint(){try{const raw=storage().getItem(journalKey);if(raw===null)return null;const value=parseJSON(raw,20000);fields(value,['version','key','before','after','createdAt']);demand(value.version===1&&value.key===key&&(value.before===null||typeof value.before==='string')&&typeof value.after==='string'&&value.after.length<=8192&&(value.before?.length||0)<=8192);isoDate(value.createdAt);validate(value.before);validate(value.after);return value}catch(error){if(error instanceof DataIssue)throw error;throw new DataIssue('storage-unavailable')}}
 function commit(expected,next){
  demand(typeof next==='string'&&next.length<=8192);validate(next);const s=storage();let before,oldJournal;
  try{before=s.getItem(key);oldJournal=s.getItem(journalKey)}catch{throw new DataIssue('storage-unavailable')}
  demand(before===expected,'conflict');
  if(oldJournal!==null)checkpoint();
  const journal=JSON.stringify({version:1,key,before,after:next,createdAt:now()});
  try{put(s,journalKey,journal)}catch{try{put(s,journalKey,oldJournal)}catch{throw new DataIssue('rollback-failed')}throw new DataIssue('storage-unavailable')}
  try{if(s.getItem(key)!==before){put(s,journalKey,oldJournal);throw new DataIssue('conflict')}}catch(error){if(error instanceof DataIssue)throw error;throw new DataIssue('storage-unavailable')}
  try{put(s,key,next)}catch{
   try{put(s,key,before);put(s,journalKey,oldJournal)}catch{throw new DataIssue('rollback-failed')}
   throw new DataIssue('storage-unavailable');
  }
  return true;
 }
 function undo(){
  const saved=checkpoint();demand(saved,'no-checkpoint');const s=storage();let current;
  try{current=s.getItem(key)}catch{throw new DataIssue('storage-unavailable')}
  demand(current===saved.after,'conflict');
  try{put(s,key,saved.before)}catch{throw new DataIssue('rollback-failed')}
  // Leave the journal if its removal fails; current!==after prevents a second overwrite.
  try{put(s,journalKey,null)}catch{/* Restored value was already verified. */}
  return true;
 }
 return {read,commit,undo,canUndo(){const value=checkpoint();return !!value&&read()===value.after}};
}

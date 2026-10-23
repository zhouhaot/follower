/** Shared scroll state only. No Three, DOM, timers, storage, or browser globals. */
export const clampProgress=value=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
/** Frame-normalized support references, not a claim of physical grasp/contact. */
export const HAND_CARD_SUPPORT=Object.freeze({aspect:.75,palmX:.50,cardX:.59,y:.73});
export function getHandCardSupportShift(width,height,center){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return 0;
 const shift=Math.min(width,height*HAND_CARD_SUPPORT.aspect)*(HAND_CARD_SUPPORT.palmX-HAND_CARD_SUPPORT.cardX)*(1-clampProgress(center));
 return shift===0?0:shift;
}
export function phaseProgress(value,start,end){
 const p=clampProgress(value),t=Math.max(0,Math.min(1,(p-start)/(end-start)));
 return t*t*(3-2*t);
}
export function getHandheldState(value){
 const progress=clampProgress(value),fan=phaseProgress(progress,.76,.94);
 return {
  progress,
  handOpen:phaseProgress(progress,0,.30),
  release:phaseProgress(progress,.30,.50),
  handOpacity:1-phaseProgress(progress,.43,.50),
  lift:phaseProgress(progress,.32,.54),
  turn:phaseProgress(progress,.42,.78),
  center:phaseProgress(progress,.50,.88),
  fan,
  spread:phaseProgress(progress,.74,.98),
  copyOpacity:1-phaseProgress(progress,0,.25),
  sceneOpacity:1-fan,
 };
}

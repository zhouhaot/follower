export function element(tag,text,attributes={}){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));return node}
export function action(text,handler,{signal,className='pill-link'}={}){const button=element('button',text,{type:'button',class:className});button.addEventListener('click',handler,signal?{signal}:undefined);return button}
export function link(text,href){return element('a',text,{href,class:'text-link'})}
export function paragraph(text,className){return element('p',text,className?{class:className}:{})}
export function status(){return element('p','',{role:'status','aria-live':'polite',class:'business-status'})}

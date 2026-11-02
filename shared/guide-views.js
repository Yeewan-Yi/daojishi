// Only navigation and visibility controls belong here. Never submit, delete, upload or select files.
const views={
 edit:['#edit-dialog[open]','#edit-button','#edit-dialog .close-dialog[aria-label="关闭"]','#edit-dialog'],
 date:['#date-dialog[open]','#start-date-button','#date-dialog [aria-label="关闭日期选择"]','#date-dialog'],
 letters:['#letters-trigger[aria-expanded="true"]','#letters-trigger','#letters-close','#letters-dock'],
 atlas:['.atlas-trigger[aria-expanded="true"]','.atlas-trigger','.atlas-close','#memory-atlas'],
 share:['#share-dialog[open]','#share-button','#share-dialog .close-dialog','#share-dialog'],
 council:['[data-suggestions-link][aria-expanded="true"]','[data-suggestions-link]','[data-council-close]','#council-panel'],
 albums:['.album-opener[aria-expanded="true"]','.album-opener','.album-opener','#album-picker'],
 albumNew:['#album-picker .album-create-inline:not([hidden])','.album-new','.album-create-cancel','#album-picker'],
 city:['#city-title[aria-expanded="true"]','#city-title','#city-switch-close','#city-switch-panel'],
 upload:['#upload-dialog[open]','#add-memory','[data-close="upload-dialog"]','#upload-dialog'],
 viewer:['#media-dialog[open]','.memory-image-button','[data-close="media-dialog"]','#media-dialog'],
 back:['#postcard-turn[aria-pressed="true"]','#postcard-turn','#postcard-turn','#media-dialog']
};
export const GUIDE_VIEW_NAMES=Object.keys(views);
export function createGuideViews({document:doc=document,onChange=()=>{},waitMs=4000}={}){
 const owned=new Map();let active=[];
 const query=s=>doc.querySelector(s);
 function dirty(event){if(event.target.closest?.('#page-guide')||event.target.type==='search')return;for(const [key,row]of owned){if(['atlas','albums','city'].includes(key))continue;const root=query(views[key][3]);if(root?.contains(event.target))row.dirty=true;}}
 doc.addEventListener('input',dirty,true);doc.addEventListener('change',dirty,true);
 doc.addEventListener('click',event=>{if(event.target.closest?.('#picker-confirm')){const row=owned.get('edit');if(row)row.dirty=true;}},true);
 function waitFor(test){if(test())return Promise.resolve(true);return new Promise(resolve=>{let observer;const finish=value=>{clearTimeout(timer);observer?.disconnect();resolve(value);};const timer=setTimeout(()=>finish(false),waitMs);const Observer=doc.defaultView?.MutationObserver||globalThis.MutationObserver;if(Observer){observer=new Observer(()=>{if(test())finish(true);});observer.observe(doc.body,{attributes:true,childList:true,subtree:true});}});}
 async function release(keep=[],cancelled=()=>false,leaveDirty=false){
  for(const key of [...owned.keys()].reverse()){
   if(keep.includes(key))continue;const row=owned.get(key),[state,trigger,close,root]=views[key];
   if(!query(state)||query(root)?.closest('dialog:not([open])')){owned.delete(key);continue;}
   if(row.dirty||query(root)?.getAttribute('aria-busy')==='true'){if(leaveDirty)continue;return {ok:false,reason:'这里有你输入或选择的内容。请先自行处理，或关闭这个区域后再继续；也可以暂停指引，内容会留着。'};}
   const dismiss=query(close)||query(trigger);if(!dismiss)return {ok:false,reason:'先关闭当前窗口，再继续看下一处。'};
   dismiss.click();await waitFor(()=>!query(state));if(cancelled())return {ok:false};
   if(query(state))return {ok:false,reason:'当前窗口还在处理，请稍后继续。'};owned.delete(key);
  }return {ok:true};
 }
 return {
  async prepare(keys=[],cancelled=()=>false){
   const result=await release(keys,cancelled);if(!result.ok||cancelled())return result;
   for(const dialog of doc.querySelectorAll('dialog[open]'))if(!keys.some(key=>query(views[key]?.[3]||':not(*)')===dialog))return {ok:false,reason:'当前还有你打开的窗口。请先处理完并关闭它，再继续看下一处。'};
   active=keys;
   for(const key of keys){
    if(cancelled())return {ok:false};const definition=views[key];if(!definition)continue;
    const [state,trigger,,root]=definition;if(query(state))continue;const control=query(trigger);
    if(!control||control.disabled)return {ok:true,reason:'这个入口需要可编辑身份或已有资料才能展开；先了解用法，也可以继续往下看。'};
    owned.set(key,{dirty:false});control.click();await waitFor(()=>!!query(state)&&!!query(root)&&!query(root).inert);if(cancelled())return {ok:false};
    if(!query(state))return {ok:true,reason:'这个区域暂时未能展开，可以稍后重试；介绍仍可继续。'};
   }
   onChange();return {ok:true};
  },
  parent(){for(const key of [...active].reverse()){const root=query(views[key]?.[3]||':not(*)');if(root&&!root.closest('dialog:not([open])')&&query(views[key][0]))return root;}return null;},
  async cleanup(){active=[];await release([],()=>false,true);/* Dirty views deliberately remain open for the visitor. */},
  owns(){return [...owned.keys()];}
 };
}

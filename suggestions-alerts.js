import {SuggestionsClient} from './suggestions.js?v=20261025-council-v3';
import {LocalSuggestionsClient} from './suggestions-local.js?v=20261025-council-v3';
import {emptyUnread,restoreUnread,applyActivity,readThread} from './suggestion-updates.js';
/** Device-local read receipts; no notification permissions or new cloud records. */
export function mountCouncilAlerts({context,onChange}={}){
 let published='',key='',state=emptyUnread(),timer,busy=false,paused=false;
 function save(){try{localStorage.setItem(key,JSON.stringify(state));}catch{}}
 function reload(){try{state=restoreUnread(localStorage.getItem(key));}catch{state=emptyUnread();}}
 function publish(){const signature=JSON.stringify(state.items);if(signature===published)return;published=signature;onChange(state.items);dispatchEvent(new CustomEvent('youqi:council:unread',{detail:state.items}));}
 async function check(){if(busy||paused)return;busy=true;try{const ctx=context();if(ctx.invalid||!ctx.localOnly&&!(ctx.room&&ctx.person)){key='';state=emptyUnread();publish();return;}const next=`youqi.council.unread.v1.${ctx.localOnly?'demo':ctx.room.id}.${ctx.person?.id||'local'}`;if(next!==key){key=next;reload();publish();}const requestKey=key,client=ctx.localOnly?new LocalSuggestionsClient():new SuggestionsClient(ctx);let more=true,batches=0;while(more&&batches++<6){const page=await client.activity(state.cursor);if(key!==requestKey)return;reload();state=applyActivity(state,page);save();publish();more=page.more;}}catch{/* Keep unread state during temporary network failures. */}finally{busy=false;clearTimeout(timer);if(!paused)timer=setTimeout(check,document.hidden?60000:10000);}}
 addEventListener('youqi:council:read',event=>{if(!key)return;reload();state=readThread(state,event.detail?.id,event.detail?.through);save();publish();});
 addEventListener('storage',event=>{if(event.key===key){reload();publish();}});
 addEventListener('online',()=>{clearTimeout(timer);check();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){clearTimeout(timer);check();}});
 addEventListener('pagehide',()=>{paused=true;clearTimeout(timer);});addEventListener('pageshow',()=>{paused=false;check();});
 check();return {check,get items(){return state.items;}};
}

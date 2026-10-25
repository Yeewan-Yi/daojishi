/** Keep each photo's submitted text, retry ID and pending state independent. */
export function createCommentRequests({readDraft,writeDraft,readRequest,writeRequest,newId=()=>crypto.randomUUID()}){
 const pending=new Set();
 return {
  isPending:id=>pending.has(id),
  begin(id,raw){if(pending.has(id))return null;const body=String(raw).trim();if(!body||[...body].length>1000)throw Error('请写下 1—1000 字。');const old=readRequest(id),requestId=old?.body===body&&/^[0-9a-f-]{36}$/i.test(old.id||'')?old.id:newId();writeRequest(id,{body,id:requestId});pending.add(id);return {id,raw,body,requestId};},
  succeed(ticket){pending.delete(ticket.id);const cleared=readDraft(ticket.id)===ticket.raw;if(cleared)writeDraft(ticket.id,'');if(readRequest(ticket.id)?.id===ticket.requestId)writeRequest(ticket.id,null);return cleared;},
  fail(ticket){pending.delete(ticket.id);}
 };
}

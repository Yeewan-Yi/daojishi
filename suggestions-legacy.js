// Existing bookmarks and emails return to their original page and open its
// in-page council. No independent suggestions page is needed anymore.
import {validSite} from './suggestions.js';
const current=new URL(location.href),site=current.searchParams.get('site');
const base=new URL('./',import.meta.url);let path='index.html';
if(site==='memories')path='memories.html';
else if(validSite(site)&&site.startsWith('page:')){
 try{const response=await fetch(new URL('pages/registry.json',base),{signal:AbortSignal.timeout(4000)});if(response.ok){const rows=await response.json();if(Array.isArray(rows)&&rows.some(row=>'page:'+row.slug===site))path='pages/'+site.slice(5)+'/index.html';}}catch{}
}
const target=new URL(path,base);if(current.searchParams.get('mode')==='local')target.searchParams.set('mode','local');target.searchParams.set('council','1');target.hash=current.hash;location.replace(target.href);

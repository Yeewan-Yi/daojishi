import {journeyLink} from './journey-data.js';
export const suggestionMark='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 5h17v18H12l-6 5ZM11 10h8m-8 5h5M23 9h4v18H16l-4 3"/><path d="m18 18 2 2 5-6"/></svg>';
export function currentSuggestionSite(path=location.pathname){const match=path.match(/\/pages\/([a-z][a-z0-9-]{1,39})\//);return match?'page:'+match[1]:/\/memories\.html$/.test(path)?'memories':'main';}
export function mountSuggestionLink({host,site=currentSuggestionSite(),shared=false}={}){
 if(!host||host.querySelector('[data-suggestions-link]'))return;
 const link=document.createElement('a');link.dataset.suggestionsLink='';link.className=shared?'site-tool':host.classList.contains('header-actions')?'icon-button nav-tool':'line-action';
 link.setAttribute('aria-label','共议 · 建议与修订');link.innerHTML=suggestionMark+'<span class="nav-caption" aria-hidden="true">共议</span>';
 link.style.textDecoration='none';
 const base=new URL('suggestions.html',import.meta.url);
 const update=()=>{const url=new URL(journeyLink(base.href));url.searchParams.set('site',site);link.href=url.href;};update();link.addEventListener('click',update);host.append(link);return link;
}

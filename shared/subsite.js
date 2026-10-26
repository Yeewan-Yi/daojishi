import {mountThemeMode} from './theme.js';
import {mountMobileTools} from './mobile-tools.js?v=20261026-system-theme';
import {brandMark} from '../symbols.js';
import {mountSuggestionLink} from '../suggestions-link.js?v=20261026-direct-status';
const root=new URL('../',import.meta.url);
/** Only same-site navigation receives the existing private fragment. Never send it to external links. */
export function siteLink(path='index.html'){
 const url=new URL(path,root);
 if(url.origin!==root.origin||!url.pathname.startsWith(root.pathname))throw Error('只允许站内链接');
 if(new URL(location.href).searchParams.get('mode')==='local')url.searchParams.set('mode','local');
 url.hash=location.hash;
 return url.href;
}
export function initSubsite({name='新篇',active='',site,suggestions=true}={}){
 mountThemeMode(document.querySelector('[data-theme-toggle]'));
 const brand=document.querySelector('[data-site-brand]');if(brand){brand.href=siteLink();brand.innerHTML=brandMark+'<span>有期</span><small></small>';brand.querySelector('small').textContent=name;}
 document.querySelectorAll('[data-site-link]').forEach(a=>{a.href=siteLink(a.dataset.siteLink);if(a.dataset.siteLink===active)a.setAttribute('aria-current','page');});
 if(suggestions&&!location.pathname.endsWith('/suggestions.html'))mountSuggestionLink({host:document.querySelector('.site-nav'),site,siteTitle:name,shared:true});
 mountMobileTools({host:document.querySelector('.site-nav'),primary:'[data-theme-toggle]'});
 return {siteLink};
}

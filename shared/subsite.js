import {mountMobileTools} from './mobile-tools.js?v=20261025-mobile-nav';
import {brandMark} from '../symbols.js';
import {mountSuggestionLink} from '../suggestions-link.js?v=20261025-inline';
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
 let theme;try{theme=localStorage.getItem('youqi.theme');}catch{}
 const apply=value=>{document.documentElement.dataset.theme=value==='dark'?'dark':'light';const button=document.querySelector('[data-theme-toggle]');if(button){const dark=document.documentElement.dataset.theme==='dark';button.setAttribute('aria-label',dark?'切换浅色模式':'切换深色模式');button.innerHTML=(dark?'<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="6"/><path d="M16 2v5m0 18v5M2 16h5m18 0h5M6 6l4 4m12 12 4 4M6 26l4-4M22 10l4-4"/></svg>':'<svg viewBox="0 0 32 32"><path d="M22 5a12 12 0 1 0 5 20A13 13 0 0 1 22 5Z"/></svg>')+'<span>明暗</span>';}};
 apply(theme|| (matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'));
 const brand=document.querySelector('[data-site-brand]');if(brand){brand.href=siteLink();brand.innerHTML=brandMark+'<span>有期</span><small></small>';brand.querySelector('small').textContent=name;}
 document.querySelectorAll('[data-site-link]').forEach(a=>{a.href=siteLink(a.dataset.siteLink);if(a.dataset.siteLink===active)a.setAttribute('aria-current','page');});
 document.querySelector('[data-theme-toggle]')?.addEventListener('click',()=>{const value=document.documentElement.dataset.theme==='dark'?'light':'dark';apply(value);try{localStorage.setItem('youqi.theme',value);}catch{}});
 addEventListener('storage',e=>{if(e.key==='youqi.theme')apply(e.newValue);});
 if(suggestions&&!location.pathname.endsWith('/suggestions.html'))mountSuggestionLink({host:document.querySelector('.site-nav'),site,siteTitle:name,shared:true});
 mountMobileTools({host:document.querySelector('.site-nav'),primary:'[data-theme-toggle]'});
 return {siteLink};
}

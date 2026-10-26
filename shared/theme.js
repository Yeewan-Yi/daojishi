export const THEME_KEY='youqi.theme';
export const THEME_MODES=['dark','light','system'];
const titles={dark:'暗色',light:'亮色',system:'跟随系统'};
export const normalizeThemeMode=value=>THEME_MODES.includes(value)?value:'system';
export const nextThemeMode=mode=>THEME_MODES[(THEME_MODES.indexOf(normalizeThemeMode(mode))+1)%THEME_MODES.length];
export const resolveTheme=(mode,dark)=>normalizeThemeMode(mode)==='system'?(dark?'dark':'light'):mode;

/** Keep the preference separate from the palette, including cross-tab and OS changes. */
export function createThemeController({storage,media,onChange,events=globalThis}){
 let mode='system';try{mode=normalizeThemeMode(storage?.getItem(THEME_KEY));}catch{}
 const apply=()=>onChange({mode,theme:resolveTheme(mode,media.matches),next:nextThemeMode(mode)});
 function set(value,persist){mode=normalizeThemeMode(value);if(persist)try{storage?.setItem(THEME_KEY,mode);}catch{}apply();}
 const systemChanged=()=>{if(mode==='system')apply();};
 const stored=event=>{if(event.key===THEME_KEY||event.key===null)set(event.newValue,false);};
 if(media.addEventListener)media.addEventListener('change',systemChanged);else media.addListener?.(systemChanged);
 events.addEventListener?.('storage',stored);apply();
 return {get mode(){return mode;},cycle:()=>set(nextThemeMode(mode),true),dispose(){if(media.removeEventListener)media.removeEventListener('change',systemChanged);else media.removeListener?.(systemChanged);events.removeEventListener?.('storage',stored);}};
}

const glyphs={
 dark:'<path d="M21 5a11 11 0 1 0 6 19A12 12 0 0 1 21 5Z"/><path d="m25 3 2 3-2 3-2-3ZM8 5v4M6 7h4"/>',
 light:'<circle cx="16" cy="16" r="7"/><path d="m16 12 4 4-4 4-4-4ZM16 2v4m0 20v4M2 16h4m20 0h4M6 6l3 3m14 14 3 3M6 26l3-3M23 9l3-3"/>',
 system:'<path d="M7 5h18l3 3v15H4V8ZM12 23v5m8-5v5M9 28h14"/><circle cx="16" cy="14" r="5"/><path d="M16 9v10"/><path d="M16 9a5 5 0 0 1 0 10Z" fill="currentColor" stroke="none" opacity=".2"/>'
};
const mounted=new WeakMap();
export function mountThemeMode(button,{colors={light:'#edf3f4',dark:'#101923'}}={}){
 if(button&&mounted.has(button))return mounted.get(button);
 let icon,caption;
 if(button){
  if(!document.querySelector('link[data-theme-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./theme.css?v=20261026-system-theme',import.meta.url).href;link.dataset.themeStyle='';document.head.append(link);}
  icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 32 32');icon.setAttribute('aria-hidden','true');icon.classList.add('theme-mode-icon');
  icon.innerHTML=THEME_MODES.map(mode=>`<g class="theme-glyph theme-glyph-${mode}" data-mode="${mode}" opacity="0">${glyphs[mode]}</g>`).join('');
  const old=button.querySelector('svg');if(old)old.replaceWith(icon);else button.prepend(icon);
  caption=button.querySelector('.nav-caption,span:not(.mobile-tool-label)');if(!caption){caption=document.createElement('span');caption.className='nav-caption';button.append(caption);}
 }
 let storage;try{storage=localStorage;}catch{}
 const controller=createThemeController({storage,media:matchMedia('(prefers-color-scheme: dark)'),onChange({mode,theme,next}){
  const root=document.documentElement;root.dataset.themeMode=mode;if(root.dataset.theme!==theme)root.dataset.theme=theme;
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=colors[theme];
  if(button){for(const glyph of icon.children)glyph.setAttribute('opacity',glyph.dataset.mode===mode?'1':'0');caption.textContent=titles[mode];button.dataset.themeLabel=titles[mode];button.dataset.themeMode=mode;const label=`颜色模式：${titles[mode]}${mode==='system'?'（'+titles[theme]+'）':''}；点击切换为${titles[next]}`;button.setAttribute('aria-label',label);button.title=label;}
 }});
 if(button){button.addEventListener('click',controller.cycle);mounted.set(button,controller);}return controller;
}

// Resolve the saved preference before styles paint, without changing that preference.
(()=>{let mode;try{mode=localStorage.getItem('youqi.theme');}catch{}mode=['dark','light','system'].includes(mode)?mode:'system';const root=document.documentElement;root.dataset.themeMode=mode;root.dataset.theme=mode==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):mode;})();

export function startBoot(){
  const root=document.documentElement,loader=document.getElementById('boot-screen');
  let finished=false,shown=false,progress=.04,cruising;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const showTimer=setTimeout(()=>{if(!finished){shown=true;root.dataset.boot='loading';loader.setAttribute('aria-hidden','false');}},140);
  const advance=value=>{if(finished)return;progress=Math.max(progress,Math.min(.9,value));loader.style.setProperty('--boot-progress',progress);};
  function cruise(){advance(progress+Math.max(0,.88-progress)*.08);cruising=setTimeout(cruise,650);}
  cruising=setTimeout(cruise,650);
  const finish=()=>{
    if(finished)return;finished=true;clearTimeout(showTimer);clearTimeout(timeout);clearTimeout(cruising);
    if(!shown){loader.hidden=true;delete root.dataset.boot;return;}
    loader.style.setProperty('--boot-progress',1);loader.querySelector('.boot-caption').textContent='航程已就绪';
    setTimeout(()=>{root.dataset.boot='ready';setTimeout(()=>{loader.hidden=true;delete root.dataset.boot;},reduced?0:400);},reduced?0:720);
  };
  const timeout=setTimeout(finish,15000);
  return {advance,finish};
}

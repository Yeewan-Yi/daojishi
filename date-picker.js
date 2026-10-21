import {toLocalInput} from './countdown.js?v=20261021-clear';
import {openModal,closeModal} from './motion.js?v=20261021-experience';
const daysInMonth=(year,month)=>{const date=new Date(0);date.setFullYear(year,month+1,0);return date.getDate();};

export function shiftDate(date,unit,amount){
  const next=new Date(date),day=next.getDate();
  if(unit==='year'||unit==='month'){
    next.setDate(1);
    if(unit==='year')next.setFullYear(Math.min(9999,Math.max(1,next.getFullYear()+amount)));
    else next.setMonth(next.getMonth()+amount);
    next.setDate(Math.min(day,daysInMonth(next.getFullYear(),next.getMonth())));
  }else if(unit==='hour')next.setHours(next.getHours()+amount);
  else if(unit==='minute')next.setMinutes(next.getMinutes()+amount);
  else next.setDate(next.getDate()+amount);
  if(next.getFullYear()<1){next.setFullYear(1,0,1);next.setHours(0,0,0,0);}
  if(next.getFullYear()>9999){next.setFullYear(9999,11,31);next.setHours(23,59,0,0);}
  return next;
}
export function monthCells(date){
  const first=new Date(date);first.setDate(1);const offset=(first.getDay()+6)%7;
  const days=daysInMonth(date.getFullYear(),date.getMonth());
  return Array.from({length:Math.ceil((offset+days)/7)*7},(_,i)=>i<offset||i>=offset+days?null:i-offset+1);
}
export function mountDatePicker(){
  const $=id=>document.getElementById(id),dialog=$('date-dialog');
  const format=new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
  let selected=new Date(),target=null,opener=null,lastWheel=0;
  const pad=n=>String(n).padStart(2,'0');
  function refresh(){
    for(const name of ['start','end']){
      const date=new Date($(name+'-input').value);
      if(!Number.isFinite(date.getTime()))continue;
      $(name+'-date-value').textContent=`${date.getFullYear()} / ${pad(date.getMonth()+1)} / ${pad(date.getDate())}`;
      $(name+'-clock-value').textContent=`${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }
  }
  function paint(focusDay=false){
    $('picker-year').value=selected.getFullYear();$('picker-month').value=selected.getMonth();
    $('picker-hour').value=pad(selected.getHours());$('picker-minute').value=pad(selected.getMinutes());
    $('picker-summary').textContent=format.format(selected);
    const grid=$('picker-days');grid.replaceChildren();
    const today=new Date();
    for(const day of monthCells(selected)){
      if(day===null){const gap=document.createElement('span');gap.setAttribute('aria-hidden','true');grid.append(gap);continue;}
      const button=document.createElement('button');button.type='button';button.textContent=day;
      button.setAttribute('aria-label',`${selected.getFullYear()}年${selected.getMonth()+1}月${day}日`);
      button.setAttribute('aria-pressed',String(day===selected.getDate()));
      if(day===today.getDate()&&selected.getMonth()===today.getMonth()&&selected.getFullYear()===today.getFullYear())button.classList.add('is-today');
      button.addEventListener('click',()=>{selected.setDate(day);paint(true);});
      button.addEventListener('keydown',event=>{
        const amount={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];
        if(amount){event.preventDefault();selected=shiftDate(selected,'day',amount);paint(true);}
        if(event.key==='PageUp'||event.key==='PageDown'){event.preventDefault();selected=shiftDate(selected,event.shiftKey?'year':'month',event.key==='PageUp'?-1:1);paint(true);}
      });grid.append(button);
    }
    if(focusDay)grid.querySelector('[aria-pressed=true]')?.focus({preventScroll:true});
  }
  function step(unit,amount){selected=shiftDate(selected,unit,amount);paint();}
  function wheel(element,unit){
    element.addEventListener('wheel',event=>{
      event.preventDefault();const now=performance.now(),delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1);if(now-lastWheel<110||Math.abs(delta)<2)return;
      lastWheel=now;step(event.shiftKey&&unit==='month'?'year':unit,delta>0?1:-1);
    },{passive:false});
  }
  for(const name of ['start','end'])$(name+'-date-button').addEventListener('click',()=>{
    target=$(name+'-input');opener=$(name+'-date-button');selected=new Date(target.value);
    if(!Number.isFinite(selected.getTime()))selected=new Date();
    $('picker-title').textContent=name==='start'?'故事的起点':'期待的日子';paint();openModal(dialog);
    $('picker-days').querySelector('[aria-pressed=true]')?.focus({preventScroll:true});
  });
  for(const [unit,id] of [['year','picker-year'],['month','picker-month'],['hour','picker-hour'],['minute','picker-minute']]){
    const input=$(id);wheel(input,unit);
    input.title={year:'滚轮切换年份',month:'滚轮切换月份',hour:'滚轮调整小时',minute:'滚轮调整分钟'}[unit];
    input.addEventListener('change',()=>{
      const value=Number(input.value);if(!Number.isFinite(value))return paint();
      if(unit==='year')step(unit,Math.round(value)-selected.getFullYear());
      else if(unit==='month')step(unit,value-selected.getMonth());
      else if(unit==='hour')step(unit,Math.min(23,Math.max(0,value))-selected.getHours());
      else step(unit,Math.min(59,Math.max(0,value))-selected.getMinutes());
    });
  }
  wheel($('picker-days'),'month');
  $('picker-days').title='滚轮切换月份，Shift + 滚轮切换年份';
  for(const button of dialog.querySelectorAll('[data-date-unit]'))button.addEventListener('click',()=>step(button.dataset.dateUnit,Number(button.dataset.dateStep)));
  $('picker-today').addEventListener('click',()=>{const now=new Date();selected.setFullYear(now.getFullYear(),now.getMonth(),now.getDate());paint();});
  $('picker-confirm').addEventListener('click',()=>{target.value=toLocalInput(selected);refresh();closeModal(dialog);});
  dialog.addEventListener('close',()=>opener?.focus({preventScroll:true}));
  return {refresh};
}

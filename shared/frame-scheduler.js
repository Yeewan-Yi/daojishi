/** Coalesce redraws requested during a frame with the animation's continuation. */
export function createFrameScheduler(draw,{request=callback=>requestAnimationFrame(callback),cancel=id=>cancelAnimationFrame(id),active=()=>true}={}){
 let pending=null,generation=0;
 return {
  invalidate(){if(pending!==null||!active())return;const scheduled=generation;pending=request(now=>{if(scheduled!==generation)return;pending=null;if(active())draw(now);});},
  stop(){generation++;if(pending!==null)cancel(pending);pending=null;}
 };
}

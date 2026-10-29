/** Size the actual print, keeping its aspect ratio and leaving room for the note. */
export function postcardFrame(width,height,viewportWidth,viewportHeight){
 const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1),mobile=viewportWidth<=680,border=mobile?8:10;
 const noteWidth=mobile?Math.max(1,viewportWidth-44):viewportWidth<1000?264:288;
 const maxWidth=mobile?Math.max(1,viewportWidth-44-border*2):Math.max(1,viewportWidth-100-noteWidth-border*2);
 const maxHeight=mobile?Math.max(1,viewportHeight*.52-border*2):Math.max(1,viewportHeight-116-border*2);
 const scale=Math.min(maxWidth/w,maxHeight/h),imageWidth=Math.max(1,Math.floor(w*scale)),imageHeight=Math.max(1,Math.floor(h*scale));
 return {imageWidth,imageHeight,noteWidth,noteHeight:Math.min(Math.max(imageHeight+border*2,360),Math.max(1,viewportHeight-116)),border,mobile};
}

export function captureFromTags(tags={}){
 const out={},raw=tags.DateTimeOriginal||tags.CreateDate;
 if(typeof raw==='string'){const match=raw.trim().match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);if(match){const [,y,m,d,h,min,s]=match,value=`${y}-${m}-${d}T${h}:${min}:${s}`,date=new Date(value+'Z');if(Number(y)>=1900&&Number(y)<=2200&&Number.isFinite(+date)&&date.toISOString().startsWith(value))out.captured_at=value;}}
 const embedded=typeof raw==='string'?raw.match(/([+-]\d{2}:\d{2}|Z)$/)?.[1]:null,offset=tags.OffsetTimeOriginal||tags.OffsetTimeDigitized||(embedded==='Z'?'+00:00':embedded);if(out.captured_at&&typeof offset==='string'&&/^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(offset))out.capture_offset=offset;
 const dms=(value,ref)=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite)?(value[0]+value[1]/60+value[2]/3600)*(['S','W'].includes(ref)?-1:1):null;
 const lat=Number.isFinite(tags.latitude)?tags.latitude:dms(tags.GPSLatitude,tags.GPSLatitudeRef),lon=Number.isFinite(tags.longitude)?tags.longitude:dms(tags.GPSLongitude,tags.GPSLongitudeRef);
 if(Number.isFinite(lat)&&Math.abs(lat)<=90&&Number.isFinite(lon)&&Math.abs(lon)<=180){out.latitude=Math.round(lat*1e6)/1e6;out.longitude=Math.round(lon*1e6)/1e6;}
 const parts=[tags.SubLocation,tags.Location,tags.City,tags.State,tags.Country].filter(value=>typeof value==='string'&&value.trim()).map(value=>value.trim());if(parts.length)out.place=[...new Set(parts)].join(' · ').slice(0,160);
 return out;
}
export async function readCapture(file){try{const {parse}=await import('./vendor-exifr.js');return captureFromTags(await parse(file,{reviveValues:false,iptc:true,xmp:true})||{});}catch{return {};}}
export const mediaTime=row=>Date.parse(row.captured_at?row.captured_at.slice(0,19)+'Z':row.taken_on?row.taken_on+'T00:00:00Z':row.created_at)||0;
export function compareMedia(a,b,order='oldest'){const difference=order==='upload'?Number(a.seq)-Number(b.seq):mediaTime(a)-mediaTime(b)||Number(a.seq)-Number(b.seq);return order==='oldest'?difference:-difference;}
export function captureLabels(row){const exact=row.captured_at?.slice(0,19),date=exact?exact.replace('T',' ').replaceAll('-',' / '):row.taken_on?.replaceAll('-',' / ');const time=date?(exact?'拍摄于 ':'归档于 ')+date+(exact&&row.capture_offset?'  UTC'+row.capture_offset:''):'';const lat=row.latitude,lon=row.longitude,coordinates=Number.isFinite(lat)&&Number.isFinite(lon)?`${Math.abs(lat).toFixed(5)}°${lat<0?'S':'N'}  ${Math.abs(lon).toFixed(5)}°${lon<0?'W':'E'}`:'';return {time,place:[row.place,coordinates].filter(Boolean).join(' · ')};}

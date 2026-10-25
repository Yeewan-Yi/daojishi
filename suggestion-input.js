import {targetSites,validSite} from './suggestions.js';

// Only leading full-width markers are structural. Brackets in ordinary prose
// stay untouched. Names are resolved against the shared page registry.
export function parseSuggestionInput(value,sites,{origin='main',selected=[origin]}={}){
 let body=String(value??'').replace(/\r\n?/g,'\n').trimStart(),explicit=false;
 const marked=[];
 const names=new Map();
 for(const site of sites){if(!validSite(site.id))continue;for(const name of [site.title,site.id,site.id.startsWith('page:')?site.id.slice(5):null]){if(!name)continue;const key=String(name).trim().toLocaleLowerCase();const matches=names.get(key)||[];if(!matches.includes(site.id))matches.push(site.id);names.set(key,matches);}}
 for(const name of ['总站','总网站'])names.set(name,['main']);
 while(body.startsWith('【')){
  const match=body.match(/^【([^【】\n]{1,80})】/);
  if(!match)return {body:body.trim(),targets:[],explicit:true,error:'请补全开头的【网站名】标记。'};
  const name=match[1].trim(),matches=names.get(name.toLocaleLowerCase())||[];
  if(matches.length!==1)return {body:body.trim(),targets:[],explicit:true,error:matches.length?'这个网站名称有重名，请改用【page:英文目录】。':`没有找到「${name}」，请检查网站名称。`};
  marked.push(matches[0]);explicit=true;body=body.slice(match[0].length).trimStart();
 }
 const targets=[...new Set([...(origin!=='main'?[origin]:[]),...(explicit?marked:selected)])];
 try{targetSites(targets);}catch(error){return {body:body.trim(),targets,explicit,error:error.message};}
 return {body:body.trim(),targets,explicit,error:''};
}

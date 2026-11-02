import {GUIDE_ARTS} from './guide-art.js';
import {GUIDE_VIEW_NAMES} from './guide-views.js';
export function validateGuide(guide){
 if(!guide||typeof guide.title!=='string'||!guide.title.trim()||typeof guide.intro!=='string'||!Array.isArray(guide.chapters)||!guide.chapters.length)throw Error('指引需要标题、简介与章节');
 if(guide.tour!==undefined&&(!Array.isArray(guide.tour)||!guide.tour.length||guide.tour.some(step=>typeof step?.title!=='string'||!step.title.trim()||typeof step.body!=='string'||!step.body.trim()||step.target!==undefined&&typeof step.target!=='string')))throw Error('导览需要按顺序填写标题、介绍和可选入口');
 if(guide.tour?.some(step=>step.views!==undefined&&(!Array.isArray(step.views)||step.views.some(view=>!GUIDE_VIEW_NAMES.includes(view)))||step.group!==undefined&&typeof step.group!=='string'||step.fallback!==undefined&&typeof step.fallback!=='string'))throw Error('导览只能使用已有的界面展开类型');
 const ids=new Set();for(const row of guide.chapters){if(!/^[a-z][a-z0-9-]*$/.test(row.id)||ids.has(row.id)||!row.title?.trim()||!row.summary?.trim()||!GUIDE_ARTS.includes(row.art)||!Array.isArray(row.steps)||!row.steps.length)throw Error('指引章节格式不完整');ids.add(row.id);for(const step of row.steps)if(!step.title?.trim()||!step.body?.trim())throw Error('每一步都要写清操作与结果');for(const item of row.buttons||[])if(!item.label?.trim()||!item.description?.trim())throw Error('按钮需要名称与用途');}return guide;
}
export function filterChapters(guide,query){const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);return guide.chapters.filter(row=>{const text=[row.title,row.summary,...row.steps.flatMap(s=>[s.title,s.body,s.hint||'']),...(row.buttons||[]).flatMap(b=>[b.label,b.description])].join(' ').toLocaleLowerCase();return words.every(word=>text.includes(word));});}

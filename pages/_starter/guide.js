import {guideFor} from '../../shared/guide-content.js';
import {quickTask} from '../../shared/guide-quick.js';
// 随页面功能更新这里的步骤、按钮与选择器；只写实际存在的功能。
const name='__PAGE_TITLE__'.startsWith('__')?'新篇':'__PAGE_TITLE__';
export const guide={title:name,intro:'从这里开始，了解这一页的功能与操作。',chapters:[
 {id:'draft',title:'保存一句本机草稿',summary:'模板示例仅保存在当前浏览器，不会自动双人同步。',art:'letters',steps:[
  {title:'输入内容',body:'在正文写下一句话。',target:'#draft'},
  {title:'保存草稿',body:'点击保存后查看结果。清理浏览器数据可能丢失草稿，保存失败时请复制保留。',target:'#save-draft'}
 ],buttons:[{label:'保存本机草稿',description:'保存到这台设备；空内容不可保存。',target:'#save-draft'}]},
 ...guideFor('starter').chapters.filter(chapter=>chapter.id!=='draft').map(quickTask)
]};

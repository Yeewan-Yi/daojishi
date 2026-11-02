import {guideFor} from '../../shared/guide-content.js';
// 随页面功能更新这里的步骤、按钮与选择器；只写实际存在的功能。
const name='__PAGE_TITLE__'.startsWith('__')?'新篇':'__PAGE_TITLE__';
export const guide={title:name,intro:'从这里开始，了解这一页的功能与操作。',tour:[
 {title:'这里是'+name,body:'我带你认识一下这一页。先看看标题，下面就是这页的主要内容。',target:'h1'},
 {title:'先试着写一句话',body:'这里可以输入文字。模板现在只作本机演示，不会发给对方。',target:'#draft'},
 {title:'写好以后，点这里保存',body:'这会把草稿留在当前浏览器。以后开发新功能，请把这段介绍换成真实的使用方法。',target:'#save-draft'},
 {title:'看着舒服的颜色，也可以换',body:'点这里，在亮色、暗色和跟随系统之间切换。',target:'[data-theme-toggle]'},
 {title:'有什么建议，可以在这里说',body:'这是共议，能给当前页面提出建议，再和对方一起讨论。',target:'[data-suggestions-link]'}
],chapters:[
 {id:'draft',title:'保存一句本机草稿',summary:'模板示例仅保存在当前浏览器，不会自动双人同步。',art:'letters',steps:[
  {title:'输入内容',body:'在正文写下一句话。',target:'#draft'},
  {title:'保存草稿',body:'点击保存后查看结果。清理浏览器数据可能丢失草稿，保存失败时请复制保留。',target:'#save-draft'}
 ],buttons:[{label:'保存本机草稿',description:'保存到这台设备；空内容不可保存。',target:'#save-draft'}]},
 ...guideFor('starter').chapters.filter(chapter=>chapter.id!=='draft')
]};

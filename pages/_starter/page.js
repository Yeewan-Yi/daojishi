import {initSubsite} from '../../shared/subsite.js';
const pageName='__PAGE_TITLE__'.startsWith('__')?'新篇':'__PAGE_TITLE__';
initSubsite({name:pageName});document.title=pageName+' · 有期';document.querySelector('h1').textContent=pageName;
// 示例仅保存到本机；多人共享的数据需要另行设计权限与服务端接口。
const key='youqi.page.__PAGE_SLUG__.draft';
const input=document.querySelector('#draft'),button=document.querySelector('#save-draft'),status=document.querySelector('#draft-status');
try{input.value=localStorage.getItem(key)||'';}catch{}
const refresh=()=>{button.disabled=!input.value.trim();};refresh();
input.addEventListener('input',refresh);
document.querySelector('#draft-form').addEventListener('submit',event=>{event.preventDefault();try{localStorage.setItem(key,input.value);status.textContent='已保存到这台设备。';}catch{status.textContent='浏览器暂时无法保存，请复制保留草稿。';}});

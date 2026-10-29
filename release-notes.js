import {openModal,closeModal} from './motion.js?v=20261026-acceptance';

// Record shipped feature additions, removals and behavior changes only. Omit visual polish, copy edits and routine bug fixes.
export const releases=[
 {version:'2026.10.29.1',date:'2026-10-29',title:'把时间，写在照片背面',items:['拾光可保留并显示照片中的拍摄时间与地点，支持全相册时间正序、倒序及导入顺序浏览。','月份可直接横向切换；加载时可展示当前相册精选照片的缩略图。','大图支持翻转正反面的明信片：正面保留完整照片，背面由照片生成彩铅效果小画，可在横线上留下批注。']},
 {version:'2026.10.26.2',date:'2026-10-26',title:'随昼夜，一起变换',items:['颜色模式支持暗色、亮色与跟随系统，选择会保留，并在各页面间同步。']},
 {version:'2026.10.26.1',date:'2026-10-26',title:'共议，一起写与改',items:['可在当前页面的共议侧栏提出建议、回复与转交；建议可归属一个或多个网站，并汇入总站，新子页面沿用模板即可接入。','输入开头的【网站名】可指定归属；归属与进展支持多选筛选，关闭后保留草稿，对方回应会显示未读提醒。','进展统一为待议、处理中、已完成与暂不处理，可在讨论底部直接切换并自动保存。']},
 {version:'2026.10.24.1',date:'2026-10-24',title:'每一城，都有自己的相册',items:['拾光支持创建、重命名、删除相册，以及批量归类、上传到指定相册；删除相册会保留其中影像。','可按洲、国家、省州与城市查找已点亮的履痕，也可点击城市标题搜索切换；相册按月份浏览，支持连续加载与大图翻看。','可整批选择照片或导入文件夹，每批最多 200 份；上传中断后可重试未完成的资料。']},
  {version:'2026.10.23.2',date:'2026-10-23',title:'为回忆，选一组封面',items:['拾光支持展示共享封面，并可在封面大图之间连续翻看。照片助手可在本机进行画面主题识别、相似照片比较与封面初选，名称建议支持人工核对。']},
  {version:'2026.10.22.3',date:'2026-10-22',title:'把走过的路，收入拾光',items:[
    '履痕支持手动点亮城市，按真实行政区域高亮；选中国家或城市后，可以继续放大查看省州与城市边界。',
    '新增淡蓝色的「拾光」，按城市收入照片与短视频，两个人可以查看历史，在每份影像旁留下评论。',
    '导航新增版本手记，可以回看已上线的功能变化。']},
  {version:'2026.10.21.1',date:'2026-10-21',title:'信笺，写得更从容',items:[
    '传书可实时收发文字、图片与表情，并查看历史。',
    '日期选择支持滚轮切换月份与年份。']}
];
export function mountReleaseNotes(){
  const host=document.querySelector('.header-actions')||document.querySelector('.memory-header nav[aria-label="页面工具"]');
  if(!host||document.getElementById('version-button'))return;
  const main=host.classList.contains('header-actions'),button=document.createElement('button');
  button.id='version-button';button.type='button';button.className=main?'icon-button nav-tool':'line-action';
  button.setAttribute('aria-label','版本手记');button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','release-dialog');
  button.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 5h16v23H8ZM5 8h3m-3 6h3m-3 6h3M12 10h8M12 15h5M12 20h4"/><path d="m23 2 3 3-3 3-3-3ZM20 23l2 2 4-5"/></svg><span class="nav-caption" aria-hidden="true">版本</span>';
  host.append(button);
  const dialog=document.createElement('dialog');dialog.id='release-dialog';dialog.className='release-dialog';dialog.setAttribute('aria-labelledby','release-title');
  dialog.innerHTML='<div class="release-heading"><div><span class="release-eyebrow">有期 · 更新记录</span><h2 id="release-title">版本手记</h2></div><button type="button" class="release-close" aria-label="关闭版本手记" autofocus><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></div><p class="release-intro">这里，记下有期最近的变化。</p><ol class="release-list"></ol>';
  const list=dialog.querySelector('ol');
  for(const [index,release] of releases.entries()){
    const li=document.createElement('li'),meta=document.createElement('div');meta.className='release-meta';
    const time=document.createElement('time');time.dateTime=release.date;time.textContent=release.date.replaceAll('-',' / ');
    const version=document.createElement('span');version.textContent='v'+release.version;meta.append(time,version);
    if(index===0){const current=document.createElement('em');current.textContent='当前';meta.append(current);}
    const title=document.createElement('h3');title.textContent=release.title;const items=document.createElement('ul');
    for(const text of release.items){const item=document.createElement('li');item.textContent=text;items.append(item);}
    li.append(meta,title,items);list.append(li);
  }
  document.body.append(dialog);
  button.onclick=()=>openModal(dialog);
  dialog.querySelector('.release-close').onclick=()=>closeModal(dialog);
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeModal(dialog);});
  dialog.addEventListener('click',event=>{const rect=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))closeModal(dialog);});
}

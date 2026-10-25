import {openModal,closeModal} from './motion.js?v=20261026-acceptance';

// Keep this list limited to changes included in the deployed site.
export const releases=[
 {version:'2026.10.25.4',date:'2026-10-25',title:'共议，轻一点',items:['双击筛选只保留该项；点击外部可收起共议，建议与讨论统一整栏滚动。','进展收敛为待议、处理中、已完成与暂不处理，列表以不同颜色的印章标明状态；填写建议时可直接选择归属。']},
 {version:'2026.10.25.3',date:'2026-10-25',title:'想到了，就写下来',items:['共议的建议输入框常驻，归属与进展改为可多选的横向筛选，网站归属以各自主题色区分。','对方的新回应会显示站内未读提醒，手机更多入口也能看到提示；打开对应讨论后清除。']},
 {version:'2026.10.25.2',date:'2026-10-25',title:'随手共议',items:['共议改为当前页面内的侧栏，提建议、回应和标记进展无需离开页面；关闭后保留未发送的内容。','输入开头的【网站名】可自动指定归属，连续输入多个标记即可同时写给多个网站。']},
 {version:'2026.10.25.1',date:'2026-10-25',title:'一起写，一起改',items:['导航新增「共议」：主站可向一个或多个网站提出建议，子网站的建议同时汇入总览，并用独立的网站标记显示归属。','双方可回复、标记修订进展或转交；讨论与流转记录持续保留，新子页面沿用模板即可自动接入。']},
 {version:'2026.10.24.1',date:'2026-10-24',title:'从城名，去往下一城',items:['点击拾光的大字城市标题，即可搜索并切换所有已点亮的城市；列表优先展示同省州、同国家和同洲，并标明完整地区。']},
 {version:'2026.10.23.3',date:'2026-10-23',title:'让每一城，都有自己的相册',items:['拾光新增相册：支持创建、重命名、删除、批量归类和直接上传到相册；删除相册会保留其中影像。','拾光可按洲、国家、省州与城市查找已点亮的履痕；主站导航整合履痕入口，同步状态由有期标记的颜色表达。']},
  {version:'2026.10.23.2',date:'2026-10-23',title:'为回忆，选一组封面',items:['拾光支持展示共享封面，并可在封面大图之间连续翻看。照片助手可在本机进行画面主题识别、相似照片比较与封面初选，名称建议支持人工核对。']},
  {version:'2026.10.23.1',date:'2026-10-23',title:'把相册，带进每一城',items:[
    '拾光支持按月份浏览照片与视频，连续加载更多资料，也可以在大图中前后翻看。',
    '可以整批选择照片或导入文件夹，每批最多 200 份；上传中断后可重试未完成的资料。']},
  {version:'2026.10.22.3',date:'2026-10-22',title:'把走过的路，收入拾光',items:[
    '履痕支持手动点亮城市，按真实行政区域高亮；选中国家或城市后，可以继续放大查看省州与城市边界。',
    '新增淡蓝色的「拾光」，按城市收入照片与短视频，两个人可以查看历史，在每份影像旁留下评论。',
    '有期、履痕与拾光更新了线描标记；导航新增版本手记，可以随时回看最近的变化。']},
  {version:'2026.10.22.2',date:'2026-10-22',title:'让航程与足迹更清晰',items:[
    '飞机沿更长的航线，从西雅图飞往南京，机身、机翼与发动机细节得到细化。',
    '优化浅色模式的航线与国界；南京、绍兴高亮为完整城市区域，避免抵达标记遮挡。',
    '地球恢复有限制的旋转，保留在原界面中上滑放大的操作。']},
  {version:'2026.10.21.1',date:'2026-10-21',title:'信笺，写得更从容',items:[
    '传书采用覆盖式侧栏，输入文字或使用输入法时保持展开，避免打断书写；递函前可添加图片与表情。',
    '导航文字在图标右侧缓缓展开；书写时毛笔有动态效果，窗口打开与收起增加过渡。',
    '刷新等待时呈现飞机加载动画；日期选择支持滚轮切换月份与年份，航程百分比显示七位小数。']}
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

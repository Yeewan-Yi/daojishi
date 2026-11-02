const s=(title,body,target)=>({title,body,target});
const common=[
 s('有想法，就告诉对方','这里是“共议”。对网页有修改建议，可以在这里写下来，再一起回复、标记进展。','[data-suggestions-link]'),
 s('按你舒服的颜色看','点这个图标，可以在亮色、暗色和跟随系统之间切换。','#theme-button,#memory-theme,[data-theme-toggle]')
];
const versions=s('新功能，会记在这里','这是“版本手记”。以后网页添了新功能，可以在这里看看，再试着用起来。','#version-button');
const tours={
 main:[
  s('这里，等着你们的下一次相见','这是你们的倒计时。先看标题，就知道正在期待哪一天。','#event-title'),
  s('飞机飞过的，是已经走过的时间','地球上的航程和百分比，让这段等待看得见。按住地球拖动，可以换个方向看。','#journey-percent'),
  s('还有多久，在这里看','这些数字依次是天、时、分、秒。上下滚动页面，地球和倒计时会轮流成为主角。','#digits'),
  s('重要的日子，由你们来定','点这支铅笔，就能修改标题、开始时间和结束时间。修改后记得保存。','#edit-button'),
  s('想说的话，写一封信','这是“传书”。电脑把鼠标放上去、手机点一下，就能看往来；写好文字或附上图片后，点“递函”。','#letters-trigger'),
  s('走过的地方，也可以留下来','这是“履痕”。在里面选国家、省州和城市，点亮一起去过的地方，再翻开这一城的“拾光”。','.atlas-trigger'),
  s('把这份期待交给对方','点分享，再开启共同使用，复制链接发给对方，就能一起看、一起改。普通快照只保留分享时的设置。','#share-button'),
  ...common,versions
 ],
 memories:[
  s('这一页，收藏你们走过的地方','这里是“拾光”。现在看到的是这座城市的回忆，照片和视频都收在这里。','#city-title'),
  s('换个城市，接着翻','点城市大标题就能搜索切换。顶部也能按洲、国家、省州和城市，一步步找到去过的地方。','.destination-menu'),
  s('每一次旅行，可以收成一本相册','点相框展开相册，也能新建相册。以后按地点、旅行来分类，就不会全挤在一起。','.album-opener'),
  s('把这次的照片放进来','点“导入照片”，选照片或整个文件夹。确认城市、相册和日期后，点“收入拾光”。','#add-memory'),
  s('照片多了，也能很快找到','这里可以选月份、按拍摄时间排序；下面还能只看照片或视频。向下翻会继续加载。','.album-navigation'),
  s('照片的背面，可以留一句话','点照片打开大图，再点“翻面”，就像翻一张明信片。背面的横线上可以写批注，点“落笔”留下来。','.memory-image-button,#memory-gallery'),
  s('想回去看航程，点这里','这个箭头带你回到“有期”。当前的共同使用身份会一起带回去。','#home-link'),
  ...common,versions
 ],
 collaborate:[s('从这里，一起写新的一页','这是共筑页。先复制自己的开发仓库，再用下面的命令生成子页面模板。','.link-list'),s('照着这几步，就能开始','在自己电脑上做好页面、完成检查，再提交合并请求。对方审核后，页面就会接入正式网站。','.steps'),s('也把使用方法留给对方','模板已经带上指引。按第一次使用的顺序，写清页面能做什么、入口在哪里，让新页面也有人带着认识。','.rule-section'),...common],
 wheel:[s('这是金轮的效果预览','按住金轮拖动，就能改变角度；方向键也可以调整。这里只用示例，不会改变正式倒计时。','#wheel-control'),s('试试暂停，再换个进度','这里可以暂停轮转；拖动进度条，看看不同阶段的效果。','#pause')],
 assistant:[s('先由电脑帮你挑一挑','照片助手在本机分析画面，推荐封面和名称；最后用哪些，由你来决定。','#gallery'),s('选好以后，保存方案','最多勾选五张封面，名称也能直接修改。保存后留在本机，不会改动原文件。','#save')]
};
export function tourFor(page,content,custom=false){
 if(Array.isArray(content.tour)&&content.tour.length)return content.tour;
 if(!custom&&tours[page])return tours[page];
 return content.chapters.map(row=>s(row.title,row.summary,row.steps.find(step=>step.target)?.target));
}

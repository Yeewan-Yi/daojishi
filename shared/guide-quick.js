// Short task names and one action per step. Custom subpages keep their own copy.
const quick={
 countdown:['看倒计时','还要等多久，一眼就知道。',['数字是剩余的天、时、分、秒。','百分比表示这段等待已经走过多少。','上下滚动，试着在地球和数字之间切换。']],
 edit:['改时间和标题','换成你们自己的日子。',['点顶部的铅笔，打开编辑。','改标题，再选择开始和结束的日期、时间。','点保存。共同使用时，对方也会看到改动。']],
 globe:['转转地球','看看飞机飞到了哪里。',['按住地球拖动，就能换个方向看。','在地球区域滚动，可以放大。','想回到原来的角度？点“复位”。']],
 footprints:['点亮一座城','留下你们去过的地方。',['点顶部的“履痕”图标。','选国家、省州，再选城市。','点“点亮这一城”，将它留在地球上。','点“翻开拾光”，看看这一城的照片。']],
 letters:['给对方写封信','有话想说，就写在这里。',['电脑上把鼠标放到“传书”；手机点一下。','写下文字，也可以附图片或表情。','点“递函”。连接正常时，对方会自动收到。']],
 sharing:['一起使用','分享同一个倒计时。',['点顶部的分享图标。','想一起修改？先点“开启共同使用”。快照只保留当时的设置。','选择权限，复制链接，再发给对方。请保管好这个私人链接。']],
 cities:['换一座城','找到你想翻看的回忆。',['点大字城市名，搜索去过的城市。','也能从顶部按洲、国家、省州、城市逐级选。','想增加新城市？先回有期，在“履痕”里点亮。']],
 albums:['分成几个相册','按旅行或地点来收。',['点相框，展开这座城市的相册。','点“新建相册”，起个名字，再收好。','进入相册后，可以重命名。删除相册也会保留里面的照片。','点“选择影像”，就能把多张照片一起归入相册。']],
 import:['放进照片','把这次旅行，一次收好。',['先确认城市和相册，再点“导入照片”。','选照片，或选整个文件夹。每批最多 200 份。','按需要补好名称、日期和当时的话。','点“收入拾光”，等这一批完成。']],
 browse:['找照片','按月份、类型或时间来找。',['点月份，再选照片或影像，缩小范围。','选时间正序或倒序，按拍摄时间翻看。','往下浏览会继续加载；网格图标能调整照片大小。']],
 postcard:['看照片、写批注','翻到背面，留下当时的话。',['点一张照片，打开大图。','点“翻面”，看拍摄信息。文件有记录才会显示。','在背面的横线上写字，点“落笔”。','用左右箭头换照片，点 × 返回相册。']],
 appearance:['换颜色、找按钮','鼠标放到图标上，看看名字。',['电脑上悬停图标会显示名字；手机点“更多”找工具。','颜色按钮依次切换亮色、暗色、跟随系统。']],
 council:['提个修改建议','把想法留给对方。',['点顶部“共议”图标。','选建议属于哪个网页，写下想法，点“记下这笔”。','点开建议就能回复；底部的进展点一下就保存。','对方回应后，入口会提醒你。']],
 versions:['看看最近更新','了解网站又添了什么。',['点“版本”看最近新增或改变的功能。','忘记怎么用时，再打开指引，选你想做的事。','关闭指引，就能继续使用网页。']],
 start:['一起开发新页面','从现成模板开始。',['先点“复制开发仓库”，创建自己的副本。','按共筑页的命令生成新页面，用本机模式开发。','完成检查后提交合并请求，对方审核后上线。']],
 'guide-authoring':['给新页面加指引','让对方第一次打开也会用。',['模板已经带上入口，打开自己页面的 guide.js。','每件事用两三步讲清：点哪里、做什么、有什么结果。','随功能一起更新即可，不增加强制提交检查。']],
 draft:['试着写一句话','体验一下模板怎么用。',['在正文输入一句话。','点“保存本机草稿”。它只保存在这台设备。']],
 wheel:['拨一拨金轮','试试这个独立的效果预览。',['拖动金轮试试，也可以用左右方向键。','点暂停停止轮转；拖进度条看看不同阶段。']],
 review:['挑几张封面','电脑先推荐，最后由你选。',['先打开本机照片助手，等它读取结果。','勾选喜欢的照片，最多五张，也可以修改建议名称。','点“保存整理方案”。方案留在本机，不改原文件。']]
};
const targets={cities:['#city-title','.destination-menu','#home-link'],edit:['#edit-button','#start-date-button','#edit-form button[type="submit"]'],footprints:['.atlas-trigger','.atlas-country-picker select','.atlas-mark','.atlas-open-memories'],letters:['#letters-trigger','#letter-body','#letter-send'],sharing:['#share-button','#cloud-create','#copy-button'],import:['#add-memory','#drop-area','#memory-title','#save-memory']};
const opened={edit:'#edit-dialog[open]',footprints:'.atlas-trigger[aria-expanded="true"]',letters:'#letters-trigger[aria-expanded="true"]',sharing:'#share-dialog[open]',import:'#upload-dialog[open]',postcard:'#media-dialog[open]'};
export function quickTask(chapter){const row=chapter.id==='versions'&&!chapter.buttons?.some(b=>b.target==='#version-button')?['再看一遍','需要时随时回来。',['点顶部“指引”，随时重看。','点 × 收起，继续使用网页。']]:quick[chapter.id];return {...chapter,title:row?.[0]||chapter.title,summary:row?.[1]||chapter.summary,steps:chapter.steps.map((step,i)=>({...step,body:row?.[2][i]||step.body,...targets[chapter.id]?.[i]&&{target:targets[chapter.id][i]},...i===0&&opened[chapter.id]&&{advanceWhen:opened[chapter.id]}}))};}

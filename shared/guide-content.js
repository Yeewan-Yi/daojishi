const step=(title,body,target,hint)=>({title,body,...target&&{target},...hint&&{hint}});
const control=(label,description,target)=>({label,description,...target&&{target}});
const chapter=(id,title,summary,art,steps,buttons=[])=>({id,title,summary,art,steps,buttons});
const common=[
 chapter('appearance','颜色与导航','图标右侧的短标签，以及手机上的更多菜单。','navigation',[
  step('先认图标','电脑上将鼠标放到图标上，右侧会缓慢展开名称；键盘 Tab 也能查看。手机把次要按钮收进“更多”。'),
  step('按自己的习惯选颜色','依次切换亮色、暗色、跟随系统。“系统”表示随设备外观变化，选择会在本站页面间保留。','#theme-button,#memory-theme,[data-theme-toggle]','手机先打开“更多”；部分子页面会直接保留主题按钮。')
 ],[control('颜色模式','太阳是亮色，月亮是暗色，屏幕是跟随系统。','#theme-button,#memory-theme,[data-theme-toggle]'),control('更多','手机点此展开工具；点外部或按 Escape 收回。','.mobile-tools-toggle'),control('有期标记 / 返回','站内返回会保留当前共享上下文；外部链接不会获得私人分享信息。','[data-site-brand],#home-brand,.brand,#home-link')]),
 chapter('council','共议：一起提建议','给当前页、总站或多个页面留下建议，再一起回复和标记进展。','council',[
  step('打开共议','从导航里的共议图标进入；手机先打开“更多”。侧栏不会跳转到另一个网站。','[data-suggestions-link]'),
  step('直接写下建议','输入框常驻。选择一个或多个归属，也可在开头写【有期】【拾光】。子页面自己的归属会保留。','#proposal-body','先打开共议。'),
  step('筛选与回复','单击归属或进展可多选；双击只保留该项，键盘可用 Shift + Enter。打开建议后回复，在底部直接改进展，自动保存。'),
  step('留意回应提醒','对方回应会出现在共议入口的未读提示中。打开对应讨论后清除。本机演示不会发送给对方。')
 ],[control('记下这笔','提交建议，空内容不能提交。','#proposal-submit'),control('待议 / 处理中 / 已完成 / 暂不处理','表示建议当前进展；修改后无需另点确认。','#state-filter'),control('归属筛选','按网站找建议，支持同时看多个页面。','#site-filter'),control('刷新','主动重新读取建议。','#refresh-council'),control('关闭 / 点击侧栏外','收回共议，未发送草稿会保留。','[data-council-close]')]),
 chapter('versions','版本手记与本页指引','想知道最近增加了什么，或忘记一个按钮的用法。','navigation',[
  step('翻阅功能变化','版本手记只保留功能增加、删除和使用方式变化；小的视觉调整与普通修复不会单列。','#version-button','主站和拾光提供版本手记；手机入口在“更多”里。'),
  step('随时重看指引','指引不自动弹出。选择章节、搜索按钮名，或按“定位”查看页面中的对应位置；定位只提示，不替你提交或删除内容。','[data-guide-button]'),
  step('收起后继续操作','关闭指引或按 Escape，返回刚才的入口。说明中的示意图不包含你们的私人照片或数据。')
 ],[control('版本','查看已经上线的功能变化。','#version-button'),control('指引','打开当前页面的使用说明。','[data-guide-button]')])
];
export const pageGuides={
 main:{title:'有期',intro:'从一次期待开始，沿着航程，慢慢靠近。',chapters:[
  chapter('countdown','认识倒计时','数字表示剩余时间，地球上的航程表示已经走过的比例。','flight',[
   step('看剩余多久','翻页数字依次是天、时、分、秒；尚未开始时会先倒数至开始时刻，抵达后不显示负数。','#digits'),
   step('看已经走过多少','航程比例按设定的开始与截止时间计算，和倒计时在相同的秒边界更新；更多小数不代表额外计时精度。','#journey-percent'),
   step('切换观看重心','在主界面滚动：向倒计时方向滑动，数字逐渐成为主视觉；反方向滑到头后继续滚动，可以进一步放大地球。')
  ]),
  chapter('edit','设置标题与起止时间','两个人从同一个时间起点，望向同一个日子。','calendar',[
   step('进入编辑','点铅笔图标，修改标题、开始时间和截止时间。只有有编辑权限的共享链接能修改共享倒计时。','#edit-button'),
   step('选日期和时刻','点日期栏打开选择器，可切月份、年份和时间；鼠标滚轮可在对应区域调整日期，留意界面显示的本地时区。','#start-date-button,#end-date-button','先打开编辑窗口。'),
   step('保存或返回','确认开始早于截止后保存。保存成功才算完成；报错时保留输入，按提示修改或重试。取消或关闭不会提交这次改动。')
  ],[control('编辑','修改当前倒计时标题、起止时间。','#edit-button'),control('保存倒计时','校验日期并保存，有共享权限时同步给对方。','#edit-form button[type="submit"]'),control('取消 / ×','退出本次编辑，不提交修改。','#edit-dialog .close-dialog')]),
  chapter('globe','转动地球与航线','飞机从西雅图沿较长航线飞往南京。','flight',[
   step('拖动观看','在地球上拖动，查看不同方向；旋转范围有限制，以便保持观看舒适。手机也可拖动。','canvas.globe-canvas'),
   step('放大看细节','在航行区域滚动放大。进入履痕后，可用侧栏的 ＋ / − 进一步调整，不必反复退出。'),
   step('回到熟悉的视角','复位会平滑回到初始方向。地球获得键盘焦点时，可用方向键旋转，Home 复位。','#globe-reset')
  ],[control('复位','平滑恢复地球视角。','#globe-reset'),control('＋ / −','在履痕中进一步放大或缩小地图。','.atlas-lens')]),
  chapter('footprints','履痕：点亮去过的城市','高亮的是城市行政区域，不只是一个坐标点。','map',[
   step('打开履痕','点导航中的履痕；也可在地球足够放大时点击国家。','#memory-atlas,.atlas-trigger','先用导航中的履痕入口。'),
   step('选择国家、省州、城市','按层级选择。已有城市小按钮可直接切换，选择框会联动；海外城市需要共享连接来搜索边界。','.atlas-country-picker select','先打开履痕。'),
   step('点亮或取消','选中城市后点“点亮这一城”。已点亮的城市显示“取消点亮”，取消后不再作为已去过的履痕展示。更改需要自己的编辑身份。','.atlas-mark','先选中一个城市。'),
   step('翻开这一城的拾光','已点亮的城市可进入拾光，整理相册与影像。侧栏内滚动只控制侧栏，关闭后回到航程。','.atlas-open-memories','先选择一个已点亮城市。')
  ],[control('履痕','进入两个人的回忆地图。','.atlas-trigger'),control('城市小按钮','直接查看已经点亮的城市。','.atlas-cities'),control('点亮 / 取消点亮','改变去过状态，不是删除照片。','.atlas-mark'),control('翻开拾光','进入当前城市的相册。','.atlas-open-memories'),control('×','关闭履痕，回到航程。','.atlas-close')]),
  chapter('letters','传书：给对方递一封函','文字、图片和表情，都可以留在这封小信里。','letters',[
   step('展开传书','电脑将鼠标放到传书入口查看，移开会收起；编辑或使用输入法时会保持打开。手机点入口展开。','#letters-trigger'),
   step('写字、附图、加表情','先进入自己的传书身份，再输入内容。只有图片也可发送；图片会先准备为适合网页的副本。'),
   step('递函与回看','内容不为空时可递函。等待发送成功提示；发送失败时保留草稿供重试。共享连接下无需刷新整页查看对方的新函。')
  ],[control('传书','展开两人的历史往来。','#letters-trigger'),control('递函','将当前文字、图片与表情发送给对方。','#letter-send'),control('身份与分享','查看两个人各自的私人传书链接，分别使用自己的身份。','#letters-links-button'),control('更早的信','继续读取历史往来。','#letters-older'),control('修改 / 保存修改','自己的信可以修改；修改后保存，取消则回到新函草稿。','#letter-cancel'),control('图片 / 表情','把照片或 emoji 附入当前草稿，不会单独自动发送。','#letter-attach,#letter-emoji')]),
  chapter('sharing','分享与同步','网页地址和带权限的分享链接，作用并不相同。','sharing',[
   step('从分享入口生成链接','普通站点地址只打开网页，不自动进入同一个房间。分享窗口会区分快照与共同使用：快照固定当时的设置，只有开启共同使用后生成的完整链接才会持续同步。','#share-button'),
   step('分清身份与权限','按分享窗口说明使用自己的编辑或传书身份链接；不要把另一人的身份当作自己的链接，也不要公开私人分享链接。'),
   step('查看保存状态','有期标记的颜色和悬停说明表达同步、断网等状态。断网或出现保存错误时，按界面提示重试；本机演示不等于共享成功。')
  ],[control('分享','查看或生成当前可用的分享方式。','#share-button'),control('复制链接','复制当前权限对应的分享链接。','#copy-button'),control('开启共同使用','建立云端共享，成功后再把链接发给对方。','#cloud-create'),control('分享权限','选择窗口提供的查看或编辑权限。','#share-permission'),control('有期标记','返回首页，并通过颜色与提示查看连接状态。','.brand-mark')])
 ]},
 memories:{title:'拾光',intro:'把每一城的照片、影像和当时的话，慢慢收好。',chapters:[
  chapter('cities','换一座城','从已留下履痕的地方开始翻阅。','map',[
   step('从顶部按层级找','顶部按洲 → 国家 → 省州 → 城市展开，只展示已有履痕相关的目的地；未去过的洲呈灰色。','.destination-menu'),
   step('也可点大字城市名','城市标题下方原位展开搜索，不加盖弹窗。搜索已去过的城市，优先排列同省州、同国家和同洲。','#city-title'),
   step('想增加新目的地','先返回有期的履痕点亮新城市，再回拾光整理。站内返回会保留共享上下文。','#home-link')
  ],[control('城市大标题','搜索并切换已去过的城市。','#city-title'),control('返回航程','回到有期的地球与履痕。','#home-link'),control('返回顶部','向下浏览后出现，一键回到页首。','#memory-back-top')]),
  chapter('albums','用相册分类','同一座城市里，一次旅行、一个地点，都可以单独收成一本。','album',[
   step('点相框展开相册','相册以封面叠片显示。全部影像查看全城，未归类查看尚未放进相册的资料。','.album-opener'),
   step('原位新建','展开后点“新建相册”，输入名称再“收好”。未输入名称不能保存；失败后名称会保留。','.album-new','先展开相册。'),
   step('整理已有相册','进入具体相册后可重命名、删除。删除相册会把其中影像留在“未归类”，不会删除照片或视频。','#album-rename,#album-delete','先进入一个自建相册。'),
   step('批量归类','点“选择影像”，选中多份资料，再点“归入相册”；大图中的归入图标可只移动当前这一份。','#select-media')
  ],[control('相册 / 相框','展开封面叠片并选择分类。','.album-opener'),control('新建相册 / 收好','创建当前城市里的新相册。','.album-new'),control('重命名 / 删除','管理当前相册；删除保留影像。','#album-rename,#album-delete'),control('选择影像 / 归入相册','批量整理选中资料。','#select-media,#move-selection')]),
  chapter('import','导入照片与视频','整批导入、按需加载，让照片多起来也便于整理。','upload',[
   step('进入目标城市和相册','先确认当前城市；可以在导入窗口内指定收入哪个相册。','#add-memory'),
   step('选择文件或整个文件夹','可点击、拖入，或选择文件夹，每批最多 200 份。照片生成轻量副本；目前视频限 MP4 / WebM、单段 40 MB 和 10 分钟。','#drop-area','先打开导入窗口。'),
   step('补充名称、日期、当时的话','统一归档日期是可选的，和照片内读取的拍摄时间分别保留。自动读取仅使用文件中实际存在的信息，不猜测地点。'),
   step('收入拾光','等待这一批完成再离开。中断或失败后可重试未完成项，原文件需要自己另外保存。')
  ],[control('导入照片','打开批量导入窗口。','#add-memory'),control('选择整个文件夹','把文件夹中的支持资料加入待导入队列。','#choose-folder'),control('收入拾光','开始处理并保存待导入资料。','#save-memory')]),
  chapter('browse','按月份、类型和时间浏览','先缩小范围，再慢慢翻看。','album',[
   step('选相册、月份与类型','月份横条用于切换时间范围；全部 / 照片 / 影像用于筛选类型。','#month-track'),
   step('选择时间顺序','时间正序、时间倒序按照片拍摄信息与可用日期排序；最近导入按收入网站的顺序。没有拍摄信息时会使用可用归档日期。','.memory-order'),
   step('切网格、继续加载','网格按钮在紧凑与舒展展示间切换。向下继续浏览或点“再翻一页”加载更多；无需一次下载全相册原图。','#album-density')
  ],[control('月份横条','只查看所选月份的资料。','#month-track'),control('全部 / 照片 / 影像','筛选影像类型。','.media-filters'),control('时间正序 / 时间倒序 / 最近导入','改变整个列表的排序。','.memory-order'),control('网格图标','改变缩略图排列密度。','#album-density'),control('刷新 / 再翻一页','更新当前列表或读取下一批资料。','#refresh-memories,#more-memories')]),
  chapter('postcard','翻开照片的背面','正面完整看图，背面像明信片一样留字。','postcard',[
   step('点照片进入大图','正面按原比例显示完整照片。上一张 / 下一张连续翻看；键盘方向键也可切换。','.memory-image-button'),
   step('翻面看信息','点“翻面”或按 F。背面含本地生成的彩铅效果、邮戳、拍摄时间与地点（文件有记录时），以及留白邮编格；彩铅不是人工主体重绘。','#postcard-turn','先打开任意照片。'),
   step('在横线上留下批注','输入后点“落笔”。批注支持双人回看，未发送文字会按照片保留草稿；“批注”展开历史。视频或输入框获得焦点时，不会被照片快捷键打断。','#comment-body','先打开大图，再翻到背面。'),
   step('回到相册','× 或 Escape 关闭大图。切换另一张照片时会回到正面，视频翻到背面时会暂停。')
  ],[control('上一张 / 下一张','连续查看当前浏览集合。','#viewer-previous,#viewer-next'),control('翻面 / 看照片','切换明信片正反面，快捷键 F。','#postcard-turn'),control('归入相册图标','移动当前照片或视频。','#move-current'),control('落笔 / 批注','保存当前批注或展开已有批注。','#send-comment,.postcard-comments summary'),control('×','关闭大图，保留未发草稿。','.viewer-close')])
 ]},
 collaborate:{title:'共筑',intro:'各自写新的一页，也能像同一本书。',chapters:[
  chapter('start','从模板开始协作','用自己的副本开发，审核后接入正式站。','work',[
   step('复制开发仓库','登录自己的 GitHub，创建 Fork，再用 GitHub Desktop 克隆。不要共享账号密码。','.link-list a'),
   step('生成独立页面','按本页命令生成 pages/你的目录，使用本机演示内容开发，先读协作约定。'),
   step('检查并提交','完成手机与深浅主题检查，运行项目检查，提交 Pull Request；对方开发的新页由主项目审核合并。')
  ],[control('复制开发仓库','在 GitHub 创建自己的开发副本。','.link-list a'),control('看看子页面模板','预览公共风格和本机草稿示例。','.link-list a:nth-child(2)'),control('完整操作说明','查看协作步骤与资料保护约定。','.link-list a:nth-child(3)')]),
  chapter('guide-authoring','给新页面写一份指引','另一方接手或第一次使用时，也能找到入口。','navigation',[
   step('模板已经带入口','新页沿用 initSubsite，自动获得“指引”。在本页 guide.js 里写功能说明，不复制整套引导代码。'),
   step('按用户要做的事写','每章解释用途、入口、步骤与结果；按钮名称要与界面一致。选一个示意图，并给重要按钮填写定位选择器。'),
   step('随功能一起维护','新增或改变功能时顺手更新指引。说明本机/共享、权限、失败重试与手机操作；不用私人照片作示例。这里只作协作约定，不新增阻断提交的检查。')
  ])
 ]},
 starter:{title:'新篇',intro:'这是子页面模板的本机演示，不会自动双人同步。',chapters:[
  chapter('draft','留下一句本机草稿','体验模板的输入与保存，再替换成新页面自己的功能。','letters',[
   step('写一句话','在正文输入框中填写内容。只有本机草稿，不会传给对方。','#draft'),
   step('保存并查看结果','点“保存本机草稿”。成功提示表示当前浏览器已保存；清理网站数据可能丢失，保存失败时请复制保留。','#save-draft')
  ],[control('保存本机草稿','保存输入到当前浏览器，空内容不可保存。','#save-draft')])
 ]},
 wheel:{title:'金轮预览',intro:'独立的视觉实验，使用示例数据，不影响正式倒计时。',chapters:[
  chapter('wheel','拨动金轮','体验转动、暂停与示例进度。','flight',[
   step('拖动或用方向键','拖动金轮改变角度；金轮获得焦点后用左右方向键调整，空格暂停或继续。','#wheel-control'),
   step('暂停与试进度','暂停按钮控制轮转，进度滑杆只改变演示状态，关闭本页不会修改正式网站资料。','#pause')
  ],[control('暂停轮转 / 继续轮转','暂停或恢复金轮。','#pause'),control('复位','恢复示例的初始进度与转动状态。','#reset'),control('示例进度','试不同阶段的视觉效果。','input[type="range"]')])
 ]},
 assistant:{title:'照片助手',intro:'离线分析只在这台电脑运行，建议由你来决定。',chapters:[
  chapter('review','挑封面、核对名称','模型提供初选，你们保留最后的选择。','album',[
   step('读取整理结果','先通过本机启动脚本打开助手。照片、模型与分析结果留在本机，界面不是公开站点。'),
   step('选择与修订','勾选想用作封面的照片，最多五张；直接修改建议名称。名称不是识别事实，请人工核对。','#gallery'),
   step('保存方案','保存后写入本机整理方案，不会自动改原文件，也不会自动覆盖共享网站。重新离线分析会重新生成建议，需要等待模型完成。','#save')
  ],[control('重新离线分析','在本机重新运行模型分析，不使用云端 API。','#run'),control('保存整理方案','保存选中的封面与名称到本机。','#save')])
 ]}
};
export function guideFor(page){const base=pageGuides[page]||pageGuides.starter;return {...base,chapters:[...base.chapters,...(['wheel','assistant'].includes(page)?[]:common.map(row=>row.id==='versions'&&!['main','memories'].includes(page)?{...row,title:'重看本页指引',summary:'忘记一个按钮的用法时，随时回来看看。',steps:row.steps.slice(1),buttons:row.buttons.slice(1)}:row))]};}

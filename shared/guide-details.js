const groups={'#event-title':'认识有期','#journey-percent':'认识有期','#digits':'认识有期','#edit-button':'设置日子','#letters-trigger':'传书','.atlas-trigger':'履痕','#share-button':'共同使用','[data-suggestions-link]':'共议','#theme-button,#memory-theme,[data-theme-toggle]':'外观','#version-button':'版本手记','#city-title':'切换城市','.destination-menu':'切换城市','.album-opener':'整理相册','#add-memory':'导入资料','.album-navigation':'查找照片','.memory-image-button,#memory-gallery':'明信片','#home-link':'归航'};
const roots={edit:'#edit-dialog',date:'#date-dialog',letters:'#letters-panel',atlas:'#memory-atlas',share:'#share-dialog',council:'#council-panel',albums:'#album-picker-panel',albumNew:'#album-picker-panel',city:'#city-switch-panel',upload:'#upload-dialog',viewer:'#media-dialog',back:'#postcard-back'};
const d=(title,body,target,views=[])=>({title,body,target,views,fallback:roots[views.at(-1)]});
const details={
 '#journey-percent':[
  d('想回到熟悉的角度，点复位','拖动地球换视角；反方向滑到头后继续滑，可以再放大一点。想回到初始方向，点“复位”；地球获得焦点后也能按 Home。','#globe-reset')],
 '#digits':[
  d('还没开始与已经结束，也有对应的显示','开始前先倒数到起点；开始后才计算航程，结束后不会倒数成负数。数字与百分比一起更新。','#digits')],
 '#edit-button':[
  d('先给这次期待起个名字','这个输入框改的是页面大标题，最多 40 个字。这里只展示位置；你不需要真的修改。','#title-input',['edit']),
  d('起点和终点，分别在这里选','开始时间决定航程从哪里算，截止时间决定什么时候抵达。两项都按窗口标出的本地时区显示。','#start-date-button,#end-date-button',['edit']),
  d('先选年和月，不必逐月翻很久','这里可以直接输入年份、选择月份，也能用两侧箭头。鼠标停在对应区域上滚动，也可以调整。','#picker-year,#picker-month',['edit','date']),
  d('再选具体哪一天','点日历里的日期；在日历上滚轮切月份，按住 Shift 滚轮切年份。“今天”可以快速回到当天。','#picker-days',['edit','date']),
  d('别忘了具体的时刻','小时和分钟可以输入、点箭头，也能在对应数字上滚动。选好后，“选定此刻”才会带回编辑窗口。','.picker-time',['edit','date']),
  d('最后保存，才算改好','开始要早于截止。点“保存倒计时”后检查结果；取消或 × 则放弃本次改动。只读身份不能修改共享时间。','#edit-form .modal-actions',['edit'])],
 '#letters-trigger':[
  d('先分清两个人各自的身份','传书需要各自的专属链接。第一次按提示连接，已有身份就会看到历史；本机演示不会把信发给对方。','#letters-setup,#letters-book,#letters-local',['letters']),
  d('这块地方，就是写信的纸','在这里输入想说的话，最多 500 字。输入法选字时可以继续写，不必一直把鼠标留在入口上。','#letter-body',['letters']),
  d('也可以附图片和表情','图片按钮可以附最多三张图；表情按钮把 emoji 插进草稿。只有图片也能递函，不会因为点了附件就自动发出。','.letter-composer-tools',['letters']),
  d('写好了，再递出去','有内容时“递函”才可用。等发送成功；失败时草稿保留，可以重试。自己的旧信可以点“修改”，再保存修改。','#letter-send',['letters']),
  d('以前写过的话，都能往回翻','往来记录保存在传书里，“查看更早的书信”继续读历史。看到更新提示时，点它回到最新；专属链接里可找回自己的身份入口。','#letters-list,#letters-older',['letters'])],
 '.atlas-trigger':[
  d('从国家、省州，一步步找到城市','这几栏会联动。选国家，再选省州和城市；已点亮的小城市按钮可以直接切换。海外城市搜索需要共享连接。','.atlas-country-picker',['atlas']),
  d('想看得更仔细，用这两个按钮','＋ 和 − 可以继续放大、缩小地图。选中城市后，看的是城市区域，不只是一个点。','.atlas-lens',['atlas']),
  d('点亮、取消点亮和看回忆，都在选中城市后','选好城市，点“点亮这一城”；已去过的城市可取消点亮，也能“翻开拾光”。取消点亮不会删除照片。','.atlas-city-actions,.atlas-cities',['atlas'])],
 '#share-button':[
  d('先看清这是什么链接','快照只保存当时的标题和时间。想两边以后一起改，需要开启共同使用，再分享生成的链接。','#share-kind,#share-explanation',['share']),
  d('权限和复制，是两件事','共同使用后可选“共同编辑”或“仅查看”，再点复制。私人链接代表访问权限，请只交给对方；分享倒计时不等于冒用对方的传书身份。','#share-permission,#copy-button',['share']),
  d('保存和连接状态，看有期的标记','标记颜色表示同步、断网等状态，悬停能看说明。遇到保存或连接错误，按提示重试；本机保存不等于已经共享成功。','.brand-mark')],
 '[data-suggestions-link]':[
  d('想到了，就直接写在这里','常驻输入框写建议，下面选择归属。也可以在开头写【有期】【拾光】，一条建议同时写给多个页面。','#proposal-body',['council']),
  d('写好了，再记下这笔','有内容后，“记下这笔”才可用。提交前看看归属是否正确；从子页面提出时，会保留这个页面的归属，不会误投到别处。','#proposal-submit',['council']),
  d('这些按钮，帮你缩小查找范围','归属与进展都能多选；单击增减，双击只保留这一项。键盘也可用 Shift + Enter。不同网站的颜色能帮助区分。','.council-filters',['council']),
  d('打开一条建议，就能继续讨论','建议上方能看到提议人、时间和归属，右上的印章表示进展。点开后写回应；底部可直接改为待议、处理中、已完成或暂不处理，无需另点确认。','#proposal-list',['council']),
  d('要交给其他页面，可以调整归属','打开建议后展开“调整归属”，选择目标页面，可补一句说明，再点“保存归属”。只有修改进展是点选即保存，调整归属还需要这次确认。','#proposal-list',['council']),
  d('有了回应，会提醒你','入口上的未读提示表示有新的回应。打开对应讨论后会清除；刷新按钮可主动读取，关闭侧栏后未发的草稿会保留。','#refresh-council',['council'])],
 '#city-title':[
  d('点大字标题，就在原处搜索','输入城市、国家或省州，选择已去过的城市。同省州、同国家的结果会排在前面，不用退出拾光再回来。','#city-switch-search',['city'])],
 '.album-opener':[
  d('先看看这座城市有哪些相册','相框叠片就是各本相册；点封面即可切换。“全部影像”看整座城市，“未归类”看还没放进相册的照片。','.album-picker-grid',['albums']),
  d('新建相册，是在这里起名字','点“新建相册”后原位输入名称，再点“收好”。名称为空不能保存；失败后文字会留下，方便重试。','.album-create-inline',['albums','albumNew']),
  d('相册名字可以改，分类也可以调整','进入自己建的相册后，会出现重命名和删除。删除的是分类，里面的照片视频会回到未归类，不会一起删除。','.album-opener'),
  d('不用一张张搬，照片可以批量归类','点“选择影像”，勾选多份，再点“归入相册”。大图右上的归入图标，则只移动当前这一份。','#select-media')],
 '#add-memory':[
  d('文件可以点选，也可以拖进来','这里接受照片和支持的视频。可以选择整个文件夹，每批最多 200 份；选文件不会立刻上传。','#drop-area',['upload']),
  d('视频有大小限制，原件要另外留好','照片会生成轻量副本；当前视频支持 MP4、WebM，单段最多 40 MB、10 分钟。更大的视频请保留原件，等大容量存储接入。','#import-count,.upload-dropzone,#drop-area',['upload']),
  d('先确认收入哪一本相册','这批资料会进到当前城市。这里可选目标相册，再补这一批的名称和当时的话。','#upload-album',['upload']),
  d('归档日期和拍摄时间，不是一回事','统一归档日期是你指定的分类日期；照片自带的拍摄时间、地点会另外读取，没有记录就不猜。未指定归档日期时用文件修改日期。','#memory-date',['upload']),
  d('确认后再收入，途中失败也能重试','点“收入拾光”才开始处理与保存。等待本批完成再离开；失败时可重试未完成资料，不必重新选整批。','#save-memory',['upload'])],
 '.album-navigation':[
  d('先选月份，只看那段时间','横向月份条可以切换时间范围，“全部时光”回到完整相册。数量会跟随当前的相册和筛选显示。','#month-track'),
  d('按拍摄顺序看，或找最近导入的资料','时间正序、倒序按可用的拍摄时间与归档日期排列；“最近导入”则按收入网站的顺序。','.memory-order'),
  d('只看照片，或只看视频','这里切换全部、照片、影像。旁边的网格图标调整疏密；向下继续加载，或用刷新按钮更新列表。','.media-filters,#album-density'),
  d('往后翻，或者回到页首','“再翻一页”继续读取下一批资料；浏览到下方时，会出现只有箭头的返回顶部按钮，不必一直往上滚。','#more-memories,#memory-back-top,#memory-gallery')],
 '#wheel-control':[
  d('不用鼠标，也能拨动','先让金轮获得焦点，再用左右方向键调整角度，空格暂停或继续。','#wheel-control'),
  d('不同进度，也可以先试试看','拖动进度条，只会改变这个预览的示例状态。“复位”回到最初的示例，不影响正式倒计时。','#progress,#reset')],
 '#gallery':[
  d('封面先挑五张以内','勾选“选作封面”保留你喜欢的候选；建议名称可直接编辑，模型的主题判断也要人工核对。','#gallery'),
  d('需要重算时，再点离线分析','重新分析会重新生成建议。若有未保存的修改，请先处理；保存整理方案只写入本机，不会擅自覆盖网站标题或原文件。','#run')],
 '.memory-image-button,#memory-gallery':[
  d('先看完整照片，再左右翻','大图保留照片比例。两侧箭头或键盘左右键可以换图；视频在这里点播放，输入批注时不会被快捷键打断。','.viewer-navigation',['viewer']),
  d('点这里，把明信片翻到背面','“翻面”也可以用 F；输入文字或播放视频时，快捷键会避让。背面是照片生成的彩铅效果和写字的位置。','#postcard-turn',['viewer']),
  d('拍摄的时间和地点，在这里读','文件中有记录才会显示拍摄信息，没有就留空。邮戳用于呈现这段回忆，下方的六格邮编是明信片留白。','.postcard-capture',['viewer','back']),
  d('这几行，可以写下你的批注','写好后点“落笔”；空白内容不可提交。未发的文字会按照片保留，切换回来还能接着写。','#comment-body',['viewer','back']),
  d('点批注，翻看之前留下的话','这里展开已有批注；“更早的话”继续读历史。大图的归入图标可整理当前照片，× 或 Escape 回到相册。','.postcard-comments',['viewer','back'])]
};
export function detailedTour(steps){return steps.flatMap(step=>{const group=groups[step.target]||'认识这一页';return [{...step,group},...(details[step.target]||[]).map(row=>({...row,group}))];});}

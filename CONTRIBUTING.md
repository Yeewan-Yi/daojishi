# 一起开发有期

只需要 GitHub 账号、GitHub Desktop、Node.js 24 LTS，以及 VS Code 或自己习惯的 AI 编辑器。纯界面开发不需要付费 API、数据库密钥，也不需要主仓库管理员权限。

在线说明与模板预览：<https://yeewan-yi.github.io/daojishi/collaborate.html>

发布约定：主项目交由 Codex 维护的功能，在检查通过后由 Codex 合并并直接上线、核实部署结果。协作者开发的新子页面仍按下述 Fork / PR 流程提交，由主项目审核后合并；无需自行部署正式站。

## 第一次开始（推荐 Fork，不必互相共享账号）

1. 打开 <https://github.com/Yeewan-Yi/daojishi/fork>，登录自己的 GitHub 创建 Fork。上游是 `Yeewan-Yi/daojishi`，自己的副本位于自己的账号下。
2. 在自己的 Fork 页面点击 Code → Open with GitHub Desktop，将仓库克隆到本机。GitHub Desktop 中选择 Branch → New branch，命名如 `codex/our-story`，然后 Repository → Open in Visual Studio Code（也可用其他编辑器打开同一文件夹）。
3. 电脑安装 Node.js 24 LTS（<https://nodejs.org/>），安装后重新打开编辑器。在项目文件夹的终端运行：

```sh
npm ci
npm run new:page -- our-story "新篇"
npm start
```

打开 <http://127.0.0.1:4173/pages/our-story/?mode=local>。网站是普通 HTML/CSS/JavaScript，没有额外构建步骤。端口被占用可运行 `npm start -- 4174`，对应打开 4174。`Ctrl+C` 停止预览。HTML/JS/CSS 保存后刷新浏览器。

Windows PowerShell 如果提示「无法加载 npm.ps1，因为禁止运行脚本」，把命令中的 `npm` 改为 `npm.cmd` 即可，无需修改系统执行策略。若提示找不到 npm，请确认 Node.js 已安装，并重新打开编辑器。

4. 新功能主要写在 `pages/our-story/index.html`、`page.css`、`page.js`。生成器同时登记 `pages/registry.json`，无需自己改部署脚本。slug 换成简短英文目录名，标题可中文。若用 AI 编辑器，把在线协作页中的开工说明交给它，并描述想做的功能。
5. 完成运行 `node scripts/check-subsites.mjs`、`npm test`。在 GitHub Desktop 填写本次改动说明 → Commit → Publish branch / Push origin → Create Pull Request；网页中确认 **base repository 是 Yeewan-Yi/daojishi，base 是 main；head 是自己的 Fork 和分支**。
6. PR 写清功能、预览路径、截图、验证结果和未接入的接口。GitHub 自动检查通过后，由主项目审核合并。合并后 GitHub Pages 自动部署，新页会出现在协作页目录；正式导航图标和入口随后在同一 PR 或单独 PR 接入。

**Fork 的 Pages 不会自动得到本站部署权限**，请用本机预览。提交 PR 不会直接改线上网站；你不需要配置 GitHub Pages、Supabase 或云存储。

## 每次继续开发

先在自己的 Fork 网页点 Sync fork → Update branch，同步上游 main；再在 GitHub Desktop 切到 main，Fetch origin / Pull origin。新任务从最新 main 创建新分支。未完成的改动先提交到原分支，不要强行覆盖。若冲突不确定怎么处理，在 PR 标明，交给主项目一起解决。

同一时间一个人负责一个页面目录；公共文件修改应尽量少。`pages/registry.json` 同时登记冲突时保留双方条目，不要只保留自己的一项。不要提交 node_modules、测试资料、真实媒体或打包程序。

## 页面如何衔接

- 共用 `shared/subsite.css`、`shared/subsite.js`，参考 `docs/subsite-design.md`。
- 「共议」建议入口由 `initSubsite()` 自动加入导航；页面目录登记后即可在总览选择新页。无需重复开发评论功能，细节见设计规范的「共议」章节。
- `initSubsite({name:'页面名'})` 初始化主题和品牌；`siteLink('memories.html')` 生成保留当前站内上下文的链接。不能用它生成外部链接。
- 从主站接入时，主项目用现有 `journeyLink('pages/our-story/index.html')` 创建入口，维持共享房间上下文；不要手填别人的分享链接。
- 房间上下文仅沿同站链接传递，不发送到外站。Fork 演示用本地模式；没有共享链接时不要假定有云端身份。
- 本机草稿不等于双人同步。先交付可操作的演示界面，数据层需求写到 PR。需要照片/视频时沿用主项目媒体存储方案，不往 GitHub 放相册。

## 官方安装入口

- GitHub Desktop：<https://desktop.github.com/>
- Node.js：<https://nodejs.org/>
- VS Code：<https://code.visualstudio.com/>

无需提供自己的密码或 API Key；不懂 Git 命令也可以使用 GitHub Desktop 完成上述流程。

流程参考 GitHub 官方：[Fork 与 Pull Request](https://docs.github.com/en/get-started/exploring-projects-on-github/contributing-to-a-project)、[GitHub Desktop 克隆与 Fork](https://docs.github.com/en/desktop/adding-and-cloning-repositories/cloning-and-forking-repositories-from-github-desktop)。

## 页内共议与输入标记

共议在当前页面右侧展开，不再单开子页面。`initSubsite()` / `mountSuggestionLink()` 的接入方式保持兼容，新页面自动获得侧栏。关闭后保留建议和回复草稿；原共议网址会回到对应页面并展开侧栏。

输入开头的 `【拾光】建议正文` 会自动识别归属；`【有期】【拾光】建议正文` 指定多个网站。名称取自注册目录，也可用 `【page:our-story】` 或 `【our-story】`，总站别名为 `【总站】`。只有开头的标记会被解析，正文中的括号保持原样。未知或重名标记会提示更正，避免误投。子网站的原始归属始终保留，其他标记可增加目标。

本机预览：`index.html?mode=local&council=1`。模板开发仍用本机演示，不需额外数据库或凭证。

# 子页面设计与接入规范

目标：新页面像有期和拾光的自然延续，同时让两个人能独立开发，减少冲突。

## 视觉

优先复用 `shared/subsite.css` 的 `--paper`、`--ink`、`--muted`、`--line`、`--accent`、`--wash`。默认浅蓝灰 / 深黑蓝，页面可在自己的 CSS 中覆盖变量，但必须同时定义深浅两套。不要改共享样式只为满足自己的页面。

字体已在仓库中：汉字 `var(--font-han)`，普通数字 Times New Roman；航行主题 IBM Plex Mono；倒计时 Libre Baskerville。品牌和小图标从 `symbols.js` 复用，新增原创细线几何图标，避免直接拷贝游戏资源。

顶部品牌 → 页面名 → 站内导航和明暗图标；正文大标题下可有短引言。开放排版、细分隔线、充足留白，不要多层套卡片。图标悬停时文字在右侧慢慢展开，外轮廓不做胶囊。

普通筛选、选择、修改尽量就地展开，少遮挡页面。过渡约 250–500ms，明暗过渡约 600ms；加载快时不强制等待动画；长列表分页/按需加载，媒体缩略图优先，避免一次下载原图。`prefers-reduced-motion` 下关闭动画。

## 结构和接口

```text
pages/<slug>/index.html  本页结构
pages/<slug>/page.css    本页样式
pages/<slug>/page.js     本页业务
pages/<slug>/assets/     少量公开设计资源（不放私人影像）
shared/subsite.css      公共页面外观
shared/subsite.js       品牌、主题、站内链接
pages/registry.json     自动登记的子页面目录
```

模板使用相对路径，在 GitHub Pages 的 `/daojishi/` 子目录也能工作。不要把资源写成 `/shared/...` 或 `/vendor/...`。新资源使用本地预览服务器允许的扩展名；需要额外路径时说明原因。

主题存于 `youqi.theme`，与现有页面保持一致；站内返回保留分享上下文。本机草稿 key 需要页面独有前缀；不要用用户文字拼接 innerHTML，显示文字用 textContent。不要记录、转发或在截图中展示私人链接的 hash。

## 提交验收

- 桌面和窄屏可用，入口、关闭和返回可理解。
- 深浅主题可读，键盘可操作，表单有 label，异步状态有 role=status。
- 空白、加载、失败、成功状态有对应界面，操作不会跳出多余加盖弹窗。
- 本机演示与真实共享有清晰边界；权限由服务端校验。新增上传先确认存储位置和配额。
- `node scripts/check-subsites.mjs` 和 `npm test` 通过。
- PR 附完整预览路径、两种主题截图、已实现/未接入内容。

# 拾光本地照片助手

本地 CLIP 画面特征 + 清晰度与曝光初筛 + 相似照片去重 + 多样性推荐。模型权重固定到 `d15189d7028b43f1d3e65039190477f6af591c2a`，下载时核对官方 SHA-256。个人图片、embedding、分析结果与 review 均留在本机，禁止提交 GitHub。

已安装的 Windows 电脑：运行 `launch.ps1`，打开 http://127.0.0.1:4196 。关闭电脑后需要重新运行启动脚本。此地址仅绑定本机，不能用来给异地另一人访问；网站展示的封面结果另行同步到现有私有相册。

首次安装：`pnpm install --ignore-scripts` 后运行 `download-model.ps1`。模型保存在 `%LOCALAPPDATA%/YouqiModels`，不依赖模型提供商推理 API。运行期默认关闭远程模型访问，不自动联网补下载。Node.js CPU ONNX 推理已实测，暂未验证 GPU provider，不声称已启用 RTX 加速。

重新分析：`node analyze.mjs --manifest=照片清单.json --offline-test --out=output/hongshan.json`。清单为数组，每项含 `id`、本机 `source` 文件路径、可选 `title`；该标志禁用所有 fetch，用于验证完全离线推理。支持的画面主题是有限标签集，得分不是动物鉴定准确率。低置信度名称回退为通用标题，所有名称建议都需要核对，不自动重命名原件。

界面可重新推荐、手选最多五张封面、修改建议名称，并保存 `output/review.json`。保存只写本机。点击“同步封面到拾光”时，后台调用本机已经登录的 Supabase CLI，将封面选择同步到 `output/target.json` 指定的房间与城市；这一步需要网络，推理本身离线。管理凭证不会返回网页，HTTP 接口不接收 SQL。同步不会修改网站标题；建议名称仍保存在本机等待核对。不要把服务端密钥放进浏览器。此同步方案适用于网站管理者的电脑，不应作为公开多人服务部署。

偏好训练：有明确保存的至少四张封面选择及十张其他候选后，运行 `python train-preferences.py`。它训练 CLIP 特征上的小型排序头，执行留出验证并记录结果；不等同于重训 CLIP，也不自动采纳未通过验证的模型。目前没有人工偏好样本，因此未伪造训练记录。保留原有模型供对比，避免把小样本结果当作普遍审美。

模型来源：https://huggingface.co/Xenova/clip-vit-base-patch32 ，基于 OpenAI CLIP。输出只作整理建议；本机缓存、输出和原图须自行备份。

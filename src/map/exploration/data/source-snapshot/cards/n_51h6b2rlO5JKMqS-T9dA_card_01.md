# Anthropic 为 Claude 上线交互式可视化，免费用户可用；OpenAI、Google 同周押注 AI 从说变成画

2026年3月12日，Anthropic 宣布 Claude 可在对话中直接生成交互式图表、流程图和可视化内容，免费用户可用。两天前 OpenAI 给 ChatGPT 上了同类功能，更早 Google Gemini 也已动手——三家不约而同，但技术路线各不相同。

## Claude 的做法：不画像素图像，用 HTML/SVG 代码生成可交互的临时视觉

Claude 的交互式可视化走了一条非典型路径：不调用图像生成模型，而是用 HTML 和 SVG 代码渲染可点可展开的内容，本质是边聊边画的白板。

- **底层机制**：HTML/SVG 矢量图形渲染，与 Midjourney 等图像生成模型有本质区别
- **与 Artifacts 的差别**：Artifacts 是侧边栏可保存可分享的持久作品，对话内可视化是临时辅助——说一句当场改，对话往下走可能消失
- **主题范围**：不限主题，不限场景，任何可用代码表达的内容都能画（建筑受力分析、职业决策树、公司收入趋势）
- **已知局限**：The New Stack 记者测试发现标注位置偶有错误；复杂可视化生成约需 30 秒
- **可用性**：默认开启，免费用户可用，Web 和桌面端支持，移动端暂不支持

## 三种打法：OpenAI 做教科书、Google 做标注器、Anthropic 做白板

三家表面都在做交互式可视化，但定位和策略差别显著，各自绑定自身核心能力。

- **OpenAI — 预设主题教科书**：覆盖 70+ 个数学和科学主题（二项式展开、库仑定律等），每主题有专门设计的交互模块。超出 70 个主题不触发。定位面向高中生和大学生，配合已上线的 Study Mode 和 QuizGPT 形成教育产品矩阵。每周 1.4 亿用户用 ChatGPT 学数学和科学
- **Google — 围绕已有图像加标注**：AI 识别图中元素，自动生成可点击标签和解释面板（如点细胞图里的高尔基体弹出定义）。需要先有图才能交互。生态优势：LearnLM 教育模型、YouTube、Google Classroom 打通
- **Anthropic — 不限主题通用白板**：不用预设模板，用代码表达，可与 Figma、Canva、Slack 等第三方应用联动。配合今年 1 月上线的 Connectors，定位是连接生产力工具的视觉交互层

- **公司策略**：新智元分析，Anthropic 在文本和代码上投入大、多模态方向基本没投入，用代码画图而非图像生成是扬长避短
- **Digital Trends 报道**：Anthropic 把这次更新定义为让 Claude "学会选择最佳表达格式"——有时文字最好，有时图最好，有时可交互工具最合适
- **定价**：Claude 免费；ChatGPT 含在订阅中；Gemini Ultra 高级交互式图表每月 200 美元

## 链接

- 官方公告：https://claude.com/blog/claude-builds-visuals
- The Verge：https://www.theverge.com/ai-artificial-intelligence/893625/anthropic-claude-ai-charts-diagrams
- 原文：https://mp.weixin.qq.com/s/n_51h6b2rlO5JKMqS-T9dA

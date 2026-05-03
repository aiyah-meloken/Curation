# OpenClaw v2026.4.24 发布：DeepSeek V4 默认集成，语音可调用完整 Agent 能力

OpenClaw 于 2026 年 4 月 24 日发布版本更新，在一天前刚接入 GPT-5.5 之后，快速将 DeepSeek V4 Flash 和 Pro 纳入模型库。主要变动包括：DeepSeek V4 Flash 取代 deepseek-chat 成为默认模型；实时语音全面接入完整 Agent 工具调用能力；浏览器自动化新增坐标点击。

## DeepSeek V4 模型集成：Flash 成为默认

在 GPT-5.5 更新仅隔一天之后，OpenClaw 快速将 DeepSeek V4 系列纳入支持。

- **模型覆盖**：DeepSeek V4 Flash 和 V4 Pro 均可选，其中 Flash 在用户配置完 DeepSeek API 后自动设为默认模型——此前默认模型为 deepseek-chat
- **工具调用修复**：同步修复了后续工具调用回合中的重放和逻辑处理问题

## 实时语音从轻量回复升级为完整 Agent

新版语音的关键变化在于：AI 不再只给一个轻量回复后结束对话，而是可以将复杂问题移交给完整的 OpenClaw Agent 处理，再通过语音返回结果。

- **Realtime Voice Loops**：Talk、Voice Call 和 Google Meet 现在使用 realtime voice loops，支持调用完整 OpenClaw Agent 来给出更深层、带工具能力的回答
- **复杂问题处理链路**：当语音对话遇到需要查上下文、调用工具或深推理的问题时，Agent 代为处理后再将结果通过语音输出——此前语音模式下只能给轻量回复

## 浏览器自动化：坐标点击与超时延长

两个改进朝向"更像真人操控浏览器"，针对 DOM 不稳定和长时操作两类场景。

- **坐标点击**：新增基于视口坐标的点击能力，提供 `openclaw browser click-coords` CLI 命令，适用于 DOM 结构复杂、按钮难以通过选择器稳定定位的页面
- **超时延长**：浏览器操作的默认超时延长到 60 秒，减少正常但耗时较长的页面操作被客户端传输层提前判为失败的情况

## 稳定性风险延续，用户提醒 "更新需谨慎"

此次更新同步修复了 Telegram、Slack、MCP、会话和 TTS 等模块的问题，但社区反馈再次指向 OpenClaw 更新引入不稳定的模式。

- 有用户报告 OpenClaw 实例在更新后直接崩溃
- 社区评论称 OpenClaw 的更新"跟没做过测试似的"，量子位原文亦称"每次更新多少都会整点幺蛾子出来"，并直接在标题中提醒"更新新版需谨慎"

## 链接

- OpenClaw v2026.4.24 Release Notes：https://github.com/openclaw/openclaw/releases/tag/v2026.4.24
- 量子位原文：https://mp.weixin.qq.com/s/0A6x8S7Jv5tzE85QAq2cZQ

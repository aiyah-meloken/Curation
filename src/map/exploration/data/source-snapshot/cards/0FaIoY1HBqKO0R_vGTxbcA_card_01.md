# OpenClaw 2026.4.24 发布，DeepSeek V4 Flash 成为默认模型

OpenClaw 发布新版本 2026.4.24，DeepSeek V4 Flash 成为默认大模型，V4 Pro 也同步上线模型库。OpenClaw 是 GitHub 250k+ 星标的开源 Agent 框架，新用户启动后的首个对话模型即为 DeepSeek V4 Flash。

## DeepSeek V4 成为默认模型，多轮工具调用稳定性同步修复

这次模型层更新的核心变化是：DeepSeek V4 Flash 被设为 OpenClaw 默认模型，V4 Pro 同步上线模型库，同时工程团队针对多轮工具调用中的稳定性问题做了专项修复。

- **默认模型路径变更**：OpenClaw 新版启动后直接走 DeepSeek V4 Flash 路线，V4 Pro 可在模型库中选用。两个模型均支持 100 万 token 上下文，MIT 协议完全开源
- **V4 Flash 规格**：284B 总参数，13B 激活参数，MoE 架构。在 Max 推理模式下能力几乎追平 Pro 版本
- **V4 Pro 规格**：1.6 万亿总参数，49B 激活参数，MoE 架构，是目前全球最大的开源模型
- **工具调用修复**：此前 DeepSeek 在多轮工具调用中因 reasoning_content 缺失触发 provider replay 检查错误，新版本补齐了占位逻辑，使 V4 双版本在长链路 Agent 任务中更稳定

## 会议与语音成为一级入口，Agent 可主导完整参会流程

这些能力变化的核心逻辑是：OpenClaw 不再只是聊天界面背后的模型调用者，而是将会议和电话变成了 Agent 可直接运行的执行环境。

- **Google Meet 成为内置插件**：支持个人谷歌账号授权、显式会议 URL 加入、Chrome 和 Twilio 实时传输。会议结束后可处理录音、转写、智能笔记并导出为 Markdown
- **实时语音可调用完整 Agent**：通过 openclaw_agent_consult，电话或会议中的问题可交给后台 Agent 处理，Agent 再调用工具、查询上下文、组织答案并以语音返回，不再局限于转写和记录
- **Voice Call 新增预检机制**：smoke command 在真实拨号前检查 Twilio 等 provider 是否就绪
- **新增 Gemini Live 语音后端**：Google provider 侧新增双向音频和函数调用支持，Gateway/VoiceClaw 加入基于 Gemini Live 的 realtime brain WebSocket endpoint

## 链接

- OpenClaw 2026.4.24 Release Notes：https://github.com/openclaw/openclaw/releases/tag/v2026.4.24

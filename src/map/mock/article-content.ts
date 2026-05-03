// Atlas — mock article content map.
// Keyed by article_id; AtlasPreviewDrawer reads from here when opened.

import type { ArticleContent } from "../types";

const tpl = (
  id: string,
  title: string,
  account: string,
  publish_time: string,
  body: string,
): ArticleContent => ({
  id,
  title,
  account,
  publish_time,
  content_md: body,
});

export const mockArticleContent: Record<string, ArticleContent> = {
  art_qbw_deepseek: tpl(
    "art_qbw_deepseek",
    "DeepSeek-V4 Pro API 限时 2.5 折",
    "量子位",
    "2026-04-26T09:32:00+08:00",
    `**DeepSeek-V4 Pro 模型 API 限时 2.5 折**

智元二六年四月二十六日，DeepSeek 实验室宣布其下一代 V4-Pro 模型 API 限时优惠，输入（缓存命中场景）降至每百万令牌 0.25 元，输出端 1 元，相较前一代下降 75%。

## 模型结构

- 沿袭 V3 的 MoE 架构（激活参数 37B）
- 训练数据扩展至 12T tokens
- 在多个跑分上越过 GPT-4o

## 价格规划

下半年随昇腾 950 大规模量产，预期单位推理成本将再次砍半。

社区在不到一周时间复现了训练曲线，多家媒体（量子位、机器之心、两光年、极客公园、硅星人）同步报道，构成今日舆图最显著的"主城"。`,
  ),

  art_2ly_deepseek_open: tpl(
    "art_2ly_deepseek_open",
    "DeepSeek 开源 V4 系列",
    "两光年",
    "2026-04-26T10:15:00+08:00",
    `**DeepSeek 开源 V4 系列：代码与 Agent 能力逼近闭源旗舰**

DeepSeek 团队发布了 V4 系列的完整开源版本，包含权重、训练配方与评测脚本。社区在一周内即复现了核心训练曲线。

代码生成、Agent 工具调用两类基准测试上，开源版本与闭源旗舰差距已缩小至 5 个百分点以内。`,
  ),

  art_2ly_mimo: tpl(
    "art_2ly_mimo",
    "小米推出 MiMo-V2.5 系列",
    "两光年",
    "2026-04-26T11:02:00+08:00",
    `**小米推出 MiMo-V2.5 系列：长程 Agent 任务对标头部闭源**

小米 AI 实验室发布 MiMo-V2.5 系列模型，参数规模在 7B 到 72B 之间。在长程 Agent 任务（>30 步）上对标头部闭源模型，且体积优化到端侧可跑。`,
  ),

  art_2ly_hunyuan: tpl(
    "art_2ly_hunyuan",
    "腾讯发布混元 Hy3 preview",
    "两光年",
    "2026-04-26T13:20:00+08:00",
    `**腾讯发布混元 Hy3 preview**

姚顺雨主导重建后首次开源。参数规模未披露，初步评测在中文长文本生成与多模态对齐上有显著改进。`,
  ),

  art_zartbot_v4_deep: tpl(
    "art_zartbot_v4_deep",
    "DeepSeek-V4 算法与模型结构深度分析",
    "zartbot",
    "2026-04-26T07:45:00+08:00",
    `**DeepSeek-V4 算法与模型结构深度分析**

> 本文是原文推送，由 zartbot 撰写，作技术解读用。

从注意力变体（multi-head latent attention）到 KV 压缩（4-bit cache）到 MoE 路由（top-2 selection with auxiliary loss），逐项剖析 V4 的工程化决策。

每个章节配伍论文截图与代码片段，是 V4 这次升级中**为何**这么做的"why" 文档。`,
  ),

  art_qbw_skvm: tpl(
    "art_qbw_skvm",
    "SkVM：面向 Skill 的语言虚拟机",
    "量子位",
    "2026-04-26T14:18:00+08:00",
    `**SkVM：面向 Skill 的语言虚拟机**

SkVM 通过编译优化消除 Skill 与底层模型间的语义鸿沟。关键想法：把 Skill 描述（自然语言 + 几个例子）编译为模型友好的 prompt + decoding constraint。

吞吐提升 30%，调用稳定性显著上升。`,
  ),

  art_zxx_rail: tpl(
    "art_zxx_rail",
    "Rail-Optimized GPU 网络",
    "智猩猩芯算",
    "2026-04-26T16:50:00+08:00",
    `**Rail-Optimized GPU 网络**

将 GPU 之间的集合通信路径映射到并行独立网络轨道（rails）的 Clos 拓扑。每条 rail 服务一份 all-reduce 数据流，跨 rail 互不干扰。

在 1024 卡训练上，AllReduce 时间下降 18%。`,
  ),

  art_xzy_lyra: tpl(
    "art_xzy_lyra",
    "Lyra 2.0：单图生成可漫游 3D 世界",
    "新智元",
    "2026-04-26T15:10:00+08:00",
    `**Lyra 2.0：单图生成可漫游 3D 世界**

Lyra 2.0 将单张 2D 图片输入，通过隐式 NeRF + 时序一致性模型生成长时程可漫游的 3D 场景。

支持任意视角推理 30 秒视频，无需多视图或深度监督。`,
  ),

  art_2ly_gptimg: tpl(
    "art_2ly_gptimg",
    "GPT Image 2 全量推送",
    "两光年",
    "2026-04-26T17:00:00+08:00",
    `**GPT Image 2 全量推送，中文文字渲染突破**

OpenAI 推送 GPT Image 2，最显著改动是中文文字渲染——能输出商用海报、菜单、招牌级别的中文文字，告别上一代"乱码字"问题。`,
  ),

  art_jqzx_openclaw: tpl(
    "art_jqzx_openclaw",
    "OpenClaw 2026.4.24 发布",
    "机器之心",
    "2026-04-26T08:05:00+08:00",
    `**OpenClaw 2026.4.24 发布**

> 本日舆图最大主城——多家媒体同步覆盖。

- 默认集成 DeepSeek V4 Flash 模型
- 原生 MCP 支持（参考实现）
- 多窗口并行编排
- 语音可调用完整 Agent

四家以上媒体（机器之心、新智元、量子位、极客公园）当日同步报道，被舆图聚合为一座"主城"——视觉上的显眼大圆。`,
  ),

  art_2ly_gpt55: tpl(
    "art_2ly_gpt55",
    "OpenAI 发布 GPT-5.5",
    "两光年",
    "2026-04-26T12:00:00+08:00",
    `**OpenAI 发布 GPT-5.5**

GPT-5.5 从聊天模型转向自主智能体。Pro 版本在 LisanBench 视觉智测中得 145 分，首次跨过门萨俱乐部 130 分门槛。

定价同步更新，企业版包含浏览器自主操作能力。`,
  ),

  art_xzy_clawsweeper: tpl(
    "art_xzy_clawsweeper",
    "ClawSweeper：50 Codex 并发扫描",
    "新智元",
    "2026-04-26T18:30:00+08:00",
    `**ClawSweeper：50 Codex 并发扫描，一天关闭 50 个 issue**

OpenClaw 创始人发布 ClawSweeper：一个把 50 个 Codex 实例并发跑起来扫描 GitHub 仓库 issue 的 AI 维护工具。一天关闭 50 个真实 issue。`,
  ),

  art_xzy_anthropic_viz: tpl(
    "art_xzy_anthropic_viz",
    "Anthropic 为 Claude 上线交互式可视化",
    "新智元",
    "2026-04-26T19:15:00+08:00",
    `**Anthropic 为 Claude 上线交互式可视化**

Claude 内置交互式可视化能力，免费用户即可使用。OpenAI、Google 同步跟进类似能力。`,
  ),

  art_jqzx_jianying: tpl(
    "art_jqzx_jianying",
    "剪映上线 AI 助手",
    "机器之心",
    "2026-04-26T20:00:00+08:00",
    `**剪映上线 AI 助手：自然语言操控视频剪辑**

剪映 12.0 发布。内置 AI 助手以自然语言操控剪辑流程，支持批量操作、素材调用、智能文案生成。`,
  ),

  art_jqzx_mathforge: tpl(
    "art_jqzx_mathforge",
    "MathForge：难度感知的 RL 数学推理",
    "机器之心",
    "2026-04-26T11:30:00+08:00",
    `**MathForge：难度感知的强化学习提升大模型数学推理**

MathForge 框架以题目难度作为 RL 信号，让模型在难题上分配更多算力，简单题快速跳过。

数学竞赛级数据集上，比 vanilla GRPO 准确率高 7 个百分点，推理长度短 22%。`,
  ),

  art_jqzx_rebalance: tpl(
    "art_jqzx_rebalance",
    "ReBalance：动态调控推理深度",
    "机器之心",
    "2026-04-26T13:45:00+08:00",
    `**ReBalance：利用模型自身置信度信号动态调控推理深度**

ReBalance 用模型对当前候选答案的置信度作为推理深度调控器：高置信即停，低置信继续 think harder。

跨多个推理基准：精度提升 10.0%，推理 token 长度压缩 35%。`,
  ),

  art_jqzx_verifier: tpl(
    "art_jqzx_verifier",
    "LLM-as-a-Verifier",
    "机器之心",
    "2026-04-26T15:50:00+08:00",
    `**LLM-as-a-Verifier：通过扩展验证计算提升 Agent 轨迹选择**

把 LLM 用作 Agent 轨迹的 post-hoc verifier，验证算力可独立扩展。

在 ReAct / ReWOO 等多个 agent 框架上，扩展 verifier 算力可换取 6-12% 的成功率提升。`,
  ),

  art_jqzx_learning: tpl(
    "art_jqzx_learning",
    "Learning Mechanics：深度学习第一性原理",
    "机器之心",
    "2026-04-26T16:20:00+08:00",
    `**Learning Mechanics：五条理论线索汇聚为深度学习的第一性原理框架**

综述论文，整理深度学习近五年的理论进展，归纳为五条核心线索：

1. NTK / 无限宽度极限
2. SGD 隐式正则化
3. 神经网络几何与 ODE 流
4. 表示学习与 emergent 现象
5. Scaling laws 的解析根

提出统一框架草案。`,
  ),

  art_fb_prompt: tpl(
    "art_fb_prompt",
    "间接提示注入进入真实网络",
    "FreeBuf",
    "2026-04-26T10:30:00+08:00",
    `**间接提示注入攻击从概念验证进入真实网络**

Google 安全团队与 Forcepoint 同时捕获到规模化的间接提示注入攻击载荷——通过被攻击者伪造的网页注入恶意 prompt，AI Agent 抓取后被劫持。

距离学术界首篇 PoC 论文不到一年，工业界已开始大规模观测到。`,
  ),

  art_xzy_epoch: tpl(
    "art_xzy_epoch",
    "Epoch AI 万人调研",
    "新智元",
    "2026-04-26T18:00:00+08:00",
    `**Epoch AI 美国万人调研：公司付费是 AI 进入工作的开关**

Epoch AI 对美国上班族的万人级调研显示：

- 公司付费 AI 工具的员工，AI 工作内嵌入率从 38% 跃至 76%
- "产出"指标正在取代"使用量/token 消耗"成为度量基线
- 部分公司（如 Box, Axon）将 AI 激励直接绑定业务交付`,
  ),
};

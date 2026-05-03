// Atlas — mock cards (~20 of today's cards).
//
// Source: curated subset of curation-dataset/dedup-set/original/2026-04-26/
// (47 real cards), backed up at src/atlas/exploration/data/source-snapshot/.
//
// Real fields: card_id, title, description, source account, article_date.
// Mocked atlas tags (not in source data yet):
//   atlas_topic (inline AtlasTopicRef), entities (formerly shared_entities), read.
// Note: source_count is always 1 in v1 (aggregate cards removed).
//
// TODO: update mock data shape after schema change — preview may be temporarily
// broken content-wise (topic label / domain_label are stubs); main app
// inbox-derived path is the source of truth and works correctly.

import type { AtlasCard } from "../types";
import type { AtlasTopicRef } from "../../types";

// Minimal topic stub map (id → AtlasTopicRef) so mock data type-checks.
// Labels are placeholders; real labels come from the server in production.
const MOCK_TOPICS: Record<string, AtlasTopicRef> = {
  pretrain:   { id: "pretrain",  label: "预训练",  domain_id: "ai_models", domain_label: "AI 模型", domain_latin_label: "AI MODELORVM" },
  inference:  { id: "inference", label: "推理",    domain_id: "ai_models", domain_label: "AI 模型", domain_latin_label: "AI MODELORVM" },
  vision:     { id: "vision",    label: "视觉",    domain_id: "ai_models", domain_label: "AI 模型", domain_latin_label: "AI MODELORVM" },
  agent:      { id: "agent",     label: "Agent",   domain_id: "ai_products", domain_label: "AI 产品", domain_latin_label: "AI PRODUCTA" },
  coding:     { id: "coding",    label: "编程助手", domain_id: "ai_products", domain_label: "AI 产品", domain_latin_label: "AI PRODUCTA" },
  media:      { id: "media",     label: "多媒体",  domain_id: "ai_products", domain_label: "AI 产品", domain_latin_label: "AI PRODUCTA" },
  paper:      { id: "paper",     label: "论文",    domain_id: "academic",    domain_label: "学术",    domain_latin_label: "ACADEMIA" },
  review:     { id: "review",    label: "综述",    domain_id: "academic",    domain_label: "学术",    domain_latin_label: "ACADEMIA" },
  attack:     { id: "attack",    label: "攻击手法", domain_id: "security",   domain_label: "AI 安全", domain_latin_label: "SECURITAS" },
  survey:     { id: "survey",    label: "产业调研", domain_id: "industry",   domain_label: "产业观察", domain_latin_label: "INDUSTRIA" },
};

const mk = (
  partial: Pick<AtlasCard, "card_id" | "article_id" | "title" | "description"> & {
    account: string;
    publish_time: string;
    atlas_topic_id: string;
    entities: string[];
    read?: boolean;
    routing?: "ai_curation" | "original_content_with_pre_card" | "original_content_with_post_card";
  },
): AtlasCard => ({
  card_id: partial.card_id,
  article_id: partial.article_id,
  title: partial.title,
  description: partial.description,
  routing: partial.routing ?? "ai_curation",
  subtype: null,
  entities: partial.entities,
  atlas_topic: MOCK_TOPICS[partial.atlas_topic_id] ?? {
    id: partial.atlas_topic_id,
    label: partial.atlas_topic_id,
    domain_id: "unknown",
    domain_label: "Unknown",
    domain_latin_label: null,
  },
  article_date: "2026-04-26",
  read_at: partial.read ? "2026-04-26T20:00:00+08:00" : null,
  queue_status: null,
  article_meta: {
    title: partial.title,
    account: partial.account,
    biz: null,
    author: null,
    publish_time: partial.publish_time,
    url: `https://mp.weixin.qq.com/s/${partial.article_id}`,
    cover_url: null,
    digest: null,
  },
});

export const mockAtlasCards: AtlasCard[] = [
  // ===== AI 模型 / 预训练 =====
  mk({
    card_id: "c1",
    article_id: "art_qbw_deepseek",
    title: "DeepSeek-V4 Pro API 限时 2.5 折",
    description:
      "输入（缓存命中）降至 0.25 元/百万 token；下半年随昇腾 950 量产将进一步降价",
    account: "量子位",
    publish_time: "2026-04-26T09:32:00+08:00",
    atlas_topic_id: "pretrain",
    entities: ["DeepSeek"],
  }),
  mk({
    card_id: "c2",
    article_id: "art_2ly_deepseek_open",
    title: "DeepSeek 开源 V4 系列",
    description: "代码与 Agent 能力逼近闭源旗舰，社区一周复现训练曲线",
    account: "两光年",
    publish_time: "2026-04-26T10:15:00+08:00",
    atlas_topic_id: "pretrain",
    entities: ["DeepSeek"],
  }),
  mk({
    card_id: "c3",
    article_id: "art_2ly_mimo",
    title: "小米推出 MiMo-V2.5 系列",
    description: "长程 Agent 任务对标头部闭源模型，体积压缩到 7B",
    account: "两光年",
    publish_time: "2026-04-26T11:02:00+08:00",
    atlas_topic_id: "pretrain",
    entities: [],
  }),
  mk({
    card_id: "c4",
    article_id: "art_2ly_hunyuan",
    title: "腾讯发布混元 Hy3 preview",
    description: "姚顺雨主导重建后首次开源，参数规模未披露",
    account: "两光年",
    publish_time: "2026-04-26T13:20:00+08:00",
    atlas_topic_id: "pretrain",
    entities: [],
    read: true,
  }),

  // ===== AI 模型 / 推理 =====
  mk({
    card_id: "c5",
    article_id: "art_zartbot_v4_deep",
    title: "DeepSeek-V4 算法与模型结构深度分析",
    description: "从注意力变体到 KV 压缩到 MoE 路由的工程化分析",
    account: "zartbot",
    publish_time: "2026-04-26T07:45:00+08:00",
    atlas_topic_id: "inference",
    entities: ["DeepSeek"],
    routing: "original_content_with_post_card",
  }),
  mk({
    card_id: "c6",
    article_id: "art_qbw_skvm",
    title: "SkVM：面向 Skill 的语言虚拟机",
    description: "通过编译优化消除 Skill 与模型间的语义鸿沟",
    account: "量子位",
    publish_time: "2026-04-26T14:18:00+08:00",
    atlas_topic_id: "inference",
    entities: [],
  }),
  mk({
    card_id: "c7",
    article_id: "art_zxx_rail",
    title: "Rail-Optimized GPU 网络",
    description: "将集合通信映射到并行独立网络轨道的 Clos 拓扑",
    account: "智猩猩芯算",
    publish_time: "2026-04-26T16:50:00+08:00",
    atlas_topic_id: "inference",
    entities: [],
    read: true,
  }),

  // ===== AI 模型 / 视觉模型 =====
  mk({
    card_id: "c8",
    article_id: "art_xzy_lyra",
    title: "Lyra 2.0：单图生成可漫游 3D 世界",
    description: "从单张 2D 图片生成可漫游的长时程 3D 场景",
    account: "新智元",
    publish_time: "2026-04-26T15:10:00+08:00",
    atlas_topic_id: "vision",
    entities: [],
  }),
  mk({
    card_id: "c9",
    article_id: "art_2ly_gptimg",
    title: "GPT Image 2 全量推送",
    description: "中文文字渲染实现突破，海报级输出",
    account: "两光年",
    publish_time: "2026-04-26T17:00:00+08:00",
    atlas_topic_id: "vision",
    entities: ["OpenAI"],
  }),

  // ===== AI 产品 / Agent =====
  mk({
    card_id: "c10",
    article_id: "art_jqzx_openclaw",
    title: "OpenClaw 2026.4.24 发布",
    description: "默认集成 DeepSeek V4 Flash，原生 MCP 支持，多家媒体同步覆盖",
    account: "机器之心",
    publish_time: "2026-04-26T08:05:00+08:00",
    atlas_topic_id: "agent",
    entities: ["DeepSeek", "OpenClaw"],
  }),
  mk({
    card_id: "c11",
    article_id: "art_2ly_gpt55",
    title: "OpenAI 发布 GPT-5.5",
    description:
      "从聊天模型转向自主智能体；Pro 在 LisanBench 跨过门萨 130 门槛",
    account: "两光年",
    publish_time: "2026-04-26T12:00:00+08:00",
    atlas_topic_id: "agent",
    entities: ["OpenAI"],
  }),
  mk({
    card_id: "c12",
    article_id: "art_xzy_clawsweeper",
    title: "ClawSweeper：50 Codex 并发扫描",
    description: "OpenClaw 创始人发布，一天关闭 50 个 GitHub issue",
    account: "新智元",
    publish_time: "2026-04-26T18:30:00+08:00",
    atlas_topic_id: "agent",
    entities: ["OpenClaw"],
  }),

  // ===== AI 产品 / 编程助手 =====
  mk({
    card_id: "c13",
    article_id: "art_xzy_anthropic_viz",
    title: "Anthropic 为 Claude 上线交互式可视化",
    description: "免费用户可用；OpenAI、Google 同步跟进",
    account: "新智元",
    publish_time: "2026-04-26T19:15:00+08:00",
    atlas_topic_id: "coding",
    entities: ["Anthropic"],
    read: true,
  }),

  // ===== AI 产品 / 多媒体 =====
  mk({
    card_id: "c14",
    article_id: "art_jqzx_jianying",
    title: "剪映上线 AI 助手",
    description: "自然语言操控视频剪辑，支持批量操作和智能文案",
    account: "机器之心",
    publish_time: "2026-04-26T20:00:00+08:00",
    atlas_topic_id: "media",
    entities: [],
  }),

  // ===== 学术 / 论文 =====
  mk({
    card_id: "c15",
    article_id: "art_jqzx_mathforge",
    title: "MathForge：难度感知的 RL 数学推理",
    description: "通过难度感知的强化学习提升大模型数学推理效率",
    account: "机器之心",
    publish_time: "2026-04-26T11:30:00+08:00",
    atlas_topic_id: "paper",
    entities: ["RLHF"],
  }),
  mk({
    card_id: "c16",
    article_id: "art_jqzx_rebalance",
    title: "ReBalance：动态调控推理深度",
    description: "利用模型自身置信度信号；精度 +10%，推理长度 −35%",
    account: "机器之心",
    publish_time: "2026-04-26T13:45:00+08:00",
    atlas_topic_id: "paper",
    entities: [],
  }),
  mk({
    card_id: "c17",
    article_id: "art_jqzx_verifier",
    title: "LLM-as-a-Verifier",
    description: "通过扩展验证计算提升 Agent 轨迹选择能力",
    account: "机器之心",
    publish_time: "2026-04-26T15:50:00+08:00",
    atlas_topic_id: "paper",
    entities: [],
    read: true,
  }),

  // ===== 学术 / 综述 =====
  mk({
    card_id: "c18",
    article_id: "art_jqzx_learning",
    title: "Learning Mechanics：深度学习第一性原理",
    description: "五条理论线索汇聚为统一框架",
    account: "机器之心",
    publish_time: "2026-04-26T16:20:00+08:00",
    atlas_topic_id: "review",
    entities: [],
  }),

  // ===== AI 安全 / 攻击手法 (sparse) =====
  mk({
    card_id: "c19",
    article_id: "art_fb_prompt",
    title: "间接提示注入进入真实网络",
    description:
      "Google 与 Forcepoint 同时捕获规模化攻击载荷，从 PoC 走向生产环境",
    account: "FreeBuf",
    publish_time: "2026-04-26T10:30:00+08:00",
    atlas_topic_id: "attack",
    entities: [],
  }),

  // ===== 产业观察 / 产业调研 (sparse) =====
  mk({
    card_id: "c20",
    article_id: "art_xzy_epoch",
    title: "Epoch AI 万人调研",
    description:
      "公司付费是 AI 进入工作的开关；使用率从 38% 跃至 76%；产出而非消耗成新度量",
    account: "新智元",
    publish_time: "2026-04-26T18:00:00+08:00",
    atlas_topic_id: "survey",
    entities: [],
  }),
];

// Atlas — mock DSL (taxonomy skeleton).
// In production this comes from a backend API per user; preview hardcodes it.

import type { AtlasDSL } from "../types";

export const mockAtlasDSL: AtlasDSL = {
  domains: [
    {
      id: "aimodel",
      label: "AI 模型",
      latin_label: "AI · MODELORVM",
      display_order: 0,
    },
    {
      id: "aiproduct",
      label: "AI 产品",
      latin_label: "AI · PRODVCTORVM",
      display_order: 1,
    },
    {
      id: "academic",
      label: "学术研究",
      latin_label: "ACADEMIA",
      display_order: 2,
    },
    {
      id: "security",
      label: "AI 安全",
      latin_label: "SECVRITAS",
      display_order: 3,
    },
    {
      id: "industry",
      label: "产业观察",
      latin_label: "INDVSTRIA",
      display_order: 4,
    },
  ],
  topics: [
    { id: "pretrain", domain_id: "aimodel", label: "预训练", display_order: 0 },
    { id: "inference", domain_id: "aimodel", label: "推理", display_order: 1 },
    { id: "vision", domain_id: "aimodel", label: "视觉模型", display_order: 2 },
    { id: "agent", domain_id: "aiproduct", label: "Agent", display_order: 0 },
    { id: "coding", domain_id: "aiproduct", label: "编程助手", display_order: 1 },
    { id: "media", domain_id: "aiproduct", label: "多媒体", display_order: 2 },
    { id: "paper", domain_id: "academic", label: "论文", display_order: 0 },
    { id: "review", domain_id: "academic", label: "综述", display_order: 1 },
    { id: "attack", domain_id: "security", label: "攻击手法", display_order: 0 },
    { id: "survey", domain_id: "industry", label: "产业调研", display_order: 0 },
  ],
};

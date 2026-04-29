// Atlas — mock DSL (taxonomy skeleton).
// In production this comes from a backend API per user; preview hardcodes it.

import type { AtlasDSL } from "../types";

export const mockAtlasDSL: AtlasDSL = {
  big_domains: [
    {
      id: "aimodel",
      label: "AI 模型",
      latin_label: "AI · MODELORVM",
      small_domain_ids: ["pretrain", "inference", "vision"],
    },
    {
      id: "aiproduct",
      label: "AI 产品",
      latin_label: "AI · PRODVCTORVM",
      small_domain_ids: ["agent", "coding", "media"],
    },
    {
      id: "academic",
      label: "学术研究",
      latin_label: "ACADEMIA",
      small_domain_ids: ["paper", "review"],
    },
    {
      id: "security",
      label: "AI 安全",
      latin_label: "SECVRITAS",
      small_domain_ids: ["attack"],
    },
    {
      id: "industry",
      label: "产业观察",
      latin_label: "INDVSTRIA",
      small_domain_ids: ["survey"],
    },
  ],
  small_domains: [
    { id: "pretrain", label: "预训练" },
    { id: "inference", label: "推理" },
    { id: "vision", label: "视觉模型" },
    { id: "agent", label: "Agent" },
    { id: "coding", label: "编程助手" },
    { id: "media", label: "多媒体" },
    { id: "paper", label: "论文" },
    { id: "review", label: "综述" },
    { id: "attack", label: "攻击手法" },
    { id: "survey", label: "产业调研" },
  ],
};

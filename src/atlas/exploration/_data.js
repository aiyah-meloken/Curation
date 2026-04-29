// Demo data for radar visual exploration.
//
// Source: curated from real cards in
//   curation-dataset/dedup-set/original/2026-04-26/cards.jsonl  (47 cards)
// Backed up unmodified at:
//   ./data/source-snapshot/  (cards.jsonl + cards/*.md + articles/*.md)
//
// What's REAL: card_id, title, description, source account, article_date.
// What's MOCKED (radar tags don't exist in source yet):
//   - small_domain_id  (taxonomy is hand-assigned)
//   - source_count     (聚合卡 indicator; bumped where multiple sources reported same news)
//   - ent              (shared entities; hand-picked salient ones)
//   - read             (preview default = false; some marked true for visual contrast)

window.RADAR_DEMO = {
  date: '2026-04-26',

  bigDomains: [
    { id: 'aimodel',   label: 'AI 模型',    short: 'MODEL'    },
    { id: 'aiproduct', label: 'AI 产品',    short: 'PRODUCT'  },
    { id: 'academic',  label: '学术研究',   short: 'ACADEMIC' },
    { id: 'security',  label: 'AI 安全',    short: 'SECURITY', sparse: true },
    { id: 'industry',  label: '产业观察',   short: 'INDUSTRY', sparse: true },
  ],

  // Order matters — small domains render top-to-bottom in the fan in this order
  smallDomains: [
    { id: 'pretrain',  label: '预训练',    big: 'aimodel'   },
    { id: 'inference', label: '推理',      big: 'aimodel'   },
    { id: 'vision',    label: '视觉模型',  big: 'aimodel'   },
    { id: 'agent',     label: 'Agent',     big: 'aiproduct' },
    { id: 'coding',    label: '编程助手',  big: 'aiproduct' },
    { id: 'media',     label: '多媒体',    big: 'aiproduct' },
    { id: 'paper',     label: '论文',      big: 'academic'  },
    { id: 'review',    label: '综述',      big: 'academic'  },
    { id: 'attack',    label: '攻击手法',  big: 'security'  },
    { id: 'survey',    label: '产业调研',  big: 'industry'  },
  ],

  cards: [
    // ====== AI 模型 / 预训练 ======
    { id: 'c1',  sd: 'pretrain', size: 5, read: false,
      title: 'DeepSeek-V4 Pro API 限时 2.5 折',
      desc: '输入（缓存命中）降至 0.25 元/百万 token；下半年随昇腾 950 量产将进一步降价',
      src: '量子位', ent: ['DeepSeek'] },
    { id: 'c2',  sd: 'pretrain', size: 1, read: false,
      title: 'DeepSeek 开源 V4 系列',
      desc: '代码与 Agent 能力逼近闭源旗舰，社区一周复现训练曲线',
      src: '两光年', ent: ['DeepSeek'] },
    { id: 'c3',  sd: 'pretrain', size: 1, read: false,
      title: '小米推出 MiMo-V2.5 系列',
      desc: '长程 Agent 任务对标头部闭源模型，体积压缩到 7B',
      src: '两光年', ent: [] },
    { id: 'c4',  sd: 'pretrain', size: 1, read: true,
      title: '腾讯发布混元 Hy3 preview',
      desc: '姚顺雨主导重建后首次开源，参数规模未披露',
      src: '两光年', ent: [] },

    // ====== AI 模型 / 推理 ======
    { id: 'c5',  sd: 'inference', size: 1, read: false,
      title: 'DeepSeek-V4 算法与模型结构深度分析',
      desc: '从注意力变体到 KV 压缩到 MoE 路由的工程化分析',
      src: 'zartbot', ent: ['DeepSeek'] },
    { id: 'c6',  sd: 'inference', size: 1, read: false,
      title: 'SkVM：面向 Skill 的语言虚拟机',
      desc: '通过编译优化消除 Skill 与模型间的语义鸿沟',
      src: '量子位', ent: [] },
    { id: 'c7',  sd: 'inference', size: 1, read: true,
      title: 'Rail-Optimized GPU 网络',
      desc: '将集合通信映射到并行独立网络轨道的 Clos 拓扑',
      src: '智猩猩芯算', ent: [] },

    // ====== AI 模型 / 视觉 ======
    { id: 'c8',  sd: 'vision', size: 1, read: false,
      title: 'Lyra 2.0：单图生成可漫游 3D 世界',
      desc: '从单张 2D 图片生成可漫游的长时程 3D 场景',
      src: '新智元', ent: [] },
    { id: 'c9',  sd: 'vision', size: 1, read: false,
      title: 'GPT Image 2 全量推送',
      desc: '中文文字渲染实现突破，海报级输出',
      src: '两光年', ent: ['OpenAI'] },

    // ====== AI 产品 / Agent ======
    { id: 'c10', sd: 'agent', size: 4, read: false,
      title: 'OpenClaw 2026.4.24 发布',
      desc: '默认集成 DeepSeek V4 Flash，原生 MCP 支持，多家媒体同步覆盖',
      src: '机器之心', ent: ['DeepSeek', 'OpenClaw'] },
    { id: 'c11', sd: 'agent', size: 3, read: false,
      title: 'OpenAI 发布 GPT-5.5',
      desc: '从聊天模型转向自主智能体；Pro 在 LisanBench 跨过门萨 130 门槛',
      src: '两光年', ent: ['OpenAI'] },
    { id: 'c12', sd: 'agent', size: 1, read: false,
      title: 'ClawSweeper：50 Codex 并发扫描',
      desc: 'OpenClaw 创始人发布，一天关闭 50 个 GitHub issue',
      src: '新智元', ent: ['OpenClaw'] },

    // ====== AI 产品 / 编程 ======
    { id: 'c13', sd: 'coding', size: 1, read: true,
      title: 'Anthropic 为 Claude 上线交互式可视化',
      desc: '免费用户可用；OpenAI、Google 同步跟进',
      src: '新智元', ent: ['Anthropic'] },

    // ====== AI 产品 / 多媒体 ======
    { id: 'c14', sd: 'media', size: 1, read: false,
      title: '剪映上线 AI 助手',
      desc: '自然语言操控视频剪辑，支持批量操作和智能文案',
      src: '机器之心', ent: [] },

    // ====== 学术 / 论文 ======
    { id: 'c15', sd: 'paper', size: 1, read: false,
      title: 'MathForge：难度感知的 RL 数学推理',
      desc: '通过难度感知的强化学习提升大模型数学推理效率',
      src: '机器之心', ent: ['RLHF'] },
    { id: 'c16', sd: 'paper', size: 1, read: false,
      title: 'ReBalance：动态调控推理深度',
      desc: '利用模型自身置信度信号；精度 +10%，推理长度 −35%',
      src: '机器之心', ent: [] },
    { id: 'c17', sd: 'paper', size: 1, read: true,
      title: 'LLM-as-a-Verifier',
      desc: '通过扩展验证计算提升 Agent 轨迹选择能力',
      src: '机器之心', ent: [] },

    // ====== 学术 / 综述 ======
    { id: 'c18', sd: 'review', size: 1, read: false,
      title: 'Learning Mechanics：深度学习第一性原理',
      desc: '五条理论线索汇聚为统一框架',
      src: '机器之心', ent: [] },

    // ====== AI 安全 / 攻击 (sparse) ======
    { id: 'c19', sd: 'attack', size: 2, read: false,
      title: '间接提示注入进入真实网络',
      desc: 'Google 与 Forcepoint 同时捕获规模化攻击载荷，从 PoC 走向生产环境',
      src: 'FreeBuf', ent: [] },

    // ====== 产业观察 (sparse) ======
    { id: 'c20', sd: 'survey', size: 1, read: false,
      title: 'Epoch AI 万人调研：公司付费是 AI 进工作的开关',
      desc: '使用率从 38% 跃至 76%；产出而非消耗成新度量',
      src: '新智元', ent: [] },
  ],

  // Edges = pairs of cards with shared entities (size ≥ 1 of intersection)
  // Derived by hand here for demo; in production frontend derives from card.ent
  edges: [
    { from: 'c1',  to: 'c2',  via: 'DeepSeek' },
    { from: 'c1',  to: 'c5',  via: 'DeepSeek' },
    { from: 'c1',  to: 'c10', via: 'DeepSeek' },
    { from: 'c10', to: 'c12', via: 'OpenClaw' },
    { from: 'c9',  to: 'c11', via: 'OpenAI'   },
  ],
};

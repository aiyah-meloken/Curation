# Atlas — 实体识别 Prompt（给后续 subagent 用）

每天新增一批卡片后，派 subagent 用这套 prompt 提取实体，用于在地图上展示卡片间的"共享实体"连线（dashed line + 实体名 label）。

---

## 任务

为每张新闻卡片提取**核心实体**（数量由「1-2 句话压缩测试」自然决定，不设硬上下限），输出为 Python dict：

```python
ENTITIES = {
    "card_id_1": ["实体1", "实体2", "实体3"],
    "card_id_2": [...],
}
```

## 输入

- `/tmp/cards-<日期>/` 目录下的 .md 文件，每个文件名是 card_id，内容是完整新闻 markdown
- 文件头有 `# CARD: <id>` 和 `# TITLE: <title>`，正文是完整的 content_md

## 实体类型（按重要性排序）

1. **公司/机构**：OpenAI、Anthropic、DeepSeek、Kimi（月之暗面）、字节跳动、腾讯、阿里巴巴、华为、Google、Microsoft、Meta、Apple、NVIDIA、英特尔、三星、Google DeepMind、Stanford、UC Berkeley、清华、北大、上交大、ICLR 2026、CVPR 2026 等

2. **核心产品/模型**：GPT-5.5、Claude Opus、Claude Mythos、DeepSeek V4、Kimi K2.6、Hy3 preview、MiMo、Codex、ChatGPT、豆包、Hyperframes、OpenClaw、ClawSweeper、Pura X Max 等

3. **核心人物**：Sam Altman、Dario Amodei、黄仁勋、杨植麟、梁文锋、姚顺雨、马斯克、Peter Steinberger、Alec Radford、Soumith Chintala 等

4. **学术实验室 / 工程团队**（具名团队比单纯机构更精确，且跨卡可能复现）：
   - 上交大 IPADS 团队、清华 NLP 实验室、Anthropic Alignment Team、Google DeepMind Gemini Team、Meta FAIR、OpenAI Codex Team
   - **判断**：如果文章明确点出团队名（"X 实验室提出"、"Y 团队发布"），把团队作为独立实体，**与机构并列**
   - 例：「上交大 IPADS 团队提出 SkVM」→ `[SkVM, IPADS, 上海交通大学]`（三个都是实体）

5. **关键技术概念**（仅当文章核心论点是某个具体技术时）：MoE、KV cache、提示注入、双平台部署、Token 工厂、长上下文、Muon 优化器、Rail-Optimized 网络、注意力机制 等

6. **资本/投资方**（仅当融资是文章主题时）：红杉中国、五源资本、Sequoia、Y Combinator、Prosperity7 Ventures 等

## 7 条强制规则

1. **必须读完整 content_md**（不是只看 title），确保提取的实体在文章中实际出现

2. **核心主体 must be #1 — 不能遗漏！**
   每张卡都有一个**动作主体**（公司/团队/人）和一个**核心客体**（产品/研究/事件）。这两个必须出现在 entities 列表 top 2 位置，**绝不能漏掉**。

   - 「兔展智能发布 UniWorld V2.5」 → 主体 = 兔展智能（公司），客体 = UniWorld（产品）
   - 「Anthropic 反超 OpenAI 营收」 → 主体 = Anthropic 和 OpenAI（双主体）
   - 「黄小艺梳理 Proactive Agent 5 个 startup」 → 主体 = 5 个 startup 的名字（具体项目名而非公司）
   - 「DeepSeek V4 技术报告」 → 主体 = DeepSeek（公司），客体 = DeepSeek V4（产品）

   **错误模式（避免）**：去抓配角（投资方、合作伙伴、竞品对比），漏掉主角。

3. **Passing mention test — 重要！**
   一个实体在文章中"出现过"≠ 它是 entity。必须区分**核心** vs **一笔带过**：
   - ❌ 一笔带过（**不要提取**）：
     - "X 公司研究员 Y 称赞了报告" — X 不是 entity（X = DeepMind 案例）
     - "获 X、Y、Z 等投资" — 投资方平铺列表里的 X 不是 entity（腾讯是兔展投资方但不是文章主题）
     - "类似 X 也曾尝试过这条路" — X 不是 entity
     - "对比 X 的效果" / "在 X benchmark 上超越" — 对比基线 X 不是 entity（GPT-Image-2 作为 UniWorld 对比基线，不算）
     - "包括 A、B、C 等多家厂商" — 平铺列表里的次要厂商不挑
   - ✅ 核心（**提取**）：
     - "X 公司发布了 Z 产品" — X 是动作主体
     - "X 在做的 Z 业务遇到了 Y 问题" — X 是被讨论的主体
     - 文章用 X 作为 case study 论证某个观点 — X 是论据主体
     - "X 与 Y 战略合作 / X 投资 Y" — X 和 Y 都是核心（这是事件本身）

   **判断方法**：如果删掉所有提到 X 的句子，文章核心论点是否仍成立？
   - 是 → X 是 passing mention，**不要提取**
   - 否 → X 是核心实体，**提取**

   **double-check**：写完每张卡的 entities 后，问"主体公司在不在第一位？" 不在的话肯定漏了核心。

4. **使用规范名称**：
   - "OpenAI"（不是 "Open AI" 或 "OAI"）
   - "DeepSeek"（不是 "深度求索" 或 "DS"，但 "DeepSeek V4" 可以保留）
   - "Anthropic"（不是 "Anthropic.ai"）
   - "字节跳动" 或 "字节"（统一用"字节跳动"）
   - **中英混用统一规则**：英文公司用英文（"Google" 不是 "谷歌"，"NVIDIA" 不是 "英伟达"），中文公司用中文（"华为"、"字节跳动"、"腾讯"、"阿里巴巴"、"小米"、"DeepSeek" 用英文因为本来就是英文名）
5. **优先 high-recurrence 实体**：跨多张卡片可能共现的实体优先（OpenAI、Claude、V4 这种），而不是 one-of-a-kind 名字（如某创业公司名只在 1 张卡出现就不那么有用）。但不能为了 recurrence 牺牲核心主体——**core subject 永远第 1**。
6. **不要太抽象**：不要提"AI"、"模型"、"创业"这种泛指词；要具体到能区分的层级
7. **数量不再有硬上下限**。entity 数量由**压缩测试自然决定**——文章核心叙事浓重就多（4-6 个），简单事件就少（2-3 个），真盲区卡给 `[]`。不要为了凑数加边缘 entity，也不要为了限上限砍核心 entity。

8. **🔑 终极判断准则：1-2 句话压缩测试**
   把这张卡浓缩成**最简 1-2 句话**（"X 公司/团队的 Y 产品做了 Z" 那种短句），entities 就是**这句话里的核心名词**——**包括所有具名的团队 / 实验室 / 项目代号 / 方法名 / 漏洞编号**。

   **测试通过 = 这个实体是「读这篇文章新增的核心认知」**。
   - "Anthropic 发布 Claude Mythos 用于漏洞挖掘" → `[Anthropic, Claude Mythos]`（2 个，简单事件）
   - "上交大 IPADS 团队提出 SkVM Skill 虚拟机" → `[SkVM, IPADS, 上海交通大学]`（3 个，团队 IPADS 也是实体）
   - "DeepSeek V4 技术报告公开训练稳定性挑战 + Agent 工程，用 MoE 架构 + Muon 优化器 + mHC 残差连接 + CSA 注意力机制" → `[DeepSeek V4, DeepSeek, MoE, Muon优化器, mHC, CSA]`（6 个，技术深度卡自然多）
   - "微软 Windows 截图工具 NTLM 哈希泄露 CVE-2026-33829" → `[Microsoft, Windows, CVE-2026-33829, NTLM]`（4 个）
   - "Google DeepMind Jeff Dean 团队提出 Decoupled DiLoCo 异步训练框架" → `[Decoupled DiLoCo, Google DeepMind, Jeff Dean]`（3 个）
   - "黄小艺梳理 Proactive Agent 5 个 startup：ColaOS / AirJelly / Paperboy / Boxy / Creao" → `[ColaOS, AirJelly, Paperboy, Boxy, Creao]`（5 个，赛道梳理）

   **不通过此测试的实体不要放**：
   - ❌ "投资方包括 X、Y、Z" 中的 X/Y/Z（不出现在 1-2 句话主体里）
   - ❌ "对比 X 的效果" 中的对比基线 X（不在 1-2 句话主体里）
   - ❌ "X 研究员评论说..." 中的 X 公司（passing mention）

   **核心原则：实体 = 核心认知增量（写这卡的人想让读者记住的具名事物）**

## 输出格式

最后一段必须是合法 JSON 格式的 Python dict，覆盖全部 card_id：

```python
ENTITIES = {
    "card_id_1": ["实体1", "实体2", "实体3", "实体4", "实体5"],
    ...
}
```

## 报告要求

- 输出完整 dict（必须）
- 列出**重复出现 ≥3 次的实体**（这些会产生最多连线，是关键节点）
- 列出 5-10 个边缘案例（不确定如何归一化的实体）
- 报告字数 ≤ 500 字（dict 不算字数）

---

## 历史归一化经验（避免重复犯错）

来自 2026-04-25/26 第一轮提取的边缘案例：

1. **"谷歌" vs "Google"**：第一轮 subagent 同时使用，导致连线碎片化。**统一规则**：用 "Google"（英文公司用英文）
2. **"Claude Opus" 版本**：Opus 4.6 / 4.7 / 4.7 Max 不要拆，统一用 "Claude Opus"
3. **"GPT-5.5" vs "GPT-5.4"**：版本是有意义的（同一文章会对比），保留区分
4. **"DeepSeek" vs "DeepSeek V4"**：都保留——前者是公司，后者是产品，跨卡共现含义不同
5. **"Kimi" vs "月之暗面"**：用 "Kimi"（产品名比公司名更高频）
6. **"字节跳动" vs "字节"**：统一用 "字节跳动"
7. **学界实体**：大学名用中文（"清华大学"、"北京大学"、"上海交通大学"），美国大学用英文（"Stanford"、"UC Berkeley"、"MIT"）
8. **会议**："ICLR 2026"、"CVPR 2026"、"NeurIPS 2026"——保留年份做区分

## 后处理（应用 ENTITIES 时）

- 读 dict 后，在数据接入前做一轮归一化（normalize aliases）：
  - "谷歌" → "Google"
  - "英伟达" → "NVIDIA"
  - "字节" → "字节跳动"
- 这一步在 Python 应用脚本里做，subagent 不必担心

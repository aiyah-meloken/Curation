# Atlas — 标注规则

This document records the rules emerging from the card-by-card review session
on the 2026-04-26 dataset. They are authoritative for this preview's
bottom-up taxonomy and should be the reference when tagging future cards.

The taxonomy is **bottom-up**: rules are written *after* tagging real cards,
not before. When a new card breaks an existing rule, update this doc.

---

## Three rules, in priority order

### Rule 1 — 实体优先 (Entity-first)

A card is about its **subject (主体)** — the actor doing the thing — not
about the topic in the abstract.

- "小马智行发布新一代域控制器" → 主体 = **小马智行** (an actor),
  not "域控制器" (a topic).
- "中国 EV 新品动态：上汽大众 ID.ERA 9X / 比亚迪方程豹钛 7" → 主体 =
  **上汽大众 + 比亚迪** (multi-actor cluster); the cluster *is* the actor set,
  still entity-first.
- When a card has multiple candidate 主体s (e.g., "Anthropic 与 NEC 合作"),
  pick the **strategically active** side — the party initiating the move.
  Anthropic + NEC → **主体 = Anthropic** (Anthropic is the one expanding into
  Japan; NEC is the channel/customer).

> **Why entity-first matters**: it forces classification by *who's making the
> move*, which is what matters for industry tracking. Topic-first
> classification would lump unrelated actors together just because they
> share a buzzword.

### Rule 2 — 赛道 = 事件实体要进入的赛道 (Track = the event's destination, not the entity's home base)

Once 主体 is locked, the **small_domain (赛道)** is the track that **this
event** moves the 主体 *into* — not the 主体's home track in general.

| Card | 主体 | 主体 home track | This event's track | 赛道 (small_domain) |
|---|---|---|---|---|
| 小马智行发布域控制器 | 小马智行 | 自动驾驶 | 自动驾驶 (域控制器仍在自动驾驶赛道内) | `autonomous` |
| Momenta 量产 + Robotaxi | Momenta | 自动驾驶 | 自动驾驶 (双线推进同一赛道) | `autonomous` |
| 上汽大众/比亚迪新品 | 上汽大众/比亚迪 | 汽车 | 新能源车 (具体新品都是 EV) | `ev` |
| Anthropic + NEC | Anthropic | AI 大模型 | **企业 AI** (Anthropic 在打 ToB 企业市场，不是又训了个新模型) | `enterprise_ai` |
| 苹果地图植入广告 | 苹果 | 操作系统/硬件 | (n/a — 不是产业推进) | → `other` |

The "进入" (enter) phrasing matters even when the entity is already an
incumbent: even giants entering a new sub-track count, *and* incumbents
operating within their own track also count — what matters is the track this
specific event sits in.

### Rule 3 — big_domain = 认知效用 (Cognitive utility)

`big_domain` answers **"what does the reader cognitively gain from this
card? why does it land in this group?"** — i.e. the **purpose of reading**,
not the topic.

| big_domain | 认知效用 (what reader gains) | small_domain dimension |
|---|---|---|
| `industry_news` (产业动态) | 跟踪某个赛道里**谁在做什么、推进到哪一步** | **赛道** — `autonomous`, `ev`, `enterprise_ai`, … |
| `security_alert` (安全警觉) | 对 AI / 系统**安全威胁演化**保持警觉 | **风险类型** — `prompt_injection`, … |
| `other` (其他) | brainstorm 阶段未归类的卡，保留在图上不丢弃 | `misc` (loose) |
| `untagged` (未分类) | 还未在 card-by-card session 里逐张过过的卡 | `pending` |

> **`small_domain` 的维度由 big_domain 决定，不是全局统一的赛道。**
> "产业动态" 下 small_domain = 赛道；后面出现的新 big_domain
> （学术/警觉/闲读/…）会有各自原生的 small_domain 维度
> （学科/风险类型/类别/…），**不要套到赛道上**。

---

## Procedure (per card)

1. **Read** title + description in full.
2. **Identify 主体** (Rule 1).
3. **Identify event track** — the track this *event* puts 主体 into (Rule 2).
4. **Decide 认知效用** (Rule 3): 这条卡片让我作为读者获得了什么？属于哪种阅读分组？
5. Pick `big_domain` matching the 认知效用; pick `small_domain_id` from that
   big_domain's native dimension.
6. If unclear or doesn't fit any current group → `big_domain = other`.
   Don't force-fit. **"其他" is a real bucket, not a fallback** — having
   something in 其他 is more honest than miscategorizing it.

---

## Worked examples (this session)

Updated as we tag.

| # | card | 主体 | event track | big_domain | small_domain |
|---|---|---|---|---|---|
| 1 | 小马智行发布域控制器 | 小马智行 | 自动驾驶 | `industry_news` | `autonomous` |
| 2 | 中国 EV 新品 | 上汽大众/比亚迪 | 新能源车 | `industry_news` | `ev` |
| 3 | Momenta 量产 + Robotaxi | Momenta | 自动驾驶 | `industry_news` | `autonomous` |
| 4 | 苹果地图植入广告 | 苹果 | (产品商业化决策, 不是赛道推进) | `other` | `misc` |
| 5 | Anthropic + NEC 合作 | Anthropic | **企业 AI** (ToB 落地) | `industry_news` | `enterprise_ai` |
| 6 | 英特尔 CPU 供应紧张预警 | Intel | **服务器 CPU** (供需面) | `industry_news` | `server_cpu` |
| 7 | Azure Linux 基于 Fedora 重构 | Microsoft | **云基础设施** (云 OS 底层重构) | `industry_news` | `cloud_infra` |
| 8 | 三星半导体车展首展车规存储 | Samsung Semi | **车规芯片** (芯片厂切入车规市场) | `industry_news` | `auto_chip` |
| 9 | 间接提示注入攻击进入真实网络 | (威胁本身, 次级 Google/Forcepoint) | **提示注入** (AI Agent 风险类型) | `security_alert` ⭐**新 big_domain** | `prompt_injection` |

---

## Open questions / patterns to watch

These will resolve as more cards land:

- **学术 / 论文类卡片**：likely a new big_domain (`academia`?) with
  small_domain = 学科 (NLP / CV / RL / …) — not 赛道.
- ~~**安全 / CVE 类卡片**：likely a new big_domain (`security_alert`?) with
  small_domain = 风险类型, not 赛道.~~ **resolved** at Card 9 — created
  `security_alert` (VIGILIA), small_domain = 风险类型. CVE-style cards
  (e.g. React2Shell) will likely add a `cve` small_domain when they land.
- **DeepSeek 开源 V4 / 苹果广告 / 微软 Azure Linux 重构** 这类——
  不止"产业动态"。可能演化出 `infra` / `model_release` 等 big_domains
  (cognitive utility 不一样：infra 是 "底层能力变化"，model_release 是
  "模型能力跃迁")。等卡片自己说话。
- 当一个 small_domain 累积 ≥ 3 张时考虑是否要再细分（e.g. autonomous
  → 域控制器 / Robotaxi / L4 全无人 …）。当前先粗放。

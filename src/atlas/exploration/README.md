# Radar — 视觉范式探索

发散阶段的多流派 mockup，**每个流派各自的母语调色板与字体**，未对齐 curation-app design tokens（先看叙事张力，再决定是否归一）。

## 怎么看

```bash
# 直接用浏览器打开 index.html（不需要任何 npm/build）
open curation-app/src/radar/exploration/index.html

# 或单独打开某一个：
open curation-app/src/radar/exploration/01-atlas.html
```

## 交互（每个 mockup 一致）

- **Hover 卡片** → 浮卡（标题 + 描述 + 路径 + 来源 + 「标为已读」按钮）
- **Click 卡片** → 抽屉打开
- **关 drawer / ESC** → 抽屉关闭

## 数据

`_data.js` —— 6 个 mockup 共享同一份 demo dataset：
- 5 大领域（AI 模型 / AI 产品 / 学术研究 / AI 安全 / 产业观察）
- 10 小领域
- 20 张卡片（标题、描述、来源 = 真实，源自 `data/source-snapshot/cards.jsonl`）
- 5 条共享实体边

**雷达 tag 是 mock 的**（`small_domain_id`、`source_count`、`shared_entities`），生产数据里不存在；上线时由后端 LLM tagging pipeline 产出。

`data/source-snapshot/` —— 备份了 `curation-dataset/dedup-set/original/2026-04-26/` 的 47 张真实卡片 + 正文 markdown。已脱离原数据集，可自由调整不影响源。

## 6 个流派

| № | 名字 | 叙事 | 盲区表达 | 调色板 |
|---|---|---|---|---|
| 01 | **古地图 Cartographic Atlas** | 每天发现一片新大陆。大陆 = 大领域，岛屿 = 卡片，商路 = 共享实体。 | "Terra Incognita" 海域 + 海怪 doodle | 羊皮卷米黄 / 锈红 / 靛黑 |
| 02 | **星座图 Celestial Chart** | 夜观天象。卡片 = 星，亮度 = 热度，星座线 = 共享实体。 | 暗色天区 + 渐晕 | 午夜深蓝 / 金 |
| 03 | **报刊版式 Editorial Print** | 完全放弃雷达比喻，改用日报头版。栏目 = 大领域，标题字号 = source_count。 | 空白栏 + "雷达今日仅捕获一道信号" | 米白 / 黑 / 朱砂 |
| 04 | **声呐扫描盘 Phosphor Sonar** | 战时仪器主义。同心圆 + 静态扫描扇 + 右栏数据读出。 | "REAR ARC · UNSCANNED" 暗区 | 磷光绿 / 哑黑 |
| 05 | **地形等高线 Topographic** | USGS 测绘风。山脉 = 大领域，山峰 = 小领域，等高线密度 = 热度。 | 平原 + 灌木点画 "PLAIN · UNSURVEYED" | 牛皮纸 / 朱砂三角 |
| 06 | **植物图鉴 Botanical Plate** | 博物画风的标本图鉴。植株 = 大领域，分枝 = 小领域，浆果 = 聚合卡，叶 = 单卡，藤蔓 = 共享实体。 | 空枝 "ungrown" + 干叶（已读） | 老纸黄褐 / 叶绿 / 浆果红 |

## 信息编码契约

每个 mockup 都满足：

1. ✅ 4-5 大领域分组（带 sparse 标记）
2. ✅ 8-12 小领域归属
3. ✅ 大→小→卡 三层结构清晰
4. ✅ ~20 张独立卡片
5. ✅ 卡片大小 ∝ source_count（不显示数字）
6. ✅ 已读 vs 未读 视觉对比
7. ✅ 共享实体连接
8. ✅ 盲区感（每流派各自表达）

## 接下来

挑 1-2 个流派，回到 `docs/superpowers/specs/2026-04-29-radar-preview-design.md` 把"视觉设计"章节的 TBD 部分填实，再决定：

- 是否保留各自原生调色板，还是映射到 curation-app `tokens.css`？
- 各流派是否需要混合（比如 Atlas 的叙事 + Editorial 的层级清晰度）？
- 哪些视觉细节进入 V1 实现，哪些是 V2+？

最终选定后这个 `exploration/` 目录可以保留作历史 reference，或归档到 `docs/`。

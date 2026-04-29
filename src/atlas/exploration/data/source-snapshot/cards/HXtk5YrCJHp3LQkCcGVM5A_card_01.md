# OpenClaw 创始人发布 ClawSweeper：50 个 Codex 并发扫描，一天关闭 5000+ 无效 Issue，成本不到 1000 美元

Peter Steinberger（OpenClaw 创始人、OpenAI 工程师）花 2 天搭建了 ClawSweeper，启动 50 个 Codex 实例并行扫描，一天内关闭了 openclaw/openclaw 仓库超过 5000 个无效 Issue，数千条仍在处理队列中。该仓库有 36 万 Star，积压超过万个 Issue 和 PR。按人工处理速度，清理这些积压约需一年。

## ClawSweeper 只在 7 种限定条件下才会关闭 Issue，超出范围一律保持 open

ClawSweeper 的设计哲学是极致保守——审查过程只读、关闭动作需要二次确认，且只在明确情况下才动手。

- **核心引擎**：运行在 gpt-5.5 上，配置 high reasoning effort 和 fast service tier，每个条目 Codex 审查超时 10 分钟
- **关闭条件（仅 7 种）**：已在 main 实现、当前 main 无法复现、应归属 ClawHub 的 skill/plugin 而非 core、重复或已被更权威条目取代、在该仓库内具体但不可执行、内容过于混乱不可执行、超过 60 天且缺少足够数据验证 bug
- **维护者保护**：Codex 先识别 GitHub 身份标记，项目主人、成员或协作者发的 issue 直接跳过，不自动关闭
- **双阶段执行**：Codex 审查时只有只读权限，输出结构化 markdown 报告存为 `items/<编号>.md`；真正评论和关闭需要切换到 `apply_existing=true` 模式，重抓最新上下文、重算快照哈希，确认 issue 在提案生成后未发生变化才会动手
- **Steinberger 人工抽检数百条关闭记录，称准确率几乎无误**

ClawSweeper 的透明机制将整个过程公开，维护者和贡献者可以自行验证每一项关闭决定。

## README 即是仪表盘：运行过程完全公开、可审计

ClawSweeper 不使用 Grafana 或 Prometheus 等传统监控方案，而是将运行状态实时写入仓库的 README.md。

- **README 实时显示**：当前 open issue 数量、本轮审查条数、提议关闭数、已执行关闭数、GitHub 限流状态——全部以表格呈现
- **完全可审计**：任何人打开仓库主页就能看到 ClawSweeper 正在做什么；对某条关闭有疑虑，可点进 `items/<编号>.md` 查看 Codex 的完整审查理由

## 50 个 Codex 并行扫描，效率瓶颈不是模型而是 GitHub API 限流

ClawSweeper 的性能数据揭示了一个反直觉的现实：唯一拖慢这套系统的东西，不是模型能力或判断准确度，而是基础设施。

- **总成本**：不到 1000 美元，单个 Issue 深度审查加关闭约 0.2 美元
- **并行规模**：50 个 Codex 实例 7×24 小时运行，扫描速度超过 GitHub API 速率限制——仪表盘显示 "State: Apply throttled"
- **人工对比**：5000+ Issue 的清理量，人工处理约需一年，ClawSweeper 一天完成约一半

## 链接

- ClawSweeper 仓库：https://github.com/openclaw/clawsweeper
- Steinberger 推文：https://x.com/steipete/status/2047982647264059734

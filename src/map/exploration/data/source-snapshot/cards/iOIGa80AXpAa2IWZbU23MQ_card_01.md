# GPT-5.5 Pro 在 LisanBench 视觉智测得 145 分，首次跨过门萨俱乐部 130 入会线

OpenAI 发布 GPT-5.5 Pro 模型。在 LisanBench 智商基准测试中，文本推理部分得分 130（刚好达到门萨入会标准，对应人群前 2%），视觉推理部分得分 145（人群前 0.1%）。这是 AI 模型首次在智商基准测试中正式跨过门萨 130 分门槛。此前一年，"LLM 过不了 130" 在技术圈是普遍共识。

## 视觉推理比文本高出 15 分，差距源于 token 化丢失空间拓扑信息

门萨 Norway 测试采用 3×3 九宫格格式（八张图 + 空缺第九张），完全非语言、非文化依赖，考察抽象模式识别——旋转、镜像反射、叠加增减元素等变换规律。

- **GPT-5.5 Pro 之前，所有顶级模型视觉题均未超过 125 分**：LLM 做视觉题的标准流程是先将图片转为 token 再推理，而 token 化过程会丢失空间结构和拓扑关系——这正是矩阵推理题最核心的信息。根据原文，过去十二个月 Claude 4.7、GPT-5.4 Pro 等模型全部卡在 125 以下
- **145 分对应门萨天才区（前 0.1%）**：130 是门萨前 2% 线，145 是前 0.1% 线。GPT-5.5 Pro 的视觉推理能力在统计意义上超过 99.9% 的人类测试者

但这次更新不止于跑分突破。伴随模型发布，OpenAI 在 API 层面同步推出效率改进。

## API 同步更新：Token 消耗减少 45.6%，SemiAnalysis 评定 GPT-5.5 全面领先

本次模型发布同步推出多项 API 效率改进，评测机构 SemiAnalysis 随后给出了横向对比评估。

- **Token 效率**：GPT-5.5 相比上一代，Token 消耗减少 45.6%，LisanBench 智能分数提升 1.77 倍
- **有效性比率排行**：GPT-5.5（Medium）以 99.44% 居首，其后为 Opus 4.7 (xhigh) 99.35%、Sonnet 4.6 (16k) 99.28%、Opus 4.6 (16k) 98.74%、Gemini 3.1 Pro 预览版（低）97.77%
- **SemiAnalysis 评估**：GPT-5.5 在数学任务上表现最佳，编程上与 Opus 4.7 各有千秋，Agent 任务上 Claude 与 GPT-5.5 远胜其他模型。该机构称 GPT-5.5 "在某些任务上显著超越了所有其他模型"
- **发布节奏加速至接近月度**：OpenAI 首席科学家 Jakub Pachocki 称"过去两年其实出奇地缓慢"，并预计短期内有"相当显著的进步"，中期有"极其显著的进步"

## 链接

- Reddit 讨论：https://www.reddit.com/r/accelerate/comments/1svnxv9/gpt_55_pro_vision_is_actually_the_first_model_to/
- StartupFortune 报道：https://startupfortune.com/gpt-55-lands-as-openai-accelerates-its-model-release-cadence-to-near-monthly/
- 新智元原文：https://mp.weixin.qq.com/s/iOIGa80AXpAa2IWZbU23MQ

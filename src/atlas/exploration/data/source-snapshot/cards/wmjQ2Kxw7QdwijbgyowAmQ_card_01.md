# LLM-as-a-Verifier：通过扩展验证计算提升 Agent 轨迹选择能力

斯坦福、伯克利与英伟达联合提出 LLM-as-a-Verifier 验证框架（项目以博客和代码形式发布），将传统 LLM-as-a-Judge 的粗粒度判分改造为细粒度验证机制，在 Terminal-Bench 2.0 和 SWE-Bench Verified 上超越 Claude Mythos 和 GPT-5.5，取得当前最优（SOTA）。

## 为什么 LLM-as-a-Judge 不够用

Agent 多次运行往往能在某次尝试中生成正确答案，但无法判断哪次是对的——瓶颈不在生成能力，而在验证能力。

- **评分平局普遍存在**：传统 LLM-as-a-Judge 让模型输出一个离散分数（如 1-8），不同质量的轨迹常获相同分数。在 Terminal-Bench 上，27% 的轨迹对出现平局，导致无法区分优劣。
- **单一分数丢失多维度信息**：一条轨迹可能格式正确但逻辑有误，另一条反之，但单一分数无法体现这种差异。

## LLM-as-a-Verifier 如何从三个方面扩展验证

为解决粗粒度判分的局限，LLM-as-a-Verifier 在三个维度上扩展验证计算量：不再输出单一离散分数，而是对每个评分 token 的概率分别建模，将轨迹奖励表示为 token 概率的加权和。

- **评分 token 粒度扩展**：传统方法从有限离散分数中选最高概率值，量化误差大
  - 将评分粒度从 1 级扩展到最高 20 级，对每个 token 的概率分布独立建模
  - 将每个评分 token 映射为标量数值后加权累加，得到连续奖励值，使验证更接近真实奖励

- **重复验证**：单次评估受采样随机性影响
  - 对同一对轨迹重复验证 K 次（实验中 K 最高取 16），聚合结果以稳定评估
  - 在 K=16 的条件下，LLM-as-a-Verifier 仍比 LLM-as-a-Judge 保持至少 7% 的验证准确率优势

- **评估标准分解**：单一评分无法解释轨迹在哪些方面有问题
  - 将验证拆为三个独立子标准：规范合规性（路径、命名等是否符合任务要求）、输出格式（是否符合预期格式）、错误检测（是否存在明显错误信号）
  - 每个子标准独立评分后聚合，使验证过程可解释

最终通过循环赛制（round-robin tournament）在所有候选轨迹对中选出胜场最多的轨迹作为输出。

## 效果

所有结果来自官方排行榜，超越对象包括 Claude Mythos 和 GPT-5.5：

- **Terminal-Bench 2.0**：取得 SOTA，将 LLM-as-a-Judge 的 27% 平局率降至 0%
- **SWE-Bench Verified**：取得 SOTA
- **跨 Harness 兼容性**：在 ForgeCode（验证准确率 86.4%）、Terminus-Kira（79.4%）、Terminus 2（71.2%）三个不同 Agent Harness 上均显著提升准确率，验证了该方法与具体 Agent 框架和模型的解耦能力

## 链接

- 博客：https://llm-as-a-verifier.notion.site
- 代码：https://llm-as-a-verifier.github.io
- 主要贡献者：Jacky Kwok（斯坦福 CS 博士生）、Shulu Li（伯克利 EECS 博士生）
- 通讯作者：Ion Stoica（伯克利教授/Databricks 创始人）、Azalia Mirhoseini（斯坦福教授/前 DeepMind & Anthropic）、Marco Pavone（英伟达 AI 与自动驾驶研究总监）

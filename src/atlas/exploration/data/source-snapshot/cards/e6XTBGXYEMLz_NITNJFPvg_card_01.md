# DeepSeek 开源 V4 系列，代码和 Agent 能力逼近闭源旗舰

DeepSeek 本周发布并开源了 V4 系列大模型预览版，同步上线 API。产品线包含 V4-Pro（总参数 1.6T，激活 49B）和 V4-Flash（总参数 284B，激活 13B），均标配百万 token 上下文。

## V4-Pro 在编程和数学基准上进入第一梯队

DeepSeek 公布的基准测试数据显示，V4-Pro 在编程和 Agent 维度上已达到与闭源旗舰可比较的水平：

- **编程能力**：LiveCodeBench Pass@1 达 93.5，Codeforces Rating 3206，均位列参测模型首位。Codeforces 人类选手排行榜中可排第 23 名
- **软件工程落地**：SWE Verified Resolved 为 80.6，与 Claude Opus 4.6 Max（80.8）基本持平
- **数学推理**：IMOAnswerBench Pass@1 为 89.8，仅次于 GPT-5.4 的 91.4
- **Agent 能力**：BrowseComp Pass@1 达 83.4，MCPAtlas Public Pass@1 达 73.6

两光年判断：此前百万级上下文与顶尖代码、Agent 能力几乎是 GPT、Claude 等闭源模型的专属区，而 DeepSeek V4 以开源方式在这些维度上实现了接近甚至部分超越。

## 开源策略的影响：开发者获得闭源替代选项

DeepSeek V4 以开源方式发布，与此前闭源旗舰垄断的局面形成对比。从行业角度看：

- **部署灵活性**：企业和开发者可免费获取、用于私有化部署和二次开发，不依赖闭源 API 授权
- **能力对标**：代码维度（SWE Verified 80.6）与 Claude Opus 4.6 Max（80.8）基本持平，开源模型首次在软件工程基准上进入这一区间

## 链接

https://mp.weixin.qq.com/s/e6XTBGXYEMLz_NITNJFPvg

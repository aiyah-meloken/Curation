# 单人攻击者利用React2Shell漏洞批量入侵900余企业，Telegram机器人构建实时入侵通知系统

DFIR Report分析师在一台意外暴露的公网服务器上发现了大规模自动化攻击行动：攻击者利用Next.js的高危漏洞CVE-2025-55182（React2Shell）批量扫描Web应用，窃取.env文件中的云服务、AI平台和支付系统密钥，全球超过900家企业受害。攻击者在Telegram上身份为@BonJoviGoesHard（显示名"Dr. Tube"），攻击活动可追溯至2025年9月。

## 攻击链

攻击者构建了从扫描到通知的完整自动化流水线，使用Claude Code和OpenClaw辅助编码与故障排除：

- 自动化扫描暴露在公网的Next.js应用，确认存在CVE-2025-55182（React2Shell）漏洞
- 利用React2Shell漏洞读取服务器.env文件，窃取Anthropic、OpenAI、AWS、Azure、Stripe、PayPal等服务商的密钥和访问令牌
- 被盗凭证按受害者目录分类暂存于中央服务器（13000+文件、150+目录），2026年4月10日至21日间向云存储上传超65,000个归档条目
- 每次成功入侵触发Telegram机器人@bissapwned_bot向攻击者私人聊天发送结构化警报，字段包含受害者身份、云环境状态、权限级别和可用密钥——攻击者可近乎实时地在Telegram上筛选入侵价值

## 建议

将生产凭证从.env文件迁移到专业密钥管理器，使用运行时注入的短生命周期令牌，并部署蜜罐令牌以在凭证泄露时触发告警。

## 链接

- 原始报道：https://mp.weixin.qq.com/s/97zyDxpP1L2QMq4t2N4SxA
- 参考来源：https://cybersecuritynews.com/hackers-use-telegram-bots/

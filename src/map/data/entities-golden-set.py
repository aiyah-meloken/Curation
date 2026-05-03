# Second-pass entity extraction for 105 golden-set cards
# Extraction date: 2026-04-30
# Rules: entity-extraction-prompt.md (v2 with Category 4 lab/team, compression test, 2-5 limit)
# Coverage: 105/105 cards

ENTITIES = {
    # ── Security / Vulnerabilities ──────────────────────────────────────────
    "2EQYYSa6HEcGEvEtIE4c5Q_card_01": ["VulnCheck", "Claude Mythos", "Anthropic"],
    "2EQYYSa6HEcGEvEtIE4c5Q_card_02": ["Claude Mythos", "Anthropic"],
    "2EQYYSa6HEcGEvEtIE4c5Q_card_03": ["Apple Intelligence", "Apple", "CVE-2025-43509"],
    "2EQYYSa6HEcGEvEtIE4c5Q_card_04": ["Claude Code", "Gemini CLI", "GitHub Copilot", "提示注入"],
    "2EQYYSa6HEcGEvEtIE4c5Q_card_05": ["Claude Opus", "Chrome", "Anthropic"],
    "2EQYYSa6HEcGEvEtIE4c5Q_card_06": ["ProxySmart"],
    "2EQYYSa6HEcGEvEtIE4c5Q_card_07": ["Microsoft", "Windows", "CVE-2026-33829", "NTLM"],
    "2EQYYSa6HEcGEvEtIE4c5Q_card_08": ["OpenAI", "Agents SDK"],
    "2EQYYSa6HEcGEvEtIE4c5Q_card_09": ["SGLang", "CVE-2026-5760", "GGUF", "Jinja2"],
    "2EQYYSa6HEcGEvEtIE4c5Q_card_10": ["HandyPay", "NGate"],
    "97zyDxpP1L2QMq4t2N4SxA_card_01": ["CVE-2025-55182", "React2Shell", "Next.js", "Telegram"],
    "3X_tjGFTfk40X2NL6wEiNg_card_01": ["Google", "Forcepoint", "间接提示注入"],
    "3k4dbwJ2uCN3R-gculOitQ_card_01": ["Claude Mythos", "Anthropic", "NSA", "Glasswing"],
    "ePnyAMU-VVLQ1hd8dZQLDw_card_01": ["ProxySmart", "Infrawatch"],

    # ── DeepSeek ────────────────────────────────────────────────────────────
    "3gMgw353X1IEcKcQfbs_WA_card_01": ["DeepSeek", "DeepSeek V4", "DeepSeek V4 Flash"],
    "IED0AJ7p6LJoETNP7PlVAQ_card_01": ["DeepSeek V4", "DeepSeek", "MoE", "Muon优化器"],
    "Rawry7KxtJ6n5ch83RUFtQ_card_01": ["DeepSeek V4", "DeepSeek", "华为昇腾"],
    "YOBBjpqln8s6vQwT1Ko5Gg_card_01": ["DeepSeek V4", "DeepSeek", "华为昇腾"],
    "F-0_bbwvQjlYaHVFW_uPNw_card_01": ["DeepSeek V4", "DeepSeek", "Muon优化器"],
    "hdmly1L514kWsFBjzk6arQ_card_01": ["DeepSeek V4", "DeepSeek", "MoE", "Muon优化器"],
    "a52yE56Okdy33F4RyQXCng_card_01": ["DeepSeek", "DeepSeek V4"],
    "fa2SMJ2mSN1CHopmHAOwkw_card_01": ["DeepSeek", "DeepSeek V4", "华为昇腾"],
    "kMEZ8emCO8rwhJ9HDmC8fg_card_03": ["DeepSeek", "DeepSeek V4", "华为昇腾"],
    "e6XTBGXYEMLz_NITNJFPvg_card_01": ["DeepSeek", "DeepSeek V4", "Claude Opus"],

    # ── OpenAI / GPT ─────────────────────────────────────────────────────────
    "HUQuPYIPK9l-saB36kdoxg_card_01": ["GPT-5.5", "OpenAI", "DeepSeek V4", "Claude Mythos"],
    "lmd2aPcmODDoyETlRWtlZg_card_01": ["OpenAI", "Anthropic", "Sora"],
    "lmd2aPcmODDoyETlRWtlZg_card_02": ["OpenAI", "GPT-5.5", "Codex", "NVIDIA"],
    "iOIGa80AXpAa2IWZbU23MQ_card_01": ["GPT-5.5", "OpenAI", "LisanBench"],
    "e6XTBGXYEMLz_NITNJFPvg_card_02": ["OpenAI", "GPT-5.5"],
    "e6XTBGXYEMLz_NITNJFPvg_card_03": ["OpenAI", "GPT Image 2", "ChatGPT"],
    "xJXsjsjIk-yJAzDOtItB9Q_card_01": ["GPT-5.4", "OpenAI"],
    "CtdZMm2f_Jrwu54hUI8RNA_card_01": ["OpenAI", "Sam Altman", "ChatGPT"],
    "ZdioUWrZuEOI20FNLbxdtA_card_01": ["OpenAI", "Sam Altman", "马斯克"],
    "yqmDsRCeZbBWMqM7oDa5qQ_card_01": ["OpenChronicle", "OpenAI", "Claude Code"],

    # ── Anthropic / Claude ───────────────────────────────────────────────────
    "3OD-4Sk92y4wDN2q-zEHeQ_card_01": ["Anthropic", "Project Deal", "Claude Opus", "Claude Haiku"],
    "Xn_wZHnUx9wjAdDnaLCoVQ_card_01": ["Anthropic", "Conway", "Claude"],
    "n_51h6b2rlO5JKMqS-T9dA_card_01": ["Anthropic", "Claude", "OpenAI", "Google"],
    "fa2SMJ2mSN1CHopmHAOwkw_card_04": ["Anthropic", "NEC"],
    "OdyCteoIa8qFu_bo3bD1ng_card_01": ["Meta", "Claudeonomics", "Claude Opus"],
    "OdyCteoIa8qFu_bo3bD1ng_card_02": ["Axon", "Box", "Claude Code"],

    # ── Google / Anthropic investments ──────────────────────────────────────
    "mUDP1t3yVSwaPZg9SzdgGg_card_01": ["Google", "Anthropic", "Amazon"],
    "kMEZ8emCO8rwhJ9HDmC8fg_card_04": ["Google", "Anthropic", "Amazon"],

    # ── Tencent / Hunyuan ────────────────────────────────────────────────────
    "soGCMknejh725lJ6LiYVCg_card_01": ["腾讯", "Hy3", "姚顺雨"],
    "e6XTBGXYEMLz_NITNJFPvg_card_05": ["腾讯", "Hy3", "姚顺雨"],

    # ── DeepSeek & Kimi comparison ───────────────────────────────────────────
    "usLRYg1WHEBXepm2qYKELQ_card_01": ["DeepSeek", "Kimi", "DeepSeek V4", "Kimi K2.6"],
    "C9XNQIS1agIE77YJf1m1jA_card_01": ["DeepSeek", "Kimi", "DeepSeek V4", "Kimi K2.6", "Muon优化器"],

    # ── NVIDIA / Compute ─────────────────────────────────────────────────────
    "z_687rOEqpwydIwoul9SCQ_card_01": ["NVIDIA", "黄仁勋"],
    "fAsBUHVRZ0k9IXZFz2GB3g_card_01": ["NVIDIA", "华为", "阿里云", "曙光", "中兴"],
    "AGR2csTKJaCfj_YB0FXGpQ_card_01": ["Rail-Optimized网络", "NVIDIA NCCL"],
    "RDo308F6WZ7ZzO2n5a7AVw_card_01": ["NVIDIA", "World Labs"],
    "kMEZ8emCO8rwhJ9HDmC8fg_card_01": ["英特尔", "NVIDIA"],
    "kMEZ8emCO8rwhJ9HDmC8fg_card_02": ["NVIDIA", "Anthropic"],
    "kwErGjX231e2efVWhERzTw_card_01": ["Claude Code", "Meta", "Google DeepMind", "NVIDIA"],
    "fa2SMJ2mSN1CHopmHAOwkw_card_08": ["小马智行", "NVIDIA", "DRIVE Hyperion"],
    "8A6mQjgfxhTj9a50Tlse6w_card_01": ["三星", "LPDDR6", "Detachable AutoSSD"],

    # ── Other model releases ─────────────────────────────────────────────────
    "e6XTBGXYEMLz_NITNJFPvg_card_04": ["小米", "MiMo-V2.5"],
    "e6XTBGXYEMLz_NITNJFPvg_card_06": ["阶跃星辰", "StepAudio 2.5"],
    "59TX5PFMEwsXzsLZ_YhTRg_card_01": ["Lyra 2.0", "NVIDIA Research", "NVIDIA"],

    # ── Academic/Research papers ─────────────────────────────────────────────
    "VCtSLapQKucVpqlvJp-48g_card_01": ["Decoupled DiLoCo", "Google DeepMind", "Jeff Dean"],
    "p-F7qQzDRgwOQTfl1WIL8A_card_01": ["LLM DNA"],
    "pnQpiRspZH68UoGR8YFSiA_card_01": ["M⋆", "Microsoft"],
    "pnQpiRspZH68UoGR8YFSiA_card_02": ["AutoHarness", "Google"],
    "uXvcwhc7CP4nGw13Tw5B-w_card_01": ["SimpleTES", "宽德智能学习实验室", "Stanford", "清华大学"],
    "KmiOOuJsFikeCt6LcIrYHw_card_01": ["Squeeze Evolve", "UC Berkeley", "Stanford", "Together AI"],
    "Ku1dZNIpI93J21d75RYAkg_card_01": ["XBridge", "中科院计算技术研究所", "ACL 2026"],
    "68U5hHkOirI5SFPybA_Olg_card_01": ["SkVM", "IPADS", "上海交通大学"],
    "N3Y7o_AbSVGqpNAc-EJL3g_card_01": ["CodeTracer", "NJU-LINK", "南京大学", "快手科技"],
    "wmjQ2Kxw7QdwijbgyowAmQ_card_01": ["LLM-as-a-Verifier", "Stanford", "UC Berkeley", "NVIDIA"],
    "DNck9A5iNAITZY0pySfUFw_card_01": ["ReBalance", "哈尔滨工业大学", "ICLR 2026"],
    "ilHVq-lbdWnzDgWAw3xNHQ_card_01": ["MathForge", "ICLR 2026", "中国人民大学"],
    "v3XujOLco3fMJuEzQKer0w_card_01": ["UC Berkeley", "Stanford"],
    "FQxg8UEnqU1_-cGJgeobPw_card_01": ["浙江大学", "ETH Zurich"],
    "E8yBh1I_8z4BeHgk4m3q7w_card_01": ["Meta-encoder", "上海交通大学", "Nature Communications"],
    "am6FOS9N6O5AOFxgodAuHw_card_01": ["联影智能", "uAI Nexus MedVLM", "MedVidBench", "CVPR 2026"],

    # ── ICLR 2026 ────────────────────────────────────────────────────────────
    "nO8AIAnvHhkLRyGHCgErUQ_card_01": ["ICLR 2026", "DCGAN", "DDPG", "Alec Radford"],
    "vV7TIWgQ8P3LdLyJxivLcA_card_01": ["ICLR 2026", "DCGAN", "Alec Radford", "Thinking Machines Lab"],

    # ── Tools / Products ─────────────────────────────────────────────────────
    "0A6x8S7Jv5tzE85QAq2cZQ_card_01": ["OpenClaw", "DeepSeek V4", "DeepSeek"],
    "0FaIoY1HBqKO0R_vGTxbcA_card_01": ["OpenClaw", "DeepSeek V4", "DeepSeek", "Google Meet"],
    "MxQSiAjUOw5dELZtfzrMOQ_card_01": ["OpenClaw", "DeepSeek V4", "Google Meet"],
    "EhKyO_-0qbyaEuzxSz6iYA_card_01": ["ClawSweeper", "OpenClaw", "Peter Steinberger", "Codex"],
    "HXtk5YrCJHp3LQkCcGVM5A_card_01": ["ClawSweeper", "OpenClaw", "Peter Steinberger", "Codex"],
    "EJu8LjZB5e0pRpWmICZg6w_card_01": ["Hyperframes", "HeyGen"],
    "d4o6_quYKWxR0YiCcUbi0w_card_01": ["CutClaw", "GVCLab"],
    "chLjBTcO-mHz15FXFAm8Sg_card_01": ["ColaOS", "AirJelly", "Paperboy", "Boxy", "Creao"],
    "LtbF0QV1kzcWGzWFUZSnOA_card_01": ["兔展智能", "UniWorld-V2.5", "华为昇腾"],
    "zDyucvyMywy-jS5y8wps3Q_card_01": ["剪映", "字节跳动"],
    "drznIJshQRdXoyOSe2_1aA_card_01": ["涂鸦智能", "Hey Tuya", "阿里云", "AWS"],

    # ── Consumer Electronics / Hardware ─────────────────────────────────────
    "o876HXNhHNjiT7JD2lFBBw_card_01": ["华为", "Pura X Max", "小艺"],
    "kMEZ8emCO8rwhJ9HDmC8fg_card_07": ["泡泡玛特", "LABUBU"],
    "kMEZ8emCO8rwhJ9HDmC8fg_card_08": ["比亚迪"],
    "kMEZ8emCO8rwhJ9HDmC8fg_card_09": [],
    "Z1ydZoj2DYHNIdejTzB4-w_card_01": ["奥迪", "华为乾崑", "一汽奥迪"],
    "DMbmVy_n7DAb0HrkZwjTrA_card_01": ["Meta", "Ray-Ban", "Blayzer Optics"],

    # ── Automotive ───────────────────────────────────────────────────────────
    "fa2SMJ2mSN1CHopmHAOwkw_card_06": ["Momenta", "Uber", "Grab"],
    "fa2SMJ2mSN1CHopmHAOwkw_card_07": ["上汽大众", "比亚迪", "Momenta"],

    # ── Macro / Industry / Business ──────────────────────────────────────────
    "kwErGjX231e2efVWhERzTw_card_01": ["Claude Code", "Meta", "Google DeepMind", "NVIDIA"],
    "vyMdMxo4Yo8o-FU-4uekng_card_01": ["Epoch AI"],
    "n31RQ_5tXLsfHasRzAemJg_card_01": ["Hudson River Trading", "Scale AI", "Cognition", "Perplexity"],
    "kMEZ8emCO8rwhJ9HDmC8fg_card_05": ["字节跳动", "豆包", "抖音"],
    "kMEZ8emCO8rwhJ9HDmC8fg_card_06": ["Microsoft"],
    "5U_NPOr8k2hSuOIZ6-kb_w_card_01": ["万格智元", "万象智维", "明日新程", "一苇宇航"],
    "0ZvmquYSdtgwMF9X8Yj3Cw_card_01": ["清华大学", "智谱AI", "商汤研究院", "中国指挥与控制学会"],

    # ── Infrastructure / OS / Misc ───────────────────────────────────────────
    "fa2SMJ2mSN1CHopmHAOwkw_card_02": ["Microsoft", "Azure Linux", "Fedora"],
    "fa2SMJ2mSN1CHopmHAOwkw_card_03": ["英特尔"],
    "fa2SMJ2mSN1CHopmHAOwkw_card_05": ["Apple"],
    "fa2SMJ2mSN1CHopmHAOwkw_card_09": [],
}

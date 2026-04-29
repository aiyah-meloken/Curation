# 微软 Azure Linux 将基于 Fedora 重构，引入 x86_64-v3 微架构

据科技媒体 Phoronix 报道，微软计划对自研 Azure Linux 操作系统进行重大改造，将其底层从独立维护的 RPM 发行版转向基于 Fedora 构建。Azure Linux（原 CBL-Mariner）目前用于 Azure 云服务和 WSL（适用于 Linux 的 Windows 子系统）。Fedora 本周召开的下一代企业级 Linux 专题会议纪要显示，微软和 Fyra Labs 对 Fedora 的 x86_64-v3 微架构支持表现出强烈兴趣。

- **技术路线变化**：发行版基础从自有 RPM 体系迁移至 Fedora 生态，可能改变 Azure Linux 的维护模式和更新节奏
- **x86_64-v3**：该微架构级别要求 CPU 支持 AVX2 等指令集，启用后可带来性能提升，但会排除部分较旧的 x86 处理器
- **参与方**：微软与 Fyra Labs 共同表达兴趣，Fedora 社区在会议中专门讨论了企业级场景需求

**信号**：微软在企业级 Linux 策略上从独立维护转向依托 Fedora 社区，x86_64-v3 的推进意味着云基础设施对 CPU 指令集的基线要求在提升。

## 链接

https://mp.weixin.qq.com/s/fa2SMJ2mSN1CHopmHAOwkw

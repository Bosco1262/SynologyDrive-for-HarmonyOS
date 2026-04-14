# SynologyDrive-for--HarmonyOS

HarmonyOS 风格 Synology Drive 客户端的 MVP 工程基础（TypeScript 领域层原型）。

## 当前实现范围（对应实施方案）

- 分层结构基础：
  - UI 模型层（`src/ui`）
  - 同步引擎层（`src/sync`）
  - API 网关层（`src/api`）
  - 本地元数据层（`src/storage`）
  - 任务调度层（`src/scheduler`）
  - 可靠性与安全层（`src/reliability`, `src/security`）
- 双向同步 MVP：
  - 首次全量同步（拉取远端 + 推送本地）
  - 增量同步（本地变更上推 + 游标拉取远端变更）
  - 冲突决策（基于时间戳，支持保留冲突副本）
- 二阶段能力：
  - 选择性同步（include/exclude 路径策略）
  - 同步限速（按字节速率节流上传/删除操作）
  - 任务日志（结构化记录）
  - 通知中心（同步开始/完成/失败）
- 可靠性：
  - 指数退避重试
  - 死信队列记录失败任务
- 安全基础：
  - Token 存储抽象
  - 审计日志敏感字段脱敏

> 说明：当前为可测试的核心领域逻辑，不含完整 HarmonyOS UI/系统后台任务集成。

## 快速开始

```bash
npm install
npm run build
npm test
```

## 项目结构

```text
src/
  api/          # Drive API 网关抽象与内存实现
  core/         # 事件总线
  reliability/  # 重试与死信队列
  scheduler/    # 同步任务调度
  security/     # Token 与审计日志
  storage/      # 本地元数据存储
  sync/         # 快照、diff、冲突与同步引擎
  observability/# 任务日志
  notification/ # 通知中心
  ui/           # UI 视图模型定义
  __tests__/    # 核心同步测试
```

## 下一步建议（第三阶段）

1. 接入真实 Synology Drive API（认证、错误码、速率限制、权限）。
2. 将 `MetadataStore` 替换为持久化数据库（游标/任务状态崩溃恢复）。
3. 接入 HarmonyOS 后台任务能力，实现前后台切换下的稳定恢复。
4. 扩展冲突策略（版本号优先、手工策略）和大文件分片上传下载。

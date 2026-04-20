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
- 三阶段能力：
  - 冲突策略扩展（时间戳/版本优先/手工策略）
  - 大文件分片传输抽象（ChunkTransferManager）
  - 前后台切换恢复（任务队列 checkpoint/restore）
- 四阶段能力：
  - Synology 风格 API 网关（Token 鉴权、路径写权限、请求限流）
  - 文件持久化元数据存储（游标/任务状态/调度 checkpoint/传输 checkpoint）
  - HarmonyOS 生命周期桥接（前后台切换触发暂停与恢复）
  - 分片上传断点续传检查点（基于 MetadataStore）
  - 本地文件读写抽象（FsLocalFileStore，用于真实文件元数据生成）
- 五阶段能力（本次）：
  - 多页面桌面 UI 拆分（登录页/文件页/任务页/设置页）
  - 同步状态聚合视图模型（`DesktopSyncViewModel`，由 metadata/task 状态驱动）
  - QuickConnect 服务器地址解析与断联重连（`https://quickconnect.cn/*`）
- 可靠性：
  - 指数退避重试
  - 死信队列记录失败任务
- 安全基础：
  - Token 存储抽象
  - 审计日志敏感字段脱敏

> 说明：当前工程已包含可运行的多页面 HarmonyOS UI 壳层与可测试领域逻辑；系统级后台任务仍可继续增强。

## 快速开始

```bash
npm install
npm run build
npm test
```

## 在 DevEco Studio 直接运行

> 仓库根目录已包含 HarmonyOS Stage 工程骨架（`AppScope/`、`entry/`、`hvigorfile.ts`、`build-profile.json5`）。

1. 在 DevEco Studio 选择 **Open**，直接打开仓库根目录（不要把仓库放进另一个工程的 `entry` 目录）。
2. 等待 hvigor 同步完成后，选择 `entry` 模块运行。
3. 默认页面为 `entry/src/main/ets/pages/Index.ets`，可在此接入 `src/` 下同步领域逻辑。

### 当前 UI（Windows 风格，多页面）

- 顶部工具栏：品牌区、搜索框、QuickConnect 输入、连接/重连、同步触发
- 左侧导航栏：登录页、文件页、任务页、设置页
- 右侧主区域：按页面切换展示（登录信息、文件列表、任务进度、设置）
- 底部状态栏：连接状态 + 文件/任务统计

## 项目结构

```text
src/
  api/          # Drive API 网关抽象与内存实现
  core/         # 事件总线
  reliability/  # 重试与死信队列
  scheduler/    # 同步任务调度与生命周期恢复
  security/     # Token 与审计日志
  storage/      # 本地元数据存储
  sync/         # 快照、diff、冲突与同步引擎
  observability/# 任务日志
  notification/ # 通知中心
  ui/           # UI 视图模型定义
  __tests__/    # 核心同步测试
```

## 下一步建议（第五阶段）

1. 将 Synology 风格网关替换为真实 NAS OpenAPI 适配器（完整鉴权与错误码映射）。
2. 将 JSON 文件持久层升级为关系型/键值数据库，实现多任务并发索引。
3. 接入系统级后台任务（如 WorkScheduler）与通知权限治理。
4. 增加端到端集成测试（含文件系统、断网重试、重启恢复）。

# Bruin: Agent Native 产品设计理念

> Bruin 不是一个带有 AI 功能的笔记应用，而是一个为 AI Agent 原生设计的知识工具，人类是审阅者和受益者。

---

## 一、什么是 Agent Native

### 传统工具 vs Agent Native 工具

| 维度 | 传统 AI 增强工具 | Agent Native 工具 |
|------|----------------|------------------|
| **主要用户** | 人类，AI 辅助 | AI Agent，人类审阅 |
| **交互入口** | GUI 为主，API 为辅 | MCP/API 为主，GUI 为辅 |
| **数据写入** | 人类手动输入 | Agent 自动采集、整理、写入 |
| **设计目标** | 降低人类操作成本 | 降低 Agent 操作摩擦 |
| **信息流向** | 人 → 工具 → 存储 | 世界 → Agent → 工具 → 人 |

Agent Native 的核心洞察：**下一代生产力工具的主要"用户"不是人，而是 Agent。** 人类的角色从"操作者"变为"监督者"和"消费者"。

### 为什么 Markdown 编辑器适合 Agent Native

Markdown 是 LLM 的母语。Agent 天然以 Markdown 思考和输出。一个为 Agent 设计的 Markdown 编辑器不需要任何格式转换层——Agent 写入的内容直接就是人类阅读的内容。这是其他富文本格式（DOCX、Notion blocks）无法比拟的优势。

---

## 二、核心设计原则

### 原则 1: MCP First — 协议即产品

Bruin 的 MCP Server 不是 GUI 的附属 API，而是产品的**第一界面**。

设计要求：
- **MCP 工具能力 >= GUI 能力**：任何人类在 GUI 上能做的事，Agent 通过 MCP 也能做到
- **MCP 工具应超越 GUI**：Agent 有独特需求（批量操作、结构化查询、追加写入），这些能力不需要在 GUI 上暴露，但必须在 MCP 上存在
- **MCP 是第一等公民**：新功能先设计 MCP 接口，再考虑 GUI 展示

Bruin 当前的 MCP 工具集：

```
基础操作（8 个）          Agent 增强（5 个）
├── create_note           ├── batch_create_notes    ← 批量原子创建
├── read_note             ├── append_to_note        ← 追加而非替换
├── update_note           ├── get_backlinks         ← 知识图谱查询
├── delete_note           ├── get_daily_note        ← 日记/日志入口
├── list_notes            └── advanced_query        ← 结构化过滤
├── search_notes
├── list_tags
└── get_note_by_title
```

### 原则 2: 零摩擦写入 — Agent 的手不应该抖

Agent 操作工具时，每一次额外的 API 调用都是摩擦，每一次不必要的确认都是延迟。

设计要求：
- **一次调用完成一个意图**：`batch_create_notes` 而非循环调用 `create_note`
- **智能默认值**：`get_daily_note` 不传日期就是今天；tags 不传就从内容自动提取
- **追加优于覆盖**：`append_to_note` 让 Agent 可以增量写入，不用先读后写再拼接
- **幂等友好**：`get_daily_note` 天然幂等，无论调用几次都返回同一个今日笔记

### 原则 3: 结构化存储 — 给 Agent 可查询的记忆

人类靠直觉和视觉扫描找信息。Agent 需要结构化的查询能力。

设计要求：
- **标签即语义**：`#twitter/summary`、`#daily`、`#project/bruin` — 层级标签是 Agent 的分类系统
- **元数据可扩展**：`note_metadata` 表允许 Agent 附加任意 key-value 元数据（来源、状态、优先级）
- **组合查询**：`advanced_query` 支持日期范围 + 标签 AND/OR + 字数范围 + 全文搜索的组合过滤
- **双向链接**：`[[wiki-link]]` + `get_backlinks` 构建笔记间的知识图谱

### 原则 4: 人类作为审阅者 — GUI 是消费界面

GUI 的核心用途不是"创建"内容，而是**审阅、组织、发现** Agent 创建的内容。

设计要求：
- **实时反映变化**：Agent 通过 MCP 写入后，GUI 应能看到最新内容（共享 SQLite + WAL 模式）
- **清晰的来源标记**：未来可通过 `note_metadata` 中的 `source: "agent"` 标记 Agent 创建的内容
- **高效浏览**：三栏布局（侧栏/列表/编辑器）让人类快速扫描和审阅大量 Agent 产出的笔记
- **人类仍可创建**：GUI 保留完整的创建和编辑能力，两种工作流并存

### 原则 5: 本地优先 — 数据主权

Agent 代替人类操作的前提是信任。信任的基础是数据主权。

设计要求：
- **SQLite 本地存储**：所有数据在 `~/Library/Application Support/com.bruin.app/bruin.db`
- **MCP 通过 stdio**：Agent 通过本地进程通信，不经过任何网络
- **iCloud 同步可选**：跨设备同步通过 iCloud，不依赖第三方服务
- **无遥测无追踪**：Agent 操作的数据永远不离开本机

---

## 三、核心场景

### 场景 1: Agent 浏览 Twitter 并记录摘要

```
Agent 工作流：
1. 浏览 Twitter 时间线，滚动收集 100+ 推文
2. 去重、过滤噪音（广告、数字、无意义内容）
3. 按主题分类汇总

Agent → Bruin MCP 调用：
1. get_daily_note()                          → 获取今日日记
2. append_to_note(daily_id, "## Twitter 摘要\n...")  → 追加摘要到日记
3. batch_create_notes([                      → 批量创建主题笔记
     {title: "AI 领域动态 2026-02-20", content: "...", tags: ["twitter", "ai"]},
     {title: "产品设计趋势", content: "...", tags: ["twitter", "design"]},
     {title: "开源项目推荐", content: "...", tags: ["twitter", "opensource"]},
   ])
```

人类打开 Bruin → 看到今日日记里有 Twitter 摘要 → 点击标签浏览各主题笔记 → 完成信息消费。

### 场景 2: Agent 作为研究助手

```
用户指令："帮我调研 Rust GUI 框架的现状"

Agent → Bruin MCP 调用：
1. create_note("Rust GUI 框架调研 2026-02", content, tags: ["research", "rust", "gui"])
2. 持续研究中: append_to_note(id, "## Tauri\n...")
3. 继续追加: append_to_note(id, "## Dioxus\n...")
4. 创建对比: create_note("Rust GUI 框架对比表", table_content, tags: ["research", "rust"])
```

### 场景 3: Agent 日志与知识积累

```
Agent 每日自动运行：
1. get_daily_note()                    → 创建/获取今日日记
2. append_to_note(id, "## 今日任务")   → 记录工作日志
3. 工作过程中持续 append               → 增量记录
4. 结束时 append 总结                   → 闭环

用户周末回顾：
advanced_query({
  date_from: "2026-02-17",
  date_to: "2026-02-21",
  tags: ["daily"],
  tag_mode: "or"
})
→ 获取本周所有日记，快速回顾 Agent 一周工作
```

### 场景 4: 知识图谱与跨笔记关联

```
Agent 在笔记 A 中引用 [[笔记 B]]
Agent 在笔记 C 中也引用 [[笔记 B]]

用户查看笔记 B 时：
get_backlinks("笔记 B")
→ 发现笔记 A 和 C 都关联到此，形成知识网络
```

---

## 四、架构设计

### 双入口单存储架构

```
┌─────────────────────────────────────────────────────┐
│                   SQLite (WAL)                       │
│          ~/Library/.../bruin.db                      │
│  ┌──────┬──────┬──────────┬─────────┬─────────────┐ │
│  │notes │ tags │ note_tags│notes_fts│note_metadata│ │
│  └──┬───┴──┬───┴────┬─────┴────┬────┴──────┬──────┘ │
└─────┼──────┼────────┼──────────┼───────────┼────────┘
      │      │        │          │           │
  ┌───┴──────┴────────┴──────────┴───────────┴───┐
  │              Shared DB File                   │
  └───────────┬────────────────────┬──────────────┘
              │                    │
     ┌────────┴────────┐  ┌───────┴────────┐
     │   Tauri (Rust)  │  │  MCP (Node.js) │
     │   GUI Backend   │  │  Agent Backend │
     │                 │  │                │
     │  ┌───────────┐  │  │  ┌──────────┐  │
     │  │ Commands  │  │  │  │  Tools   │  │
     │  │  notes    │  │  │  │  13 个   │  │
     │  │  tags     │  │  │  │          │  │
     │  │  search   │  │  │  │          │  │
     │  │  sync     │  │  │  │          │  │
     │  └─────┬─────┘  │  │  └────┬─────┘  │
     └────────┼────────┘  └───────┼────────┘
              │                    │
     ┌────────┴────────┐  ┌───────┴────────┐
     │   React GUI     │  │   AI Agent     │
     │   (人类界面)     │  │   (通过 stdio) │
     └─────────────────┘  └────────────────┘
```

关键设计决策：
- **SQLite WAL 模式**：允许 GUI 和 MCP 并发读写，不互相阻塞
- **FTS5 全文搜索**：Agent 和人类共享同一个搜索引擎
- **Trigger 自动同步**：notes 表变更自动同步到 FTS 索引，无需手动维护

### MCP 工具设计原则

每个 MCP 工具的设计都遵循：

```
1. 输入极简化 — 只要求必要参数，其余智能推断
2. 输出信息充分 — 返回足够的上下文供 Agent 下一步决策
3. 错误信息可操作 — 不只说"失败"，要说"为什么"和"怎么办"
4. 原子性保证 — 要么完全成功，要么完全不变
```

---

## 五、Roadmap: Agent Native 能力演进

### v0.1 (当前) — 基础能力

- [x] CRUD 笔记（GUI + MCP）
- [x] 层级标签系统
- [x] FTS5 全文搜索
- [x] Wiki-link 双向链接
- [x] iCloud 同步
- [x] 8 个基础 MCP 工具

### v0.2 (进行中) — Agent 增强

- [x] 批量创建 `batch_create_notes`
- [x] 追加写入 `append_to_note`
- [x] 反向链接 `get_backlinks`
- [x] 每日笔记 `get_daily_note`
- [x] 高级查询 `advanced_query`
- [x] 扩展元数据 `note_metadata`
- [x] 多主题支持（6 个 Bear 风格主题）

### v0.3 (规划中) — Agent 感知

- [ ] **MCP Resources**：将笔记暴露为 MCP Resource，支持 Agent 订阅变更
- [ ] **Agent Activity Feed**：GUI 中展示 Agent 的操作日志（哪个 Agent 创建/修改了什么）
- [ ] **Webhook/事件通知**：笔记变更时通知 Agent（实现双向通信）
- [ ] **模板系统**：预定义日报、周报、会议纪要模板，Agent 填充内容
- [ ] **笔记状态机**：draft → review → published 状态流转，Agent 写入 draft，人类审阅后 publish

### v0.4 (远期) — 知识网络

- [ ] **知识图谱可视化**：基于 wiki-link 和 backlinks 的图谱 UI
- [ ] **语义搜索**：Embedding 向量索引，支持"找到和这篇笔记相似的内容"
- [ ] **Agent Workspace**：多 Agent 协作的共享工作区，每个 Agent 有自己的标签空间
- [ ] **跨应用集成**：通过 MCP 与其他 Agent Native 工具互通（日历、邮件、代码编辑器）

---

## 六、与现有产品的差异化

### vs Bear / Obsidian / Notion

这些是优秀的**人类优先**笔记工具。它们可能会加入 AI 功能，但架构上是"给人用的工具，加了 AI 辅助"。

Bruin 是反过来的：**给 Agent 用的工具，加了人类审阅界面**。

具体差异：

| 能力 | Bear/Obsidian/Notion | Bruin |
|------|---------------------|-------|
| 批量操作 | 不支持或需要插件 | `batch_create_notes` 原生支持 |
| 追加写入 | 不支持（必须全量更新） | `append_to_note` 原生支持 |
| 结构化查询 | 有限的筛选 | `advanced_query` 组合过滤 |
| Agent 日志 | 不支持 | `get_daily_note` 原生支持 |
| 元数据扩展 | 有限的属性 | `note_metadata` 任意 key-value |
| MCP 协议 | 不支持 | 原生 MCP Server |
| 本地数据 | 部分支持 | 完全本地 SQLite |

### 定位声明

> **Bruin 是第一个 Agent Native 的 Markdown 知识库。**
>
> 在 AI Agent 成为日常工作核心助手的时代，Bruin 是它们的笔记本。
> Agent 在这里记录、整理、关联知识；人类在这里审阅、发现、思考。
>
> 不是 AI 帮人记笔记，是 Agent 自己记笔记，人来看。

---

## 七、技术栈选型理由

| 技术 | 选型理由 |
|------|---------|
| **Tauri + Rust** | 本地优先，原生性能，小体积，安全沙箱 |
| **SQLite + WAL** | 单文件数据库，支持并发读写，Agent 和 GUI 互不阻塞 |
| **FTS5** | SQLite 内置全文搜索，无需外部搜索引擎 |
| **MCP (stdio)** | 标准化 Agent 通信协议，零网络依赖 |
| **TipTap** | 基于 ProseMirror 的富文本编辑器，支持 Markdown 双向转换 |
| **React + Zustand** | 轻量状态管理，适合桌面应用 |
| **Tailwind CSS** | 主题系统基于 CSS 变量，切换零延迟 |
| **iCloud** | macOS 原生同步，无需自建后端 |

每一项选择都服务于同一个目标：**让 Agent 写入快、让人类阅读好、让数据留在本地。**

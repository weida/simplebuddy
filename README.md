# Simple Buddy Allocator

A small implementation of the [buddy memory allocation](https://en.wikipedia.org/wiki/Buddy_memory_allocation) algorithm, with a browser-based interactive demo.

**演示地址 / Live demo：** https://weida.github.io/simplebuddy/

![Web demo screenshot](assets/simplebuddy-web-2026-04-26.png)

> 截图 / Screenshot：演示页运行时实际样貌。视频演示见下方"演示视频"章节。

---

## 目录结构 / Layout

```
simplebuddy/
├── README.md            ← 本文件
├── index.html           ← 根目录跳转（GitHub Pages 入口，自动转到 web/）
├── assets/              ← 截图等静态资源
├── c/                   ← C 实现（参考实现，与教材风格一致）
│   ├── buddy.c
│   ├── buddy.h
│   ├── buddytest.c
│   ├── list.h
│   └── Makefile
└── web/                 ← 浏览器演示（HTML + CSS + 原生 JS，零构建）
    ├── index.html
    ├── styles.css
    └── app.js
```

`c/` 和 `web/` 互不依赖，可独立运行。

---

## 算法核心 / The algorithm in 60 seconds

- 内存被切成 **2^N 个固定大小的页**（本演示：16 页 × 64K = 1024K，MAX_ORDER=4）
- 每个 order `i` 维护一个空闲块链表 `free_area[i]`，块大小为 `2^i 个页`
- **申请 `s` 字节**：把 `s` 向上取到最小的 `2^k * page_size`，从 `free_area[k]` 拿；如果空，从更大 order 取一块**反复二分**
- **释放**：归还后查 `buddy_pfn = pfn XOR 2^order`；若 buddy 同 order 且空闲，**合并**升一级，循环到不能合为止
- 内部碎片 = 实际分配 − 用户请求（典型代价是 buddy 的"对齐到 2^k"换来的可控碎片）

详细的步骤可视化、`free_area` 实时变化、分裂树、合并触发条件都在 web 演示里能看到。

---

## C 版本 / C reference implementation

仿 Linux 内核早期 buddy 风格的精简实现。

```bash
cd c
make
./buddytest
```

**已知问题**：`buddy.c` 里有一些旧式 K&R 风格的隐式函数声明，**新版 GCC（>= 9 左右）会报 `-Wimplicit-function-declaration` 错误**。如要在新机器上编译，需要在 `buddy.c` / `buddytest.c` 顶部补全函数原型，或者临时用 `CFLAGS += -fpermissive` 降级警告（不推荐长期方案）。这块刻意保留原貌，没改，要修的话单独提 PR，别和 web 改动混在一起。

---

## Web 演示 / Browser demo

纯静态：HTML + CSS + 原生 JS，没有任何构建步骤、没有依赖。

### 本地开发

随便起一个静态服务即可。Python 自带的就够：

```bash
cd /path/to/simplebuddy
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000/web/
```

或者直接 `xdg-open web/index.html`（少数浏览器对 `file://` 加载字体可能限制，建议起服务）。

### 主要功能

- **手动操作**：左侧输入 pid 和大小，点"申请"/"释放"
- **示例脚本**：8 步内置流程（A 申请 34K → B 66K → C 35K → D 67K → 各种释放），可单步、可自动播放
- **可视化**：连续内存条 + 分裂树 + `free_area` 各 order 链表，操作时同步动画
- **i18n**：右上角 `[ZH / EN]` 切换中英文，记忆在 localStorage
- **解说**：右上角 `[解说]` 按钮可展开当前步骤的"在做什么 + 公式 + 下一步"详情，默认折叠
- **冲突自处理**：手动操作打乱状态后再点 step / play，会自动重置并从脚本第 1 步开始（顶部黄 notice 提示）

### 关键文件

| 文件 | 职责 |
|---|---|
| `web/index.html` | 页面骨架 + i18n hook（`data-i18n` 属性） |
| `web/styles.css` | amber CRT 主题，btop 风格面板，扫描线，响应式 |
| `web/app.js` | 算法 + 渲染 + i18n（`t(key, params)` 函数 + zh/en 字典）+ 事件 |

---

## 发布到 GitHub Pages / Publishing

GitHub Pages 从 `gh-pages` 分支根目录读取。本项目的 `web/` 内容通过 `git subtree split` 推到 `gh-pages`。

```bash
# 1. 改完 web/ 后正常提交到 master
git add web/index.html web/styles.css web/app.js
git commit -m "Your message"
git push origin master

# 2. 把 web/ 子树切出来推到 gh-pages
COMMIT=$(git subtree split --prefix web)
git push origin $COMMIT:gh-pages
```

线上地址：https://weida.github.io/simplebuddy/  
GitHub Pages 有缓存，发布后等 1–3 分钟，强刷（Cmd/Ctrl+Shift+R）。

---

## SSH key

仓库配置了专用 deploy key，**不**走同事共享的 key：

- SSH host alias：`github-simplebuddy`
- 期望的 origin：`git@github-simplebuddy:weida/simplebuddy.git`
- 私钥/公钥：`~/.ssh/id_ed25519_simplebuddy_deploy{,.pub}`

不要删除或覆盖这两个文件。`git remote -v` 验证 origin 是不是 `github-simplebuddy:` 前缀。

---

## 演示视频 / Demo video

> TODO: 录屏待补。建议覆盖：
> 1. 自动播放完整 8 步流程
> 2. 中英切换前后文字
> 3. 手动 alloc 后点 step 触发自动重置
> 4. 展开解说面板看公式
> 5. 移动端窗口缩到 < 760px 看响应式
>
> 录完后把视频放到 `assets/` 或链接到外部，并更新本节。

---

## 后续可优化方向

仅供参考，不是必做：

1. **C 编译兼容**：补全函数原型让新 GCC 通过
2. **教学体验**：把每次拆分/合并拆成更细的动画帧（当前是"一次操作完成后展示结果"，不是逐帧执行内部循环）
3. **失败原因提示**：例如"为什么不能合并"的 hover 解释
4. **C 与 JS 输出对齐**：基于 `buddytest.c` 的步骤再细化日志，使两版输出可逐行对比
5. **更大规模演示**：支持改 `MAX_ORDER` 和页大小，看不同参数下碎片表现

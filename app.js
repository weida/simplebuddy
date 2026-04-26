/* ══════════════════════════════════════════════════════════════════════
   buddy_alloc demo · main script
   - same algorithm as the C version (16 pages, 64K/page, MAX_ORDER=5)
   - i18n: zh/en, persisted in localStorage
   - re-renders all dynamic text on language switch
═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const maxOrder = 5;            // 0..4 meaningful, max as sentinel
  const pageCount = 16;
  const pageSizeK = 64;
  const LANG_KEY = "buddy.lang";
  const EXPLAIN_KEY = "buddy.explain";        // "1" = visible, "0" = collapsed

  /* ──────────────── i18n dictionary ──────────────── */
  const i18n = {
    zh: {
      title: "Buddy 内存分配器",
      heroTitle: "Buddy 内存分配器",

      statUsedPages: "已分配页",
      statFreePages: "空闲页",
      statLargest: "最大空闲块",
      statWaste: "内部碎片",

      panelOps: "操作",
      panelMem: "连续内存布局",
      panelExplain: "当前步骤解说",
      panelTree: "分裂树",
      panelArea: "FREE_AREA",
      panelAlloc: "已分配块",
      panelLog: "操作记录",

      labelPid: "进程 / pid",
      labelSize: "申请大小 (K)",
      btnAlloc: "申请",
      btnFree: "释放",
      btnStep: "下一步",
      btnPlay: "自动播放",
      btnPause: "暂停",
      btnReset: "重置",
      btnClear: "清空",
      labelSpeed: "演示速度",
      labelScript: "示例流程",
      speedFmt: "{sec}s",
      btnExplain: "解说",

      legendFree: "空闲",
      legendUsed: "已分配",
      legendActive: "变化中",

      noticeAutoReset: "状态已重置，将从示例第 1 步开始。",

      explainNow: "// 正在发生",
      explainFormula: "// 关键公式",
      explainNext: "// 下一步",

      initMsg: "初始状态：一个 2^4 空闲块覆盖全部内存。",
      initExplainTitle: "初始化",
      initExplainBody: "全部内存先作为一个 order 4 空闲块进入 free_area[4]。每页 64K，所以 order 4 表示 16 页，也就是 1024K。",
      initFormula: "block_pages = 2^order\norder 4 = 16 pages = 1024K",
      initNext: "点击\"下一步\"或\"自动播放\"开始演示，也可以手动输入参数后申请。",
      initLog: "init: 16 个 64K 页组成一个 order 4 空闲块。",

      stepAllocFmt: "下一步：进程 {pid} 申请 {size}K。",
      stepFreeFmt: "下一步：进程 {pid} 释放内存。",
      stepEnd: "示例流程结束，所有块应逐步合并回一个 order 4 空闲块。",

      scriptAllocFmt: "{pid} 申请 {size}K",
      scriptFreeFmt: "{pid} 释放",

      allocFailTooBigLog: "申请失败：{size}K 超过演示内存容量。",
      allocFailTooBigTitle: "申请失败",
      allocFailTooBigBody: "请求 {size}K 大于演示内存的最大连续容量，无法找到可容纳它的 power-of-two 块。",
      allocFailTooBigCode: "max_capacity = {cap}K",

      allocFailDupLog: "申请失败：进程 {pid} 已经持有内存，请先释放。",
      allocFailDupTitle: "申请失败",
      allocFailDupBody: "进程 {pid} 已经占用一个块。本演示用进程名作为唯一标识，避免重复申请覆盖状态。",
      allocFailDupCode: "pid {pid} already allocated",

      allocFailNoBlockLog: "申请失败：没有可用的 2^{order} 块。",
      allocFailNoBlockTitle: "没有合适空闲块",
      allocFailNoBlockBody: "请求 {size}K 需要 order {order}，但 free_area[{order}] 以及更大的空闲链表都没有可拆分的块。",
      allocFailNoBlockCode: "need >= {rounded}K, order = {order}",

      allocSplitLog: "拆分：页 {start} 的 2^{from} 块产生空闲 buddy，起点 {buddy}，大小 2^{order}。",
      allocOkLog: "申请：进程 {pid} 请求 {size}K，得到页 {start}-{end}，order {order}。",
      allocOkMsg: "进程 {pid} 请求 {size}K，实际分配 {rounded}K，内部碎片 {waste}K。",
      allocOkTitle: "进程 {pid} 分配完成",
      allocOkBody: "先把 {size}K 向上取到最小可容纳块 {rounded}K，也就是 order {order}。如果 free_area[{order}] 没有块，就从 order {sourceOrder} 取一个更大的块一路二分，左半继续用于分配，右半回到对应 free list。",
      allocOkCode: "ceil({size}K / 64K) = {pages} 页\n2^{order} = {bs} 页\n内部碎片 = {rounded}K - {size}K = {waste}K",

      freeFailLog: "释放失败：进程 {pid} 没有已分配块。",
      freeOkLog: "释放：进程 {pid} 归还页 {start}-{end}，order {order}。",
      freeMergeLog: "合并：页 {start} 与 buddy 合并为 2^{order} 块。",
      freeOkMsg: "进程 {pid} 已释放，页 {start}-{end} 回收后合并到 order {order}。",
      freeOkTitle: "进程 {pid} 释放完成",
      freeOkBody: "释放时先找到当前块的 buddy：buddy_pfn = pfn XOR 2^order。只有 buddy 也是同 order 的空闲块时才能合并；合并后继续向更高 order 检查，直到遇到已分配块或到达最大 order。",
      freeOkCode: "起点 pfn = {start}\n原 order = {order}\nbuddy = pfn XOR 2^order\n最终空闲块：页 {finalStart}-{finalEnd}, order {finalOrder}",

      endMsg: "示例流程已播放完成，内存回到一个完整的 order 4 空闲块。",
      endTitle: "演示完成",
      endBody: "A、B、C、D 都释放后，相邻且同 order 的 buddy 块逐层合并，最终恢复为一个覆盖全部 16 页的 order 4 空闲块。",
      endCode: "最终：free_area[4] = { 页 0 }\nfree_area[0..3] = 空",
      endNext: "可以重置后手动尝试不同大小，观察内部碎片和合并是否发生。",

      formInvalid: "请输入有效的进程名和申请大小。",
      freeMissingPid: "请输入要释放的进程名。",
      pauseMsg: "自动播放已暂停。",
      playMsg: "正在自动播放示例流程。",

      areaEmpty: "空",
      pageRangeFmt: "页 {start}-{end} · order {order}",
      allocMetaFmt: "请求 {size}K，分配 {alloc}K，内部碎片 {waste}K",
      allocLabelFmt: "{pid}:2^{order}",
      freeLabelFmt: "2^{order}",
      allocEmpty: "// 暂无已分配块",
      areaPageFmt: "p{start}",
      treeUsedFmt: "{pid} {bytes}K",
      treeFreeFmt: "free {bytes}K",
      treeSplit: "split",

      _trailing: ""
    },

    en: {
      title: "Buddy Allocator",
      heroTitle: "Buddy Allocator",

      statUsedPages: "used pages",
      statFreePages: "free pages",
      statLargest: "largest free",
      statWaste: "internal frag",

      panelOps: "ops",
      panelMem: "contiguous memory",
      panelExplain: "current step",
      panelTree: "split tree",
      panelArea: "FREE_AREA",
      panelAlloc: "allocations",
      panelLog: "log",

      labelPid: "process / pid",
      labelSize: "request size (K)",
      btnAlloc: "alloc",
      btnFree: "free",
      btnStep: "step",
      btnPlay: "play",
      btnPause: "pause",
      btnReset: "reset",
      btnClear: "clear",
      labelSpeed: "playback speed",
      labelScript: "demo script",
      speedFmt: "{sec}s",
      btnExplain: "trace",

      legendFree: "free",
      legendUsed: "used",
      legendActive: "active",

      noticeAutoReset: "State reset. Restarting demo from step 1.",

      explainNow: "// what is happening",
      explainFormula: "// key formula",
      explainNext: "// next",

      initMsg: "init: a single 2^4 free block covers all memory.",
      initExplainTitle: "INIT",
      initExplainBody: "All memory enters free_area[4] as one order 4 free block. Each page is 64K, so order 4 means 16 pages = 1024K total.",
      initFormula: "block_pages = 2^order\norder 4 = 16 pages = 1024K",
      initNext: "Click 'step' or 'play' to start the demo, or enter values and click alloc.",
      initLog: "init: 16 pages × 64K combined as one order 4 free block.",

      stepAllocFmt: "next: process {pid} requests {size}K.",
      stepFreeFmt: "next: process {pid} frees its block.",
      stepEnd: "Demo finished. All blocks should have merged back into one order 4 free block.",

      scriptAllocFmt: "{pid} alloc {size}K",
      scriptFreeFmt: "{pid} free",

      allocFailTooBigLog: "alloc failed: {size}K exceeds total memory.",
      allocFailTooBigTitle: "Alloc failed",
      allocFailTooBigBody: "Request {size}K is larger than the maximum contiguous capacity. No power-of-two block can hold it.",
      allocFailTooBigCode: "max_capacity = {cap}K",

      allocFailDupLog: "alloc failed: pid {pid} already holds a block — free it first.",
      allocFailDupTitle: "Alloc failed",
      allocFailDupBody: "Process {pid} already owns a block. This demo uses pid as a unique key, so duplicate allocations are rejected to keep state consistent.",
      allocFailDupCode: "pid {pid} already allocated",

      allocFailNoBlockLog: "alloc failed: no free 2^{order} block available.",
      allocFailNoBlockTitle: "No suitable free block",
      allocFailNoBlockBody: "Request {size}K needs order {order}, but free_area[{order}] and all higher-order free lists are empty — nothing can be split.",
      allocFailNoBlockCode: "need >= {rounded}K, order = {order}",

      allocSplitLog: "split: 2^{from} block at page {start} produces a free buddy at {buddy}, size 2^{order}.",
      allocOkLog: "alloc: pid {pid} requested {size}K → pages {start}-{end}, order {order}.",
      allocOkMsg: "pid {pid} requested {size}K, allocated {rounded}K, internal frag {waste}K.",
      allocOkTitle: "pid {pid} allocated",
      allocOkBody: "Round {size}K up to the smallest power-of-two block that fits: {rounded}K (order {order}). If free_area[{order}] is empty, take a larger block from order {sourceOrder} and split it down — left half keeps splitting, right half goes back to its free list.",
      allocOkCode: "ceil({size}K / 64K) = {pages} pages\n2^{order} = {bs} pages\ninternal_frag = {rounded}K - {size}K = {waste}K",

      freeFailLog: "free failed: pid {pid} holds no block.",
      freeOkLog: "free: pid {pid} returned pages {start}-{end}, order {order}.",
      freeMergeLog: "merge: page {start} merged with buddy → 2^{order} block.",
      freeOkMsg: "pid {pid} freed. Pages {start}-{end} reclaimed and merged up to order {order}.",
      freeOkTitle: "pid {pid} freed",
      freeOkBody: "On free, locate the buddy: buddy_pfn = pfn XOR 2^order. Merge only if the buddy is free and at the same order; then climb to the next order and try again, until a non-mergeable buddy or MAX_ORDER is reached.",
      freeOkCode: "start pfn = {start}\noriginal order = {order}\nbuddy = pfn XOR 2^order\nfinal free block: pages {finalStart}-{finalEnd}, order {finalOrder}",

      endMsg: "Demo complete. Memory restored to a single order 4 free block.",
      endTitle: "demo done",
      endBody: "After A, B, C, D are all freed, adjacent same-order buddies merge upward layer by layer, restoring one order 4 block covering all 16 pages.",
      endCode: "final: free_area[4] = { page 0 }\nfree_area[0..3] = empty",
      endNext: "Reset, then try arbitrary sizes manually to see fragmentation and merging in action.",

      formInvalid: "Enter a valid pid and request size.",
      freeMissingPid: "Enter the pid to free.",
      pauseMsg: "Playback paused.",
      playMsg: "Auto-playing demo script.",

      areaEmpty: "·",
      pageRangeFmt: "pages {start}-{end} · order {order}",
      allocMetaFmt: "req {size}K, got {alloc}K, frag {waste}K",
      allocLabelFmt: "{pid}:2^{order}",
      freeLabelFmt: "2^{order}",
      allocEmpty: "// no allocations",
      areaPageFmt: "p{start}",
      treeUsedFmt: "{pid} {bytes}K",
      treeFreeFmt: "free {bytes}K",
      treeSplit: "split",

      _trailing: ""
    }
  };

  /* ──────────────── state ──────────────── */
  const state = {
    pages: [],
    freeAreas: [],
    allocations: new Map(),
    log: [],
    scriptIndex: 0,
    playing: false,
    timer: null,
    speed: 1400,
    focus: null,
    lang: "zh",
    manualDirty: false,         // set by manual alloc/free clicks; auto-reset on next step
    explanation: { kind: "init", params: {} }
  };

  let messageState = { kind: "key", key: "initMsg", params: {} };

  const script = [
    { type: "alloc", pid: "A", size: 34 },
    { type: "alloc", pid: "B", size: 66 },
    { type: "alloc", pid: "C", size: 35 },
    { type: "alloc", pid: "D", size: 67 },
    { type: "free", pid: "B" },
    { type: "free", pid: "D" },
    { type: "free", pid: "A" },
    { type: "free", pid: "C" }
  ];

  const els = {
    memory: document.getElementById("memory"),
    freeAreas: document.getElementById("freeAreas"),
    log: document.getElementById("log"),
    message: document.getElementById("message"),
    usedPages: document.getElementById("usedPages"),
    freePages: document.getElementById("freePages"),
    largestBlock: document.getElementById("largestBlock"),
    wasteK: document.getElementById("wasteK"),
    explainTitle: document.getElementById("explainTitle"),
    explainBody: document.getElementById("explainBody"),
    formula: document.getElementById("formula"),
    nextAction: document.getElementById("nextAction"),
    tree: document.getElementById("tree"),
    processId: document.getElementById("processId"),
    requestSize: document.getElementById("requestSize"),
    allocateBtn: document.getElementById("allocateBtn"),
    freeBtn: document.getElementById("freeBtn"),
    stepBtn: document.getElementById("stepBtn"),
    playBtn: document.getElementById("playBtn"),
    playLabel: document.getElementById("playLabel"),
    resetBtn: document.getElementById("resetBtn"),
    speedRange: document.getElementById("speedRange"),
    speedLabel: document.getElementById("speedLabel"),
    clearLogBtn: document.getElementById("clearLogBtn"),
    scriptList: document.getElementById("scriptList"),
    langToggle: document.getElementById("langToggle"),
    notice: document.getElementById("notice"),
    explainerPanel: document.getElementById("explainerPanel"),
    explainToggle: document.getElementById("explainToggle"),
    htmlRoot: document.documentElement
  };

  /* ──────────────── i18n core ──────────────── */
  function t(key, params) {
    const dict = i18n[state.lang] || i18n.zh;
    let str = dict[key];
    if (str === undefined) str = i18n.zh[key];
    if (str === undefined) return key;
    if (params) {
      str = str.replace(/\{(\w+)\}/g, (_, k) =>
        params[k] !== undefined ? params[k] : "{" + k + "}"
      );
    }
    return str;
  }

  function applyStaticI18n() {
    document.title = t("title");
    els.htmlRoot.setAttribute("lang", state.lang === "zh" ? "zh-CN" : "en");
    els.htmlRoot.setAttribute("data-lang", state.lang);
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      el.textContent = t(key);
    });
  }

  function setLang(lang) {
    if (lang !== "zh" && lang !== "en") return;
    state.lang = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ignore */ }
    applyStaticI18n();
    updateSpeedLabel();
    els.playLabel.textContent = state.playing ? t("btnPause") : t("btnPlay");
    render();
  }

  function loadLang() {
    let stored = null;
    try { stored = localStorage.getItem(LANG_KEY); } catch (e) { /* ignore */ }
    if (stored === "zh" || stored === "en") return stored;
    const nav = (navigator.language || "").toLowerCase();
    return nav.startsWith("zh") ? "zh" : "en";
  }

  /* ──────────────── algorithm ──────────────── */
  function initPages() {
    state.pages = Array.from({ length: pageCount }, (_, index) => ({
      index, pid: "", order: null, freeOrder: null
    }));
    state.freeAreas = Array.from({ length: maxOrder }, () => []);
    state.freeAreas[maxOrder - 1].push(0);
    state.pages[0].freeOrder = maxOrder - 1;
    state.allocations.clear();
  }

  function orderForSize(sizeK) {
    let pages = Math.max(1, Math.ceil(sizeK / pageSizeK));
    let order = 0;
    let cap = 1;
    while (cap < pages) { cap *= 2; order += 1; }
    return order;
  }
  function blockSize(order) { return 1 << order; }
  function capacityK(order) { return blockSize(order) * pageSizeK; }

  function removeFree(start, order) {
    const area = state.freeAreas[order];
    const idx = area.indexOf(start);
    if (idx !== -1) area.splice(idx, 1);
    state.pages[start].freeOrder = null;
  }
  function addFree(start, order) {
    state.pages[start].freeOrder = order;
    state.freeAreas[order].push(start);
    state.freeAreas[order].sort((a, b) => a - b);
  }

  /* ──────────────── ops ──────────────── */
  function allocate(pid, sizeK) {
    const order = orderForSize(sizeK);
    const roundedK = capacityK(order);

    if (order >= maxOrder) {
      addLog("alloc", t("allocFailTooBigLog", { size: sizeK }), { error: true });
      setExplanation("allocFailTooBig", { size: sizeK, cap: capacityK(maxOrder - 1), pid: pid });
      render();
      return;
    }
    if (state.allocations.has(pid)) {
      addLog("alloc", t("allocFailDupLog", { pid: pid }), { error: true });
      setExplanation("allocFailDup", { pid: pid, size: sizeK });
      render();
      return;
    }

    let currentOrder = order;
    while (currentOrder < maxOrder && state.freeAreas[currentOrder].length === 0) {
      currentOrder += 1;
    }
    if (currentOrder >= maxOrder) {
      addLog("alloc", t("allocFailNoBlockLog", { order: order }), { error: true });
      setExplanation("allocFailNoBlock", { size: sizeK, rounded: roundedK, order: order });
      render();
      return;
    }

    const start = state.freeAreas[currentOrder][0];
    const sourceOrder = currentOrder;
    removeFree(start, currentOrder);
    state.focus = { kind: "active", start: start, order: currentOrder };

    while (currentOrder > order) {
      currentOrder -= 1;
      const buddyStart = start + blockSize(currentOrder);
      addFree(buddyStart, currentOrder);
      state.focus = { kind: "splitting", start: buddyStart, order: currentOrder };
      addLog("split", t("allocSplitLog", {
        start: start, from: currentOrder + 1, buddy: buddyStart, order: currentOrder
      }));
    }

    for (let i = start; i < start + blockSize(order); i += 1) {
      state.pages[i].pid = pid;
      state.pages[i].order = order;
    }
    state.allocations.set(pid, { start: start, order: order, sizeK: sizeK });
    state.focus = { kind: "active", start: start, order: order };
    state.lastTouchedPid = pid;

    addLog("alloc", t("allocOkLog", {
      pid: pid, size: sizeK, start: start,
      end: start + blockSize(order) - 1, order: order
    }));
    setMessageKey("allocOkMsg", {
      pid: pid, size: sizeK, rounded: roundedK, waste: roundedK - sizeK
    });
    setExplanation("allocOk", {
      pid: pid, size: sizeK, rounded: roundedK, order: order,
      sourceOrder: sourceOrder, pages: Math.ceil(sizeK / pageSizeK),
      bs: blockSize(order), waste: roundedK - sizeK
    });
    render();
  }

  function freeProcess(pid) {
    const allocation = state.allocations.get(pid);
    if (!allocation) {
      addLog("free", t("freeFailLog", { pid: pid }), { error: true });
      render();
      return;
    }

    let { start, order } = allocation;
    const originalStart = start;
    const originalOrder = order;
    for (let i = start; i < start + blockSize(order); i += 1) {
      state.pages[i].pid = "";
      state.pages[i].order = null;
    }
    state.allocations.delete(pid);
    state.lastTouchedPid = null;
    addLog("free", t("freeOkLog", {
      pid: pid, start: start, end: start + blockSize(order) - 1, order: order
    }));

    while (order < maxOrder - 1) {
      const buddyStart = start ^ blockSize(order);
      const buddy = state.pages[buddyStart];
      if (!buddy || buddy.freeOrder !== order) break;
      removeFree(buddyStart, order);
      start = Math.min(start, buddyStart);
      order += 1;
      state.focus = { kind: "merging", start: start, order: order };
      addLog("merge", t("freeMergeLog", { start: start, order: order }));
    }

    addFree(start, order);
    state.focus = { kind: "active", start: start, order: order };
    setMessageKey("freeOkMsg", {
      pid: pid,
      start: originalStart,
      end: originalStart + blockSize(originalOrder) - 1,
      order: order
    });
    setExplanation("freeOk", {
      pid: pid, start: originalStart, order: originalOrder,
      finalStart: start, finalEnd: start + blockSize(order) - 1, finalOrder: order
    });
    render();
  }

  /* ──────────────── explanation (re-renderable) ──────────────── */
  function setExplanation(kind, params) {
    state.explanation = { kind: kind, params: params || {} };
  }

  function renderExplanation() {
    const { kind, params } = state.explanation;
    const next = describeStep(state.scriptIndex);
    let title, body, formula;

    switch (kind) {
      case "init":
        title = t("initExplainTitle");
        body = t("initExplainBody");
        formula = t("initFormula");
        break;
      case "allocFailTooBig":
        title = t("allocFailTooBigTitle");
        body = t("allocFailTooBigBody", params);
        formula = t("allocFailTooBigCode", params);
        break;
      case "allocFailDup":
        title = t("allocFailDupTitle");
        body = t("allocFailDupBody", params);
        formula = t("allocFailDupCode", params);
        break;
      case "allocFailNoBlock":
        title = t("allocFailNoBlockTitle");
        body = t("allocFailNoBlockBody", params);
        formula = t("allocFailNoBlockCode", params);
        break;
      case "allocOk":
        title = t("allocOkTitle", params);
        body = t("allocOkBody", params);
        formula = t("allocOkCode", params);
        break;
      case "freeOk":
        title = t("freeOkTitle", params);
        body = t("freeOkBody", params);
        formula = t("freeOkCode", params);
        break;
      case "end":
        title = t("endTitle");
        body = t("endBody");
        formula = t("endCode");
        break;
      default:
        title = t("initExplainTitle");
        body = t("initExplainBody");
        formula = t("initFormula");
    }

    els.explainTitle.textContent = title;
    els.explainBody.textContent = body;
    els.formula.textContent = formula;
    els.nextAction.textContent = (kind === "end") ? t("endNext") : next;
  }

  function describeStep(index) {
    const step = script[index];
    if (!step) return t("stepEnd");
    return step.type === "alloc"
      ? t("stepAllocFmt", { pid: step.pid, size: step.size })
      : t("stepFreeFmt", { pid: step.pid });
  }

  /* ──────────────── messages (re-renderable) ──────────────── */
  function setMessageKey(key, params) {
    messageState = { kind: "key", key: key, params: params || {} };
    els.message.textContent = t(key, params);
  }

  function renderMessage() {
    if (messageState.kind === "key") {
      els.message.textContent = t(messageState.key, messageState.params);
    }
  }

  /* ──────────────── current blocks ──────────────── */
  function currentBlocks() {
    const blocks = [];
    state.allocations.forEach((alloc, pid) => {
      blocks.push({
        type: "used",
        label: t("allocLabelFmt", { pid: pid, order: alloc.order }),
        start: alloc.start, order: alloc.order
      });
    });
    state.freeAreas.forEach((starts, order) => {
      starts.forEach((start) => {
        blocks.push({
          type: "free",
          label: t("freeLabelFmt", { order: order }),
          start: start, order: order
        });
      });
    });
    return blocks.sort((a, b) => a.start - b.start || b.order - a.order);
  }

  /* ──────────────── render ──────────────── */
  function renderMemory() {
    els.memory.replaceChildren();
    for (let i = 0; i < pageCount; i += 1) {
      const page = document.createElement("div");
      page.className = "page";
      page.dataset.index = i;
      page.dataset.hex = "0x" + i.toString(16).toUpperCase().padStart(2, "0");
      els.memory.appendChild(page);
    }
    const blocks = currentBlocks();
    blocks.forEach((block) => {
      const node = document.createElement("div");
      node.className = "block " + block.type;
      if (state.focus && state.focus.start === block.start && state.focus.order === block.order) {
        node.classList.add(state.focus.kind);
      }
      node.textContent = block.label;
      node.style.left = "calc(" + (block.start / pageCount) * 100 + "% + 2px)";
      node.style.width = "calc(" + (blockSize(block.order) / pageCount) * 100 + "% - 4px)";
      node.style.top = ((maxOrder - 1 - block.order) * 36) + "px";
      els.memory.appendChild(node);
    });
  }

  function renderFreeAreas() {
    els.freeAreas.replaceChildren();
    for (let order = 0; order < maxOrder; order += 1) {
      const area = document.createElement("div");
      area.className = "area";
      const head = document.createElement("strong");
      head.textContent = "order " + order;
      area.appendChild(head);
      if (state.freeAreas[order].length === 0) {
        const empty = document.createElement("span");
        empty.className = "empty";
        empty.textContent = t("areaEmpty");
        area.appendChild(empty);
      } else {
        state.freeAreas[order].forEach((start) => {
          const chip = document.createElement("span");
          chip.textContent = t("areaPageFmt", { start: start });
          area.appendChild(chip);
        });
      }
      els.freeAreas.appendChild(area);
    }
  }

  function renderStats() {
    let usedPages = 0;
    let wasteK = 0;
    state.allocations.forEach((a) => {
      usedPages += blockSize(a.order);
      wasteK += capacityK(a.order) - a.sizeK;
    });
    const largest = state.freeAreas.reduce((found, starts, order) => {
      return starts.length > 0 ? order : found;
    }, null);

    els.usedPages.textContent = usedPages;
    els.freePages.textContent = pageCount - usedPages;
    els.largestBlock.textContent = (largest === null) ? "-" : ("2^" + largest);
    els.wasteK.textContent = wasteK + "K";
  }

  function blockAt(start, order) {
    const allocEntry = Array.from(state.allocations.entries()).find(
      (e) => e[1].start === start && e[1].order === order
    );
    if (allocEntry) {
      return {
        type: "used",
        label: t("treeUsedFmt", { pid: allocEntry[0], bytes: capacityK(order) })
      };
    }
    if (state.pages[start] && state.pages[start].freeOrder === order) {
      return { type: "free", label: t("treeFreeFmt", { bytes: capacityK(order) }) };
    }
    return null;
  }
  function hasChildState(start, order) {
    if (order === 0) return false;
    const half = blockSize(order - 1);
    return Boolean(
      blockAt(start, order - 1) ||
      blockAt(start + half, order - 1) ||
      hasChildState(start, order - 1) ||
      hasChildState(start + half, order - 1)
    );
  }

  function renderTree() {
    els.tree.replaceChildren();
    for (let order = maxOrder - 1; order >= 0; order -= 1) {
      const row = document.createElement("div");
      row.className = "tree-row";
      const label = document.createElement("div");
      label.className = "tree-label";
      label.textContent = "order " + order;
      const track = document.createElement("div");
      track.className = "tree-track";
      track.style.gridTemplateColumns = "repeat(" + (pageCount / blockSize(order)) + ", minmax(0, 1fr))";
      for (let start = 0; start < pageCount; start += blockSize(order)) {
        const node = document.createElement("div");
        const block = blockAt(start, order);
        const split = !block && hasChildState(start, order);
        node.className = "tree-node " + (block ? block.type : split ? "split" : "");
        node.textContent = block ? block.label : split ? t("treeSplit") : "";
        track.appendChild(node);
      }
      row.appendChild(label);
      row.appendChild(track);
      els.tree.appendChild(row);
    }
  }


  function renderLog() {
    els.log.replaceChildren();
    state.log.slice().reverse().forEach((entry) => {
      const row = document.createElement("div");
      row.className = "entry";
      row.dataset.kind = entry.error ? "error" : entry.kind;
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = entry.error ? "[ERR]" : ("[" + (entry.kind || "info").toUpperCase() + "]");
      const text = document.createElement("span");
      text.className = "text";
      text.textContent = entry.text;
      row.appendChild(tag);
      row.appendChild(text);
      els.log.appendChild(row);
    });
    // newest entry is rendered at the top — keep it in view
    els.log.scrollTop = 0;
  }

  function renderScript() {
    els.scriptList.replaceChildren();
    script.forEach((step, index) => {
      const item = document.createElement("li");
      if (index === state.scriptIndex) item.classList.add("active");
      if (index < state.scriptIndex) item.classList.add("done");
      item.textContent = step.type === "alloc"
        ? t("scriptAllocFmt", { pid: step.pid, size: step.size })
        : t("scriptFreeFmt", { pid: step.pid });
      els.scriptList.appendChild(item);
    });
    els.stepBtn.disabled = state.scriptIndex >= script.length || state.playing;
    els.playLabel.textContent = state.playing ? t("btnPause") : t("btnPlay");
    els.playBtn.disabled = state.scriptIndex >= script.length && !state.playing;
  }

  /* ──────────────── log ──────────────── */
  function addLog(kind, text, opts) {
    state.log.push({
      kind: kind, text: text, error: Boolean(opts && opts.error)
    });
    renderLog();
  }

  /* ──────────────── render orchestration ──────────────── */
  function render() {
    renderMemory();
    renderFreeAreas();
    renderStats();
    renderExplanation();
    renderMessage();
    renderTree();
    renderLog();
    renderScript();
  }

  function readPid() {
    const pid = els.processId.value.trim().slice(0, 1).toUpperCase();
    els.processId.value = pid;
    return pid;
  }

  function reset() {
    stopPlayback();
    initPages();
    state.log = [];
    state.scriptIndex = 0;
    state.manualDirty = false;
    state.lastTouchedPid = null;
    state.focus = { kind: "active", start: 0, order: maxOrder - 1 };
    setExplanation("init", {});
    setMessageKey("initMsg");
    addLog("info", t("initLog"));
    render();
  }

  // Detects whether the next script step would conflict with current state
  // (e.g. user manually allocated A, but script[0] is also alloc A).
  // If so, we visibly reset, then re-fire the step after a brief delay so
  // the user actually perceives the state change.
  function nextStepConflicts() {
    const step = script[state.scriptIndex];
    if (!step) return false;
    if (step.type === "alloc") return state.allocations.has(step.pid);
    return !state.allocations.has(step.pid);
  }

  function runScriptStep() {
    if (state.scriptIndex >= script.length) {
      stopPlayback();
      setMessageKey("endMsg");
      setExplanation("end", {});
      render();
      return false;
    }

    if (nextStepConflicts()) {
      // sync reset + recurse with clean state — no setTimeout games that
      // would let schedulePlayback() clobber our recovery timer.
      // The notice banner + log entry give the user visible feedback.
      initPages();
      state.log = [];
      state.scriptIndex = 0;
      state.lastTouchedPid = null;
      state.manualDirty = false;
      state.focus = { kind: "active", start: 0, order: maxOrder - 1 };
      setExplanation("init", {});
      setMessageKey("initMsg");
      addLog("info", t("noticeAutoReset"));
      showNotice(t("noticeAutoReset"));
      // intentional: do NOT render() here — recurse and let allocate()'s
      // own render() paint the post-step state in one frame.
      return runScriptStep();
    }

    const step = script[state.scriptIndex];
    state.scriptIndex += 1;
    els.processId.value = step.pid;
    if (step.type === "alloc") {
      els.requestSize.value = step.size;
      allocate(step.pid, step.size);
    } else {
      freeProcess(step.pid);
    }
    renderScript();
    return true;
  }

  /* ──────────────── notice (transient banner) ──────────────── */
  function showNotice(text) {
    if (!els.notice) return;
    els.notice.textContent = text;
    els.notice.hidden = false;
    // restart CSS animation by reflowing
    els.notice.style.animation = "none";
    void els.notice.offsetWidth;
    els.notice.style.animation = "";
    clearTimeout(state.noticeTimer);
    state.noticeTimer = setTimeout(() => {
      els.notice.hidden = true;
    }, 2700);
  }

  /* ──────────────── explainer toggle ──────────────── */
  function setExplainerVisible(visible) {
    state.explainerVisible = !!visible;
    try { localStorage.setItem(EXPLAIN_KEY, visible ? "1" : "0"); } catch (e) { /* ignore */ }
    els.explainerPanel.hidden = !visible;
    els.explainToggle.classList.toggle("active", visible);
  }
  function loadExplainPref() {
    try {
      const v = localStorage.getItem(EXPLAIN_KEY);
      if (v === "1") return true;
      if (v === "0") return false;
    } catch (e) { /* ignore */ }
    return false;  // default: collapsed
  }

  function schedulePlayback() {
    clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      if (!state.playing) return;
      const ran = runScriptStep();
      if (ran) schedulePlayback();
    }, state.speed);
  }
  function startPlayback() {
    if (state.scriptIndex >= script.length) reset();
    state.playing = true;
    setMessageKey("playMsg");
    runScriptStep();
    schedulePlayback();
    renderScript();
  }
  function stopPlayback() {
    state.playing = false;
    clearTimeout(state.timer);
    state.timer = null;
    renderScript();
  }

  function updateSpeedLabel() {
    state.speed = Number(els.speedRange.value);
    els.speedLabel.textContent = t("speedFmt", { sec: (state.speed / 1000).toFixed(1) });
  }

  /* ──────────────── events ──────────────── */
  function bindEvents() {
    els.allocateBtn.addEventListener("click", () => {
      const pid = readPid();
      const sizeK = Number(els.requestSize.value);
      if (!pid || !Number.isFinite(sizeK) || sizeK <= 0) {
        addLog("info", t("formInvalid"), { error: true });
        return;
      }
      allocate(pid, sizeK);
    });
    els.freeBtn.addEventListener("click", () => {
      const pid = readPid();
      if (!pid) {
        addLog("info", t("freeMissingPid"), { error: true });
        return;
      }
      freeProcess(pid);
    });
    els.stepBtn.addEventListener("click", runScriptStep);
    els.playBtn.addEventListener("click", () => {
      if (state.playing) {
        stopPlayback();
        setMessageKey("pauseMsg");
      } else {
        startPlayback();
      }
    });
    els.resetBtn.addEventListener("click", reset);
    els.speedRange.addEventListener("input", () => {
      updateSpeedLabel();
      if (state.playing) schedulePlayback();
    });
    els.clearLogBtn.addEventListener("click", () => {
      state.log = [];
      renderLog();
    });
    els.langToggle.addEventListener("click", () => {
      setLang(state.lang === "zh" ? "en" : "zh");
    });
    els.explainToggle.addEventListener("click", () => {
      setExplainerVisible(!state.explainerVisible);
    });
  }

  /* ──────────────── boot ──────────────── */
  state.lang = loadLang();
  applyStaticI18n();
  bindEvents();
  updateSpeedLabel();
  setExplainerVisible(loadExplainPref());
  reset();
}());

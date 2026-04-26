(function () {
  "use strict";

  const maxOrder = 5;
  const pageCount = 16;
  const pageSizeK = 64;

  const state = {
    pages: [],
    freeAreas: [],
    allocations: new Map(),
    log: [],
    scriptIndex: 0,
    playing: false,
    timer: null,
    speed: 1200,
    focus: null,
    explanation: {
      title: "初始化",
      body: "全部内存先作为一个 order 4 空闲块进入 free_area[4]。",
      formula: "block_pages = 2^order",
      next: "点击“下一步”或“自动播放”开始 A 进程申请 34K。"
    }
  };

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
    allocations: document.getElementById("allocations"),
    processId: document.getElementById("processId"),
    requestSize: document.getElementById("requestSize"),
    allocateBtn: document.getElementById("allocateBtn"),
    freeBtn: document.getElementById("freeBtn"),
    stepBtn: document.getElementById("stepBtn"),
    playBtn: document.getElementById("playBtn"),
    resetBtn: document.getElementById("resetBtn"),
    speedRange: document.getElementById("speedRange"),
    speedLabel: document.getElementById("speedLabel"),
    clearLogBtn: document.getElementById("clearLogBtn"),
    scriptList: document.getElementById("scriptList")
  };

  function initPages() {
    state.pages = Array.from({ length: pageCount }, (_, index) => ({
      index,
      pid: "",
      order: null,
      freeOrder: null
    }));
    state.freeAreas = Array.from({ length: maxOrder }, () => []);
    state.freeAreas[maxOrder - 1].push(0);
    state.pages[0].freeOrder = maxOrder - 1;
    state.allocations.clear();
  }

  function orderForSize(sizeK) {
    let pages = Math.max(1, Math.ceil(sizeK / pageSizeK));
    let order = 0;
    let capacity = 1;
    while (capacity < pages) {
      capacity *= 2;
      order += 1;
    }
    return order;
  }

  function blockSize(order) {
    return 1 << order;
  }

  function capacityK(order) {
    return blockSize(order) * pageSizeK;
  }

  function describeStep(index) {
    const step = script[index];
    if (!step) {
      return "示例流程结束，所有块应逐步合并回一个 order 4 空闲块。";
    }
    return step.type === "alloc"
      ? `下一步：进程 ${step.pid} 申请 ${step.size}K。`
      : `下一步：进程 ${step.pid} 释放内存。`;
  }

  function setExplanation(title, body, formula, next) {
    state.explanation = { title, body, formula, next };
  }

  function removeFree(start, order) {
    const area = state.freeAreas[order];
    const index = area.indexOf(start);
    if (index !== -1) {
      area.splice(index, 1);
    }
    state.pages[start].freeOrder = null;
  }

  function addFree(start, order) {
    state.pages[start].freeOrder = order;
    state.freeAreas[order].push(start);
    state.freeAreas[order].sort((a, b) => a - b);
  }

  function allocate(pid, sizeK) {
    const order = orderForSize(sizeK);
    const roundedK = capacityK(order);
    if (order >= maxOrder) {
      addLog(`申请失败：${sizeK}K 超过演示内存容量。`, true);
      setExplanation(
        "申请失败",
        `请求 ${sizeK}K 大于演示内存的最大连续容量，无法找到可容纳它的 power-of-two 块。`,
        `max_capacity = ${capacityK(maxOrder - 1)}K`,
        describeStep(state.scriptIndex)
      );
      return;
    }
    if (state.allocations.has(pid)) {
      addLog(`申请失败：进程 ${pid} 已经持有内存，请先释放。`, true);
      setExplanation(
        "申请失败",
        `进程 ${pid} 已经占用一个块。这个演示用进程名作为唯一标识，避免重复申请覆盖状态。`,
        `pid ${pid} already allocated`,
        describeStep(state.scriptIndex)
      );
      return;
    }

    let currentOrder = order;
    while (currentOrder < maxOrder && state.freeAreas[currentOrder].length === 0) {
      currentOrder += 1;
    }

    if (currentOrder >= maxOrder) {
      addLog(`申请失败：没有可用的 2^${order} 块。`, true);
      setExplanation(
        "没有合适空闲块",
        `请求 ${sizeK}K 需要 order ${order}，但 free_area[${order}] 以及更大的空闲链表都没有可拆分的块。`,
        `need >= ${roundedK}K, order = ${order}`,
        describeStep(state.scriptIndex)
      );
      return;
    }

    const start = state.freeAreas[currentOrder][0];
    const sourceOrder = currentOrder;
    removeFree(start, currentOrder);
    state.focus = { kind: "active", start, order: currentOrder };

    while (currentOrder > order) {
      currentOrder -= 1;
      const buddyStart = start + blockSize(currentOrder);
      addFree(buddyStart, currentOrder);
      state.focus = { kind: "splitting", start: buddyStart, order: currentOrder };
      addLog(`拆分：页 ${start} 的 2^${currentOrder + 1} 块产生空闲 buddy，起点 ${buddyStart}，大小 2^${currentOrder}。`);
    }

    for (let i = start; i < start + blockSize(order); i += 1) {
      state.pages[i].pid = pid;
      state.pages[i].order = order;
    }
    state.allocations.set(pid, { start, order, sizeK });
    state.focus = { kind: "active", start, order };
    addLog(`申请：进程 ${pid} 请求 ${sizeK}K，得到页 ${start}-${start + blockSize(order) - 1}，order ${order}。`);
    setMessage(`进程 ${pid} 请求 ${sizeK}K，实际分配 ${roundedK}K，内部碎片 ${roundedK - sizeK}K。`);
    setExplanation(
      `进程 ${pid} 分配完成`,
      `先把 ${sizeK}K 向上取到最小可容纳块 ${roundedK}K，也就是 order ${order}。如果 free_area[${order}] 没有块，就从 order ${sourceOrder} 取一个更大的块一路二分，左半继续用于分配，右半回到对应 free list。`,
      `ceil(${sizeK}K / 64K) = ${Math.ceil(sizeK / pageSizeK)} 页\n2^${order} = ${blockSize(order)} 页\n内部碎片 = ${roundedK}K - ${sizeK}K = ${roundedK - sizeK}K`,
      describeStep(state.scriptIndex)
    );
    render();
  }

  function freeProcess(pid) {
    const allocation = state.allocations.get(pid);
    if (!allocation) {
      addLog(`释放失败：进程 ${pid} 没有已分配块。`, true);
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
    addLog(`释放：进程 ${pid} 归还页 ${start}-${start + blockSize(order) - 1}，order ${order}。`);

    while (order < maxOrder - 1) {
      const buddyStart = start ^ blockSize(order);
      const buddy = state.pages[buddyStart];
      if (!buddy || buddy.freeOrder !== order) {
        break;
      }
      removeFree(buddyStart, order);
      start = Math.min(start, buddyStart);
      order += 1;
      state.focus = { kind: "merging", start, order };
      addLog(`合并：页 ${start} 与 buddy 合并为 2^${order} 块。`);
    }

    addFree(start, order);
    state.focus = { kind: "active", start, order };
    setMessage(`进程 ${pid} 已释放，页 ${originalStart}-${originalStart + blockSize(originalOrder) - 1} 回收后合并到 order ${order}。`);
    setExplanation(
      `进程 ${pid} 释放完成`,
      `释放时先找到当前块的 buddy：buddy_pfn = pfn XOR 2^order。只有 buddy 也是同 order 的空闲块时才能合并；合并后继续向更高 order 检查，直到遇到已分配块或到达最大 order。`,
      `起点 pfn = ${originalStart}\n原 order = ${originalOrder}\nbuddy = pfn XOR 2^order\n最终空闲块：页 ${start}-${start + blockSize(order) - 1}, order ${order}`,
      describeStep(state.scriptIndex)
    );
    render();
  }

  function currentBlocks() {
    const blocks = [];

    state.allocations.forEach((allocation, pid) => {
      blocks.push({
        type: "used",
        label: `${pid}:2^${allocation.order}`,
        start: allocation.start,
        order: allocation.order
      });
    });

    state.freeAreas.forEach((starts, order) => {
      starts.forEach((start) => {
        blocks.push({
          type: "free",
          label: `2^${order}`,
          start,
          order
        });
      });
    });

    return blocks.sort((a, b) => a.start - b.start || b.order - a.order);
  }

  function renderMemory() {
    els.memory.innerHTML = "";
    for (let i = 0; i < pageCount; i += 1) {
      const page = document.createElement("div");
      page.className = "page";
      page.dataset.index = i;
      els.memory.appendChild(page);
    }

    const blocks = currentBlocks();
    blocks.forEach((block) => {
      const node = document.createElement("div");
      node.className = `block ${block.type}`;
      if (state.focus && state.focus.start === block.start && state.focus.order === block.order) {
        node.classList.add(state.focus.kind);
      }
      node.textContent = block.label;
      node.style.left = `calc(${(block.start / pageCount) * 100}% + 2px)`;
      node.style.width = `calc(${(blockSize(block.order) / pageCount) * 100}% - 4px)`;
      node.style.top = `${(maxOrder - 1 - block.order) * 30}px`;
      els.memory.appendChild(node);
    });
  }

  function renderFreeAreas() {
    els.freeAreas.innerHTML = "";
    for (let order = 0; order < maxOrder; order += 1) {
      const area = document.createElement("div");
      area.className = "area";
      area.innerHTML = `<strong>order ${order}</strong>`;
      if (state.freeAreas[order].length === 0) {
        const empty = document.createElement("span");
        empty.textContent = "空";
        area.appendChild(empty);
      } else {
        state.freeAreas[order].forEach((start) => {
          const chip = document.createElement("span");
          chip.textContent = `页 ${start}`;
          area.appendChild(chip);
        });
      }
      els.freeAreas.appendChild(area);
    }
  }

  function renderStats() {
    let usedPages = 0;
    let wasteK = 0;
    state.allocations.forEach((allocation) => {
      usedPages += blockSize(allocation.order);
      wasteK += capacityK(allocation.order) - allocation.sizeK;
    });
    const largest = state.freeAreas.reduce((found, starts, order) => {
      return starts.length > 0 ? order : found;
    }, null);

    els.usedPages.textContent = usedPages;
    els.freePages.textContent = pageCount - usedPages;
    els.largestBlock.textContent = largest === null ? "-" : `2^${largest}`;
    els.wasteK.textContent = `${wasteK}K`;
  }

  function renderExplanation() {
    els.explainTitle.textContent = state.explanation.title;
    els.explainBody.textContent = state.explanation.body;
    els.formula.textContent = state.explanation.formula;
    els.nextAction.textContent = state.explanation.next;
  }

  function blockAt(start, order) {
    const allocation = Array.from(state.allocations.entries()).find((entry) => {
      return entry[1].start === start && entry[1].order === order;
    });
    if (allocation) {
      return { type: "used", label: `${allocation[0]}:${capacityK(order)}K` };
    }
    if (state.pages[start] && state.pages[start].freeOrder === order) {
      return { type: "free", label: `free ${capacityK(order)}K` };
    }
    return null;
  }

  function hasChildState(start, order) {
    if (order === 0) {
      return false;
    }
    const half = blockSize(order - 1);
    return Boolean(blockAt(start, order - 1) || blockAt(start + half, order - 1) || hasChildState(start, order - 1) || hasChildState(start + half, order - 1));
  }

  function renderTree() {
    els.tree.innerHTML = "";
    for (let order = maxOrder - 1; order >= 0; order -= 1) {
      const row = document.createElement("div");
      row.className = "tree-row";
      const label = document.createElement("div");
      label.className = "tree-label";
      label.textContent = `order ${order}`;
      const track = document.createElement("div");
      track.className = "tree-track";
      track.style.gridTemplateColumns = `repeat(${pageCount / blockSize(order)}, minmax(0, 1fr))`;

      for (let start = 0; start < pageCount; start += blockSize(order)) {
        const node = document.createElement("div");
        const block = blockAt(start, order);
        const split = !block && hasChildState(start, order);
        node.className = `tree-node ${block ? block.type : split ? "split" : ""}`;
        node.textContent = block ? block.label : split ? "split" : "";
        track.appendChild(node);
      }

      row.appendChild(label);
      row.appendChild(track);
      els.tree.appendChild(row);
    }
  }

  function renderAllocations() {
    els.allocations.innerHTML = "";
    if (state.allocations.size === 0) {
      const empty = document.createElement("div");
      empty.className = "allocation empty";
      empty.textContent = "暂无已分配块。执行示例后，这里会显示每个进程的页范围、实际分配容量和内部碎片。";
      els.allocations.appendChild(empty);
      return;
    }

    Array.from(state.allocations.entries())
      .sort((a, b) => a[1].start - b[1].start)
      .forEach(([pid, allocation]) => {
        const node = document.createElement("div");
        node.className = "allocation";
        const waste = capacityK(allocation.order) - allocation.sizeK;
        const badge = document.createElement("b");
        const detail = document.createElement("div");
        const title = document.createElement("p");
        const meta = document.createElement("small");
        badge.textContent = pid;
        title.textContent = `页 ${allocation.start}-${allocation.start + blockSize(allocation.order) - 1} · order ${allocation.order}`;
        meta.textContent = `请求 ${allocation.sizeK}K，分配 ${capacityK(allocation.order)}K，内部碎片 ${waste}K`;
        detail.appendChild(title);
        detail.appendChild(meta);
        node.appendChild(badge);
        node.appendChild(detail);
        els.allocations.appendChild(node);
      });
  }

  function renderLog() {
    els.log.innerHTML = "";
    state.log.slice().reverse().forEach((entry) => {
      const node = document.createElement("div");
      node.className = entry.error ? "entry error" : "entry";
      node.textContent = entry.text;
      els.log.appendChild(node);
    });
  }

  function renderScript() {
    els.scriptList.innerHTML = "";
    script.forEach((step, index) => {
      const item = document.createElement("li");
      item.className = index === state.scriptIndex ? "active" : "";
      if (index < state.scriptIndex) {
        item.classList.add("done");
      }
      item.textContent = step.type === "alloc"
        ? `${step.pid} 申请 ${step.size}K`
        : `${step.pid} 释放`;
      els.scriptList.appendChild(item);
    });
    els.stepBtn.disabled = state.scriptIndex >= script.length || state.playing;
    els.playBtn.textContent = state.playing ? "暂停播放" : "自动播放";
    els.playBtn.disabled = state.scriptIndex >= script.length && !state.playing;
  }

  function render() {
    renderMemory();
    renderFreeAreas();
    renderStats();
    renderExplanation();
    renderTree();
    renderAllocations();
    renderLog();
    renderScript();
  }

  function addLog(text, error) {
    state.log.push({ text, error: Boolean(error) });
    renderLog();
  }

  function setMessage(text) {
    els.message.textContent = text;
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
    state.focus = { kind: "active", start: 0, order: maxOrder - 1 };
    setExplanation(
      "初始化",
      "全部内存先作为一个 order 4 空闲块进入 free_area[4]。这个演示中每页 64K，所以 order 4 表示 16 页，也就是 1024K。",
      "block_pages = 2^order\norder 4 = 16 页 = 1024K",
      describeStep(0)
    );
    setMessage("初始状态：一个 2^4 空闲块覆盖全部内存。");
    addLog("初始化：16 个 64K 页组成一个 order 4 空闲块。");
    render();
  }

  function runScriptStep() {
    const step = script[state.scriptIndex];
    if (!step) {
      stopPlayback();
      setMessage("示例流程已播放完成，内存回到一个完整的 order 4 空闲块。");
      setExplanation(
        "演示完成",
        "A、B、C、D 都释放后，相邻且同 order 的 buddy 块逐层合并，最终恢复为一个覆盖全部 16 页的 order 4 空闲块。",
        "最终：free_area[4] = { 页 0 }\nfree_area[0..3] = 空",
        "可以重置后手动尝试不同大小，观察内部碎片和合并是否发生。"
      );
      render();
      return false;
    }

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

  function schedulePlayback() {
    clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      if (!state.playing) {
        return;
      }
      const didRun = runScriptStep();
      if (didRun) {
        schedulePlayback();
      }
    }, state.speed);
  }

  function startPlayback() {
    if (state.scriptIndex >= script.length) {
      reset();
    }
    state.playing = true;
    setMessage("正在自动播放示例流程。");
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
    els.speedLabel.textContent = `${(state.speed / 1000).toFixed(1)} 秒/步`;
  }

  function bindEvents() {
    els.allocateBtn.addEventListener("click", () => {
      const pid = readPid();
      const sizeK = Number(els.requestSize.value);
      if (!pid || !Number.isFinite(sizeK) || sizeK <= 0) {
        addLog("请输入有效的进程名和申请大小。", true);
        return;
      }
      allocate(pid, sizeK);
    });

    els.freeBtn.addEventListener("click", () => {
      const pid = readPid();
      if (!pid) {
        addLog("请输入要释放的进程名。", true);
        return;
      }
      freeProcess(pid);
    });

    els.stepBtn.addEventListener("click", () => {
      runScriptStep();
    });

    els.playBtn.addEventListener("click", () => {
      if (state.playing) {
        stopPlayback();
        setMessage("自动播放已暂停。");
      } else {
        startPlayback();
      }
    });

    els.resetBtn.addEventListener("click", reset);
    els.speedRange.addEventListener("input", () => {
      updateSpeedLabel();
      if (state.playing) {
        schedulePlayback();
      }
    });
    els.clearLogBtn.addEventListener("click", () => {
      state.log = [];
      renderLog();
    });
  }

  bindEvents();
  updateSpeedLabel();
  reset();
}());

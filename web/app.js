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
    focus: null
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
    if (order >= maxOrder) {
      addLog(`申请失败：${sizeK}K 超过演示内存容量。`, true);
      return;
    }
    if (state.allocations.has(pid)) {
      addLog(`申请失败：进程 ${pid} 已经持有内存，请先释放。`, true);
      return;
    }

    let currentOrder = order;
    while (currentOrder < maxOrder && state.freeAreas[currentOrder].length === 0) {
      currentOrder += 1;
    }

    if (currentOrder >= maxOrder) {
      addLog(`申请失败：没有可用的 2^${order} 块。`, true);
      return;
    }

    const start = state.freeAreas[currentOrder][0];
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
    setMessage(`进程 ${pid} 已分配 ${blockSize(order)} 页，共 ${blockSize(order) * pageSizeK}K。`);
    render();
  }

  function freeProcess(pid) {
    const allocation = state.allocations.get(pid);
    if (!allocation) {
      addLog(`释放失败：进程 ${pid} 没有已分配块。`, true);
      return;
    }

    let { start, order } = allocation;
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
    setMessage(`进程 ${pid} 已释放，空闲块回收到 order ${order}。`);
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
    state.allocations.forEach((allocation) => {
      usedPages += blockSize(allocation.order);
    });
    const largest = state.freeAreas.reduce((found, starts, order) => {
      return starts.length > 0 ? order : found;
    }, null);

    els.usedPages.textContent = usedPages;
    els.freePages.textContent = pageCount - usedPages;
    els.largestBlock.textContent = largest === null ? "-" : `2^${largest}`;
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
    setMessage("初始状态：一个 2^4 空闲块覆盖全部内存。");
    addLog("初始化：16 个 64K 页组成一个 order 4 空闲块。");
    render();
  }

  function runScriptStep() {
    const step = script[state.scriptIndex];
    if (!step) {
      stopPlayback();
      setMessage("示例流程已播放完成。");
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

/* Note 01: three tasks, one shared global slot vs one slot per task. */
(function () {
  "use strict";

  const lab = document.getElementById("race-lab");
  if (!lab) return;

  const TASKS = ["A", "B", "C"];
  // The order asyncio.gather actually runs them in: every task sets and
  // yields at its await, then each wakes up and reads.
  const STEPS = [
    { task: "A", op: "set" },
    { task: "B", op: "set" },
    { task: "C", op: "set" },
    { task: "A", op: "get" },
    { task: "B", op: "get" },
    { task: "C", op: "get" },
  ];
  const DEFAULT_VALUE = "none";
  const PLAY_DELAY_MS = 1100;

  const INTRO = {
    global: "Requests A, B and C arrive together. Each handler writes its id " +
      "to <code>global_request_id</code>, awaits some I/O, then reads it " +
      "back. Press Step.",
    ctx: "Same three requests, but the id now goes into " +
      "<code>request_id: ContextVar</code>. Press Step.",
  };
  const TEST_NAME = {
    global: "test_global_is_overwritten_by_concurrent_tasks",
    ctx: "test_context_var_keeps_each_tasks_own_value",
  };

  const lanesEl = lab.querySelector("[data-lanes]");
  const memoryEl = lab.querySelector("[data-memory]");
  const captionEl = lab.querySelector("[data-caption]");
  const stepButton = lab.querySelector('[data-act="step"]');
  const playButton = lab.querySelector('[data-act="play"]');
  const resetButton = lab.querySelector('[data-act="reset"]');
  const modeButtons = lab.querySelectorAll("[data-mode]");

  const state = { mode: "global", done: 0, timer: null };

  /** Value a task would read after the first `stepCount` steps ran. */
  function storedValue(stepCount, task) {
    const writes = STEPS.slice(0, stepCount).filter((s) => s.op === "set");
    if (state.mode === "ctx") {
      const ownWrite = writes.find((s) => s.task === task);
      return ownWrite ? ownWrite.task : DEFAULT_VALUE;
    }
    const lastWrite = writes[writes.length - 1];
    return lastWrite ? lastWrite.task : DEFAULT_VALUE;
  }

  function isSleeping(task, col) {
    const setCol = STEPS.findIndex((s) => s.task === task && s.op === "set");
    const getCol = STEPS.findIndex((s) => s.task === task && s.op === "get");
    return col > setCol && col < getCol;
  }

  function chipFor(task, col) {
    if (col >= state.done) return "";
    const step = STEPS[col];
    if (step.task !== task) {
      return isSleeping(task, col) ? '<span class="chip wait">await</span>' : "";
    }
    if (step.op === "set") return `<span class="chip set">set ${task}</span>`;
    const value = storedValue(col, task);
    const badClass = value === task ? "" : " is-bad";
    return `<span class="chip get${badClass}">get→${value}</span>`;
  }

  function renderLanes() {
    const nowCol = state.done - 1;
    const parts = ["<span></span>"];
    STEPS.forEach((_, col) => {
      const now = col === nowCol ? " is-now" : "";
      parts.push(`<span class="lanes__tick${now}">t${col + 1}</span>`);
    });
    TASKS.forEach((task) => {
      parts.push(`<span class="lane-name" data-task="${task}">Task ${task}</span>`);
      STEPS.forEach((_, col) => {
        const now = col === nowCol ? " is-now" : "";
        const chip = chipFor(task, col);
        parts.push(`<span class="cell${now}" data-task="${task}">${chip}</span>`);
      });
    });
    lanesEl.innerHTML = `<div class="lanes">${parts.join("")}</div>`;
  }

  function slotHtml(label, value, options) {
    const taskAttr = value === DEFAULT_VALUE ? "" : ` data-task="${value}"`;
    const bigClass = options.big ? " is-big" : "";
    const flashClass = options.flash ? " flash" : "";
    return `<div class="slot${bigClass}">` +
      `<span class="slot__label">${label}</span>` +
      `<span class="slot__value${flashClass}"${taskAttr}>"${value}"</span></div>`;
  }

  function changedSlotIndex() {
    const step = STEPS[state.done - 1];
    if (!step || step.op !== "set") return -1;
    return state.mode === "global" ? 0 : TASKS.indexOf(step.task);
  }

  function resultsHtml() {
    const reads = STEPS.slice(0, state.done)
      .map((step, col) => ({ step, col }))
      .filter(({ step }) => step.op === "get");
    return reads.map(({ step, col }) => {
      const value = storedValue(col, step.task);
      const ok = value === step.task;
      return `<span class="result ${ok ? "ok" : "bad"}">` +
        `${step.task} got "${value}" ${ok ? "✓" : "✗"}</span>`;
    }).join("");
  }

  function renderMemory() {
    const flashIndex = changedSlotIndex();
    const slots = state.mode === "global"
      ? [slotHtml("global_request_id", storedValue(state.done, null),
          { big: true, flash: flashIndex === 0 })]
      : TASKS.map((task, i) => slotHtml(`Task ${task}'s context`,
          storedValue(state.done, task), { big: false, flash: flashIndex === i }));
    const results = resultsHtml();
    memoryEl.innerHTML =
      '<p class="memory__title">Memory</p>' + slots.join("") +
      (results ? '<p class="memory__title is-spaced">Returned</p>' +
        `<div class="results">${results}</div>` : "");
  }

  function describeSet(task) {
    if (state.mode === "global") {
      return `Task ${task} writes "${task}" into the <em>one</em> shared ` +
        "global, hits <code>await asyncio.sleep()</code> and hands the " +
        "loop to the next task.";
    }
    return `Task ${task} writes "${task}" into <em>its own</em> context, ` +
      "then awaits and hands the loop on.";
  }

  function describeGet(task, value) {
    if (value !== task) {
      return `Task ${task} wakes up and reads "${value}". Someone else's id: ` +
        "the last writer won.";
    }
    if (state.mode === "global") {
      return `Task ${task} reads "${value}". Correct, but only by luck: it ` +
        "wrote last.";
    }
    return `Task ${task} wakes up and reads "${value}" from its own context. ` +
      "The other writes never touched it.";
  }

  function caption() {
    if (state.done === 0) return INTRO[state.mode];
    const col = state.done - 1;
    const step = STEPS[col];
    const tag = `<span class="step-tag">t${state.done}</span>`;
    const text = step.op === "set"
      ? describeSet(step.task)
      : describeGet(step.task, storedValue(col, step.task));
    const isLast = state.done === STEPS.length;
    const summary = isLast
      ? ` This is exactly what <code>${TEST_NAME[state.mode]}</code> asserts.`
      : "";
    return tag + text + summary;
  }

  function render() {
    renderLanes();
    renderMemory();
    captionEl.innerHTML = caption();
    stepButton.disabled = state.done >= STEPS.length;
  }

  function stop() {
    clearInterval(state.timer);
    state.timer = null;
    playButton.textContent = "Play";
  }

  function step() {
    if (state.done < STEPS.length) {
      state.done += 1;
      render();
    }
    if (state.done >= STEPS.length) stop();
  }

  function togglePlay() {
    if (state.timer) {
      stop();
      return;
    }
    if (state.done >= STEPS.length) state.done = 0;
    playButton.textContent = "Pause";
    step();
    state.timer = setInterval(step, PLAY_DELAY_MS);
  }

  function reset() {
    stop();
    state.done = 0;
    render();
  }

  function setMode(mode) {
    state.mode = mode;
    modeButtons.forEach((b) => {
      b.setAttribute("aria-checked", String(b.dataset.mode === mode));
    });
    reset();
  }

  stepButton.addEventListener("click", () => {
    stop();
    step();
  });
  playButton.addEventListener("click", togglePlay);
  resetButton.addEventListener("click", reset);
  modeButtons.forEach((b) => {
    b.addEventListener("click", () => setMode(b.dataset.mode));
  });

  render();
})();

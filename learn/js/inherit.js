/* Note 02: create_task copies the context, a bare await shares it. */
(function () {
  "use strict";

  const lab = document.getElementById("inherit-lab");
  if (!lab) return;

  const LAST_STEP = 4;
  const PARENT = "parent";
  const CHANGED = "changed-by-child";
  const DEFAULT_VALUE = "none";

  const SCENARIOS = [
    {
      title: "asyncio.create_task(child())",
      tag: "new Task",
      copies: true,
      lines: [
        'request_id.set("parent")',
        "task = asyncio.create_task(child())",
        '  # child sets "changed-by-child"',
        "await task",
        "request_id.get()",
      ],
      lineForStep: [-1, 0, 1, 2, 4],
    },
    {
      title: "await child()",
      tag: "same Task",
      copies: false,
      lines: [
        'request_id.set("parent")',
        "await child()",
        '  # child sets "changed-by-child"',
        "request_id.get()",
      ],
      lineForStep: [-1, 0, 1, 2, 3],
    },
  ];

  const CAPTIONS = [
    "Both columns run the same <code>child()</code> (the demo calls it " +
      "<code>child_changes_value</code>). It overwrites " +
      "<code>request_id</code>. Press Step.",
    'The parent sets <code>"parent"</code> in its context. Identical on ' +
      "both sides.",
    "<b>Left:</b> <code>create_task</code> snapshots the parent's context " +
      "into a new one for the child. <b>Right:</b> a bare <code>await</code> " +
      "just calls the child, which runs in the parent's context.",
    '<b>The child writes <code>"changed-by-child"</code>.</b> Left: it lands ' +
      "in the copy. Right: it lands in the only context there is, the " +
      "parent's.",
    '<b>The parent reads back.</b> Left gets <code>"parent"</code>: copied ' +
      'down, never up. Right gets <code>"changed-by-child"</code>: shared. ' +
      "Both outcomes are pinned by tests in " +
      "<code>test_context_vars_demo.py</code>.",
  ];

  const columnsEl = lab.querySelector("[data-columns]");
  const captionEl = lab.querySelector("[data-caption]");
  const stepButton = lab.querySelector('[data-act="step"]');
  const resetButton = lab.querySelector('[data-act="reset"]');

  let current = 0;

  function parentValue(scenario, step) {
    if (step >= 3 && !scenario.copies) return CHANGED;
    return step >= 1 ? PARENT : DEFAULT_VALUE;
  }

  function parentFlashes(scenario, step) {
    return step === 1 || (step === 3 && !scenario.copies);
  }

  function ctxBox(label, value, options) {
    const copyClass = options.copy ? " is-copy" : "";
    const flashClass = options.flash ? " flash" : "";
    return `<div class="ctx${copyClass}">` +
      `<span class="ctx__label"><span>${label}</span>` +
      `<span class="ctx__here">${options.here || ""}</span></span>` +
      `<span class="ctx__val${flashClass}">request_id = "${value}"</span></div>`;
  }

  function listingHtml(scenario, step) {
    const nowLine = scenario.lineForStep[step];
    return scenario.lines.map((line, i) => {
      const now = i === nowLine ? " is-now" : "";
      return `<span class="ln${now}">${window.highlightPython(line)}</span>`;
    }).join("");
  }

  function boxesHtml(scenario, step) {
    const childRunning = step === 2 || step === 3;
    const hereInParent = !scenario.copies && childRunning ? "◂ child runs here" : "";
    const parentBox = ctxBox("parent's context", parentValue(scenario, step),
      { here: hereInParent, flash: parentFlashes(scenario, step) });
    if (!scenario.copies || step < 2) return parentBox;
    const childValue = step >= 3 ? CHANGED : PARENT;
    const childBox = ctxBox("child Task's context (copy)", childValue,
      { copy: true, here: childRunning ? "◂ child runs here" : "", flash: step === 2 || step === 3 });
    return parentBox + childBox;
  }

  function readoutHtml(scenario, step) {
    if (step < LAST_STEP) return "";
    return `parent reads → <b>"${parentValue(scenario, step)}"</b>`;
  }

  function columnHtml(scenario, step) {
    return '<div class="inherit__col">' +
      `<p class="inherit__title">${scenario.title} <span>· ${scenario.tag}</span></p>` +
      `<pre class="listing">${listingHtml(scenario, step)}</pre>` +
      boxesHtml(scenario, step) +
      `<div class="readout">${readoutHtml(scenario, step)}</div>` +
      "</div>";
  }

  function render() {
    columnsEl.innerHTML = SCENARIOS.map((s) => columnHtml(s, current)).join("");
    const tag = current === 0 ? "" : `<span class="step-tag">${current}/${LAST_STEP}</span>`;
    captionEl.innerHTML = tag + CAPTIONS[current];
    stepButton.disabled = current >= LAST_STEP;
  }

  stepButton.addEventListener("click", () => {
    current = Math.min(current + 1, LAST_STEP);
    render();
  });
  resetButton.addEventListener("click", () => {
    current = 0;
    render();
  });

  render();
})();

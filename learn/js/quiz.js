/* Note 07: predict-the-output questions. Every answer was run on 3.12. */
(function () {
  "use strict";

  const root = document.querySelector("[data-quiz]");
  if (!root) return;

  const QUESTIONS = [
    {
      ask: "What does main() print?",
      code: [
        'v = ContextVar("v", default=0)',
        "",
        "async def bump():",
        "    v.set(v.get() + 1)",
        "",
        "async def main():",
        "    await bump()",
        "    await asyncio.create_task(bump())",
        "    print(v.get())",
      ],
      options: ["0", "1", "2"],
      answer: 1,
      why: "<b>1.</b> The bare <code>await bump()</code> runs in main's " +
        "context and sets 1 there. The Task bumps its <em>copy</em> to 2, " +
        "which main never sees.",
    },
    {
      ask: "What does main() print?",
      code: [
        's = ContextVar("s", default="none")',
        "",
        "async def main():",
        '    s.set("outer")',
        "    print(await asyncio.to_thread(s.get))",
      ],
      options: ['"outer"', '"none"', "LookupError"],
      answer: 0,
      why: '<b>"outer".</b> <code>to_thread</code> copies the current ' +
        "context and runs the function inside it on the worker thread.",
    },
    {
      ask: "Same variable, but through run_in_executor:",
      code: [
        "async def main():",
        '    s.set("outer")',
        "    loop = asyncio.get_running_loop()",
        "    print(await loop.run_in_executor(None, s.get))",
      ],
      options: ['"outer"', '"none"', "LookupError"],
      answer: 1,
      why: '<b>"none".</b> The pool thread uses its own context, where ' +
        "<code>s</code> was never set, so you get the default. Pass " +
        "<code>ctx.run</code> to carry it across.",
    },
    {
      ask: "What does main() print?",
      code: [
        'log = ContextVar("log")',
        "",
        "async def child():",
        '    log.get().append("child")',
        "",
        "async def main():",
        "    log.set([])",
        "    await asyncio.create_task(child())",
        "    print(log.get())",
      ],
      options: ["[]", "['child']", "LookupError"],
      answer: 1,
      why: "<b>['child'].</b> The Task copied a <em>reference</em> to the " +
        "same list. \"Copy down, never up\" covers <code>set()</code>, not " +
        "mutating the object.",
    },
    {
      ask: "What is printed?",
      code: [
        'w = ContextVar("w", default="none")',
        'w.set("a")',
        'token = w.set("b")',
        'w.set("c")',
        "w.reset(token)",
        "print(w.get())",
      ],
      options: ['"none"', '"a"', '"b"', '"c"'],
      answer: 1,
      why: '<b>"a".</b> The token remembers the value from before ' +
        '<em>its</em> set, which was "a". The later <code>set("c")</code> ' +
        "is discarded too.",
    },
  ];

  const scoreEl = document.querySelector("[data-score]");
  const resetButton = document.querySelector("[data-quiz-reset]");
  let picks = new Map();

  function optionsHtml(question, qIndex) {
    return question.options.map((label, i) =>
      `<button type="button" class="opt" data-q="${qIndex}" data-opt="${i}">` +
      `${window.escapeHtml(label)}</button>`).join("");
  }

  function questionHtml(question, qIndex) {
    const code = window.highlightPython(question.code.join("\n"));
    return `<article class="q" data-q-index="${qIndex}">` +
      `<div class="q__head"><span class="q__num">Q${qIndex + 1}</span>` +
      `<span class="q__ask">${question.ask}</span></div>` +
      `<pre class="code"><code>${code}</code></pre>` +
      `<div class="q__opts">${optionsHtml(question, qIndex)}</div>` +
      `<p class="q__why" hidden>${question.why}</p></article>`;
  }

  function renderScore() {
    const right = [...picks.entries()]
      .filter(([q, opt]) => QUESTIONS[q].answer === opt).length;
    scoreEl.textContent = picks.size === 0
      ? `0 of ${QUESTIONS.length} answered`
      : `${right} right · ${picks.size} of ${QUESTIONS.length} answered`;
  }

  function reveal(qIndex, chosen) {
    const card = root.querySelector(`[data-q-index="${qIndex}"]`);
    const correct = QUESTIONS[qIndex].answer;
    card.querySelectorAll(".opt").forEach((button) => {
      const opt = Number(button.dataset.opt);
      button.disabled = true;
      button.classList.toggle("is-right", opt === correct);
      button.classList.toggle("is-wrong", opt === chosen && opt !== correct);
    });
    card.querySelector(".q__why").hidden = false;
  }

  function render() {
    root.innerHTML = QUESTIONS.map(questionHtml).join("");
    renderScore();
  }

  root.addEventListener("click", (event) => {
    const button = event.target.closest(".opt");
    if (!button || button.disabled) return;
    const qIndex = Number(button.dataset.q);
    const chosen = Number(button.dataset.opt);
    picks.set(qIndex, chosen);
    reveal(qIndex, chosen);
    renderScore();
  });

  resetButton.addEventListener("click", () => {
    picks = new Map();
    render();
  });

  render();
})();

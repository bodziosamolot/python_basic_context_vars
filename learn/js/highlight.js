/* Tiny Python highlighter: keywords, strings, comments and numbers. */
(function () {
  "use strict";

  // Strings come before comments in the scan, so a "#" inside a string
  // is never mistaken for a comment.
  const TOKEN = /(#[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\b(async|await|def|return|import|from|with|try|finally|for|in|if|else|None|True|False|global|lambda)\b|\b(\d+(?:\.\d+)?)\b/g;
  const CLASS_BY_GROUP = ["tk-c", "tk-s", "tk-k", "tk-n"];

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function highlightPython(source) {
    let html = "";
    let last = 0;
    for (const match of source.matchAll(TOKEN)) {
      const groupIndex = match.slice(1).findIndex((g) => g !== undefined);
      const className = CLASS_BY_GROUP[groupIndex];
      const plain = source.slice(last, match.index);
      html += escapeHtml(plain);
      html += `<span class="${className}">${escapeHtml(match[0])}</span>`;
      last = match.index + match[0].length;
    }
    html += escapeHtml(source.slice(last));
    return html;
  }

  window.escapeHtml = escapeHtml;
  window.highlightPython = highlightPython;

  document.querySelectorAll("code.py").forEach((el) => {
    el.innerHTML = highlightPython(el.textContent);
  });
})();

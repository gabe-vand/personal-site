/* ============================================================
   gabevandevere.com
   Plain JavaScript. No bundler, no dependencies.
   ============================================================ */
"use strict";

/* Keep the footer year honest without editing HTML every January. */
document.querySelectorAll("#year").forEach(function (el) {
  el.textContent = String(new Date().getFullYear());
});

/* ============================================================
   "Ask" box - talks to the local LLM on this machine.

   IMPORTANT: this posts to /api/ask on this same site. It does NOT
   talk to the llama.cpp server directly, and it never sees an API
   key. The key lives server-side. If you ever find yourself pasting
   a token into this file, stop - anyone can read it.

   The section is hidden in index.html until the backend exists.
   See README.md, "Wiring in the LLM".
   ============================================================ */
(function () {
  var form = document.getElementById("ask-form");
  if (!form) return;

  var input = document.getElementById("ask-input");
  var out = document.getElementById("ask-output");
  var button = form.querySelector("button");

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    var question = input.value.trim();
    if (!question) return;

    button.disabled = true;
    out.removeAttribute("data-state");
    out.textContent = "Thinking…";

    try {
      var response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question })
      });

      if (response.status === 429) {
        throw new Error("Too many questions right now. Give it a minute.");
      }
      if (!response.ok) {
        throw new Error("The model is offline (HTTP " + response.status + ").");
      }

      var data = await response.json();
      out.textContent = data.answer || "(no answer)";
    } catch (error) {
      out.setAttribute("data-state", "error");
      out.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
})();

/* ============================================================
   Contact form.

   No backend, by design. We build a mailto: URL and hand it to
   whatever mail app the visitor has. Nothing is transmitted to
   this server, so there is nothing here to secure, rate limit,
   or accidentally spill.

   EDIT: change the address here AND in the fallback link in
   index.html if you ever switch inboxes.
   ============================================================ */
(function () {
  var form = document.getElementById("contact-form");
  if (!form) return;

  var ADDRESS = "gabe@gabevandevere.com";

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var subject = form.elements.subject.value.trim() || "Hello";
    var body = form.elements.body.value.trim();
    if (!body) return;

    window.location.href =
      "mailto:" + ADDRESS +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);
  });
})();

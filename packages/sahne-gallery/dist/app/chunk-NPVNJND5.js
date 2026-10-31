// ../sahne/src/listen/index.ts
var denied = /* @__PURE__ */ new Set();
function envOf(env) {
  const g = globalThis;
  return {
    Recognition: env && "Recognition" in env ? env.Recognition ?? null : g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null,
    online: env?.online ?? g.navigator?.onLine !== false,
    secure: env?.secure ?? g.isSecureContext !== false
  };
}
function cannotListen(env) {
  const e = envOf(env);
  if (!e.Recognition) return "unsupported";
  if (!e.secure) return "insecure";
  if (!e.online) return "offline";
  if (denied.has(e.Recognition)) return "denied";
  return null;
}
var canListen = (env) => cannotListen(env) === null;
function resetListen() {
  denied.clear();
}
var ERRORS = {
  "not-allowed": "denied",
  "service-not-allowed": "denied",
  "audio-capture": "denied",
  "no-speech": "no-speech",
  aborted: "aborted",
  network: "network",
  "language-not-supported": "unsupported"
};
function listen(o = {}) {
  const why = cannotListen(o.env);
  if (why) return { result: Promise.resolve({ alternatives: [], error: why }), stop() {
  }, abort() {
  } };
  const R = envOf(o.env).Recognition;
  const rec = new R();
  rec.lang = o.lang ?? "tr-TR";
  rec.interimResults = o.interim !== false;
  rec.maxAlternatives = o.alternatives ?? 5;
  rec.continuous = false;
  let finals = [], interim = "", error, spoke = false, settled = false;
  let resolve;
  const result = new Promise((r) => {
    resolve = r;
  });
  const timers = [];
  const state = (s) => {
    try {
      o.onState?.(s);
    } catch {
    }
  };
  const finish = () => {
    if (settled) return;
    settled = true;
    for (const t of timers) clearTimeout(t);
    o.signal?.removeEventListener("abort", onAbort);
    const alternatives = finals.length ? finals : interim ? [interim] : [];
    state("done");
    resolve(alternatives.length ? { alternatives } : { alternatives, error: error ?? (spoke ? "error" : "no-speech") });
  };
  const onAbort = () => {
    error = "aborted";
    finals = [];
    interim = "";
    try {
      rec.abort();
    } catch {
    }
    finish();
  };
  rec.onstart = () => state("listening");
  rec.onspeechstart = () => {
    spoke = true;
    state("hearing");
  };
  rec.onresult = (e) => {
    let text = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) {
        const alts = Array.from({ length: r.length }, (_, k) => r[k].transcript.trim()).filter(Boolean);
        finals = finals.length ? finals.flatMap((f) => alts.map((a) => `${f} ${a}`)).slice(0, rec.maxAlternatives) : alts;
      } else text += r[0]?.transcript ?? "";
    }
    if (!spoke && (text || finals.length)) {
      spoke = true;
      state("hearing");
    }
    interim = (finals[0] ? `${finals[0]} ` : "") + text.trim();
    if (text.trim()) try {
      o.onInterim?.(interim.trim());
    } catch {
    }
  };
  rec.onerror = (e) => {
    error = ERRORS[e.error] ?? "error";
    if (error === "denied") denied.add(R);
  };
  rec.onend = finish;
  if (o.signal?.aborted) {
    onAbort();
    return { result, stop() {
    }, abort() {
    } };
  }
  o.signal?.addEventListener("abort", onAbort);
  timers.push(setTimeout(() => {
    if (!spoke) {
      error = "no-speech";
      try {
        rec.abort();
      } catch {
      }
      finish();
    }
  }, o.silence ?? 6e3));
  timers.push(setTimeout(() => {
    error ??= "timeout";
    try {
      rec.stop();
    } catch {
    }
    setTimeout(finish, 800);
  }, o.timeout ?? 12e3));
  state("starting");
  try {
    rec.start();
  } catch {
    error = "error";
    finish();
  }
  return {
    result,
    stop() {
      try {
        rec.stop();
      } catch {
        finish();
      }
    },
    abort: onAbort
  };
}
function fallbackMatch(heard, expected) {
  const n = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  for (const h of [heard].flat()) {
    const best = expected.findIndex((e) => n(e) === n(h));
    if (best >= 0) return { matched: true, best, heard: h, score: 1 };
  }
  return { matched: false, best: -1, heard: [heard].flat()[0] ?? "", score: 0 };
}
async function listenFor(expected, plugin, o = {}) {
  const matchLine = (h) => plugin.matchLine ? plugin.matchLine(h, expected, o.match) : fallbackMatch(h, expected);
  let early = null;
  const run = listen({
    ...o,
    lang: o.lang ?? plugin.locale ?? "tr-TR",
    onInterim: (text) => {
      o.onInterim?.(text);
      if (early) return;
      const m2 = matchLine(text);
      if (m2.matched && m2.score >= 0.999) {
        early = m2;
        run.stop();
      }
    }
  });
  const r = await run.result;
  if (!r.alternatives.length) return { matched: false, best: -1, heard: "", score: 0, alternatives: [], error: r.error };
  const m = matchLine(r.alternatives);
  const best = m.matched || !early ? m : early;
  return { ...best, alternatives: r.alternatives, ...r.error && !best.matched ? { error: r.error } : {} };
}
async function micPermission() {
  try {
    const p = await globalThis.navigator.permissions.query({ name: "microphone" });
    return p.state === "granted" || p.state === "denied" || p.state === "prompt" ? p.state : "unknown";
  } catch {
    return "unknown";
  }
}

// src/card.ts
var el = (tag, cls = "", text = "") => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
var WHY = {
  "no-speech": "Duyamad\u0131m. I heard nothing: try again, or tap.",
  denied: "The microphone is off for this page: tap instead.",
  network: "No connection to the recogniser: tap instead.",
  offline: "Offline: tap instead.",
  timeout: "That took too long: try again, or tap."
};
function replyCard(o) {
  const card = el("div", "card");
  card.dataset.kind = o.silent ? "silent" : o.options.length > 1 ? "choice" : "say";
  card.append(el("small", "", o.label));
  const buttons = [];
  let ctl = null;
  const pick = (k) => {
    ctl?.abort();
    o.onPick(k);
  };
  if (o.silent) {
    const b = el("button", "primary", "\u2026");
    b.type = "button";
    b.onclick = () => pick(0);
    b.setAttribute("aria-label", "\u2026 (stay silent)");
    card.append(b);
    return card;
  }
  if (o.options.length === 1) {
    const p = el("p", "glossable");
    o.text(p, o.options[0].tr);
    card.append(p);
    if (o.translate && o.options[0].en) card.append(el("span", "tl", o.options[0].en));
    const row = el("div", "row");
    const b = el("button", "primary", "S\xF6yle");
    b.type = "button";
    b.onclick = () => pick(0);
    buttons.push(b);
    row.append(b);
    card.append(row);
  } else {
    o.options.forEach((op, k) => {
      const b = el("button", "option");
      b.type = "button";
      b.onclick = () => pick(k);
      b.append(el("span", "", op.tr));
      b.lang = "tr";
      if (o.translate && op.en) b.append(el("span", "tl", op.en));
      buttons.push(b);
      card.append(b);
    });
  }
  if (o.aloud) {
    const row = card.querySelector(".row") ?? card.appendChild(el("div", "row"));
    const mic = el("button", "mic", "\u{1F3A4} Say it");
    mic.type = "button";
    mic.setAttribute("aria-label", "Say it aloud");
    const status = el("span", "heard");
    status.setAttribute("aria-live", "polite");
    mic.onclick = async () => {
      if (ctl) {
        ctl.abort();
        return;
      }
      ctl = new AbortController();
      const mine = ctl;
      mic.setAttribute("aria-pressed", "true");
      mic.textContent = "\u25CF Listening\u2026";
      status.textContent = "";
      const r = await o.aloud(o.options.map((x) => x.tr), (t) => {
        status.textContent = `\u201C${t}\u201D`;
      }, mine.signal);
      if (ctl !== mine) return;
      ctl = null;
      mic.setAttribute("aria-pressed", "false");
      mic.textContent = "\u{1F3A4} Say it";
      if (r.matched && r.best >= 0) {
        status.textContent = `\u2713 \u201C${r.heard}\u201D`;
        card.dataset.heard = String(r.best);
        o.onPick(r.best);
        return;
      }
      if (r.error === "aborted") {
        status.textContent = "";
        return;
      }
      status.textContent = r.heard ? `\u201C${r.heard}\u201D: that was not the line. Try again, or tap.` : WHY[r.error ?? ""] ?? "Not heard: tap instead.";
      card.dataset.heard = "-1";
    };
    row.append(mic, status);
  }
  return card;
}

export {
  cannotListen,
  canListen,
  resetListen,
  listenFor,
  micPermission,
  replyCard
};
//# sourceMappingURL=chunk-NPVNJND5.js.map

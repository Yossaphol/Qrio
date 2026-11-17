(() => {
  const $ = (id) => document.getElementById(id);
  const input = $("input"), card = $("card"), qrBox = $("qrBox"), qrEl = $("qr"), meta = $("meta");
  const label = $("label"), lTitle = $("lTitle"), lDesc = $("lDesc");
  const pasteBtn = $("pasteBtn"), clearBtn = $("clearBtn");
  const fullBtn = $("fullBtn"), labelBtn = $("labelBtn"), labelBtnText = $("labelBtnText"), labelBadge = $("labelBadge");
  const saveBtn = $("saveBtn"), shareBtn = $("shareBtn");
  const full = $("full"), bigQr = $("bigQr"), fTitle = $("fTitle"), fDesc = $("fDesc"), fullUrl = $("fullUrl");
  const sheetWrap = $("sheetWrap"), tIn = $("tIn"), dIn = $("dIn");
  const toast = $("toast");

  const QUIET = 4; // quiet zone มาตรฐาน 4 โมดูล
  const INK = "#111214";
  let current = null; // { text, matrix }
  let wakeLock = null;

  qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];

  // ---------- helpers ----------
  function normalize(raw) {
    const s = raw.trim();
    if (!s) return { text: "", isUrl: false };
    if (/^[a-z][a-z0-9+.-]*:/i.test(s)) {
      return { text: s, isUrl: /^https?:\/\//i.test(s) };
    }
    // ดูเหมือนโดเมน (เช่น google.com/abc) → เติม https://
    if (!/\s/.test(s) && /^[^\s/]+\.[a-z]{2,}([/:?#].*)?$/i.test(s)) {
      return { text: "https://" + s, isUrl: true };
    }
    return { text: s, isUrl: false };
  }

  function makeMatrix(text) {
    const qr = qrcode(0, "M");
    qr.addData(text, "Byte");
    qr.make();
    const n = qr.getModuleCount();
    const m = [];
    for (let r = 0; r < n; r++) {
      const row = [];
      for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
      m.push(row);
    }
    return m;
  }

  function toSvg(matrix) {
    const n = matrix.length, size = n + QUIET * 2;
    let d = "";
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        if (matrix[r][c]) d += `M${c + QUIET} ${r + QUIET}h1v1h-1z`;
    return `<svg class="qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" aria-label="QR Code"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="${INK}"/></svg>`;
  }

  const prettyUrl = (t) => t.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  const getLabel = () => ({ t: tIn.value.trim(), d: dIn.value.trim() });

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function setMeta(text, warn) {
    if (!text) { meta.innerHTML = ""; meta.classList.remove("warn"); return; }
    meta.classList.toggle("warn", !!warn);
    meta.innerHTML = `<span class="dot"></span><span class="text"></span>`;
    meta.querySelector(".text").textContent = text;
  }

  // เก็บข้อมูลใน URL (?u=&t=&d=) เพื่อเปิดซ้ำ/ส่งต่อได้
  function syncUrl() {
    const url = new URL(location.href);
    const { text } = normalize(input.value);
    const { t, d } = getLabel();
    [["u", text], ["t", t], ["d", d]].forEach(([k, v]) =>
      v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
    try { history.replaceState(null, "", url); } catch {}
  }

  // ---------- render ----------
  function render() {
    const { text, isUrl } = normalize(input.value);
    clearBtn.hidden = !input.value;
    pasteBtn.hidden = !!input.value;

    if (!text) {
      current = null;
      qrBox.classList.remove("has-qr");
      qrEl.innerHTML = "";
      setMeta("");
      fullBtn.disabled = saveBtn.disabled = shareBtn.disabled = labelBtn.disabled = true;
    } else {
      try {
        const matrix = makeMatrix(text);
        current = { text, matrix };
        qrEl.innerHTML = toSvg(matrix);
        requestAnimationFrame(() => qrBox.classList.add("has-qr"));
        setMeta(isUrl ? prettyUrl(text) : "ข้อความ (ไม่ใช่ลิงก์) — ยังสแกนได้", !isUrl);
        fullBtn.disabled = saveBtn.disabled = shareBtn.disabled = labelBtn.disabled = false;
      } catch (e) {
        current = null;
        qrBox.classList.remove("has-qr");
        setMeta("ยาวเกินไปสำหรับ QR — ลองใช้ลิงก์ที่สั้นลง", true);
        fullBtn.disabled = saveBtn.disabled = shareBtn.disabled = labelBtn.disabled = true;
      }
    }
    renderLabel();
    syncUrl();
  }

  function renderLabel() {
    const { t, d } = getLabel();
    const has = !!(t || d) && !!current;
    label.hidden = !has;
    card.classList.toggle("labeled", has);
    lTitle.textContent = t; lTitle.hidden = !t;
    lDesc.textContent = d;  lDesc.hidden = !d;
    labelBadge.hidden = !(t || d);
    labelBtnText.textContent = (t || d) ? "แก้ชื่อ" : "ใส่ชื่อ";
  }

  // ---------- link input ----------
  input.addEventListener("input", render);

  // วางแล้ว → ซ่อนคีย์บอร์ด ให้เห็น QR เต็ม ๆ
  input.addEventListener("paste", () => setTimeout(() => { render(); if (current) input.blur(); }, 0));
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); input.blur(); } });

  pasteBtn.addEventListener("click", async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t) { showToast("คลิปบอร์ดว่าง"); return; }
      input.value = t.trim();
      render();
      input.blur();
    } catch {
      input.focus();
      showToast("กดค้างในช่องแล้วเลือก “วาง”");
    }
  });

  clearBtn.addEventListener("click", () => {
    input.value = "";
    render();
    input.focus();
  });

  // วางได้จากทุกที่ในหน้า (เดสก์ท็อป)
  document.addEventListener("paste", (e) => {
    if (e.target === input || e.target === tIn || e.target === dIn) return;
    const t = e.clipboardData && e.clipboardData.getData("text");
    if (t) { e.preventDefault(); input.value = t.trim(); render(); }
  });

  // ---------- label sheet ----------
  function openSheet() {
    if (!current) return;
    sheetWrap.classList.add("open");
    sheetWrap.setAttribute("aria-hidden", "false");
    setTimeout(() => tIn.focus(), 60);
  }
  function closeSheet() {
    sheetWrap.classList.remove("open");
    sheetWrap.setAttribute("aria-hidden", "true");
    document.activeElement && document.activeElement.blur();
  }
  labelBtn.addEventListener("click", openSheet);
  label.addEventListener("click", openSheet);
  $("backdrop").addEventListener("click", closeSheet);
  $("sheetDone").addEventListener("click", closeSheet);
  $("labelClear").addEventListener("click", () => {
    tIn.value = ""; dIn.value = "";
    renderLabel(); syncUrl(); tIn.focus();
  });
  [tIn, dIn].forEach((el) => el.addEventListener("input", () => { renderLabel(); syncUrl(); }));
  tIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); dIn.focus(); } });
  dIn.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); closeSheet(); } });

  // ยก sheet ขึ้นเหนือคีย์บอร์ดบน iOS/Android
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const onVV = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty("--kb", kb + "px");
    };
    vv.addEventListener("resize", onVV);
    vv.addEventListener("scroll", onVV);
  }

  // ---------- fullscreen ----------
  async function openFull() {
    if (!current) { input.focus(); return; }
    const { t, d } = getLabel();
    bigQr.innerHTML = toSvg(current.matrix);
    fTitle.textContent = t; fTitle.hidden = !t;
    fDesc.textContent = d;  fDesc.hidden = !d;
    fullUrl.textContent = prettyUrl(current.text);
    full.classList.add("open");
    try { if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen"); } catch {}
  }
  function closeFull() {
    full.classList.remove("open");
    try { wakeLock && wakeLock.release(); } catch {}
    wakeLock = null;
  }
  qrBox.addEventListener("click", openFull);
  qrBox.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFull(); } });
  fullBtn.addEventListener("click", openFull);
  full.addEventListener("click", closeFull);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (sheetWrap.classList.contains("open")) closeSheet(); else closeFull();
  });

  // ---------- export image ----------
  // ตัดบรรทัดภาษาไทยด้วย Intl.Segmenter (ภาษาไทยไม่มีเว้นวรรค)
  function wrapText(ctx, text, maxW, maxLines) {
    const parts = (window.Intl && Intl.Segmenter)
      ? [...new Intl.Segmenter("th", { granularity: "word" }).segment(text)].map((s) => s.segment)
      : [...text];
    const lines = [];
    let line = "";
    for (const p of parts) {
      if (ctx.measureText(line + p).width <= maxW || !line) { line += p; continue; }
      lines.push(line.trim()); line = p.trimStart();
    }
    if (line.trim()) lines.push(line.trim());
    if (lines.length > maxLines) {
      lines.length = maxLines;
      let last = lines[maxLines - 1];
      while (last && ctx.measureText(last + "…").width > maxW) last = last.slice(0, -1);
      lines[maxLines - 1] = last + "…";
    }
    return lines;
  }

  async function buildPng() {
    const { t, d } = getLabel();
    const font = getComputedStyle(document.body).fontFamily;
    try { await Promise.all([document.fonts.load(`600 52px Anuphan`), document.fonts.load(`400 34px Anuphan`)]); } catch {}

    const W = 1080, PAD = 64;
    const n = current.matrix.length, size = n + QUIET * 2;
    const scale = Math.floor((W - PAD * 2) / size);
    const qrPx = size * scale;

    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");

    // วัดข้อความก่อน เพื่อคำนวณความสูงรูป
    const maxW = W - PAD * 2 - 40;
    ctx.font = `600 52px ${font}`;
    const tLines = t ? wrapText(ctx, t, maxW, 2) : [];
    ctx.font = `400 34px ${font}`;
    const dLines = d ? wrapText(ctx, d, maxW, 3) : [];
    const urlText = prettyUrl(current.text);

    const hasLabel = tLines.length || dLines.length;
    let textH = 0;
    if (hasLabel) {
      textH += tLines.length * 66;
      if (tLines.length && dLines.length) textH += 10;
      textH += dLines.length * 48;
      textH += 24 + 40; // url
    }
    const H = PAD + qrPx + (hasLabel ? 8 + textH + PAD : PAD);

    c.width = W; c.height = H;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);

    const ox = Math.round((W - qrPx) / 2), oy = PAD;
    ctx.fillStyle = INK;
    for (let r = 0; r < n; r++)
      for (let col = 0; col < n; col++)
        if (current.matrix[r][col]) ctx.fillRect(ox + (col + QUIET) * scale, oy + (r + QUIET) * scale, scale, scale);

    if (hasLabel) {
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      let y = oy + qrPx + 8;
      ctx.fillStyle = INK;
      ctx.font = `600 52px ${font}`;
      tLines.forEach((l) => { ctx.fillText(l, W / 2, y); y += 66; });
      if (tLines.length && dLines.length) y += 10;
      ctx.fillStyle = "#5d6169";
      ctx.font = `400 34px ${font}`;
      dLines.forEach((l) => { ctx.fillText(l, W / 2, y); y += 48; });
      y += 24;
      ctx.fillStyle = "#9aa0a8";
      ctx.font = `400 28px ${font}`;
      let u = urlText;
      while (u.length > 4 && ctx.measureText(u).width > maxW) u = u.slice(0, -2);
      if (u !== urlText) u += "…";
      ctx.fillText(u, W / 2, y);
    }

    return new Promise((res) => c.toBlob(res, "image/png"));
  }

  // บันทึก = ดาวน์โหลดไฟล์ (ค่าเริ่มต้น) · แชร์ = เปิด share sheet ของระบบ
  const canShareFiles = (() => {
    try { return !!navigator.canShare && navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] }); }
    catch { return false; }
  })();
  shareBtn.hidden = !canShareFiles;

  async function makeFile() {
    const { t } = getLabel();
    const blob = await buildPng();
    const name = ((t || "qr-code").replace(/[\\/:*?"<>|\n\r]+/g, " ").trim().slice(0, 60) || "qr-code") + ".png";
    return { blob, name, title: t };
  }

  saveBtn.addEventListener("click", async () => {
    if (!current) return;
    const { blob, name } = await makeFile();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    showToast("บันทึกรูปแล้ว");
  });

  shareBtn.addEventListener("click", async () => {
    if (!current) return;
    const { blob, name, title } = await makeFile();
    try {
      await navigator.share({ files: [new File([blob], name, { type: "image/png" })], title: title || undefined });
    } catch (e) {
      if (e.name !== "AbortError") showToast("แชร์ไม่สำเร็จ ลองกดบันทึกแทน");
    }
  });

  // ---------- init ----------
  const params = new URL(location.href).searchParams;
  input.value = params.get("u") || "";
  tIn.value = params.get("t") || "";
  dIn.value = params.get("d") || "";
  render();
  // โฟกัสอัตโนมัติเฉพาะเดสก์ท็อป (มือถือจะเด้งคีย์บอร์ดบังหน้า)
  if (!input.value && matchMedia("(hover: hover) and (pointer: fine)").matches) input.focus();
})();

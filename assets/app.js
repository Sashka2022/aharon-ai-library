{
const G = (window.GUIDES || []).slice().sort((a, b) => a.no.localeCompare(b.no));
const main = document.getElementById('main');
const toastEl = document.getElementById('toast');
const SPINE = ['#1f4e5f', '#2f7d86', '#a85a16', '#55703c', '#6b4f7a'];
const GRADES = ['א׳–ב׳', 'ג׳–ד׳', 'ה׳–ו׳'];

/* ---------- storage (best effort) ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('ahb-' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ahb-' + k, JSON.stringify(v)); } catch (e) {} }
};
const isRead = no => store.get('read', []).includes(no);
function toggleRead(no) {
  const r = store.get('read', []); const i = r.indexOf(no);
  if (i >= 0) r.splice(i, 1); else r.push(no);
  store.set('read', r); return r.includes(no);
}

/* ---------- helpers ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const FIN = {'ך':'כ','ם':'מ','ן':'נ','ף':'פ','ץ':'צ'};
function norm(s) { // returns {t, map} normalized text + index map to original
  let t = '', map = [];
  for (let i = 0; i < s.length; i++) {
    let c = s[i];
    if (/[֑-ׇ]/.test(c) || c === '״' || c === '׳' || c === '"' || c === "'") continue;
    c = FIN[c] || c.toLowerCase();
    t += c; map.push(i);
  }
  return {t, map};
}
function toast(msg) {
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove('show'), 1800);
}
async function copyText(text, btn) {
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
    try {
      const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      ok = document.execCommand('copy'); ta.remove();
    } catch (e2) { ok = false; }
  }
  toast(ok ? 'הפרומפט הועתק. הדביקי אותו בכלי ה-AI.' : 'ההעתקה נחסמה בדפדפן. סמני את הטקסט והעתיקי ידנית.');
  if (btn && ok) { btn.classList.add('done'); btn.textContent = 'הועתק ✓'; setTimeout(() => { btn.classList.remove('done'); btn.textContent = 'העתקת הפרומפט'; }, 2000); }
}

/* ---------- index: parse every guide once ---------- */
const parser = new DOMParser();
const SECTIONS = [], PROMPTS = [];
for (const g of G) {
  const doc = parser.parseFromString('<div>' + g.html + '</div>', 'text/html');
  g.toc = [];
  doc.querySelectorAll('section.chapter').forEach(sec => {
    const h = sec.querySelector('h2');
    const hc = h ? h.cloneNode(true) : null; if (hc) hc.querySelectorAll('.num').forEach(n => n.remove());
    const title = hc ? hc.textContent.trim() : '';
    const subs = [...sec.querySelectorAll('h3[id]')]
      .map(h => ({id: h.id, title: h.textContent.replace(/\s+/g, ' ').trim()}));
    g.toc.push({id: sec.id, title, subs});
    const text = sec.textContent.replace(/\s+/g, ' ').trim();
    SECTIONS.push({g, id: sec.id, title, text, n: norm(text)});
    sec.querySelectorAll('.prompt-card').forEach((pc, k) => {
      const pre = pc.querySelector('pre.prompt'); if (!pre) return;
      const h4 = pc.querySelector('header h4');
      const kind = (pc.dataset.kind || (pc.querySelector('header .kind') || {}).textContent || '').trim();
      PROMPTS.push({g, sec: sec.id, title: h4 ? h4.textContent.trim() : 'פרומפט', kind, text: pre.textContent.trim()});
    });
  });
  g.text = doc.body.textContent;
}
const TAGCOUNT = {};
G.forEach(g => (g.tags || []).forEach(t => TAGCOUNT[t] = (TAGCOUNT[t] || 0) + 1));
// show only topics shared by more than one guide, so the filter row stays scannable
const TAGS = Object.keys(TAGCOUNT).filter(t => TAGCOUNT[t] > 1).sort((a, b) => TAGCOUNT[b] - TAGCOUNT[a]);

/* ---------- views ---------- */
let state = {q: '', grade: '', tag: ''};

function spineHTML(g, i) {
  return `<a class="spine${isRead(g.no) ? ' read' : ''}" href="#g${esc(g.no)}" style="background:${SPINE[i % SPINE.length]};height:${78 + (i * 37) % 22}%" aria-label="מדריך ${esc(g.no)}: ${esc(g.title)}${isRead(g.no) ? ' (סומן כנקרא)' : ''}"><span class="no">${+g.no}</span><span class="t">${esc(g.title)}</span></a>`;
}
function cardHTML(g) {
  const r = isRead(g.no);
  return `<a class="gcard" href="#g${esc(g.no)}">
    <div class="row"><span class="num">${esc(g.no)}</span>${r ? '<span class="pill read">קראתי ✓</span>' : ''}</div>
    <h3>${esc(g.title)}</h3><p>${esc(g.short || g.benefit)}</p>
    <div class="meta">${(g.grades || []).map(x => `<span class="pill">${esc(x)}</span>`).join('')}${g.main_tool ? `<span class="pill">כלי מרכזי: ${esc(g.main_tool)}</span>` : ''}${g.pdf ? '<span class="pill">PDF</span>' : ''}</div></a>`;
}
function viewHome() {
  document.title = 'ספריית מדריכי AI למורה';
  main.innerHTML = `
  <section class="hero"><div class="wrap hero-in">
    <div>
      <h1>עשרה מדריכים מעשיים לבינה מלאכותית בכיתה</h1>
      <p class="lead">לכל אתגר שעלה בצוות יש מדריך: מה הבעיה, באיזה כלי להשתמש, איך לעבוד צעד אחר צעד, דוגמאות לפי גיל ופרומפטים מוכנים להעתקה. ה-AI כאן עוזר לך להתכונן, ואת מחליטה.</p>
      <form class="search" role="search" id="sform"><label for="q" class="skip">חיפוש במדריכים</label>
        <input id="q" type="search" placeholder="חפשי נושא, כלי או מילה — למשל: תחנות, מחוון, Gemini" value="${esc(state.q)}" autocomplete="off"></form>
    </div>
    <div class="shelf"><div class="spines" aria-label="מדף המדריכים">${G.map(spineHTML).join('')}</div><div class="ledge"></div>
      <p class="shelf-note">בחרי חוברת מהמדף. ${G.length} מדריכים, PDF להורדה לכל אחד.</p></div>
  </div></section>
  <section class="band"><div class="wrap" id="lib"></div></section>`;
  const q = document.getElementById('q');
  q.addEventListener('input', () => { state.q = q.value; renderLib(); });
  document.getElementById('sform').addEventListener('submit', e => { e.preventDefault(); });
  renderLib();
}
function renderLib() {
  const lib = document.getElementById('lib'); if (!lib) return;
  const q = state.q.trim();
  if (q) { lib.innerHTML = searchHTML(q); return; }
  const list = G.filter(g => (!state.grade || (g.grades || []).includes(state.grade)) && (!state.tag || (g.tags || []).includes(state.tag)));
  lib.innerHTML = `<h2 id="all">כל המדריכים</h2><p class="sub">סנני לפי שכבה או נושא. המדריכים עצמאיים, ואפשר להתחיל מכל אחד.</p>
  <div class="chips" role="group" aria-label="סינון לפי שכבה"><span class="lbl">שכבה:</span>${['', ...GRADES].map(x => `<button type="button" class="chip" data-grade="${esc(x)}" aria-pressed="${state.grade === x}">${x ? esc(x) : 'הכול'}</button>`).join('')}</div>
  <div class="chips" role="group" aria-label="סינון לפי נושא"><span class="lbl">נושא:</span>${['', ...TAGS].map(x => `<button type="button" class="chip" data-tag="${esc(x)}" aria-pressed="${state.tag === x}">${x ? esc(x) : 'הכול'}</button>`).join('')}</div>
  <div class="grid">${list.map(cardHTML).join('') || '<p class="empty">אין מדריך שמתאים לשני הסינונים יחד. נסי לבטל אחד מהם.</p>'}</div>`;
  lib.querySelectorAll('[data-grade]').forEach(b => b.onclick = () => { state.grade = b.dataset.grade; renderLib(); });
  lib.querySelectorAll('[data-tag]').forEach(b => b.onclick = () => { state.tag = b.dataset.tag; renderLib(); });
}
function snippet(rec, nq, terms) {
  const i = rec.n.t.indexOf(terms[0]); if (i < 0) return esc(rec.text.slice(0, 160)) + '…';
  const s = rec.n.map[Math.max(0, i - 60)] ?? 0, e = rec.n.map[Math.min(rec.n.t.length - 1, i + 140)] ?? rec.text.length;
  let out = esc((s > 0 ? '…' : '') + rec.text.slice(s, e + 1) + '…');
  for (const t of terms) { // highlight raw query words (best effort)
    const raw = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); if (raw.length < 2) continue;
    try { out = out.replace(new RegExp(raw, 'gi'), m => `<mark>${m}</mark>`); } catch (e) {}
  }
  return out;
}
function searchHTML(q) {
  const nq = norm(q).t; const terms = nq.split(/\s+/).filter(Boolean);
  const hits = SECTIONS.filter(r => terms.every(t => r.n.t.includes(t)))
    .map(r => ({r, score: terms.reduce((s, t) => s + (norm(r.title).t.includes(t) ? 5 : 0) + (norm(r.g.title).t.includes(t) ? 8 : 0), 0)}))
    .sort((a, b) => b.score - a.score).slice(0, 40);
  return `<h2 id="all">תוצאות חיפוש</h2><p class="sub" aria-live="polite">${hits.length ? `נמצאו ${hits.length} קטעים עבור „${esc(q)}”.` : `לא נמצאו תוצאות עבור „${esc(q)}”. נסי מילה אחרת או קצרה יותר.`}</p>
  <div class="results">${hits.map(({r}) => `<a class="res" href="#g${esc(r.g.no)}-${esc(r.id)}"><b>מדריך ${esc(r.g.no)}: ${esc(r.g.title)} · ${esc(r.title)}</b><div>${snippet(r, nq, terms)}</div></a>`).join('')}</div>
  <p><button type="button" class="btn light" id="clearq">ניקוי החיפוש וחזרה לכל המדריכים</button></p>`;
}
document.addEventListener('click', e => {
  if (e.target && e.target.id === 'clearq') { state.q = ''; const q = document.getElementById('q'); if (q) { q.value = ''; q.focus(); } renderLib(); }
});

let current = null;
function viewGuide(no, sec) {
  const idx = G.findIndex(g => g.no === no); const g = G[idx];
  if (!g) return viewNotFound();
  if (current !== no) {
    current = no;
    document.title = `מדריך ${g.no} — ${g.title}`;
    const prev = G[idx - 1], next = G[idx + 1];
    main.innerHTML = `<div class="wrap reader">
      <aside class="side" aria-label="תוכן המדריך"><details open id="tocd"><summary>תוכן המדריך</summary>
        <ol>${g.toc.map((t, i) => `<li><a href="#g${g.no}-${esc(t.id)}" data-sec="${esc(t.id)}"><span class="n">${i + 1}</span>${esc(t.title)}</a>${(t.subs || []).length ? `<ol class="sub">${t.subs.map(sx => `<li><a href="#g${g.no}-${esc(sx.id)}">${esc(sx.title)}</a></li>`).join('')}</ol>` : ''}</li>`).join('')}</ol></details></aside>
      <article>
        <header class="ghead">
          <div class="crumb"><a href="#home">הספרייה</a> › מדריך ${esc(g.no)} מתוך ${G.length}</div>
          <div class="gno">${esc(g.no)}</div><h1>${esc(g.title)}</h1><p>${esc(g.benefit)}</p>
          <div class="gmeta">${(g.grades || []).map(x => `<span class="pill">${esc(x)}</span>`).join('')}${g.main_tool ? `<span class="pill">כלי מרכזי: ${esc(g.main_tool)}</span>` : ''}${g.minutes ? `<span class="pill">התחלה מהירה: כ־${esc(g.minutes)} דק׳ (אומדן)</span>` : ''}</div>
          <div class="actions">
            ${g.pdf ? `<a class="btn" href="${esc(g.pdf)}" target="_blank" rel="noopener">פתיחת ה-PDF להדפסה ולהורדה</a>` : ''}
            <button type="button" class="btn ghost" id="readbtn" aria-pressed="${isRead(g.no)}">${isRead(g.no) ? 'סומן כנקרא ✓' : 'סימון: קראתי'}</button>
          </div>
        </header>
        <nav class="jump" aria-label="מעבר לפרק במדריך">
          <span class="jl">לפרקי המדריך:</span>
          <div class="scroll">${g.toc.map((t, i) => `<a href="#g${g.no}-${esc(t.id)}"><b>${i + 1}</b>${esc(t.title)}</a>`).join('')}</div>
        </nav>
        <div class="guide-body" id="gbody">${g.html}</div>
        <nav class="pager" aria-label="מדריכים סמוכים">
          ${prev ? `<a href="#g${prev.no}"><small>המדריך הקודם</small>${esc(prev.no)} · ${esc(prev.title)}</a>` : '<span></span>'}
          ${next ? `<a href="#g${next.no}"><small>המדריך הבא</small>${esc(next.no)} · ${esc(next.title)}</a>` : '<a href="#prompts"><small>ומכאן</small>לכל הפרומפטים במקום אחד</a>'}
        </nav>
      </article></div>`;
    const body = document.getElementById('gbody');
    body.querySelectorAll('section.chapter').forEach((s, i) => {
      s.dataset.sec = s.id; s.id = `g${g.no}-${s.id}`; s.tabIndex = -1;
      s.querySelectorAll('h3[id]').forEach(h => { h.id = `g${g.no}-${h.id}`; h.tabIndex = -1; });
      const back = document.createElement('a');
      back.className = 'backtop noprint'; back.href = '#g' + g.no;
      back.textContent = 'לראש המדריך ולרשימת הפרקים';
      s.append(back);
    });
    body.querySelectorAll('a[href^="#"]').forEach(a => { const id = a.getAttribute('href').slice(1); if (id && !/^g\d\d/.test(id)) a.setAttribute('href', `#g${g.no}-${id}`); });
    body.querySelectorAll('a[href^="http"]').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
    // app demos: scripts injected via innerHTML never execute, so re-create them,
    // and reveal the parts that only make sense when the demo is live
    body.querySelectorAll('.live-only').forEach(el => { el.style.display = ''; });
    body.querySelectorAll('.print-only').forEach(el => { el.style.display = 'none'; });
    body.querySelectorAll('script[data-demo]').forEach(old => {
      const sc = document.createElement('script');
      sc.textContent = old.textContent;
      old.replaceWith(sc);
    });
    body.querySelectorAll('table').forEach(tb => {
      const cap = tb.querySelector('caption');
      const name = (cap ? cap.textContent : '').trim().slice(0, 80) || 'טבלה';
      const wrap = document.createElement('div');
      wrap.className = 'tscroll'; wrap.tabIndex = 0; wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-label', name + ' — ניתן לגלול לצדדים');
      tb.before(wrap); wrap.append(tb);
    });
    body.querySelectorAll('pre.prompt').forEach(pre => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'copy noprint'; b.textContent = 'העתקת הפרומפט';
      b.addEventListener('click', () => copyText(pre.textContent.trim(), b)); pre.after(b);
    });
    document.getElementById('readbtn').addEventListener('click', ev => {
      const on = toggleRead(g.no); ev.currentTarget.setAttribute('aria-pressed', on); ev.currentTarget.textContent = on ? 'סומן כנקרא ✓' : 'סימון: קראתי';
      toast(on ? 'המדריך סומן כנקרא בדפדפן זה.' : 'הסימון הוסר.');
    });
    if (matchMedia('(max-width:900px)').matches) document.getElementById('tocd').removeAttribute('open');
    observeSections();
  }
  const target = sec ? document.getElementById(`g${no}-${sec}`) : null;
  if (target) { target.scrollIntoView(); target.focus({preventScroll: true}); }
  else window.scrollTo(0, 0);
}
let secObs = null;
function observeSections() {
  if (secObs) secObs.disconnect();
  const links = [...document.querySelectorAll('.side a[data-sec]')];
  secObs = new IntersectionObserver(es => {
    es.forEach(en => { if (en.isIntersecting) links.forEach(l => l.classList.toggle('on', l.dataset.sec === en.target.dataset.sec)); });
  }, {rootMargin: '-20% 0px -70% 0px'});
  document.querySelectorAll('#gbody section.chapter').forEach(s => secObs.observe(s));
}

let pstate = {g: '', kind: '', q: ''};
function viewPrompts() {
  document.title = 'מאגר פרומפטים';
  const kinds = [...new Set(PROMPTS.map(p => p.kind).filter(Boolean))];
  main.innerHTML = `<section class="band"><div class="wrap">
    <h1>מאגר הפרומפטים</h1><p class="sub">כל ${PROMPTS.length} הפרומפטים מכל המדריכים. העתיקי, החליפי את השדות שבסוגריים המרובעים בפרטים שלך — בלי שמות או פרטים מזהים של תלמידות — ובדקי את התוצר לפני שימוש.</p>
    <div class="filters">
      <div class="field"><label for="pg">מדריך</label><select id="pg"><option value="">כל המדריכים</option>${G.map(g => `<option value="${g.no}">${g.no} · ${esc(g.title)}</option>`).join('')}</select></div>
      <div class="field"><label for="pk">סוג</label><select id="pk"><option value="">כל הסוגים</option>${kinds.map(k => `<option>${esc(k)}</option>`).join('')}</select></div>
      <div class="field" style="flex:1 1 220px"><label for="pq">חיפוש בפרומפטים</label><input id="pq" type="search" placeholder="למשל: מחוון, תחנות"></div>
    </div><div class="plist" id="plist"></div></div></section>`;
  const pg = document.getElementById('pg'), pk = document.getElementById('pk'), pq = document.getElementById('pq');
  pg.value = pstate.g; pk.value = pstate.kind; pq.value = pstate.q;
  const draw = () => {
    pstate = {g: pg.value, kind: pk.value, q: pq.value};
    const terms = norm(pq.value.trim()).t.split(/\s+/).filter(Boolean);
    const list = PROMPTS.filter(p => (!pstate.g || p.g.no === pstate.g) && (!pstate.kind || p.kind === pstate.kind) && terms.every(t => norm(p.title + ' ' + p.text).t.includes(t)));
    const el = document.getElementById('plist');
    el.innerHTML = list.length ? list.map((p, i) => `<article class="pitem"><header><h2 class="pt">${esc(p.title)}</h2><span class="pill">${esc(p.kind || 'פרומפט')}</span></header>
      <pre>${esc(p.text)}</pre><div class="links"><button type="button" class="copy" data-i="${PROMPTS.indexOf(p)}">העתקת הפרומפט</button>
      <a href="#g${p.g.no}-${esc(p.sec)}">בהקשר: מדריך ${p.g.no} · ${esc(p.g.title)}</a></div></article>`).join('') : '<p class="empty">לא נמצאו פרומפטים. נסי לשנות סינון.</p>';
    el.querySelectorAll('button.copy').forEach(b => b.onclick = () => copyText(PROMPTS[+b.dataset.i].text, b));
  };
  [pg, pk].forEach(x => x.addEventListener('change', draw)); pq.addEventListener('input', draw); draw();
}

const GEN_DEF = {role: 'מורה מנוסה בבית ספר יסודי לבנות', subject: '', grade: 'ג׳', topic: '', goal: '', inputs: '', time: '45', format: 'טבלה', extra: '', guide: '', c_nodevice: false, c_access: false, c_levels: false, c_short: false};
function viewGenerator() {
  document.title = 'מחולל פרומפטים';
  const d = Object.assign({}, GEN_DEF, store.get('gen', {}));
  const opt = (arr, v) => arr.map(x => `<option${x === v ? ' selected' : ''}>${esc(x)}</option>`).join('');
  main.innerHTML = `<section class="band"><div class="wrap">
    <h1>מחולל פרומפטים</h1><p class="sub">מלאי את השדות, והמחולל יבנה פרומפט שכולל את כל רכיבי החובה: תפקיד, הקשר, שכבה, יעד מדיד, קלטים, מגבלות, פורמט, איסור להמציא נתונים, סימון אי-ודאות ובדיקה אנושית. דבר לא נשלח לשרת. הטיוטה נשמרת רק בדפדפן שלך.</p>
    <div class="gen"><form id="gform" novalidate>
      <div class="field"><label for="f-role">תפקיד שה-AI ימלא</label><input id="f-role" name="role" value="${esc(d.role)}"></div>
      <div class="cols" style="display:flex;gap:1rem;flex-wrap:wrap">
        <div class="field" style="flex:1 1 140px"><label for="f-subject">מקצוע</label><input id="f-subject" name="subject" value="${esc(d.subject)}" placeholder="למשל: חשבון"></div>
        <div class="field" style="flex:0 1 120px"><label for="f-grade">שכבה</label><select id="f-grade" name="grade">${opt(['א׳','ב׳','ג׳','ד׳','ה׳','ו׳'], d.grade)}</select></div>
        <div class="field" style="flex:0 1 140px"><label for="f-time">משך (דקות)</label><input id="f-time" name="time" inputmode="numeric" value="${esc(d.time)}"></div>
      </div>
      <div class="field"><label for="f-topic">נושא</label><input id="f-topic" name="topic" value="${esc(d.topic)}" placeholder="למשל: שברים פשוטים — חצי ורבע"></div>
      <div class="field"><label for="f-goal">יעד מדיד</label><textarea id="f-goal" name="goal" placeholder="מה התלמידות יֵדעו לעשות בסוף, ואיך תראי את זה?">${esc(d.goal)}</textarea></div>
      <div class="field"><label for="f-inputs">חומרים שאדביק</label><small>למשל: יעדי תוכנית הלימודים שלך, קטע מספר הלימוד. בלי שמות ובלי מידע מזהה.</small><textarea id="f-inputs" name="inputs">${esc(d.inputs)}</textarea></div>
      <div class="field"><label for="f-format">פורמט התוצר</label><select id="f-format" name="format">${opt(['טבלה','רשימה ממוספרת','מערך שיעור','דף עבודה לתלמידות + מפתח תשובות','מחוון','כרטיסי תחנה'], d.format)}</select></div>
      <fieldset class="field" style="border:0;padding:0;margin:0 0 .9rem"><legend class="lab">מגבלות נוספות</legend><div class="checks">
        <label><input type="checkbox" name="c_nodevice"${d.c_nodevice ? ' checked' : ''}> חלופה ללא מכשירים</label>
        <label><input type="checkbox" name="c_access"${d.c_access ? ' checked' : ''}> הנגשה: טקסט אמיתי, מבנה כותרות, תיאור לתמונות</label>
        <label><input type="checkbox" name="c_levels"${d.c_levels ? ' checked' : ''}> שלוש רמות תמיכה עם יעד משותף</label>
        <label><input type="checkbox" name="c_short"${d.c_short ? ' checked' : ''}> ניסוח קצר ופשוט המתאים לקריאה עצמאית</label></div></fieldset>
      <div class="field"><label for="f-extra">הערה חופשית</label><textarea id="f-extra" name="extra">${esc(d.extra)}</textarea></div>
      <div class="field"><label for="f-guide">מדריך קשור (לא חובה)</label><select id="f-guide" name="guide"><option value="">ללא</option>${G.map(g => `<option value="${g.no}"${g.no === d.guide ? ' selected' : ''}>${g.no} · ${esc(g.title)}</option>`).join('')}</select></div>
      <button type="button" class="btn light" id="greset">איפוס הטופס</button>
    </form>
    <div class="out"><h2 style="margin-top:0">הפרומפט שלך</h2><pre id="gout" aria-live="polite" aria-atomic="true" aria-busy="false"></pre>
      <button type="button" class="btn" id="gcopy">העתקת הפרומפט</button>
      <p class="sub" style="margin-top:.8rem">אחרי ההדבקה: קראי את התוצר, בדקי עובדות, תשובות והתאמה לכיתה שלך. ה-AI יכול לטעות.</p></div></div></div></section>`;
  const f = document.getElementById('gform'), out = document.getElementById('gout');
  const build = () => {
    const v = {}; new FormData(f).forEach((x, k) => v[k] = x); ['c_nodevice','c_access','c_levels','c_short'].forEach(k => v[k] = !!f.elements[k].checked);
    store.set('gen', v);
    const ph = (x, p) => (x && String(x).trim()) ? String(x).trim() : `[${p}]`;
    const lim = [`משך הפעילות: ${ph(v.time, 'מספר דקות')} דקות.`];
    if (v.c_nodevice) lim.push('כללי גם חלופה מלאה שאינה דורשת מכשירים.');
    if (v.c_access) lim.push('הקפידי על נגישות: טקסט אמיתי (לא תמונה), מבנה כותרות, תיאור חלופי לכל איור.');
    if (v.c_levels) lim.push('בני שלוש רמות תמיכה עם אותו יעד ליבה, ושאלה אחת לפחות בכל רמה שדורשת הסבר.');
    if (v.c_short) lim.push('נסחי משפטים קצרים ופשוטים, מותאמים לקריאה עצמאית בשכבה זו.');
    const g = G.find(x => x.no === v.guide);
    out.textContent =
`תפקיד: את ${ph(v.role, 'תפקיד')}.
הקשר: אני מורה בבית ספר יסודי לבנות ומתכוננת לשיעור ב${ph(v.subject, 'מקצוע')} בנושא ${ph(v.topic, 'נושא')}.${g ? ` אני עובדת לפי המדריך "${g.title}".` : ''}
שכבה: כיתה ${ph(v.grade, 'שכבה')}.
יעד מדיד: ${ph(v.goal, 'מה התלמידות יֵדעו לעשות בסוף השיעור, ואיך אראה זאת')}
קלטים: השתמשי רק בחומרים שאדביק כאן:
${ph(v.inputs, 'הדביקי כאן יעדים או חומרים — ללא שמות או מידע מזהה')}
מגבלות:
- ${lim.join('\n- ')}
- אל תמציאי יעדים רשמיים, נתונים, ציטוטים או מקורות. אם חסר מידע — כתבי מה חסר ושאלי אותי.
- אל תבקשי ואל תשתמשי בפרטים מזהים של תלמידות.${v.extra && v.extra.trim() ? '\n- ' + v.extra.trim() : ''}
פורמט התוצר: ${ph(v.format, 'פורמט')}, בעברית.
אי-ודאות: סמני בכוכבית (*) כל הנחה שהנחת וכל פרט שאינך בטוחה בו, והסבירי בקצרה בסוף.
בדיקה אנושית: בסוף, כתבי רשימה קצרה של מה עליי לבדוק לפני שימוש בכיתה (דיוק, התאמה לגיל, זמן, נגישות).`;
  };
  let bt;
  const debounced = () => { out.setAttribute('aria-busy', 'true'); clearTimeout(bt); bt = setTimeout(() => { build(); out.setAttribute('aria-busy', 'false'); }, 500); };
  f.addEventListener('input', debounced); f.addEventListener('change', debounced);
  document.getElementById('gcopy').addEventListener('click', e => copyText(out.textContent, null));
  document.getElementById('greset').addEventListener('click', () => { store.set('gen', {}); viewGenerator(); toast('הטופס אופס.'); });
  build();
}

function viewAbout() {
  document.title = 'על הספרייה';
  main.innerHTML = `<section class="band"><div class="wrap prose">
  <h1 style="margin-top:0">על הספרייה</h1>
  <p>הספרייה נבנתה לצוות "אהרון הרואה בנות" מתוך עשרה צרכים שהעלו המורות. לכל צורך יש מדריך עצמאי: ניתוח פדגוגי, בחירת כלי, הדרכה צעד אחר צעד, דוגמאות לשתי קבוצות גיל לפחות, ולפחות שלושה פרומפטים.</p>
  <h2>איך לעבוד עם המדריכים</h2>
  <ul><li>התחילי מתיבת "התחלה מהירה" בתחילת כל מדריך.</li><li>העתיקי פרומפט, החליפי את השדות שבסוגריים המרובעים, והדביקי בכלי ה-AI של בית הספר.</li><li>בדקי כל תוצר לפני שימוש: עובדות, תשובות, התאמה לגיל ולכיתה.</li><li>ה-PDF של כל מדריך מתאים להדפסה ולשמירה.</li></ul>
  <h2>מה אומת ומה לא</h2>
  <p>מידע על כלים — מחירים, תמיכה בעברית, דרישות גיל וחשבון — נבדק מול תיעוד רשמי ב־24.11.2026 ומסומן "אומת בתיעוד בלבד". אף כלי לא נוסה בפועל עם חשבון, ואף פרומפט לא הורץ. כלים ותנאים משתנים, ולכן כדאי לבדוק שוב לפני שימוש.</p>
  <h2>בינה מלאכותית ותלמידות</h2>
  <p>במדריכים ה-AI משמש את המורה בלבד, לתכנון ולהכנה. הנחיות משרד החינוך על שימוש תלמידות ב-AI משתנות לפי שכבה, והמסמכים הרשמיים שנבדקו מנוסחים באופן שונה זה מזה. לפני כל שימוש של תלמידות בדקי את הגרסה העדכנית ואת מדיניות בית הספר.</p>
  <h2>פרטיות</h2>
  <p>אין להזין לכלי AI שמות, תצלומים, הקלטות, ציונים מזוהים, מידע רפואי או תיאורי התנהגות של תלמידות. גם מידע מוסווה חלקית עלול לזהות ילדה. כל הדוגמאות במדריכים סינתטיות.</p>
  <p>האתר עצמו לא אוסף מידע. סימוני "קראתי", גודל הטקסט וטיוטת המחולל נשמרים רק בדפדפן שלך, ואפשר למחוק אותם דרך הגדרות הדפדפן.</p>
  <h2>נגישות</h2>
  <p>האתר נבנה לפי עקרונות WCAG 2.2 ברמה AA: ניווט מקלדת, מיקוד נראה, מבנה כותרות, תוויות לשדות, ניגודיות והגדלת טקסט. לא בוצעה בדיקת תאימות מלאה על ידי גורם מוסמך.</p>
  <h2>שאלות פתוחות לבית הספר</h2>
  <ul><li>באיזו סביבה בית הספר עובד: Google Workspace או Microsoft 365? המדריכים מציגים את Gemini כמסלול מרכזי ואת Copilot כחלופה.</li><li>מי המורה השנייה בכיתה בהוראה המשותפת (מדריך 04)?</li><li>מה ההגדרה של בית הספר למודל "איתי, לידי ובמרחב" (מדריך 07)?</li></ul>
  <p class="sub">גופן: Heebo, ברישיון SIL Open Font License. עיצוב מוצע, לא אושר רשמית.</p>
  </div></section>`;
}
function viewNotFound() { document.title = 'הדף לא נמצא'; main.innerHTML = `<section class="band"><div class="wrap"><h1>הדף לא נמצא</h1><p><a href="#home">חזרה לספרייה</a></p></div></section>`; }

/* ---------- router ---------- */
function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  const m = /^g(\d\d)(?:-(.+))?$/.exec(h);
  const page = m ? 'guide' : (h || 'home');
  document.querySelectorAll('[data-nav]').forEach(a => { if (a.dataset.nav === page) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (m) return viewGuide(m[1], m[2]);
  current = null;
  if (page === 'home') viewHome();
  else if (page === 'prompts') viewPrompts();
  else if (page === 'generator') viewGenerator();
  else if (page === 'about') viewAbout();
  else viewNotFound();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', () => { route(); main.focus({preventScroll: true}); });

/* ---------- text size ---------- */
let scale = store.get('scale', 1);
const applyScale = () => { document.documentElement.style.setProperty('--scale', scale); store.set('scale', scale); };
document.getElementById('ts-up').addEventListener('click', () => { scale = Math.min(1.5, +(scale + 0.1).toFixed(2)); applyScale(); });
document.getElementById('ts-down').addEventListener('click', () => { scale = Math.max(0.9, +(scale - 0.1).toFixed(2)); applyScale(); });
applyScale();
route();
}

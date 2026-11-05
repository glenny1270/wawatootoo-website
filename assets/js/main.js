/* ============================================================
   Wawatootoo art studio — shared script
   ヘッダー/フッターの生成・言語切替・作品/動画の自動読み込み・
   ホームのメディアカルーセルをここで一括管理します。
   ============================================================ */

/* ---------- pages (menu order) ---------- */
const PAGES = [
  ["index.html",    "nav_home"],
  ["about.html",    "nav_about"],
  ["courses.html",  "nav_courses"],
  ["works.html",    "nav_works"],
  ["teachers.html", "nav_teachers"],
  ["contact.html",  "nav_contact"]
];

const HTML_KEYS = new Set(["about_stamp","addr","t2_bio","t3_bio","t4_bio","t5_bio"]);
/* 言語別サブディレクトリ（/zh/ /en/）から資産を参照するためのベースパス */
const BASE = (document.body && document.body.dataset.base) || "";
let currentLang = "ja";
let worksGroups = {child:[], sketch:[]};  /* assets/works/<group>/ の画像 */
let discoveredWorks = [];   /* [{group, n, url}] 全グループ結合（lightbox 用） */
let mediaItems = [];        /* carousel slides: videos first, then images */

/* ---------- language persistence (fails silently if unavailable) ---------- */
function savedLang(){
  try{ const l = localStorage.getItem("wawatootoo-lang"); if(l && I18N[l]) return l; }catch(e){}
  const pageLang = document.documentElement.getAttribute("data-lang");
  return (pageLang && I18N[pageLang]) ? pageLang : "ja";
}
function saveLang(l){ try{ localStorage.setItem("wawatootoo-lang", l); }catch(e){} }

/* ---------- header & footer injection ---------- */
function currentPageFile(){
  const p = location.pathname.split("/").pop();
  return p === "" ? "index.html" : p;
}

function buildHeader(){
  const host = document.getElementById("site-header");
  if(!host) return;
  const cur = currentPageFile();
  const links = PAGES.map(([file,key])=>
    `<a href="${file}" class="i18n-fade${file===cur?" active":""}" data-i18n="${key}"></a>`).join("");
  host.innerHTML = `
  <header class="site-header" id="header">
    <a class="brand" href="index.html">
      <img class="brand-mark-img" src="${BASE}assets/img/wato-mark.png" alt="Wawatootoo art studio">
      <span>
        <span class="brand-name i18n-fade" data-i18n="brand"></span>
        <span class="brand-sub">art studio</span>
      </span>
    </a>
    <nav class="main-nav" id="mainNav">${links}</nav>
    <div class="header-right">
      <div class="lang-switch" role="group" aria-label="Language">
        <button type="button" data-setlang="ja">日本語</button>
        <button type="button" data-setlang="zh">中文</button>
        <button type="button" data-setlang="en">EN</button>
      </div>
      <button class="menu-btn" id="menuBtn" aria-label="Menu">☰</button>
    </div>
  </header>`;
  document.querySelectorAll(".lang-switch button").forEach(b=>{
    b.addEventListener("click", ()=>switchLang(b.dataset.setlang));
  });
  const menuBtn = document.getElementById("menuBtn");
  const nav = document.getElementById("mainNav");
  menuBtn.addEventListener("click", ()=>nav.classList.toggle("open"));
}

function buildFooter(){
  const host = document.getElementById("site-footer");
  if(!host) return;
  host.innerHTML = `
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-left">
        <small>Art Studio · Kameido, Tokyo</small>
        <a class="footer-ig" href="https://www.instagram.com/wawatootoo.art.studio/" target="_blank" rel="noopener" aria-label="Instagram">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none"/></svg>
          <span>@wawatootoo.art.studio</span>
        </a>
      </div>
      <p class="footer-tag i18n-fade" data-i18n="foot_note"></p>
    </div>
    <div class="copyright">
      <span>© 2026 Wawatootoo art studio. All rights reserved.</span>
      <span>Kameido, Koto City, Tokyo</span>
      <span class="ga-note i18n-fade" data-i18n="ga_note"></span>
    </div>
  </footer>`;
}

/* ---------- i18n ---------- */
function applyLang(lang){
  currentLang = lang;
  const dict = I18N[lang];
  document.documentElement.setAttribute("data-lang", lang);
  document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
  document.querySelectorAll("[data-i18n]").forEach(el=>{
    const k = el.getAttribute("data-i18n");
    if(dict[k] !== undefined){
      if(HTML_KEYS.has(k)) el.innerHTML = dict[k];
      else el.textContent = dict[k];
    }
  });
  const cur = currentPageFile();
  const page = PAGES.find(p=>p[0]===cur);
  document.title = (cur === "index.html" || !page)
    ? dict.meta_title
    : dict[page[1]] + " | Wawatootoo art studio";
  const mq = document.getElementById("marqueeTrack");
  if(mq) buildMarquee(dict.marquee);
  document.querySelectorAll(".lang-switch button").forEach(b=>{
    b.classList.toggle("active", b.dataset.setlang === lang);
  });
  refreshMediaCaptions();
}

function switchLang(lang){
  if(lang === currentLang) return;
  saveLang(lang);
  document.body.classList.add("lang-fading");
  setTimeout(()=>{
    applyLang(lang);
    requestAnimationFrame(()=>document.body.classList.remove("lang-fading"));
  }, 250);
}

function buildMarquee(words){
  const track = document.getElementById("marqueeTrack");
  const seq = words.concat(words).map(w=>`<span>${w}</span>`).join("");
  track.innerHTML = seq + seq;
}

/* ---------- media auto-discovery ----------
   画像: assets/works/01.jpg, 02.png ... （番号順・最大60枚）
   動画: assets/media/video_0.mp4, video_1.mp4 ... （最大10本） */
const WORK_EXTS = ["jpg","jpeg","png","webp","svg"];
const pad2 = n => String(n).padStart(2,"0");

function probeImage(url){
  return new Promise(res=>{
    const im = new Image();
    im.onload = ()=>res(true);
    im.onerror = ()=>res(false);
    im.src = url;
  });
}

/* 作品はグループごとのサブフォルダに置く:
   assets/works/child/1.jpg…（こども美術） / assets/works/sketch/01.jpg…（デッサン）
   ファイル名は 1.jpg でも 01.jpg でも可。 */
const WORK_GROUPS = ["child","sketch"];
/* 首页カルーセルに出さない作品（"グループ/番号"） */
const CAROUSEL_EXCLUDE = new Set(["sketch/1"]);

async function probeWork(folder, n){
  const names = n < 10 ? [pad2(n), String(n)] : [String(n)];
  for(const name of names){
    for(const ext of WORK_EXTS){
      const candidate = folder
        ? `${BASE}assets/works/${folder}/${name}.${ext}`
        : `${BASE}assets/works/${name}.${ext}`;
      if(await probeImage(candidate)) return candidate;
    }
  }
  return null;
}

/* 番号をまとめて並列チェック（初回表示を速くする） */
async function discoverFolder(folder, max=60){
  const found = [];
  const BATCH = 12;
  for(let start=1; start<=max; start+=BATCH){
    const ns = [];
    for(let n=start; n<Math.min(start+BATCH, max+1); n++) ns.push(n);
    const urls = await Promise.all(ns.map(n=>probeWork(folder, n)));
    for(let i=0;i<ns.length;i++){
      if(!urls[i]) return found;
      found.push({group: folder || "sketch", n: ns[i], url: urls[i]});
    }
  }
  return found;
}

async function discoverWorks(max=60){
  const lists = await Promise.all(WORK_GROUPS.map(g=>discoverFolder(g, max)));
  const groups = {};
  WORK_GROUPS.forEach((g,i)=>groups[g] = lists[i]);
  /* 旧構成（assets/works/01.jpg…）へのフォールバック */
  if(!groups.child.length && !groups.sketch.length){
    groups.sketch = await discoverFolder("", max);
  }
  return groups;
}


/* ---------- captions ---------- */
function imageCaption(w){
  /* w: {group, n} — WORKS_CAPTIONS のキーは "child/1" / "sketch/2" 形式 */
  const dd = I18N[currentLang];
  if(w.group === "intro") return [`${dd.works_generic_intro} ${pad2(w.n)}`, dd.works_generic_meta_intro];
  const key = `${w.group}/${w.n}`;
  const c = WORKS_CAPTIONS[key] || WORKS_CAPTIONS[w.n];
  if(c && c[currentLang]) return c[currentLang];
  const d = I18N[currentLang];
  const generic = (w.group === "child" ? d.works_generic_kids : d.works_generic_sketch) || d.works_generic;
  return [`${generic} ${pad2(w.n)}`, d.works_generic_meta];
}
function videoCaption(n){
  const c = VIDEO_CAPTIONS[n];
  if(c && c[currentLang]) return c[currentLang];
  return [`Video ${n}`, "Movie"];
}
function mediaCaption(item){
  return item.type === "video" ? videoCaption(item.n) : imageCaption(item);
}

function refreshMediaCaptions(){
  document.querySelectorAll("[data-work-key]").forEach(el=>{
    const parts = el.dataset.workKey.split("/");
    const w = parts.length === 2
      ? {group: parts[0], n: Number(parts[1])}
      : {group: "sketch", n: Number(parts[0])};
    const [t,a] = imageCaption(w);
    const tEl = el.querySelector(".w-title"), aEl = el.querySelector(".w-age");
    if(tEl) tEl.textContent = t;
    if(aEl) aEl.textContent = a;
  });
  /* アクティビティ動画のキャプション */
  if(typeof ACTIVITY_VIDEOS !== "undefined"){
    document.querySelectorAll("[data-act-i]").forEach(el=>{
      const item = ACTIVITY_VIDEOS[Number(el.dataset.actI)];
      if(!item) return;
      const cap = item[currentLang] || item.ja;
      const tEl = el.querySelector(".v-title"), mEl = el.querySelector(".v-meta");
      if(tEl) tEl.textContent = cap[0];
      if(mEl) mEl.textContent = cap[1] || "";
    });
  }
  const capHost = document.getElementById("carouselCaption");
  if(capHost && mediaItems.length && capHost.dataset.mediaI !== undefined){
    const item = mediaItems[Number(capHost.dataset.mediaI)];
    if(item){
      const [t,a] = mediaCaption(item);
      capHost.querySelector(".t").textContent = t;
      capHost.querySelector(".a").textContent = a;
    }
  }
}

/* ---------- home media carousel（画像のみ・軽量版） ----------
   動画本体は作品ページへ移動し、ここでは2枚のポスター画像＋作品画像を表示。
   ポスター2枚は検出を待たず即表示されるので、開いてすぐ操作できる。 */
function CAROUSEL_STATIC(){
  return [
    {type:"img", group:"intro", n:1, url:`${BASE}assets/media/video_0_poster.jpg`},
    {type:"img", group:"intro", n:2, url:`${BASE}assets/media/video_1_poster.jpg`}
  ];
}
let carIdx = 0, carTimer = null, carBound = false;

function carStop(){ if(carTimer){ clearInterval(carTimer); carTimer = null; } }
function carStart(){ carStop(); carTimer = setInterval(()=>carShow(carIdx+1), 6000); }

function carShow(i){
  const slidesHost = document.getElementById("carouselSlides");
  if(!slidesHost || !mediaItems.length) return;
  carIdx = (i + mediaItems.length) % mediaItems.length;
  slidesHost.querySelectorAll(".slide").forEach(st=>st.classList.toggle("on", Number(st.dataset.i)===carIdx));
  const dotsHost = document.getElementById("carouselDots");
  dotsHost.querySelectorAll("button").forEach(d=>d.classList.toggle("on", Number(d.dataset.i)===carIdx));
  document.getElementById("carouselCounter").textContent = `${pad2(carIdx+1)} / ${pad2(mediaItems.length)}`;
  const capHost = document.getElementById("carouselCaption");
  const [t,a] = mediaCaption(mediaItems[carIdx]);
  capHost.querySelector(".t").textContent = t;
  capHost.querySelector(".a").textContent = a;
  capHost.dataset.mediaI = carIdx;
  carStart();
}

function bindCarouselControls(){
  if(carBound) return;
  carBound = true;
  document.getElementById("carPrev").addEventListener("click", ()=>carShow(carIdx-1));
  document.getElementById("carNext").addEventListener("click", ()=>carShow(carIdx+1));
  addEventListener("keydown", e=>{
    if(e.key === "ArrowRight") carShow(carIdx+1);
    if(e.key === "ArrowLeft") carShow(carIdx-1);
  });
  const frame = document.querySelector(".carousel-frame");
  frame.addEventListener("mouseenter", carStop);
  frame.addEventListener("mouseleave", carStart);
}

function renderCarousel(){
  const slidesHost = document.getElementById("carouselSlides");
  if(!slidesHost || !mediaItems.length) return;
  const dotsHost = document.getElementById("carouselDots");
  slidesHost.innerHTML = mediaItems.map((m,i)=>
    `<div class="slide" data-i="${i}"><img src="${m.url}" alt="WATO ${m.group} ${pad2(m.n)}" ${i===0 ? 'fetchpriority="high"' : 'loading="lazy"'}></div>`).join("");
  dotsHost.innerHTML = mediaItems.map((m,i)=>
    `<button type="button" data-i="${i}" aria-label="slide ${i+1}"></button>`).join("");
  dotsHost.querySelectorAll("button").forEach(d=>
    d.addEventListener("click", ()=>carShow(Number(d.dataset.i))));
  bindCarouselControls();
  carShow(Math.min(carIdx, mediaItems.length-1));
}

function initCarousel(){
  if(!document.getElementById("carouselSlides")) return;
  mediaItems = CAROUSEL_STATIC();
  renderCarousel();
}

function appendWorksToCarousel(){
  if(!document.getElementById("carouselSlides")) return;
  mediaItems = [
    ...CAROUSEL_STATIC(),
    ...discoveredWorks
      .filter(w=>!CAROUSEL_EXCLUDE.has(`${w.group}/${w.n}`))
      .map(w=>({type:"img", group:w.group, n:w.n, url:w.url}))
  ];
  renderCarousel();
}

/* ---------- works page grids (こども美術 / デッサン) ---------- */
function workFigure(w, idx){
  return `
    <figure class="work reveal" data-work-key="${w.group}/${w.n}" data-idx="${idx}">
      <div class="art"><img src="${w.url}" alt="student work ${w.group} ${pad2(w.n)}" loading="lazy"></div>
      <figcaption><span class="w-title"></span><span class="age w-age"></span></figcaption>
    </figure>`;
}
function initWorksGrid(){
  const kidsGrid = document.getElementById("kidsGrid");
  const sketchGrid = document.getElementById("sketchGrid");
  const legacyGrid = document.getElementById("worksGrid");
  if(!kidsGrid && !sketchGrid && !legacyGrid) return;
  const hosts = [];
  if(kidsGrid){
    kidsGrid.innerHTML = worksGroups.child.map(w=>workFigure(w, discoveredWorks.indexOf(w))).join("");
    const sec = document.getElementById("kidsSection");
    if(sec && !worksGroups.child.length) sec.style.display = "none";
    hosts.push(kidsGrid);
  }
  if(sketchGrid){
    sketchGrid.innerHTML = worksGroups.sketch.map(w=>workFigure(w, discoveredWorks.indexOf(w))).join("");
    const sec = document.getElementById("sketchSection");
    if(sec && !worksGroups.sketch.length) sec.style.display = "none";
    hosts.push(sketchGrid);
  }
  if(!kidsGrid && !sketchGrid && legacyGrid){
    legacyGrid.innerHTML = discoveredWorks.map((w,i)=>workFigure(w,i)).join("");
    hosts.push(legacyGrid);
  }
  refreshMediaCaptions();
  bindTilt();
  buildLightbox();
  hosts.forEach(grid=>{
    observeReveals(grid);
    grid.querySelectorAll(".work").forEach(w=>{
      w.addEventListener("click", ()=>openLightbox(Number(w.dataset.idx)));
    });
  });
}

/* ---------- lightbox（作品クリックで拡大表示） ---------- */
let lbIndex = 0;
function buildLightbox(){
  if(document.getElementById("lightbox")) return;
  const lb = document.createElement("div");
  lb.id = "lightbox";
  lb.setAttribute("hidden","");
  lb.innerHTML = `
    <button class="lb-btn lb-close" aria-label="close">✕</button>
    <button class="lb-btn lb-prev" aria-label="previous">←</button>
    <figure class="lb-stage">
      <img alt="">
      <figcaption data-work-key=""><span class="w-title"></span><span class="age w-age"></span></figcaption>
    </figure>
    <button class="lb-btn lb-next" aria-label="next">→</button>`;
  document.body.appendChild(lb);
  lb.querySelector(".lb-close").addEventListener("click", closeLightbox);
  lb.querySelector(".lb-prev").addEventListener("click", e=>{ e.stopPropagation(); showLightbox(lbIndex-1); });
  lb.querySelector(".lb-next").addEventListener("click", e=>{ e.stopPropagation(); showLightbox(lbIndex+1); });
  lb.addEventListener("click", e=>{ if(e.target === lb || e.target.classList.contains("lb-stage")) closeLightbox(); });
  addEventListener("keydown", e=>{
    if(lb.hasAttribute("hidden")) return;
    if(e.key === "Escape") closeLightbox();
    if(e.key === "ArrowLeft"){ e.stopPropagation(); showLightbox(lbIndex-1); }
    if(e.key === "ArrowRight"){ e.stopPropagation(); showLightbox(lbIndex+1); }
  }, true);
}
function showLightbox(i){
  const lb = document.getElementById("lightbox");
  if(!lb || !discoveredWorks.length) return;
  lbIndex = (i + discoveredWorks.length) % discoveredWorks.length;
  const w = discoveredWorks[lbIndex];
  lb.querySelector("img").src = w.url;
  const cap = lb.querySelector("figcaption");
  cap.dataset.workKey = `${w.group}/${w.n}`;
  const [t,a] = imageCaption(w);
  cap.querySelector(".w-title").textContent = t;
  cap.querySelector(".w-age").textContent = a;
}
function openLightbox(i){
  const lb = document.getElementById("lightbox");
  if(!lb) return;
  showLightbox(i);
  lb.removeAttribute("hidden");
  requestAnimationFrame(()=>lb.classList.add("on"));
  document.body.style.overflow = "hidden";
}
function closeLightbox(){
  const lb = document.getElementById("lightbox");
  if(!lb) return;
  lb.classList.remove("on");
  lb.setAttribute("hidden","");
  document.body.style.overflow = "";
}

/* ---------- works page: activity movies grid ----------
   assets/js/i18n.js の ACTIVITY_VIDEOS の順に表示します。 */
function initActivityGrid(){
  const grid = document.getElementById("videoGrid");
  if(!grid || typeof ACTIVITY_VIDEOS === "undefined") return;
  grid.innerHTML = ACTIVITY_VIDEOS.map((v,i)=>`
    <figure class="vid reveal" data-act-i="${i}">
      <video src="${BASE}${v.file}" controls ${v.poster ? `poster="${BASE}${v.poster}" preload="none"` : 'preload="metadata"'} playsinline controlslist="nodownload"></video>
      <figcaption><span class="v-title"></span><span class="v-meta"></span></figcaption>
    </figure>`).join("");
  refreshMediaCaptions();
  /* 再生は同時に1本だけ */
  grid.querySelectorAll("video").forEach(v=>{
    v.addEventListener("play", ()=>{
      grid.querySelectorAll("video").forEach(o=>{ if(o!==v) o.pause(); });
    });
  });
  observeReveals(grid.parentElement);
}

/* ---------- scroll effects ---------- */
const io = new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      e.target.classList.add("visible");
      io.unobserve(e.target);
      setTimeout(()=>{ e.target.style.transitionDelay=""; }, 1600);
    }
  });
},{threshold:.12});

function observeReveals(scope){
  const root = scope || document;
  root.querySelectorAll(".course-grid,.works-grid,.teach-grid,.fee-grid,.contact-grid,.about-grid").forEach(g=>{
    [...g.querySelectorAll(".reveal")].forEach((el,i)=>el.style.transitionDelay = (i*130)+"ms");
  });
  root.querySelectorAll(".reveal:not(.visible)").forEach(el=>io.observe(el));
}

function bindTilt(){
  document.querySelectorAll(".work").forEach(w=>{
    if(w.dataset.tiltBound) return;
    w.dataset.tiltBound = "1";
    const art = w.querySelector(".art");
    w.addEventListener("mousemove", e=>{
      const r = w.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5;
      const y = (e.clientY - r.top) / r.height - .5;
      art.style.transform = `perspective(700px) rotateY(${x*7}deg) rotateX(${-y*7}deg) translateZ(5px)`;
    });
    w.addEventListener("mouseleave", ()=>{ art.style.transform=""; });
  });
}

/* ---------- init ---------- */
buildHeader();
buildFooter();
applyLang(savedLang());
observeReveals();

const headerEl = document.getElementById("header");
const progressBar = document.getElementById("progressBar");
addEventListener("scroll", ()=>{
  headerEl.classList.toggle("scrolled", scrollY > 30);
  if(progressBar){
    const h = document.documentElement.scrollHeight - innerHeight;
    progressBar.style.width = (h > 0 ? (scrollY / h) * 100 : 0) + "%";
  }
}, {passive:true});

/* ---------- お問い合わせフォーム（FormSubmit 経由でメール送信） ---------- */
const FORM_ENDPOINT = "https://api.web3forms.com/submit";
const FORM_ACCESS_KEY = "b3ac149b-d587-4d76-b333-72c0cc09f7cd";
function showFormSuccess(){
  const formEl = document.getElementById("contactForm");
  if(!formEl || document.querySelector(".form-success")) return;
  const d = I18N[currentLang];
  const card = document.createElement("div");
  card.className = "form-success";
  card.innerHTML = `
    <span class="fs-check" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27 l8 7 l14 -15"/></svg></span>
    <h3 class="i18n-fade" data-i18n="f_done_title">${d.f_done_title}</h3>
    <p class="i18n-fade" data-i18n="f_done_body">${d.f_done_body}</p>
    <p class="fs-note i18n-fade" data-i18n="f_done_note">${d.f_done_note}</p>`;
  formEl.replaceWith(card);
  card.scrollIntoView({block:"center", behavior:"smooth"});
}

const form = document.getElementById("contactForm");
if(form){
  /* 通常送信フォールバックから戻ってきた場合（?sent=1）は完了メッセージを表示 */
  if(location.search.indexOf("sent=1") !== -1){
    showFormSuccess();
  }
  form.addEventListener("submit", async e=>{
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    const sent = document.getElementById("formSent");
    const honey = document.getElementById("f-honey");
    const dict = I18N[currentLang];
    btn.disabled = true; btn.style.opacity = ".55";
    sent.classList.remove("show","err");
    try{
      const payload = {
        "access_key": FORM_ACCESS_KEY,
        "subject": "【Wawatootoo art studio】サイトからのお問い合わせ",
        "from_name": "Wawatootoo art studio",
        "お名前 / Name": document.getElementById("f-name").value,
        "email": document.getElementById("f-email").value,
        "ご希望のコース / Course": document.getElementById("f-course").value,
        "メッセージ / Message": document.getElementById("f-msg").value
      };
      /* ハニーポット: bot がチェックした場合のみ送る（Web3Forms が自動で破棄） */
      if(honey && honey.checked) payload.botcheck = true;
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: {"Content-Type":"application/json", "Accept":"application/json"},
        body: JSON.stringify(payload)
      });
      if(!res.ok) throw new Error("send failed: " + res.status);
      form.reset();
      showFormSuccess();
    }catch(err){
      /* AJAX が使えない環境では通常のフォーム送信にフォールバック
         （FormSubmit へ POST し、完了後 _next で当ページに戻る） */
      try{
        HTMLFormElement.prototype.submit.call(form);
        return;
      }catch(e2){}
      sent.setAttribute("data-i18n","f_err");
      sent.textContent = dict.f_err;
      sent.classList.add("show","err");
    }finally{
      btn.disabled = false; btn.style.opacity = "";
    }
  });
}

/* carousel はポスター2枚で即時表示（検出を待たない） */
initCarousel();

/* 作品画像の検出は、カルーセル/作品グリッドのあるページだけで実行 */
if(document.getElementById("carouselSlides") ||
   document.getElementById("kidsGrid") || document.getElementById("sketchGrid") ||
   document.getElementById("worksGrid")){
  discoverWorks().then(groups=>{
    worksGroups = groups;
    discoveredWorks = [...groups.child, ...groups.sketch];
    appendWorksToCarousel();
    initWorksGrid();
  });
}

/* 作品ページのアクティビティ動画（自動検出に依存しないので即時実行） */
initActivityGrid();

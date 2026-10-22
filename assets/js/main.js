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

const HTML_KEYS = new Set(["about_stamp","addr","t2_bio"]);
let currentLang = "ja";
let discoveredWorks = [];   /* [{n, url}]  images in assets/works */
let discoveredVideos = [];  /* [{n, url}]  videos in assets/media */
let mediaItems = [];        /* carousel slides: videos first, then images */

/* ---------- language persistence (fails silently if unavailable) ---------- */
function savedLang(){
  try{ const l = localStorage.getItem("wawatootoo-lang"); if(l && I18N[l]) return l; }catch(e){}
  return "ja";
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
      <svg class="brand-mark" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="20" stroke="#16141F" stroke-width="2.6" stroke-dasharray="100 26" stroke-linecap="round" transform="rotate(-60 24 24)"/>
        <circle cx="30" cy="17" r="4.6" fill="#8B5CF6"/>
      </svg>
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
      <p class="footer-brand"><span class="i18n-fade" data-i18n="brand"></span><small>Art Studio · Kameido, Tokyo</small></p>
      <p class="footer-tag i18n-fade" data-i18n="foot_note"></p>
    </div>
    <div class="copyright">
      <span>© 2026 Wawatootoo art studio. All rights reserved.</span>
      <span>Kameido, Koto City, Tokyo</span>
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
/* 動画の存在確認は <video> 要素で行う（file:// 直開きでも動作する） */
function probeUrl(url){
  return new Promise(res=>{
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = ()=>res(true);
    v.onerror = ()=>res(false);
    v.src = url;
  });
}

async function discoverWorks(max=60){
  const found = [];
  for(let n=1;n<=max;n++){
    let url = null;
    for(const ext of WORK_EXTS){
      const candidate = `assets/works/${pad2(n)}.${ext}`;
      if(await probeImage(candidate)){ url = candidate; break; }
    }
    if(!url) break;
    found.push({n, url});
  }
  return found;
}

async function discoverVideos(max=10){
  const found = [];
  for(let n=0;n<max;n++){
    const mp4 = `assets/media/video_${n}.mp4`;
    if(await probeUrl(mp4)){
      const webm = `assets/media/video_${n}.webm`;
      found.push({n, url:mp4, webm:(await probeUrl(webm)) ? webm : null});
    } else break;
  }
  return found;
}

/* ---------- captions ---------- */
function imageCaption(n){
  const c = WORKS_CAPTIONS[n];
  if(c && c[currentLang]) return c[currentLang];
  const d = I18N[currentLang];
  return [`${d.works_generic} ${pad2(n)}`, d.works_generic_meta];
}
function videoCaption(n){
  const c = VIDEO_CAPTIONS[n];
  if(c && c[currentLang]) return c[currentLang];
  return [`Video ${n}`, "Movie"];
}
function mediaCaption(item){
  return item.type === "video" ? videoCaption(item.n) : imageCaption(item.n);
}

function refreshMediaCaptions(){
  document.querySelectorAll("[data-work-n]").forEach(el=>{
    const [t,a] = imageCaption(Number(el.dataset.workN));
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

/* ---------- home media carousel ----------
   スライド構成: 動画（video_0 が先頭・自動再生）→ 作品画像。
   動画スライドは再生終了で次へ、画像スライドは6秒で次へ。 */
function initCarousel(){
  const slidesHost = document.getElementById("carouselSlides");
  if(!slidesHost) return;
  const dotsHost = document.getElementById("carouselDots");
  const counter = document.getElementById("carouselCounter");
  const capHost = document.getElementById("carouselCaption");
  let idx = 0, timer = null;

  mediaItems = [
    ...discoveredVideos.map(v=>({type:"video", n:v.n, url:v.url, webm:v.webm})),
    ...discoveredWorks.map(w=>({type:"img", n:w.n, url:w.url}))
  ];
  if(!mediaItems.length){
    slidesHost.innerHTML = "<p style='padding:40px;text-align:center'>No media found.</p>";
    return;
  }

  slidesHost.innerHTML = mediaItems.map((m,i)=>{
    if(m.type === "video"){
      const sources = `<source src="${m.url}" type="video/mp4">` +
        (m.webm ? `<source src="${m.webm}" type="video/webm">` : "");
      return `<div class="slide" data-i="${i}"><video muted playsinline preload="metadata" controls controlslist="nodownload">${sources}</video></div>`;
    }
    return `<div class="slide" data-i="${i}"><img src="${m.url}" alt="student work ${pad2(m.n)}" loading="lazy"></div>`;
  }).join("");
  dotsHost.innerHTML = mediaItems.map((m,i)=>
    `<button type="button" data-i="${i}" aria-label="slide ${i+1}"></button>`).join("");

  function stopTimer(){ if(timer){ clearInterval(timer); timer = null; } }
  function startTimer(){ stopTimer(); timer = setInterval(next, 6000); }

  function show(i){
    idx = (i + mediaItems.length) % mediaItems.length;
    slidesHost.querySelectorAll(".slide").forEach(s=>{
      const on = Number(s.dataset.i) === idx;
      s.classList.toggle("on", on);
      const v = s.querySelector("video");
      if(v){
        if(on){ v.currentTime = 0; v.play().catch(()=>{}); }
        else v.pause();
      }
    });
    dotsHost.querySelectorAll("button").forEach(d=>d.classList.toggle("on", Number(d.dataset.i)===idx));
    counter.textContent = `${pad2(idx+1)} / ${pad2(mediaItems.length)}`;
    const item = mediaItems[idx];
    const [t,a] = mediaCaption(item);
    capHost.querySelector(".t").textContent = t;
    capHost.querySelector(".a").textContent = a;
    capHost.dataset.mediaI = idx;
    /* 動画中はタイマー停止（終了イベントで進む）、画像中は6秒タイマー */
    if(item.type === "video") stopTimer();
    else startTimer();
  }
  function next(){ show(idx+1); }
  function prev(){ show(idx-1); }

  slidesHost.querySelectorAll("video").forEach(v=>{
    v.addEventListener("ended", ()=>next());
  });

  document.getElementById("carPrev").addEventListener("click", ()=>prev());
  document.getElementById("carNext").addEventListener("click", ()=>next());
  dotsHost.querySelectorAll("button").forEach(d=>
    d.addEventListener("click", ()=>show(Number(d.dataset.i))));
  addEventListener("keydown", e=>{
    if(e.key === "ArrowRight") next();
    if(e.key === "ArrowLeft") prev();
  });
  const frame = document.querySelector(".carousel-frame");
  frame.addEventListener("mouseenter", stopTimer);
  frame.addEventListener("mouseleave", ()=>{
    if(mediaItems[idx] && mediaItems[idx].type !== "video") startTimer();
  });

  show(0); /* 先頭 = video_0（自動再生） */
}

/* ---------- works page grid (images only) ---------- */
function initWorksGrid(){
  const grid = document.getElementById("worksGrid");
  if(!grid) return;
  grid.innerHTML = discoveredWorks.map(w=>`
    <figure class="work reveal" data-work-n="${w.n}">
      <div class="art"><img src="${w.url}" alt="student work ${pad2(w.n)}" loading="lazy"></div>
      <figcaption><span class="w-title"></span><span class="age w-age"></span></figcaption>
    </figure>`).join("");
  refreshMediaCaptions();
  bindTilt();
  observeReveals(grid);
}

/* ---------- works page: activity movies grid ----------
   assets/js/i18n.js の ACTIVITY_VIDEOS の順に表示します。 */
function initActivityGrid(){
  const grid = document.getElementById("videoGrid");
  if(!grid || typeof ACTIVITY_VIDEOS === "undefined") return;
  grid.innerHTML = ACTIVITY_VIDEOS.map((v,i)=>`
    <figure class="vid reveal" data-act-i="${i}">
      <video src="${v.file}" controls preload="metadata" playsinline controlslist="nodownload"></video>
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
const FORM_ENDPOINT = "https://formsubmit.co/ajax/wmyymw1994@gmail.com";
const form = document.getElementById("contactForm");
if(form){
  form.addEventListener("submit", async e=>{
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    const sent = document.getElementById("formSent");
    const honey = document.getElementById("f-honey");
    const dict = I18N[currentLang];
    btn.disabled = true; btn.style.opacity = ".55";
    sent.classList.remove("show","err");
    try{
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: {"Content-Type":"application/json", "Accept":"application/json"},
        body: JSON.stringify({
          "お名前 / Name": document.getElementById("f-name").value,
          "メール / Email": document.getElementById("f-email").value,
          "ご希望のコース / Course": document.getElementById("f-course").value,
          "メッセージ / Message": document.getElementById("f-msg").value,
          "_subject": "【Wawatootoo】サイトからのお問い合わせ",
          "_template": "table",
          "_captcha": "false",
          "_honey": honey ? honey.value : ""
        })
      });
      if(!res.ok) throw new Error("send failed: " + res.status);
      sent.setAttribute("data-i18n","f_sent");
      sent.textContent = dict.f_sent;
      sent.classList.add("show");
      form.reset();
    }catch(err){
      sent.setAttribute("data-i18n","f_err");
      sent.textContent = dict.f_err;
      sent.classList.add("show","err");
    }finally{
      btn.disabled = false; btn.style.opacity = "";
    }
  });
}

/* media discovery → carousel / grid */
Promise.all([discoverWorks(), discoverVideos()]).then(([works, videos])=>{
  discoveredWorks = works;
  discoveredVideos = videos;
  initCarousel();
  initWorksGrid();
});

/* 作品ページのアクティビティ動画（自動検出に依存しないので即時実行） */
initActivityGrid();

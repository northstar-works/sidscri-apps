
function autoGrowTextarea(ta){
  if(!ta) return;
  ta.style.height = "auto";
  ta.style.height = (ta.scrollHeight + 2) + "px";
}
let allGroups = [];
let scopeGroup = "";         // selected group for studying ("" means all)
let allCardsMode = true; // studying all cards across groups    // "All Cards" button (flat mode)
let activeTab = "active";    // active | unsure | learned | custom

// Breakdown IDs cache - cards that have breakdown data
let breakdownIds = new Set();

// Learned tab can be viewed as a list (default) or studied like a deck
let learnedViewMode = "list"; // list | study

// Custom Set view filter
let customViewMode = "unlearned"; // unlearned | unsure | learned | all

function updateFilterHighlight(){
  const btn = $("allCardsBtn");
  const sel = $("groupSelect");
  if(!btn || !sel) return;
  const usingAll = !!allCardsMode || !sel.value;
  btn.classList.toggle("filterActive", usingAll);
  sel.classList.toggle("filterActive", !usingAll);
}


function updateLearnedViewHighlight(){
  const wrap = $("learnedViewToggle");
  if(!wrap) return;
  const show = (activeTab === "learned");
  wrap.classList.toggle("hidden", !show);
  const bList = $("learnedViewListBtn");
  const bStudy = $("learnedViewStudyBtn");
  if(bList) bList.classList.toggle("active", learnedViewMode === "list");
  if(bStudy) bStudy.classList.toggle("active", learnedViewMode === "study");
}

function updateCustomViewHighlight(){
  const wrap = $("customViewToggle");
  if(!wrap) return;
  const show = (activeTab === "custom");
  wrap.classList.toggle("hidden", !show);
  const bUnlearned = $("customViewUnlearnedBtn");
  const bUnsure = $("customViewUnsureBtn");
  const bLearned = $("customViewLearnedBtn");
  const bAll = $("customViewAllBtn");
  if(bUnlearned) bUnlearned.classList.toggle("active", customViewMode === "unlearned");
  if(bUnsure) bUnsure.classList.toggle("active", customViewMode === "unsure");
  if(bLearned) bLearned.classList.toggle("active", customViewMode === "learned");
  if(bAll) bAll.classList.toggle("active", customViewMode === "all");
}

let deck = [];
let deckIndex = 0;

let settingsAll = null;      // global settings
let settingsGroup = {};      // group overrides (loaded on demand)

const $ = (id) => document.getElementById(id);
const DEFAULT_DECK_LOGO_URL = "/res/decklogos/advanced_flashcards_logo.png";
function bind(id, evt, fn){
  const el = $(id);
  if(!el){ console.warn("Missing element:", id); return; }
  el.addEventListener(evt, fn);
}

let currentUser = null; // {id, username, display_name}
let loginResetPending = false; // true after temp-password login until password is changed

function isAdminUser(){
  try{
    return !!(currentUser && (currentUser.username||"").toString().trim().toLowerCase() === "sidscri");
  } catch(e){
    return false;
  }
}
let appInitialized = false;

let aiStatus = { openai_available: false, openai_model: "", gemini_available: false, gemini_model: "", selected_provider: "auto" };

async function postLoginInit(){
  let _activeDeckLoadedFromSettings = false;
  if(appInitialized) return;
  
  // Load settings and decks in PARALLEL (they don't depend on each other)
  let settingsResult = null;
  let decksResult = null;
  try {
    [settingsResult, decksResult] = await Promise.all([
      jget("/api/settings?scope=all").catch(async (e)=>{ return await jget("/api/settings"); }).catch(()=>null),
      jget("/api/decks").catch(()=>[])
    ]);
  } catch(e){}
  
  // Apply settings
  if(settingsResult) {
    const settings = (settingsResult && settingsResult.settings) ? settingsResult.settings : settingsResult;
    settingsAll = settings;  // Cache so getScopeSettings won't re-fetch
    if(settings && settings.activeDeckId){
      activeDeckId = settings.activeDeckId;
      _activeDeckLoadedFromSettings = true;
    }
  }
  
  // Apply decks
  if(decksResult) {
    currentDecks = decksResult;
    try {
      const ids = new Set((currentDecks || []).map(d => (d && d.id) ? d.id : null).filter(Boolean));
      const defaultDeck = (currentDecks || []).find(d => d && d.isDefault) || (currentDecks || [])[0];

      const shouldUseDefault = (!_activeDeckLoadedFromSettings && defaultDeck && defaultDeck.id && defaultDeck.id !== activeDeckId);
      const activeMissing = ids.size && !ids.has(activeDeckId);

      if((shouldUseDefault || activeMissing) && defaultDeck && defaultDeck.id){
        activeDeckId = defaultDeck.id;
        try { jpost("/api/settings", { scope: "all", settings: { activeDeckId } }); } catch(e){}
      }
    } catch(e){}

    updateHeaderDeckName();
    updateHeaderDeckLogo();
  }
  
  // Load breakdown IDs, groups, health, AI status in parallel
  await Promise.all([
    loadBreakdownIds(),
    loadGroups(),
    loadHealth(),
    (async () => { try{ aiStatus = await jget("/api/ai"); } catch(e){ aiStatus = { openai_available:false, openai_model:"", gemini_available:false, gemini_model:"" }; } })()
  ]);

  // setTab() will call refresh() and refreshCounts()

  // default start view
  setTab("active");
  appInitialized = true;
}

// Load breakdown IDs for visual indicator on cards
async function loadBreakdownIds(){
  try {
    const res = await jget("/api/breakdowns/ids");
    breakdownIds = new Set(res.ids || []);
  } catch(e){
    breakdownIds = new Set();
  }
}

// Check if a card has breakdown data
function cardHasBreakdown(cardId){
  return breakdownIds.has(cardId);
}


function showAuthOverlay(){ $("authOverlay").classList.remove("hidden"); }
function hideAuthOverlay(){ $("authOverlay").classList.add("hidden"); }

function setAuthView(view){
  $("loginBox").classList.toggle("hidden", view !== "login");
  $("registerBox").classList.toggle("hidden", view !== "register");
}

async function loadVersionIntoMenu() {
  try {
    const v = await jget('/api/version');
    const el = document.getElementById('userMenuVersion');
    if (!el || !v) return;

    // New API (preferred)
    const isPackaged = (v.is_packaged === true) || (v.mode === 'packaged');
    const appName  = v.app_name || v.app || v.application || v.name;
    const appVer   = v.app_version || v.app_ver || v.appVersion;
    const appBuild = (v.app_build !== undefined) ? v.app_build : v.appBuild;

    const webName  = v.web_name || v.web || v.webapp || 'Web Server';
    const webVer   = v.web_version || v.web_ver || v.webVersion || v.version;
    const webBuild = (v.web_build !== undefined) ? v.web_build : (v.webBuild !== undefined ? v.webBuild : v.build);

    // Render (user dropdown: show APP version when packaged; otherwise show Webserver version)
    if (isPackaged) {
      const ab = (appBuild !== undefined && appBuild !== null && String(appBuild).trim() !== "") ? ` (build ${appBuild})` : "";
      el.textContent = `App Version: ${appVer || "unknown"}${ab}`;
    } else {
      const wb = (webBuild !== undefined && webBuild !== null && String(webBuild).trim() !== "") ? ` (build ${webBuild})` : "";
      el.textContent = `Webserver Version: ${webVer || "unknown"}${wb}`;
    }
  } catch (e) {
    // ignore
  }
}

function toggleUserMenu(force){
  const menu = $("userMenu");
  const line = $("userLine");
  if(!menu || !line) return;
  const isHidden = menu.classList.contains("hidden");
  const wantOpen = (force === true) ? true : (force === false) ? false : isHidden;
  menu.classList.toggle("hidden", !wantOpen);
  line.setAttribute("aria-expanded", wantOpen ? "true" : "false");
  if(wantOpen){
    loadVersionIntoMenu();
  }
}

function wireUserMenu(){
  const line = $("userLine");
  const menu = $("userMenu");
  if(!line || !menu) return;

  line.addEventListener("click", (e) => {
    if(!currentUser) return;
    e.stopPropagation();
    toggleUserMenu();
  });

  line.addEventListener("keydown", (e) => {
    if(!currentUser) return;
    if(e.key === "Enter" || e.key === " "){
      e.preventDefault();
      toggleUserMenu();
    }
  });

  document.addEventListener("click", (e) => {
    if(menu.classList.contains("hidden")) return;
    if(e.target !== line && !menu.contains(e.target)){
      toggleUserMenu(false);
    }
  });
}

function setUserLine(){
  if(currentUser){
    $("userLine").textContent = `User: ${currentUser.display_name || currentUser.username}`;
  } else {
    $("userLine").textContent = "";
  }
}

function clearAuthForms(){
  $("loginUsername").value = "";
  $("loginPassword").value = "";
  $("regUsername").value = "";
  $("regPassword").value = "";
  $("regDisplayName").value = "";
}

async function ensureLoggedIn(){
  const me = await fetch("/api/me").then(r=>r.json());
  if(me.logged_in){
    currentUser = me.user;
    setUserLine();
    hideAuthOverlay();
    if(!appInitialized){
      try{ await postLoginInit(); } catch(e){}
    }
    return true;
  }

  currentUser = null;
  setUserLine();
  showAuthOverlay();
  clearAuthForms();
  $("authMessage").textContent = "Sign in to continue";
  setAuthView("login");
  return false;
}


async function jget(url){
  const r = await fetch(url, { cache: "no-store" });
  if(r.status === 401){
    await ensureLoggedIn();
    throw new Error("login_required");
  }
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}
async function jpost(url, body){
  const r = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body||{})});
  if(r.status === 401){
    await ensureLoggedIn();
    throw new Error("login_required");
  }
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

function setStatus(msg){ 
  const hdr = $("statusHeader");
  const study = $("statusStudy");
  if(hdr) hdr.textContent = msg;
  if(study) study.textContent = msg;
  // Show header status only when study view is hidden (list mode)
  const studyVisible = $("viewStudy") && !$("viewStudy").classList.contains("hidden");
  if(hdr) hdr.style.display = studyVisible ? "none" : "";
}

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}


// Escape for putting values into HTML attributes (inputs)
function escapeAttr(str){
  return escapeHtml(str).replaceAll("\n"," ").replaceAll("\r"," ");
}

function shuffle(a){
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
}

function updateSearchClearButton(){
  const searchBox = $("searchBox");
  const clearBtn = $("searchClearBtn");
  if(!clearBtn) return;
  if(searchBox && searchBox.value.trim()){
    clearBtn.classList.remove("hidden");
  } else {
    clearBtn.classList.add("hidden");
  }
}

function reshuffleDeck(){
  if(deck.length > 1){
    shuffle(deck);
    deckIndex = 0;
    renderStudyCard();
    setStatus("Deck reshuffled!");
    setTimeout(() => setStatus(""), 1500);
  }
}

function isFlipped(){ return $("card").classList.contains("flipped"); }

function resizeCard(){
  const inner = $("cardInner");
  if(!inner) return;
  const faces = inner.querySelectorAll(".card-face");
  let maxH = 200; // minimum height
  faces.forEach(f => {
    // Temporarily position relative to measure natural height
    const savedPos = f.style.position;
    const savedVis = f.style.visibility;
    const savedTrans = f.style.transform;
    const savedBf = f.style.backfaceVisibility;
    f.style.position = "relative";
    f.style.visibility = "hidden";
    f.style.transform = "none";
    f.style.backfaceVisibility = "visible";
    f.style.webkitBackfaceVisibility = "visible";
    const h = f.scrollHeight;
    f.style.position = savedPos;
    f.style.visibility = savedVis;
    f.style.transform = savedTrans;
    f.style.backfaceVisibility = savedBf;
    f.style.webkitBackfaceVisibility = savedBf;
    if(h > maxH) maxH = h;
  });
  inner.style.height = maxH + "px";
}

function flip(){ 
  const wasFlipped = isFlipped();
  $("card").classList.toggle("flipped");
  resizeCard();
  
  // Speak definition when flipped to back (definition side)
  const settings = window.__activeSettings || settingsAll || {};
  if(!wasFlipped && settings.speak_definition_on_flip && deck.length){
    const c = deck[deckIndex];
    const reversed = !!settings.reverse_faces;
    // When flipping to back: if not reversed, back shows definition; if reversed, back shows term
    const textToSpeak = reversed ? c.term : c.meaning;
    if(textToSpeak){
      setTimeout(() => speakText(textToSpeak), 100);
    }
  }
}

function speakText(text){
  if(!text || !("speechSynthesis" in window)) return;
  
  const settings = window.__activeSettings || settingsAll || {};
  window.speechSynthesis.cancel();
  
  const u = new SpeechSynthesisUtterance(text);
  u.rate = settings.speech_rate || 1.0;
  
  const voiceName = settings.speech_voice || "";
  if(voiceName){
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.name === voiceName);
    if(voice) u.voice = voice;
  }
  
  window.speechSynthesis.speak(u);
}

function setTab(tab){
  activeTab = tab;

  // Show/hide the Learned view toggle
  const lvt = $("learnedViewToggle");
  if(lvt) lvt.classList.toggle("hidden", tab !== "learned");
  const lvList = $("learnedViewListBtn");
  const lvStudy = $("learnedViewStudyBtn");
  if(lvList) lvList.classList.toggle("active", tab === "learned" && learnedViewMode === "list");
  if(lvStudy) lvStudy.classList.toggle("active", tab === "learned" && learnedViewMode === "study");

  // Show/hide the Custom Set view toggle
  updateCustomViewHighlight();

  // Update study action button labels based on current mode
  updateStudyActionButtons();
  for(const [id, name] of [["tabActive","active"],["tabUnsure","unsure"],["tabLearned","learned"],["tabAll","all"],["tabCustom","custom"]]){
    const el = $(id);
    if(el) el.classList.toggle("active", tab===name);
  }

  const study = (tab === "active" || tab === "unsure" || tab === "custom" || (tab === "learned" && learnedViewMode === "study"));
  $("viewStudy").classList.toggle("hidden", !study);
  $("viewList").classList.toggle("hidden", study);
  $("viewSettings").classList.add("hidden");

  refresh();
}

function updateStudyActionButtons(){
  const got = $("gotItBtn");
  const ub  = $("unsureBtn");
  if(!got || !ub) return;

  // Default (Unlearned/Unsure study)
  got.textContent = "Got it ✓";
  got.classList.remove("neutral", "warn");
  got.classList.add("good");

  ub.textContent = (activeTab === "unsure") ? "Relearn" : "Unsure";
  ub.classList.remove("good", "neutral");
  ub.classList.add("secondary");

  // Learned study mode: replace buttons with Relearn / Still Unsure
  if(activeTab === "learned" && learnedViewMode === "study"){
    got.textContent = "Relearn";
    got.classList.remove("good");
    got.classList.add("neutral");

    ub.textContent = "Still Unsure";
    ub.classList.remove("secondary");
    ub.classList.add("warn");
  }
}

async function refreshCounts(){
  try{
    // In Custom Set mode, use the custom-set counts and do NOT overwrite with /api/counts (whole deck)
    if(activeTab === "custom"){
      if(customSetData && customSetData.counts){
        const counts = customSetData.counts || {};
        $("countsLine").textContent = `Unlearned: ${counts.active || 0} | Unsure: ${counts.unsure || 0} | Learned: ${counts.learned || 0}`;
        const total = (counts.total != null) ? counts.total : (Array.isArray(deck) ? deck.length : 0);
        updateHeaderCardCount(total);
      }
      return;
    }

    const groupParam = scopeGroup ? `&group=${encodeURIComponent(scopeGroup)}` : "";
    const deckParam = activeDeckId ? `&deck_id=${encodeURIComponent(activeDeckId)}` : "";
    const c = await jget(`/api/counts?${groupParam}${deckParam}`);
    $("countsLine").textContent = `Unlearned: ${c.active} | Unsure: ${c.unsure} | Learned: ${c.learned}`;
    // Update header card count
    updateHeaderCardCount(c.total);
  } catch(e){
    $("countsLine").textContent = `Unlearned: — | Unsure: — | Learned: —`;
  }
}

async function loadHealth(){
  const h = await jget("/api/health");
  // This will be updated by refreshCounts with actual deck card count
  $("healthLine").textContent = `Cards loaded: ${h.cards_loaded}`;
}

// Update the header card count based on current deck
function updateHeaderCardCount(total){
  $("healthLine").textContent = `Cards loaded: ${total}`;
}

// Update header to show current deck name
function updateHeaderDeckLogo(){
  const img = $("deckLogoImg");
  const wrap = $("deckLogoWrap");
  if(!img || !wrap){
    return;
  }
  const deck = currentDecks.find(d => d.id === activeDeckId);
  const logo = (deck && deck.logoPath) ? deck.logoPath : DEFAULT_DECK_LOGO_URL;
  img.src = logo;
  img.onerror = () => { img.onerror = null; img.src = DEFAULT_DECK_LOGO_URL; };
  wrap.style.display = "flex";
}

function updateHeaderDeckName(){
  const el = $("headerDeckName");
  if(!el) return;
  
  if(currentDecks && currentDecks.length > 0){
    const deck = currentDecks.find(d => d.id === activeDeckId);
    el.textContent = deck ? deck.name : "Kenpo Vocabulary";
  } else {
    el.textContent = "Kenpo Vocabulary";
  }
}

async function loadGroups(){
  const deckParam = activeDeckId ? `?deck_id=${encodeURIComponent(activeDeckId)}` : "";
  allGroups = await jget("/api/groups" + deckParam);

  const sel = $("groupSelect");
  sel.innerHTML = "";
  const optPick = document.createElement("option");
  optPick.value = "";
  optPick.textContent = "Select group…";
  sel.appendChild(optPick);

  for(const g of allGroups){
    const o = document.createElement("option");
    o.value = g;
    o.textContent = g;
    sel.appendChild(o);
  }

  scopeGroup = "";
  sel.value = "";
  allCardsMode = true;

  updateFilterHighlight();
  updateLearnedViewHighlight();

  // Build a dark custom dropdown (native <select> option list is white on Windows).
  setupGroupDropdown(allGroups);

  sel.addEventListener("change", () => {
    scopeGroup = sel.value;
    allCardsMode = scopeGroup ? false : true;
    updateFilterHighlight();
  updateLearnedViewHighlight();
    refresh();
  });

  const scopeSel = $("settingsScope");
  scopeSel.innerHTML = "";
  const sAll = document.createElement("option");
  sAll.value = "all";
  sAll.textContent = "All Groups";
  scopeSel.appendChild(sAll);

  for(const g of allGroups){
    const o = document.createElement("option");
    o.value = g;
    o.textContent = g;
    scopeSel.appendChild(o);
  }
}

let _groupDropdownWired = false;
function setupGroupDropdown(groupsList){
  const root = $("groupDropdown");
  const btn = $("groupDropdownBtn");
  const menu = $("groupDropdownMenu");
  const sel = $("groupSelect");
  if(!root || !btn || !menu || !sel) return;

  // Render menu
  const current = sel.value || "";
  const items = [{value:"", label:"Select group…", muted:true}].concat(
    (groupsList || []).map(g => ({value:g, label:g, muted:false}))
  );
  menu.innerHTML = items.map(it => {
    const cls = ["dropdownItem", it.muted ? "muted" : "", it.value===current ? "selected" : ""].filter(Boolean).join(" ");
    const safe = (it.label||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    return `<div class="${cls}" role="option" data-value="${(it.value||"").replace(/"/g,"&quot;")}">${safe}</div>`;
  }).join("");

  const setBtnLabel = (v) => { btn.textContent = v ? v : "Select group…"; };
  setBtnLabel(current);

  // One-time wiring
  if(!_groupDropdownWired){
    _groupDropdownWired = true;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const isOpen = !menu.classList.contains("hidden");
      if(isOpen){
        menu.classList.add("hidden");
        btn.setAttribute("aria-expanded","false");
      }else{
        menu.classList.remove("hidden");
        btn.setAttribute("aria-expanded","true");
      }
    });

    menu.addEventListener("click", (e) => {
      const item = e.target.closest(".dropdownItem");
      if(!item) return;
      const v = item.getAttribute("data-value") || "";
      sel.value = v;
      setBtnLabel(v);
      // Update selected styling
      [...menu.querySelectorAll(".dropdownItem")].forEach(el => el.classList.toggle("selected", el.getAttribute("data-value") === v));
      menu.classList.add("hidden");
      btn.setAttribute("aria-expanded","false");
      sel.dispatchEvent(new Event("change"));
    });

    // Close on outside click / ESC
    document.addEventListener("click", (e) => {
      if(!root.contains(e.target)){
        menu.classList.add("hidden");
        btn.setAttribute("aria-expanded","false");
      }
    }, true);

    document.addEventListener("keydown", (e) => {
      if(e.key === "Escape"){
        menu.classList.add("hidden");
        btn.setAttribute("aria-expanded","false");
      }
    });
  }
}

async function getScopeSettings(){
  if(!settingsAll){
    const res = await jget("/api/settings?scope=all");
    settingsAll = res.settings;
  }

  if(!scopeGroup){
    return settingsAll;
  }

  if(!(scopeGroup in settingsGroup)){
    const res = await jget(`/api/settings?scope=${encodeURIComponent(scopeGroup)}`);
    settingsGroup[scopeGroup] = res.settings || {};
  }

  return { ...settingsAll, ...settingsGroup[scopeGroup] };
}

function labelFor(card, settings){
  const showGroup = settings.show_group_label !== false;
  const showSub  = settings.show_subgroup_label !== false;

  const g = (card.group || "").trim();
  const sg = (card.subgroup || "").trim();

  const parts = [];
  if(showGroup && g) parts.push(g);
  if(showSub && sg) parts.push(sg);

  return parts.join(" • ");
}


function getStudyRandomizeFlag(settings){
  const base = (settings && typeof settings.randomize === "boolean") ? settings.randomize : false;
  const link = (settings && settings.link_randomize_study_tabs !== false);
  // Per-tab flags live in All-Groups scope (global)
  if(activeTab === "active"){
    return (settings && typeof settings.randomize_unlearned === "boolean") ? settings.randomize_unlearned : base;
  }
  if(activeTab === "unsure"){
    return (settings && typeof settings.randomize_unsure === "boolean") ? settings.randomize_unsure : base;
  }
  if(activeTab === "learned" && learnedViewMode === "study"){
    return (settings && typeof settings.randomize_learned_study === "boolean") ? settings.randomize_learned_study : base;
  }
  if(activeTab === "custom"){
    return (settings && typeof settings.randomize_custom_set === "boolean") ? settings.randomize_custom_set : base;
  }
  return base;
}

async function setStudyRandomizeFlag(value){
  const settings = await getScopeSettings();
  const link = (settings && settings.link_randomize_study_tabs !== false);
  const patch = {};
  if(activeTab === "custom"){
    // Custom set has its own flag, not linked
    patch.randomize_custom_set = !!value;
  } else if(link){
    patch.randomize_unlearned = !!value;
    patch.randomize_unsure = !!value;
    patch.randomize_learned_study = !!value;
  } else {
    if(activeTab === "active") patch.randomize_unlearned = !!value;
    else if(activeTab === "unsure") patch.randomize_unsure = !!value;
    else if(activeTab === "learned" && learnedViewMode === "study") patch.randomize_learned_study = !!value;
  }
  await jpost("/api/settings", {scope:"all", settings: patch});
  // refresh settings cache
  settingsAll = null;
}


function updateRandomStudyUI(){
  try{
    const chk = $("randomStudyChk");
    const btn = $("randomRefreshBtn");
    if(!chk || !btn) return;
    const on = !!chk.checked;
    btn.style.display = on ? "inline-flex" : "none";
  } catch(e){}
}

let breakdownCurrentCard = null;
let breakdownCurrentData = null;

// Cache for inline breakdown lookups (used to show breakdown on study card definition side)
const breakdownInlineCache = Object.create(null); // id -> breakdown or null
const breakdownInlinePending = Object.create(null); // id -> Promise
let breakdownInlineRenderToken = 0;

function breakdownHasContent(b){
  if(!b) return false;
  const parts = Array.isArray(b.parts) ? b.parts : [];
  const anyParts = parts.some(p => p && ((p.part||"").trim() || (p.meaning||"").trim()));
  const lit = (b.literal || "").trim();
  return anyParts || !!lit;
}

async function getBreakdownInline(cardId){
  if(!cardId) return null;
  if(Object.prototype.hasOwnProperty.call(breakdownInlineCache, cardId)) return breakdownInlineCache[cardId];
  if(breakdownInlinePending[cardId]) return breakdownInlinePending[cardId];

  breakdownInlinePending[cardId] = (async ()=>{
    try{
      const res = await jget(`/api/breakdown?id=${encodeURIComponent(cardId)}`);
      const b = res && res.breakdown ? res.breakdown : null;
      breakdownInlineCache[cardId] = b;
      return b;
    } catch(e){
      breakdownInlineCache[cardId] = null;
      return null;
    } finally {
      delete breakdownInlinePending[cardId];
    }
  })();

  return breakdownInlinePending[cardId];
}

function renderBreakdownInlineHTML(b){
  if(!breakdownHasContent(b)) return "";
  const parts = Array.isArray(b.parts) ? b.parts : [];
  const cleanParts = parts
    .filter(p => p && ((p.part||"").trim() || (p.meaning||"").trim()))
    .map(p => ({part:(p.part||"").trim(), meaning:(p.meaning||"").trim()}));

  const pieces = [];
  if(cleanParts.length){
    const spans = cleanParts.map(p => {
      const left = escapeHtml(p.part || "");
      const right = escapeHtml(p.meaning || "");
      if(left && right) return `<span><b>${left}</b> = ${right}</span>`;
      if(left) return `<span><b>${left}</b></span>`;
      return `<span>${right}</span>`;
    });
    pieces.push(
      `<div class="label">Term breakdown</div>` +
      `<div class="value parts">${spans.join('<span class="sep">•</span>')}</div>`
    );
  }
  const lit = (b.literal || "").trim();
  if(lit){
    pieces.push(
      `<div class="label">Literal meaning</div>` +
      `<div class="value">${escapeHtml(lit)}</div>`
    );
  }
  return pieces.join("");
}

async function updateStudyDefinitionExtras(card, settings){
  const front = $("frontExtras");
  const back = $("backExtras");
  if(!front || !back) return;

  // Clear by default
  front.innerHTML = "";
  back.innerHTML = "";
  front.classList.add("hidden");
  back.classList.add("hidden");

  if(!card || !settings) return;

  // Show breakdown by default unless the "Remove breakdown" toggle is enabled for this Study tab
  const isLearnedStudy = (activeTab === "learned" && learnedViewMode === "study");
  const tabKey = (activeTab === "active") ? "unlearned"
    : (activeTab === "unsure") ? "unsure"
    : (isLearnedStudy ? "learned_study" : "");
  if(!tabKey) return;

  const applyAll = !!settings.breakdown_apply_all_tabs;
  let remove = false;
  if(applyAll){
    remove = !!settings.breakdown_remove_all_tabs;
  } else {
    if(tabKey === "unlearned") remove = !!settings.breakdown_remove_unlearned;
    else if(tabKey === "unsure") remove = !!settings.breakdown_remove_unsure;
    else if(tabKey === "learned_study") remove = !!settings.breakdown_remove_learned_study;
  }

  if(remove) return;

  const token = ++breakdownInlineRenderToken;
  const b = await getBreakdownInline(card.id);
  if(token !== breakdownInlineRenderToken) return; // stale
  if(!breakdownHasContent(b)) return;

  const html = renderBreakdownInlineHTML(b);
  if(!html) return;

  const reversed = !!settings.reverse_faces;
  // Definition side is back when NOT reversed, front when reversed
  const target = reversed ? front : back;
  target.innerHTML = html;
  target.classList.remove("hidden");
}



function renderBreakdownParts(parts){
  const wrap = $("breakdownParts");
  wrap.innerHTML = "";
  const arr = Array.isArray(parts) ? parts : [];
  if(!arr.length){
    const empty = document.createElement("div");
    empty.className = "mini muted";
    empty.textContent = "No parts yet. Click “+ Add part” or Auto-fill.";
    wrap.appendChild(empty);
  }
  for(let i=0;i<arr.length;i++){
    const row = document.createElement("div");
    row.className = "breakdownRow";

    const part = document.createElement("input");
    part.className = "input";
    part.placeholder = "Part (e.g., Tae)";
    part.value = arr[i].part || "";
    part.setAttribute("data-idx", String(i));
    part.setAttribute("data-field", "part");

    const meaning = document.createElement("input");
    meaning.className = "input";
    meaning.placeholder = "Meaning (e.g., Foot)";
    meaning.value = arr[i].meaning || "";
    meaning.setAttribute("data-idx", String(i));
    meaning.setAttribute("data-field", "meaning");

    const del = document.createElement("button");
    del.className = "secondary tinyBtn";
    del.textContent = "✕";
    del.title = "Remove part";
    del.addEventListener("click", ()=>{
      breakdownCurrentData.parts.splice(i,1);
      renderBreakdownParts(breakdownCurrentData.parts);
    });

    row.appendChild(part);
    row.appendChild(meaning);
    row.appendChild(del);
    wrap.appendChild(row);
  }
}

async function openBreakdown(card){
  if(!card) return;
  breakdownCurrentCard = card;

  const res = await jget(`/api/breakdown?id=${encodeURIComponent(card.id)}`);
  const existing = res.breakdown || null;

  breakdownCurrentData = {
    id: card.id,
    term: card.term || "",
    parts: (existing && Array.isArray(existing.parts)) ? existing.parts.map(p=>({part:p.part||"", meaning:p.meaning||""})) : [],
    literal: (existing && existing.literal) ? existing.literal : "",
    notes: (existing && existing.notes) ? existing.notes : "",
    updated_at: (existing && existing.updated_at) ? existing.updated_at : null,
    updated_by: (existing && existing.updated_by) ? existing.updated_by : null
  };

  $("breakdownTitle").textContent = `Breakdown: ${card.term || ""}`;
  $("breakdownLiteral").value = breakdownCurrentData.literal || "";
  $("breakdownNotes").value = breakdownCurrentData.notes || "";

  const meta = $("breakdownMeta");
  if(breakdownCurrentData.updated_at){
    const d = new Date(breakdownCurrentData.updated_at*1000);
    meta.textContent = `Last saved: ${d.toLocaleString()}${breakdownCurrentData.updated_by ? " • " + breakdownCurrentData.updated_by : ""}`;
  } else {
    meta.textContent = "Not saved yet.";
  }

  // Only admin (sidscri) can overwrite an existing saved breakdown
  const saveBtn = $("breakdownSaveBtn");
  if(saveBtn){
    const readOnly = !!existing && !isAdminUser();
    saveBtn.disabled = readOnly;
    saveBtn.classList.toggle("disabled", readOnly);
    if(readOnly){
      meta.textContent = (meta.textContent ? meta.textContent + " • " : "") + "Read-only (admin only)";
    }
  }

  renderBreakdownParts(breakdownCurrentData.parts);

  // Update the Auto-fill button label based on AI availability
  const autoBtn = $("breakdownAutoBtn");
  if(autoBtn){
    const hasAI = !!(aiStatus && (aiStatus.openai_available || aiStatus.gemini_available));
    if(hasAI){
      autoBtn.textContent = "Auto-fill (AI)";
      const prov = (aiStatus.selected_provider || "auto").toLowerCase();
      const bits = [];
      if(aiStatus.openai_available) bits.push(`OpenAI: ${aiStatus.openai_model || "available"}`);
      if(aiStatus.gemini_available) bits.push(`Gemini: ${aiStatus.gemini_model || "available"}`);
      autoBtn.title = `AI provider: ${prov}. ${bits.join(" • ")}`;
    } else {
      autoBtn.textContent = "Auto-fill";
      autoBtn.title = "Uses built-in suggestions unless AI is configured";
    }
  }

  $("breakdownOverlay").classList.remove("hidden");
}

function closeBreakdown(){
  $("breakdownOverlay").classList.add("hidden");
  breakdownCurrentCard = null;
  breakdownCurrentData = null;
}

async function loadBreakdownsList(){
  const q = ($("breakdownsSearch").value || "").trim();
  const qParam = q ? `?q=${encodeURIComponent(q)}` : "";
  const res = await jget(`/api/breakdowns${qParam}`);
  const items = (res.items || []);
  const list = $("breakdownsList");
  list.innerHTML = "";
  if(!items.length){
    const empty = document.createElement("div");
    empty.className = "mini muted";
    empty.textContent = "No saved breakdowns yet.";
    list.appendChild(empty);
    return;
  }
  for(const it of items){
    const row = document.createElement("div");
    row.className = "breakdownListItem";
    const title = document.createElement("div");
    title.className = "bTitle";
    title.textContent = it.term || "(unknown)";
    const sub = document.createElement("div");
    sub.className = "mini muted";
    const parts = (it.parts||[]).filter(p=>p && (p.part||p.meaning)).map(p=>`${p.part}${p.meaning ? " = " + p.meaning : ""}`).join(" • ");
    sub.textContent = (it.literal ? it.literal : parts);
    row.appendChild(title);
    row.appendChild(sub);
    row.addEventListener("click", async ()=>{
      // Need the card to open by id; fall back to a minimal object
      await openBreakdown({id: it.id, term: it.term});
    });
    list.appendChild(row);
  }
}


function buildDeck(cards, settings){
  // All Cards (across groups)
  if(allCardsMode){
    if(settings.all_mode === "flat"){
      const d = cards.slice();
      if(settings.randomize) shuffle(d);
      else if(settings.card_order === "alpha"){
        d.sort((a,b)=> (a.term||"").localeCompare(b.term||""));
      }
      return d;
    }

    // grouped
    const byGroup = new Map();
    for(const c of cards){
      const g = c.group || "General";
      if(!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g).push(c);
    }

    let groupList = Array.from(byGroup.keys());
    if(settings.group_order === "alpha"){
      groupList.sort((a,b)=> a.localeCompare(b));
    }

    const out = [];
    for(const g of groupList){
      const arr = byGroup.get(g);
      if(settings.randomize){
        shuffle(arr);
      } else if(settings.card_order === "alpha"){
        arr.sort((a,b)=> (a.term||"").localeCompare(b.term||""));
      }
      out.push(...arr);
    }
    return out;
  }

  // Studying a specific group
  const d = cards.slice();
  if(settings.randomize) shuffle(d);
  else if(settings.card_order === "alpha"){
    d.sort((a,b)=> (a.term||"").localeCompare(b.term||""));
  }
  return d;
}

function renderStudyCard(){
  $("card").classList.remove("flipped");

  if(!deck.length){
    $("pillLabel").textContent = scopeGroup ? scopeGroup : "All Cards";
    $("frontText").textContent = "No cards left 🎉";
    $("frontSub").textContent = "";
    $("backText").textContent = "Everything here has been moved out of this list.";
    $("backSub").textContent = "";
    $("cardPos").textContent = "Card 0 / 0";
    // Clear any inline breakdown extras
    updateStudyDefinitionExtras(null, window.__activeSettings || settingsAll || {});
    resizeCard();
    return;
  }

  const c = deck[deckIndex];
  const settings = window.__activeSettings || settingsAll || {};

  const label = labelFor(c, settings);
  $("pillLabel").textContent = label;
  $("pillLabel").style.visibility = label ? "visible" : "hidden";

  const reversed = !!settings.reverse_faces;

  const frontMain = reversed ? c.meaning : c.term;
  const backMain  = reversed ? c.term : c.meaning;

  const pron = (c.pron || "").trim();

  // keep pron optional; hide if empty
  $("frontSub").textContent = (!reversed && pron) ? `Pron: ${pron}` : "";
  $("backSub").textContent  = (reversed && pron) ? `Pron: ${pron}` : "";

  $("frontText").textContent = frontMain || "";
  $("backText").textContent = backMain || "";

  $("cardPos").textContent = `Card ${deckIndex+1} / ${deck.length}`;

  // Update star button
  updateStudyStarButton(c);
  
  // Update breakdown indicator (puzzle icon)
  updateBreakdownIndicator(c);

  // Optional: show saved breakdown + literal meaning on the definition side
  updateStudyDefinitionExtras(c, settings);
  
  // Auto-size card to fit content
  resizeCard();
}

// Update breakdown indicator icon
function updateBreakdownIndicator(card){
  const indicator = $("breakdownBtn");
  if(!indicator) return;
  
  const hasBreakdown = card && cardHasBreakdown(card.id);
  indicator.classList.toggle("has-breakdown", hasBreakdown);
  indicator.title = hasBreakdown ? "Has breakdown data - click to view" : "No breakdown data";
}

function cleanPronunciationForSpeech(text){
  if(!text) return text;
  
  let cleaned = text;
  
  // Remove ALL hyphens - replace with spaces
  cleaned = cleaned.replace(/-/g, ' ');
  
  // Remove ALL periods - they cause TTS to spell things out
  cleaned = cleaned.replace(/\./g, '');
  
  // Handle apostrophes that might cause issues
  cleaned = cleaned.replace(/'/g, '');
  
  // Replace problematic phonetic patterns with real words or better phonetics
  // These are specific fixes for syllables that TTS spells out
  const specificFixes = {
    // Double vowels at end that get spelled out - use real word sounds
    '\\boo kee may\\b': 'oo kee may',
    '\\boo kay\\b': 'oo kay', 
    '\\bah ee\\b': 'eye',
    '\\bkee ah ee\\b': 'kee eye',
    '\\bah ee kee doh\\b': 'eye kee doe',
    '\\btah ee kwon doh\\b': 'tie kwon doe',
    '\\bsah ee\\b': 'sigh',
    '\\bkw oon\\b': 'kwoon',
    '\\bsh in\\b': 'shin',
    // More general patterns
    '\\bsoh keh\\b': 'so kay',
    '\\broh shee\\b': 'roe shee'
  };
  
  for(const [pattern, replacement] of Object.entries(specificFixes)){
    const regex = new RegExp(pattern, 'gi');
    cleaned = cleaned.replace(regex, replacement);
  }
  
  // Handle remaining double vowels that might get spelled out
  // Replace with phonetic equivalents using real word sounds
  const doubleVowelFixes = {
    '\\boo\\b': 'oo',      // Beginning is usually ok
    '\\bee\\b': 'ee',      // Beginning is usually ok  
    '\\bah ee\\b': 'eye',  // "ah ee" sounds like "eye"
    '\\beh ee\\b': 'ay',   // "eh ee" sounds like "ay"
    '\\boh ee\\b': 'oy',   // "oh ee" sounds like "oy"
  };
  
  for(const [pattern, replacement] of Object.entries(doubleVowelFixes)){
    const regex = new RegExp(pattern, 'gi');
    cleaned = cleaned.replace(regex, replacement);
  }
  
  // Expand standalone two-letter syllables that TTS spells out
  const twoLetterExpansions = {
    '\\bkoh\\b': 'koe',
    '\\bkeh\\b': 'kay',
    '\\bsoh\\b': 'so',
    '\\btoh\\b': 'toe',
    '\\bnoh\\b': 'no',
    '\\bmoh\\b': 'moe',
    '\\broh\\b': 'roe',
    '\\bgoh\\b': 'go',
    '\\bboh\\b': 'bow',
    '\\bdoh\\b': 'doe',
    '\\bhoh\\b': 'hoe',
    '\\bjoh\\b': 'joe',
    '\\bloh\\b': 'low',
    '\\bpoh\\b': 'poe',
    '\\bwoh\\b': 'woe',
    '\\byoh\\b': 'yo',
    '\\bah\\b': 'ah',
    '\\boh\\b': 'oh',
    '\\buh\\b': 'uh',
    '\\beh\\b': 'eh',
    '\\bsh\\b': 'sh'
  };
  
  for(const [pattern, replacement] of Object.entries(twoLetterExpansions)){
    const regex = new RegExp(pattern, 'gi');
    cleaned = cleaned.replace(regex, replacement);
  }
  
  // Clean up multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

function speakCurrent(){
  if(!deck.length) return;
  const c = deck[deckIndex];
  const settings = window.__activeSettings || settingsAll || {};
  const reversed = !!settings.reverse_faces;

  // Determine what to say based on which face is showing
  let say;
  if(isFlipped()){
    // Back face showing
    say = reversed ? c.term : c.meaning;
  } else {
    // Front face showing - use pronunciation if available for the term
    if(reversed){
      // Front shows meaning when reversed
      say = c.meaning;
    } else {
      // Front shows term - prefer pronunciation
      say = c.pron ? cleanPronunciationForSpeech(c.pron) : c.term;
    }
  }

  if(!say) return;

  if(!("speechSynthesis" in window)){
    setStatus("Speech not supported in this browser.");
    return;
  }

  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(say);
  
  // Apply voice settings
  const rate = settings.speech_rate || 1.0;
  const voiceName = settings.speech_voice || "";
  
  u.rate = rate;
  
  if(voiceName){
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.name === voiceName);
    if(voice) u.voice = voice;
  }
  
  window.speechSynthesis.speak(u);
}

function speakCard(card){
  if(!card) return;
  
  const settings = window.__activeSettings || settingsAll || {};
  
  // Use pronunciation if speak_pronunciation_only is enabled and pron exists, otherwise use term
  let say;
  if(settings.speak_pronunciation_only && card.pron){
    say = cleanPronunciationForSpeech(card.pron);
  } else {
    say = card.pron ? cleanPronunciationForSpeech(card.pron) : card.term;
  }

  if(!say) return;

  if(!("speechSynthesis" in window)){
    setStatus("Speech not supported in this browser.");
    return;
  }

  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(say);
  
  // Apply voice settings
  const rate = settings.speech_rate || 1.0;
  const voiceName = settings.speech_voice || "";
  
  u.rate = rate;
  
  if(voiceName){
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.name === voiceName);
    if(voice) u.voice = voice;
  }
  
  window.speechSynthesis.speak(u);
}

async function loadDeckForStudy(){
  const settings = await getScopeSettings();
  window.__activeSettings = settings;

  const q = ($("searchBox").value || "").trim();
  const groupParam = scopeGroup ? `&group=${encodeURIComponent(scopeGroup)}` : "";
  const statusParam = `status=${encodeURIComponent(activeTab)}`;
  const qParam = q ? `&q=${encodeURIComponent(q)}` : "";
  const deckParam = activeDeckId ? `&deck_id=${encodeURIComponent(activeDeckId)}` : "";

  const cards = await jget(`/api/cards?${statusParam}${groupParam}${qParam}${deckParam}`);
  const deckSettings = Object.assign({}, settings);
  deckSettings.randomize = getStudyRandomizeFlag(settings);
  deck = buildDeck(cards, deckSettings);
  deckIndex = 0;

  updateRandomStudyUI();
  renderStudyCard();
}

// Custom Set deck loading
let customSetData = null;

let customRandomLimit = 0; // 0 means no limit

async function loadCustomSetForStudy(){
  const settings = await getScopeSettings();
  window.__activeSettings = settings;

  const q = ($("searchBox").value || "").trim();
  
  try {
    const res = await jget(customSetApiUrl());
    customSetData = res;
    
    let cards = res.cards || [];
    
    // Filter by custom view mode
    if(customViewMode === "unlearned"){
      cards = cards.filter(c => c.custom_status === "active");
    } else if(customViewMode === "unsure"){
      cards = cards.filter(c => c.custom_status === "unsure");
    } else if(customViewMode === "learned"){
      cards = cards.filter(c => c.custom_status === "learned");
    } else {
      // "all" - include all custom-set statuses
      // (no status filter)
    }
    
    // Apply search filter
    if(q){
      const ql = q.toLowerCase();
      cards = cards.filter(c => {
        const hay = `${c.term || ""} ${c.meaning || ""} ${c.pron || ""}`.toLowerCase();
        return hay.includes(ql);
      });
    }
    
    // Apply randomization if enabled or if random limit is set
    if(settings.randomize_custom_set || customRandomLimit > 0){
      shuffle(cards);
    }
    
    // Apply random limit if set
    if(customRandomLimit > 0 && cards.length > customRandomLimit){
      cards = cards.slice(0, customRandomLimit);
    }
    
    deck = cards;
    deckIndex = 0;
    
    updateRandomStudyUI();
    renderStudyCard();
    
    // Update counts display for custom set
    if(customSetData){
      const counts = customSetData.counts || {};
      // Show custom set's own Unlearned/Unsure/Learned in the counts bar
      $("countsLine").textContent = `Unlearned: ${counts.active || 0} | Unsure: ${counts.unsure || 0} | Learned: ${counts.learned || 0}`;
      let statusMsg = `Custom Set: ${counts.total || 0} cards`;
      if(customRandomLimit > 0){
        statusMsg = `🎲 Random ${Math.min(customRandomLimit, deck.length)} of ${counts.total || 0} cards`;
      }
      // Status line is set by refresh() to keep labels consistent.
    }
  } catch(e){
    console.error("Failed to load custom set:", e);
    deck = [];
    deckIndex = 0;
    renderStudyCard();
  }
}

async function toggleCustomSet(cardId){
  try {
    const res = await jpost("/api/custom_set/toggle", customSetBody({ id: cardId  }));
    return res.in_custom_set;
  } catch(e){
    console.error("Failed to toggle custom set:", e);
    return null;
  }
}

async function setCustomSetStatus(cardId, status){
  try {
    await jpost("/api/custom_set/set_status", customSetBody({ id: cardId, status: status  }));
    await refresh();
  } catch(e){
    console.error("Failed to set custom set status:", e);
  }
}

async function setCurrentStatus(status){
  if(!deck.length) return;
  const c = deck[deckIndex];
  
  // For custom set, use custom set status API
  if(activeTab === "custom"){
  await jpost("/api/custom_set/set_status", customSetBody({ id: c.id, status }));
  // ✅ refresh cached counts immediately
  try { customSetData = await jget(customSetApiUrl() + "&_t=" + Date.now()); } catch(e){}
} else {
  await jpost("/api/set_status", { id: c.id, status });
}

  deck.splice(deckIndex, 1);
  if(deckIndex >= deck.length) deckIndex = 0;

  await refreshCounts();
  renderStudyCard();
}

function nextCard(){
  if(!deck.length) return;
  deckIndex = (deckIndex + 1) % deck.length;
  renderStudyCard();
  
  // Auto-speak on card change
  const settings = window.__activeSettings || settingsAll || {};
  if(settings.auto_speak_on_card_change && deck.length){
    setTimeout(() => speakCard(deck[deckIndex]), 100);
  }
}
function prevCard(){
  if(!deck.length) return;
  deckIndex = (deckIndex - 1 + deck.length) % deck.length;
  renderStudyCard();
  
  // Auto-speak on card change
  const settings = window.__activeSettings || settingsAll || {};
  if(settings.auto_speak_on_card_change && deck.length){
    setTimeout(() => speakCard(deck[deckIndex]), 100);
  }
}

async function loadList(status){
  // List settings (definitions shown/hidden)
  const settings = await getScopeSettings();
  const showDefsAll = (settings.show_definitions_all_list !== false);
  const showDefsLearned = (settings.show_definitions_learned_list !== false);
  const showAllUUButtons = (settings.all_list_show_unlearned_unsure_buttons !== false);
  // Learned list-only settings
  const showLearnedMoveButtons = (settings.learned_list_show_relearn_unsure_buttons !== false);
  const showLearnedGroupLabel  = (settings.learned_list_show_group_label !== false);

  const q = ($("searchBox").value || "").trim();
  const groupParam = scopeGroup ? `&group=${encodeURIComponent(scopeGroup)}` : "";
  const qParam = q ? `&q=${encodeURIComponent(q)}` : "";
  const deckParam = activeDeckId ? `&deck_id=${encodeURIComponent(activeDeckId)}` : "";
  let cards = await jget(`/api/cards?status=${encodeURIComponent(status)}${groupParam}${qParam}${deckParam}`);

  const titleMap = {learned:"Learned", deleted:"Deleted", all:"All"};
  $("listTitle").textContent = titleMap[status] || "List";

  // Show/hide sort dropdown for All list
  const sortField = $("sortByStatusField");
  if(sortField){
    sortField.style.display = (status === "all") ? "flex" : "none";
  }

  // Apply sorting for All list
  if(status === "all"){
    const sortBy = $("sortByStatus") ? $("sortByStatus").value : "";
    if(sortBy === "unlearned"){
      cards.sort((a,b) => {
        const order = {active: 0, unsure: 1, learned: 2};
        return (order[a.status] || 3) - (order[b.status] || 3);
      });
    } else if(sortBy === "unsure"){
      cards.sort((a,b) => {
        const order = {unsure: 0, active: 1, learned: 2};
        return (order[a.status] || 3) - (order[b.status] || 3);
      });
    } else if(sortBy === "learned"){
      cards.sort((a,b) => {
        const order = {learned: 0, unsure: 1, active: 2};
        return (order[a.status] || 3) - (order[b.status] || 3);
      });
    } else if(sortBy === "alpha"){
      cards.sort((a,b) => (a.term || "").localeCompare(b.term || ""));
    }
  }

  const bulk = $("bulkBtns");
  bulk.innerHTML = "";

  bulk.style.display = "none"; // bulk actions disabled
  const mkBtn = (txt, cls, onClick) => {
    const b = document.createElement("button");
    b.textContent = txt;
    b.className = cls;
    b.addEventListener("click", onClick);
    return b;
  };

  const selectedIds = () => Array.from(document.querySelectorAll("input[data-id]:checked")).map(x => x.getAttribute("data-id"));

  if(status === "deleted"){
    bulk.appendChild(mkBtn("Restore to Active", "secondary", async ()=>{
      const ids = selectedIds(); if(!ids.length) return;
      await jpost("/api/bulk_set_status", {ids, status:"active"});
      await refresh();
    }));
    bulk.appendChild(mkBtn("Restore to Unsure", "secondary", async ()=>{
      const ids = selectedIds(); if(!ids.length) return;
      await jpost("/api/bulk_set_status", {ids, status:"unsure"});
      await refresh();
    }));
  }

  const list = $("list");
  list.innerHTML = "";

  if(!cards.length){
    list.textContent = "No cards found in this list.";
    return;
  }

  for(const c of cards){
    const row = document.createElement("div");
    row.className = "item";


    const left = document.createElement("div");
    left.className = "itemLeft";

    let chk = null;


    // No selection checkboxes (per-card move buttons are used instead)
    chk = null;

    const text = document.createElement("div");
    const lbl = (c.group || "").trim();
    const sName = (c.status || "").toString();
    let sLabel = sName ? (sName.charAt(0).toUpperCase() + sName.slice(1)) : "";
    if(status === "all" && sName === "active") sLabel = "Unlearned";
    const showMeaning = (status === "all") ? showDefsAll : (status === "learned") ? showDefsLearned : true;

    const lines = [];
    if(showMeaning) lines.push(`<span class="defText">${escapeHtml(c.meaning)}</span>`);
    if(c.pron) lines.push(`Pron: ${escapeHtml(c.pron)}`);
    if(lbl && !(status === "learned" && !showLearnedGroupLabel)) lines.push(`${escapeHtml(lbl)}`);
    if(status === "all" && sLabel) lines.push(`Status: ${escapeHtml(sLabel)}`);

    text.innerHTML = `<b>${escapeHtml(c.term)}</b>${lines.length ? `<small>${lines.join("<br/>")}</small>` : ""}`;

if(chk) left.appendChild(chk);
    left.appendChild(text);

    const right = document.createElement("div");
    right.className = "itemRight";


    // Actions for the All list: quick-move cards between statuses
    if(status === "all"){
      right.classList.add("itemActions");
      const cur = (c.status || "active").toString();
      const addMove = (label, to, cls) => {
        if(cur === to) return;
        const b = document.createElement("button");
        b.className = "mini " + cls;
        b.textContent = label;
        b.addEventListener("click", async ()=>{
          await jpost("/api/set_status", {id:c.id, status:to});
          await refresh();
        });
        right.appendChild(b);
      };
      if(showAllUUButtons){
        addMove("Unlearned", "active", "neutral");
        addMove("Unsure", "unsure", "warn");
      }
      addMove("Learned", "learned", "good");
    }
    if(status === "all"){
      const speakBtn = document.createElement("button");
      speakBtn.className = "good"; speakBtn.textContent = "🔊 Speak";
      speakBtn.addEventListener("click", ()=>{ speakCard(c); });
      right.appendChild(speakBtn);

      // Star button for Custom Set
      const starBtn = document.createElement("button");
      starBtn.className = c.in_custom_set ? "itemStar starred" : "itemStar"; 
      starBtn.textContent = c.in_custom_set ? "★" : "☆"; 
      starBtn.title = c.in_custom_set ? "Remove from Custom Set" : "Add to Custom Set"; 
      starBtn.setAttribute("aria-label", starBtn.title);
      starBtn.addEventListener("click", async ()=>{ 
        const inSet = await toggleCustomSet(c.id);
        if(inSet !== null){
          c.in_custom_set = inSet;
          starBtn.textContent = inSet ? "★" : "☆";
          starBtn.className = inSet ? "itemStar starred" : "itemStar";
          starBtn.title = inSet ? "Remove from Custom Set" : "Add to Custom Set";
          setStatus(inSet ? "Added to Custom Set" : "Removed from Custom Set");
        }
      });
      right.appendChild(starBtn);

      const brBtn = document.createElement("button");
      brBtn.className = "secondary iconOnly"; brBtn.textContent = "🧩"; brBtn.title = "Breakdown"; brBtn.setAttribute("aria-label","Breakdown");
      brBtn.addEventListener("click", ()=>{ openBreakdown(c); });
      right.appendChild(brBtn);
    }

    if(status === "learned"){
      // Match the "All" list layout: compact buttons on the right (no arrow labels)
      const addMove = (label, to, cls) => {
        const b = document.createElement("button");
        b.className = cls;
        b.textContent = label;
        b.addEventListener("click", async ()=>{
          await jpost("/api/set_status", {id:c.id, status:to});
          await refresh();
        });
        right.appendChild(b);
      };

      // Learned cards can be moved back to Unlearned (active) or Unsure
      // Rename buttons for the Learned page only
      if(showLearnedMoveButtons){
        addMove("Relearn", "active", "neutral");
        addMove("Still Unsure", "unsure", "warn");
      }

      const speakBtn = document.createElement("button");
      speakBtn.className = "good"; speakBtn.textContent = "🔊 Speak";
      speakBtn.addEventListener("click", ()=>{ speakCard(c); });
      right.appendChild(speakBtn);

      const brBtn = document.createElement("button");
      brBtn.className = "secondary iconOnly"; brBtn.textContent = "🧩"; brBtn.title = "Breakdown"; brBtn.setAttribute("aria-label","Breakdown");
      brBtn.addEventListener("click", ()=>{ openBreakdown(c); });
      right.appendChild(brBtn);
    }

    if(status === "deleted"){
      const b1 = document.createElement("button");
      b1.className = "secondary"; b1.textContent = "Restore";
      b1.addEventListener("click", async ()=>{ await jpost("/api/set_status", {id:c.id, status:"active"}); await refresh(); });
      right.appendChild(b1);
    }

    row.appendChild(left);
    row.appendChild(right);
    list.appendChild(row);
  }
}

async function refresh(){
  updateFilterHighlight();
  updateLearnedViewHighlight();
  updateCustomViewHighlight();

  if(!currentUser){
    const ok = await ensureLoggedIn();
    if(!ok) return;
  }

  // If settings panel is open, only refresh the header counts (don't swap views)
  if(!$("viewSettings").classList.contains("hidden")){
    await refreshCounts();
    return;
  }

  const isStudyMode = (
    activeTab === "active" ||
    activeTab === "unsure" ||
    activeTab === "custom" ||
    (activeTab === "learned" && learnedViewMode === "study")
  );

  const rWrap = $("randomStudyWrap");
  if(rWrap){
    rWrap.classList.toggle("hidden", !isStudyMode);
  }

  if(isStudyMode){
    $("viewStudy").classList.remove("hidden");
    $("viewList").classList.add("hidden");

    if(activeTab === "custom"){
      // IMPORTANT: Do NOT run refreshCounts() in parallel with custom set load.
      // refreshCounts() pulls /api/counts for the whole deck and can overwrite the custom-set counts bar.
      await loadCustomSetForStudy();

      // Ensure header card count reflects current custom set size
      updateHeaderCardCount(Array.isArray(deck) ? deck.length : 0);

      // Ensure the status line reflects Custom Set mode
      const cvmLabel = (customViewMode === "unlearned") ? "Unlearned"
                    : (customViewMode === "unsure") ? "Unsure"
                    : (customViewMode === "learned") ? "Learned"
                    : "All";
      const prefix = (customRandomLimit > 0) ? "🎲 " : "";
      setStatus(`${prefix}Custom Set • Studying: ${cvmLabel}`);
      return;
    }

    // Non-custom study: load counts and deck cards in parallel for speed
    const deckPromise = loadDeckForStudy();
    await Promise.all([ refreshCounts(), deckPromise ]);

    const s = window.__activeSettings || settingsAll || {};
    const allLabel = (s.all_mode === "flat") ? "All (flat)" : "All (grouped)";
    const studyLabel = (activeTab === "active") ? "Unlearned"
                     : (activeTab === "unsure") ? "Unsure"
                     : (activeTab === "learned") ? "Learned"
                     : (activeTab || "");
    setStatus(`${(scopeGroup || (allCardsMode ? allLabel : ""))} • Studying: ${studyLabel}`);
    return;
  }

  // List mode
  $("viewStudy").classList.add("hidden");
  $("viewList").classList.remove("hidden");

  // Load counts and list in parallel
  await Promise.all([ refreshCounts(), loadList(activeTab) ]);
  setStatus(`${(scopeGroup||"All")} • Viewing: ${activeTab}`);
}

async function openSettings(){
  // Toggle behavior - if settings already open, close it
  if(!$("viewSettings").classList.contains("hidden")){
    if(settingsDirty){
      if(!confirm("You have unsaved changes. Close without saving?")){
        return;
      }
    }
    settingsDirty = false;
    $("viewSettings").classList.add("hidden");
    if(activeTab === "active" || activeTab === "unsure" || (activeTab === "learned" && learnedViewMode === "study")){
      $("viewStudy").classList.remove("hidden");
    } else {
      $("viewList").classList.remove("hidden");
    }
    await refresh();
    return;
  }
  
  if(!appInitialized){
    try{ await postLoginInit(); } catch(e){}
  }
  $("viewSettings").classList.remove("hidden");
  $("viewStudy").classList.add("hidden");
  $("viewList").classList.add("hidden");

  $("settingsScope").value = "all";
  try{ aiStatus = await jget("/api/ai"); } catch(e){}
  await loadSettingsForm("all");
  settingsDirty = false; // Reset dirty flag after loading
}

let settingsDirty = false;

// Track settings changes
function markSettingsDirty(){
  settingsDirty = true;
}

async function loadSettingsForm(scope){
  if(!scope) scope = "all";
  const res = await jget(`/api/settings?scope=${encodeURIComponent(scope)}`);
  const s = res.settings || {};

  let effective = s;
  if(scope !== "all"){
    if(!settingsAll){
      const g = await jget("/api/settings?scope=all");
      settingsAll = g.settings;
    }
    effective = { ...settingsAll, ...s };
  }

  $("setRandomize").checked = !!effective.randomize;
  if($("setLinkRandomize")) $("setLinkRandomize").checked = (effective.link_randomize_study_tabs !== false);
  const baseRand = !!effective.randomize;
  if($("setRandomizeUnlearned")) $("setRandomizeUnlearned").checked = (typeof effective.randomize_unlearned === "boolean") ? effective.randomize_unlearned : baseRand;
  if($("setRandomizeUnsure")) $("setRandomizeUnsure").checked = (typeof effective.randomize_unsure === "boolean") ? effective.randomize_unsure : baseRand;
  if($("setRandomizeLearnedStudy")) $("setRandomizeLearnedStudy").checked = (typeof effective.randomize_learned_study === "boolean") ? effective.randomize_learned_study : baseRand;
  if($("setRandomizeCustomSet")) $("setRandomizeCustomSet").checked = (typeof effective.randomize_custom_set === "boolean") ? effective.randomize_custom_set : baseRand;
  if($("setReflectStatusInMain")) $("setReflectStatusInMain").checked = !!effective.reflect_status_in_main;
  
  // Reset dirty flag after loading
  settingsDirty = false;

$("setShowGroup").checked = effective.show_group_label !== false;
  $("setShowSubgroup").checked = effective.show_subgroup_label !== false;
  if($("setShowUiErrorLog")) $("setShowUiErrorLog").checked = !!effective.show_ui_error_log;
  $("setReverseFaces").checked = !!effective.reverse_faces;
  if($("setBreakdownApplyAll")) $("setBreakdownApplyAll").checked = !!effective.breakdown_apply_all_tabs;
  if($("setBreakdownRemoveAll")) $("setBreakdownRemoveAll").checked = !!effective.breakdown_remove_all_tabs;
  if($("setBreakdownRemoveUnlearned")) $("setBreakdownRemoveUnlearned").checked = !!effective.breakdown_remove_unlearned;
  if($("setBreakdownRemoveUnsure")) $("setBreakdownRemoveUnsure").checked = !!effective.breakdown_remove_unsure;
  if($("setBreakdownRemoveLearned")) $("setBreakdownRemoveLearned").checked = !!effective.breakdown_remove_learned_study;
  if(typeof updateBreakdownSettingsUI === "function") updateBreakdownSettingsUI();

  $("setAllMode").value = effective.all_mode || "grouped";
  $("setGroupOrder").value = effective.group_order || "alpha";
  $("setCardOrder").value = effective.card_order || "json";
  
  // Voice settings
  $("setSpeechRate").value = effective.speech_rate || 1.0;
  updateRateLabel(effective.speech_rate || 1.0);
  if($("setSpeakPronunciationOnly")) $("setSpeakPronunciationOnly").checked = !!effective.speak_pronunciation_only;
  
  // Populate voice dropdown and select saved voice
  await populateVoiceDropdown();
  $("setSpeechVoice").value = effective.speech_voice || "";

  updateBreakdownSettingsUI();

  // List-page settings are global (All Groups only)
  const listSection = $("listSettingsSection");
  if(listSection) listSection.style.display = (scope === "all") ? "block" : "none";
  if($("setShowDefAllList")) $("setShowDefAllList").checked = (effective.show_definitions_all_list !== false);
  if($("setShowDefLearnedList")) $("setShowDefLearnedList").checked = (effective.show_definitions_learned_list !== false);
  if($("setAllListShowUnlearnedUnsureBtns")) $("setAllListShowUnlearnedUnsureBtns").checked = (effective.all_list_show_unlearned_unsure_buttons !== false);
  if($("setLearnedListShowMoveBtns")) $("setLearnedListShowMoveBtns").checked = (effective.learned_list_show_relearn_unsure_buttons !== false);
  if($("setLearnedListShowGroupLabel")) $("setLearnedListShowGroupLabel").checked = (effective.learned_list_show_group_label !== false);

  // AI breakdown provider (global)
  const aiSection = $("aiSettingsSection");
  if(aiSection) aiSection.style.display = (scope === "all") ? "block" : "none";
  const provSel = $("setBreakdownProvider");
  if(provSel) provSel.value = (effective.breakdown_ai_provider || "auto");
  const provStatus = $("aiStatusLine");
  if(provStatus){
    const bits = [];
    if(aiStatus && aiStatus.openai_available) bits.push(`OpenAI: ${aiStatus.openai_model || "available"}`);
    if(aiStatus && aiStatus.gemini_available) bits.push(`Gemini: ${aiStatus.gemini_model || "available"}`);
    provStatus.textContent = bits.length ? (`Available: ${bits.join(" • ")}`) : "No AI keys detected (will use built-in suggestions).";
  }
}


function updateBreakdownSettingsUI(){
  const applyAllEl = $("setBreakdownApplyAll");
  const rowAll = $("rowBreakdownRemoveAll");
  const removeAllEl = $("setBreakdownRemoveAll");
  const rowU = $("rowBreakdownRemoveUnlearned");
  const rowS = $("rowBreakdownRemoveUnsure");
  const rowL = $("rowBreakdownRemoveLearned");
  const rmU = $("setBreakdownRemoveUnlearned");
  const rmS = $("setBreakdownRemoveUnsure");
  const rmL = $("setBreakdownRemoveLearned");
  if(!applyAllEl) return;

  const applyAll = !!applyAllEl.checked;

  // "All Study tabs" row is visible but disabled unless Apply-to-all is enabled (Option 2)
  if(rowAll && removeAllEl){
    removeAllEl.disabled = !applyAll;
    rowAll.classList.toggle("disabled", !applyAll);
  }

  // Per-tab toggles grey out when Apply-to-all is enabled
  const lock = applyAll;
  const rows = [
    [rowU, rmU],
    [rowS, rmS],
    [rowL, rmL]
  ];
  for(const [row, el] of rows){
    if(!row || !el) continue;
    el.disabled = lock;
    row.classList.toggle("disabled", lock);
  }
}

async function saveSettings(){
  let scope = $("settingsScope").value;
  if(!scope) scope = "all";

  const patch = {
    randomize: $("setRandomize").checked,
    show_group_label: $("setShowGroup").checked,
    show_subgroup_label: $("setShowSubgroup").checked,
    show_ui_error_log: ($("setShowUiErrorLog") ? $("setShowUiErrorLog").checked : false),
    reverse_faces: $("setReverseFaces").checked,
    show_breakdown_on_definition: $("setShowBreakdownOnDef") ? $("setShowBreakdownOnDef").checked : true,
    breakdown_apply_all_tabs: $("setBreakdownApplyAll") ? $("setBreakdownApplyAll").checked : false,
    breakdown_remove_all_tabs: $("setBreakdownRemoveAll") ? $("setBreakdownRemoveAll").checked : false,
    breakdown_remove_unlearned: $("setBreakdownRemoveUnlearned") ? $("setBreakdownRemoveUnlearned").checked : false,
    breakdown_remove_unsure: $("setBreakdownRemoveUnsure") ? $("setBreakdownRemoveUnsure").checked : false,
    breakdown_remove_learned_study: $("setBreakdownRemoveLearned") ? $("setBreakdownRemoveLearned").checked : false,
    all_mode: $("setAllMode").value,
    group_order: $("setGroupOrder").value,
    card_order: $("setCardOrder").value,
    speech_rate: parseFloat($("setSpeechRate").value) || 1.0,
    speech_voice: $("setSpeechVoice").value || "",
    auto_speak_on_card_change: $("setAutoSpeakOnCardChange") ? $("setAutoSpeakOnCardChange").checked : false,
    speak_definition_on_flip: $("setSpeakDefinitionOnFlip") ? $("setSpeakDefinitionOnFlip").checked : false,
    speak_pronunciation_only: $("setSpeakPronunciationOnly") ? $("setSpeakPronunciationOnly").checked : false
  };

  // Only save tab-specific + list-page settings at the All-Groups scope
  if(scope === "all"){
    patch.link_randomize_study_tabs = $("setLinkRandomize") ? $("setLinkRandomize").checked : true;
    patch.randomize_unlearned = $("setRandomizeUnlearned") ? $("setRandomizeUnlearned").checked : patch.randomize;
    patch.randomize_unsure = $("setRandomizeUnsure") ? $("setRandomizeUnsure").checked : patch.randomize;
    patch.randomize_learned_study = $("setRandomizeLearnedStudy") ? $("setRandomizeLearnedStudy").checked : patch.randomize;
    patch.randomize_custom_set = $("setRandomizeCustomSet") ? $("setRandomizeCustomSet").checked : patch.randomize;
    patch.reflect_status_in_main = $("setReflectStatusInMain") ? $("setReflectStatusInMain").checked : false;

    patch.show_definitions_all_list = $("setShowDefAllList").checked;
    patch.show_definitions_learned_list = $("setShowDefLearnedList").checked;
    patch.all_list_show_unlearned_unsure_buttons = $("setAllListShowUnlearnedUnsureBtns").checked;
    patch.learned_list_show_relearn_unsure_buttons = $("setLearnedListShowMoveBtns").checked;
    patch.learned_list_show_group_label = $("setLearnedListShowGroupLabel").checked;
    if($("setBreakdownProvider")) patch.breakdown_ai_provider = $("setBreakdownProvider").value || "auto";
  }

  await jpost("/api/settings", {scope, settings: patch});

  settingsAll = null;
  settingsGroup = {};
  window.__activeSettings = null;
  settingsDirty = false; // Reset dirty flag after saving

  await refreshCounts();
  await refresh();
}

function getErrorMessage(error){
  const msg = error.message || "";
  if(msg.includes("username_and_password_required")) return "Please enter both username and password.";
  if(msg.includes("username_too_short")) return "Username must be at least 3 characters.";
  if(msg.includes("password_too_short")) return "Password must be at least 4 characters.";
  if(msg.includes("username_taken")) return "That username is already taken.";
  if(msg.includes("invalid_credentials")) return "Invalid username or password.";
  return "An error occurred. Please try again.";
}

function updateRateLabel(value){
  const label = $("rateLabel");
  if(label) label.textContent = `${value}x`;
}

async function populateVoiceDropdown(){
  const sel = $("setSpeechVoice");
  if(!sel) return;
  
  // Force voices to load by calling getVoices
  let voices = window.speechSynthesis.getVoices();
  
  // If voices not loaded yet, wait for them
  if(!voices.length){
    await new Promise(resolve => {
      const checkVoices = () => {
        voices = window.speechSynthesis.getVoices();
        if(voices.length > 0){
          resolve();
        }
      };
      
      // Set up the event listener
      window.speechSynthesis.onvoiceschanged = checkVoices;
      
      // Also poll in case the event doesn't fire (some browsers)
      const interval = setInterval(() => {
        voices = window.speechSynthesis.getVoices();
        if(voices.length > 0){
          clearInterval(interval);
          resolve();
        }
      }, 100);
      
      // Timeout fallback after 2 seconds
      setTimeout(() => {
        clearInterval(interval);
        resolve();
      }, 2000);
    });
    
    voices = window.speechSynthesis.getVoices();
  }
  
  const currentValue = sel.value;
  sel.innerHTML = "";
  
  // Default option
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "Default voice";
  sel.appendChild(defaultOpt);
  
  if(!voices.length){
    const noVoices = document.createElement("option");
    noVoices.value = "";
    noVoices.textContent = "(No voices available)";
    noVoices.disabled = true;
    sel.appendChild(noVoices);
    return;
  }
  
  // Group voices by full language code (e.g., "EN-AU", "EN-US", "EN-GB")
  const byLangCountry = new Map();
  for(const v of voices){
    // Parse language code like "en-AU" or "en_AU" or just "en"
    const langParts = v.lang.replace('_', '-').split('-');
    const lang = langParts[0].toUpperCase();
    const country = langParts[1] ? langParts[1].toUpperCase() : '';
    const key = country ? `${lang} > ${country}` : lang;
    
    if(!byLangCountry.has(key)) byLangCountry.set(key, []);
    byLangCountry.get(key).push(v);
  }
  
  // Sort language-country keys: EN first, then alphabetical, within EN sort by country
  const keys = Array.from(byLangCountry.keys()).sort((a, b) => {
    const aIsEN = a.startsWith("EN");
    const bIsEN = b.startsWith("EN");
    
    // EN languages come first
    if(aIsEN && !bIsEN) return -1;
    if(!aIsEN && bIsEN) return 1;
    
    // Within same language prefix, sort alphabetically
    return a.localeCompare(b);
  });
  
  for(const key of keys){
    const group = document.createElement("optgroup");
    group.label = key;
    
    const langVoices = byLangCountry.get(key).sort((a, b) => a.name.localeCompare(b.name));
    for(const v of langVoices){
      const opt = document.createElement("option");
      opt.value = v.name;
      opt.textContent = v.name + (v.localService ? "" : " (online)");
      group.appendChild(opt);
    }
    
    sel.appendChild(group);
  }
  
  // Restore selection
  if(currentValue) sel.value = currentValue;
}

function testVoice(){
  const voiceName = $("setSpeechVoice").value;
  const rate = parseFloat($("setSpeechRate").value) || 1.0;
  
  if(!("speechSynthesis" in window)){
    setStatus("Speech not supported in this browser.");
    return;
  }
  
  window.speechSynthesis.cancel();
  
  // Test with sample pronunciations including problematic ones
  const testText = cleanPronunciationForSpeech("oo-kee-may, sh-in, kee-ah-ee, ah-ee-kee-doh, sah-ee, oo-kay");
  const u = new SpeechSynthesisUtterance(testText);
  u.rate = rate;
  
  // Get voices and apply selected one
  const voices = window.speechSynthesis.getVoices();
  
  if(voiceName && voices.length > 0){
    const voice = voices.find(v => v.name === voiceName);
    if(voice){
      u.voice = voice;
    }
  }
  
  // If voices aren't loaded yet, wait and try again
  if(voices.length === 0){
    window.speechSynthesis.onvoiceschanged = () => {
      const loadedVoices = window.speechSynthesis.getVoices();
      if(voiceName){
        const voice = loadedVoices.find(v => v.name === voiceName);
        if(voice) u.voice = voice;
      }
      window.speechSynthesis.speak(u);
    };
    return;
  }
  
  window.speechSynthesis.speak(u);
}

function resetVoiceToDefault(){
  $("setSpeechVoice").value = "";
  $("setSpeechRate").value = 1.0;
  updateRateLabel(1.0);
}

async function main(){

  // Auth modal buttons - Login
  bind("btnLogin","click", async ()=>{
    const username = ($("loginUsername").value || "").trim();
    const password = ($("loginPassword").value || "");
    
    if(!username || !password){
      $("authMessage").textContent = "Please enter both username and password.";
      return;
    }
    
    try{
      const res = await fetch("/api/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({username, password})
      }).then(r => r.json());
      
      if(res.error){
        if(res.error === "password_change_required"){
          $("authMessage").textContent = res.message || "Password reset required. Log in with the temporary password (123456789) to set a new password.";
          $("loginResetBox").classList.add("hidden");
          loginResetPending = false;
          return;
        }
        $("authMessage").textContent = getErrorMessage({message: res.error});
        return;
      }

      if(res.force_password_change){
        loginResetPending = true;
        $("authMessage").textContent = "Password change required. Set a new password below to finish logging in.";
        $("loginResetBox").classList.remove("hidden");
        if($("loginNewPassword")) $("loginNewPassword").value = "";
        if($("loginNewPassword2")) $("loginNewPassword2").value = "";
        return;
      }
      
      currentUser = res.user;
      setUserLine();
      hideAuthOverlay();
      appInitialized = false;
      await postLoginInit();
      await refresh();
    } catch(e){
      $("authMessage").textContent = getErrorMessage(e);
    }
  });

  bind("btnLoginResetPw","click", async ()=>{
    const new_password = ($("loginNewPassword").value || "");
    const new_password2 = ($("loginNewPassword2").value || "");

    if(!loginResetPending){
      $("authMessage").textContent = "Please log in with the temporary password first, then set a new password here.";
      return;
    }
    if(!new_password){
      $("authMessage").textContent = "Please enter a new password.";
      return;
    }
    if(new_password !== new_password2){
      $("authMessage").textContent = "New passwords do not match.";
      return;
    }

    try{
      const res = await fetch("/api/user/change_password", {
        method:"POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({new_password})
      }).then(async r => {
        const j = await r.json().catch(()=>({}));
        if(!r.ok && !j.error) j.error = "reset_failed";
        return j;
      });

      if(res.error){
        $("authMessage").textContent = getErrorMessage({message: res.error});
        return;
      }

      // Password updated successfully — finish login
      loginResetPending = false;
      $("loginResetBox").classList.add("hidden");
      if($("loginNewPassword")) $("loginNewPassword").value = "";
      if($("loginNewPassword2")) $("loginNewPassword2").value = "";
      $("authMessage").textContent = "";

      // Refresh current user and continue into app
      await ensureLoggedIn();
      appInitialized = false;
      try{ await postLoginInit(); } catch(e){}
      await refresh();
    } catch(e){
      $("authMessage").textContent = "Error: " + e.message;
    }
  });


  // Switch to register view
  bind("btnShowRegister","click", ()=>{
    $("authMessage").textContent = "Create a new account";
    clearAuthForms();
    setAuthView("register");
  });

  // Switch to login view
  bind("btnShowLogin","click", ()=>{
    $("authMessage").textContent = "Sign in to continue";
    clearAuthForms();
    setAuthView("login");
  });

  // Register new user
  bind("btnRegister","click", async ()=>{
    const username = ($("regUsername").value || "").trim();
    const password = ($("regPassword").value || "");
    const displayName = ($("regDisplayName").value || "").trim();
    
    if(!username || !password){
      $("authMessage").textContent = "Please enter both username and password.";
      return;
    }
    
    try{
      const res = await fetch("/api/register", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({username, password, display_name: displayName})
      }).then(r => r.json());
      
      if(res.error){
        $("authMessage").textContent = getErrorMessage({message: res.error});
        return;
      }
      
      currentUser = res.user;
      setUserLine();
      hideAuthOverlay();
      appInitialized = false;
      await postLoginInit();
      await refresh();
    } catch(e){
      $("authMessage").textContent = getErrorMessage(e);
    }
  });

  bind("logoutBtn","click", doLogout);
  // Also bind to user menu logout
  bind("userMenuLogout","click", doLogout);
  
  bind("tabActive","click", ()=>setTab("active"));
  bind("tabUnsure","click", ()=>setTab("unsure"));
  bind("tabLearned","click", ()=>setTab("learned"));
  bind("tabAll","click", ()=>setTab("all"));
  bind("tabCustom","click", ()=>setTab("custom"));

  // Learned tab view toggle
  bind("learnedViewListBtn","click", async ()=>{
    learnedViewMode = "list";
    // Use setTab so the active highlight updates correctly
    setTab("learned");
  });
  bind("learnedViewStudyBtn","click", async ()=>{
    learnedViewMode = "study";
    // Use setTab so the active highlight updates correctly
    setTab("learned");
  });

  // Custom Set view toggle
  bind("customViewUnlearnedBtn","click", async ()=>{
    customViewMode = "unlearned";
    customRandomLimit = 0;
    updateCustomViewHighlight();
    await refresh();
  });
  bind("customViewUnsureBtn","click", async ()=>{
    customViewMode = "unsure";
    customRandomLimit = 0;
    updateCustomViewHighlight();
    await refresh();
  });
  bind("customViewLearnedBtn","click", async ()=>{
    customViewMode = "learned";
    customRandomLimit = 0;
    updateCustomViewHighlight();
    await refresh();
  });
  bind("customViewAllBtn","click", async ()=>{
    customViewMode = "all";
    customRandomLimit = 0;
    updateCustomViewHighlight();
    await refresh();
  });
  bind("customRandomPickBtn","click", async ()=>{
    const input = prompt("How many random cards to study?", "10");
    if(input === null) return;
    const n = parseInt(input, 10);
    if(isNaN(n) || n < 1){
      setStatus("Please enter a valid number");
      return;
    }
    customRandomLimit = n;
    customViewMode = "all";
    updateCustomViewHighlight();
    await refresh();
  });

  bind("nextBtn","click", nextCard);
  bind("prevBtn","click", prevCard);
  bind("speakBtn","click", speakCurrent);


  

  bind("randomRefreshBtn","click", async ()=>{
    try{
      // Reshuffle works even if random is not checked - instant shuffle
      if(deck && deck.length){
        shuffle(deck);
        deckIndex = 0;
        renderStudyCard();
        setStatus("Deck reshuffled!");
        setTimeout(() => setStatus(""), 1500);
      } else {
        await refresh();
      }
    } catch(e){ console.error(e); }
  });

// Study random order toggle (per tab)
  bind("randomStudyChk","change", async ()=>{
    try{
      const on = $("randomStudyChk").checked;
      await setStudyRandomizeFlag(on);
      updateRandomStudyUI();
      await refresh();
    } catch(e){ console.error(e); }
  });



  // Breakdown (study card)
  bind("breakdownBtn","click", async ()=>{
    try{
      if(!deck.length) return;
      const c = deck[deckIndex];
      await openBreakdown(c);
    } catch(e){ console.error(e); }
  });

  // Breakdown modal controls
  bind("breakdownCloseBtn","click", closeBreakdown);
  bind("breakdownAddPartBtn","click", ()=>{
    if(!breakdownCurrentData) return;
    breakdownCurrentData.parts.push({part:"", meaning:""});
    renderBreakdownParts(breakdownCurrentData.parts);
  });
  bind("breakdownAutoBtn","click", async ()=>{
    try{
      if(!breakdownCurrentCard) return;
      const res = await jpost("/api/breakdown_autofill", {
        term: breakdownCurrentCard.term || "",
        meaning: breakdownCurrentCard.meaning || "",
        group: breakdownCurrentCard.group || ""
      });
      if(res && res.suggestion){
        breakdownCurrentData.parts = (res.suggestion.parts || []).map(p=>({part:p.part||"", meaning:p.meaning||""}));
        breakdownCurrentData.literal = res.suggestion.literal || "";
        $("breakdownLiteral").value = breakdownCurrentData.literal || "";
        renderBreakdownParts(breakdownCurrentData.parts);

        // Update meta line to show where the suggestion came from
        const meta = $("breakdownMeta");
        if(meta){
          const src = (res.source || "").toLowerCase();
          if(src === "openai" || src === "gemini"){
            const who = src === "openai" ? "AI (OpenAI)" : "AI (Gemini)";
            meta.textContent = `Auto-filled using ${who}. Review and edit, then Save.`;
          } else {
            // curated fallback
            const err = res.ai_error && res.ai_error.message ? String(res.ai_error.message) : "";
            if(err){
              meta.textContent = `AI auto-fill failed (${err}). Using built-in suggestions instead. Review and edit, then Save.`;
            } else {
              meta.textContent = "Auto-filled using built-in suggestions. Review and edit, then Save.";
            }
          }
        }
      }
    } catch(e){ console.error(e); }
  });
  bind("breakdownSaveBtn","click", async ()=>{
    try{
      if(!breakdownCurrentCard || !breakdownCurrentData) return;
      // pull latest from inputs
      const inputs = Array.from(document.querySelectorAll("#breakdownParts input.input"));
      const parts = [];
      for(const el of inputs){
        const idx = parseInt(el.getAttribute("data-idx")||"0",10);
        const field = el.getAttribute("data-field");
        if(!parts[idx]) parts[idx] = {part:"", meaning:""};
        parts[idx][field] = el.value;
      }
      breakdownCurrentData.parts = parts.filter(p=>p && (p.part||p.meaning));
      breakdownCurrentData.literal = $("breakdownLiteral").value || "";
      breakdownCurrentData.notes = $("breakdownNotes").value || "";

      await jpost("/api/breakdown", {
        id: breakdownCurrentCard.id,
        term: breakdownCurrentCard.term || breakdownCurrentData.term || "",
        parts: breakdownCurrentData.parts,
        literal: breakdownCurrentData.literal,
        notes: breakdownCurrentData.notes
      });
      // Keep inline cache in sync so study cards can immediately show the saved breakdown
      breakdownInlineCache[breakdownCurrentCard.id] = {
        parts: breakdownCurrentData.parts,
        literal: breakdownCurrentData.literal,
        notes: breakdownCurrentData.notes
      };
      setStatus("Saved breakdown.");
      closeBreakdown();
    } catch(e){
      console.error(e);
      let msg = "Could not save breakdown.";
      try{
        const raw = (e && e.message) ? String(e.message) : "";
        if(raw && raw.trim().startsWith("{")){
          const j = JSON.parse(raw);
          if(j && (j.message || j.error)) msg = j.message || j.error;
        }
      } catch(_){ }
      setStatus(msg);
    }
  });

  // Breakdowns list overlay
  bind("breakdownsBtn","click", async ()=>{
    $("breakdownsOverlay").classList.remove("hidden");
    await loadBreakdownsList();
  });
  bind("breakdownsCloseBtn","click", ()=>{ $("breakdownsOverlay").classList.add("hidden"); });
  bind("breakdownsRefreshBtn","click", loadBreakdownsList);
  bind("breakdownsSearch","input", ()=>{
    // lightweight debounce
    clearTimeout(window.__bdSearchTimer);
    window.__bdSearchTimer = setTimeout(loadBreakdownsList, 200);
  });


  bind("gotItBtn","click", ()=>{
    // Default: mark learned
    if(activeTab === "learned" && learnedViewMode === "study"){
      // Learned study: move back to Unlearned
      return setCurrentStatus("active");
    }
    if(activeTab === "custom"){
      return setCurrentStatus("learned");
    }
    return setCurrentStatus("learned");
  });
  bind("unsureBtn","click", ()=>{
    if(activeTab === "learned" && learnedViewMode === "study"){
      // Learned study: move to Unsure
      return setCurrentStatus("unsure");
    }
    if(activeTab === "unsure") return setCurrentStatus("active");
    if(activeTab === "custom") return setCurrentStatus("unsure");
    return setCurrentStatus("unsure");
  });
  
  // Star button on study card
  bind("starStudyBtn","click", async ()=>{
    if(!deck.length) return;
    const c = deck[deckIndex];

    const inSet = await toggleCustomSet(c.id);
    if(inSet === null) return;

    // If we're studying the Custom Set and user removed the card, remove it immediately.
    if(activeTab === "custom" && inSet === false){
      // remove from current study queue
      deck.splice(deckIndex, 1);
      if(deckIndex >= deck.length) deckIndex = 0;

      setStatus("Removed from Custom Set");

      // refresh cached custom-set data + counts immediately
      try { customSetData = await jget(customSetApiUrl() + "&_t=" + Date.now()); } catch(e){}
      await refreshCounts();
      renderStudyCard();
      return;
    }

    // Otherwise just update local state + UI
    c.in_custom_set = inSet;
    updateStudyStarButton(c);
    setStatus(inSet ? "Added to Custom Set" : "Removed from Custom Set");

    // If we are in custom tab (added back), refresh counts too
    if(activeTab === "custom"){
      try { customSetData = await jget(customSetApiUrl() + "&_t=" + Date.now()); } catch(e){}
      await refreshCounts();
    }
  });
// Sort by status dropdown for All list
  bind("sortByStatus","change", async ()=>{
    await refresh();
  });
  
  // Settings nav tabs
  document.querySelectorAll(".settingsNavBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const section = btn.getAttribute("data-section");
      switchSettingsSection(section);
    });
  });
  
  // Sync buttons
  bind("syncPushBtn","click", doSyncPush);
  bind("syncPullBtn","click", doSyncPull);
  bind("syncBreakdownsBtn","click", doSyncBreakdowns);
  
bind("card","click", flip);
  bind("card","keydown", (e)=>{
    if(e.code === "Space" || e.code === "Enter"){
      e.preventDefault(); flip();
    }
  });

  // Search box with clear button
  bind("searchBox","input", async ()=>{ 
    updateSearchClearButton();
    await refresh(); 
  });
  bind("searchClearBtn","click", async ()=>{
    $("searchBox").value = "";
    updateSearchClearButton();
    collapseSearch();
    await refresh();
  });

  // Search icon toggle (expand/collapse search box)
  bind("searchIconBtn","click", (e)=>{
    e.stopPropagation();
    const wrapper = $("searchWrapper");
    if(wrapper.classList.contains("expanded")){
      if(!$("searchBox").value.trim()) collapseSearch();
    } else {
      wrapper.classList.add("expanded");
      $("searchBox").focus();
    }
  });

  // Close search on outside click
  document.addEventListener("click", (e)=>{
    const wrapper = $("searchWrapper");
    if(wrapper && wrapper.classList.contains("expanded") && !wrapper.contains(e.target)){
      if(!$("searchBox").value.trim()) collapseSearch();
    }
  });

  function collapseSearch(){
    const wrapper = $("searchWrapper");
    if(wrapper) wrapper.classList.remove("expanded");
  }

  bind("allCardsBtn","click", async ()=>{
    scopeGroup = "";
    $("groupSelect").value = "";
    allCardsMode = true;
    updateFilterHighlight();
  updateLearnedViewHighlight();
    await refresh();
  });

  bind("settingsBtn","click", openSettings);
  bind("closeSettingsBtn","click", async ()=>{
    if(settingsDirty){
      if(!confirm("You have unsaved changes. Close without saving?")){
        return;
      }
    }
    settingsDirty = false;
    $("viewSettings").classList.add("hidden");
    if(activeTab === "active" || activeTab === "unsure" || (activeTab === "learned" && learnedViewMode === "study")){
      $("viewStudy").classList.remove("hidden");
    } else {
      $("viewList").classList.remove("hidden");
    }
    await refresh();
  });
  
  // Close button at top of settings page (for mobile)
  bind("settingsCloseTopBtn","click", async ()=>{
    if(settingsDirty){
      if(!confirm("You have unsaved changes. Close without saving?")){
        return;
      }
    }
    settingsDirty = false;
    $("viewSettings").classList.add("hidden");
    if(activeTab === "active" || activeTab === "unsure" || (activeTab === "learned" && learnedViewMode === "study")){
      $("viewStudy").classList.remove("hidden");
    } else {
      $("viewList").classList.remove("hidden");
    }
    await refresh();
  });

  bind("settingsScope","change", async ()=>{
    await loadSettingsForm($("settingsScope").value);
  });

  bind("setBreakdownApplyAll","change", ()=>{ updateBreakdownSettingsUI(); markSettingsDirty(); });

  // Mark settings dirty when any input changes
  document.querySelectorAll("#viewSettings input, #viewSettings select").forEach(el => {
    el.addEventListener("change", markSettingsDirty);
    el.addEventListener("input", markSettingsDirty);
  });

  bind("saveSettingsBtn","click", saveSettings);
  bind("resetSettingsBtn","click", async ()=>{
    let scope = $("settingsScope").value;
    if(!scope) scope = "all";
    if(!confirm("Reset settings to defaults for this scope?")) return;
    try{
      await jpost("/api/settings_reset", {scope});
      // clear cached settings + reload form
      settingsAll = null;
      settingsGroup = {};
      window.__activeSettings = null;
      await loadSettingsForm(scope);
      await refresh();
    } catch(e){
      console.error(e);
    }
  });

  // Voice settings bindings
  bind("setSpeechRate","input", ()=>{
    updateRateLabel($("setSpeechRate").value);
  });
  bind("testVoiceBtn","click", testVoice);
  bind("resetVoiceBtn","click", resetVoiceToDefault);

  // Allow Enter key to submit login/register forms
  $("loginPassword").addEventListener("keydown", (e) => {
    if(e.key === "Enter") $("btnLogin").click();
  });
  $("regPassword").addEventListener("keydown", (e) => {
    if(e.key === "Enter") $("btnRegister").click();
  });

  const ok = await ensureLoggedIn();
  if(!ok) return;
  await postLoginInit();
}

main().catch(err=>{
  console.error(err);
  setStatus("Error: " + err.message);
});

try{ wireUserMenu(); }catch(e){}

// Logout function
async function doLogout(){
  // Confirm logout
  if(!confirm("Are you sure you want to logout?")) return;
  
  try{ await jpost("/api/logout", {}); } catch(e){}
  currentUser = null;
  setUserLine();
  appInitialized = false;
  allGroups = [];
  try{ $("groupSelect").innerHTML = ""; } catch(e){}
  try{ $("settingsScope").innerHTML = ""; } catch(e){}
  // Close user menu
  const menu = $("userMenu");
  if(menu) menu.classList.add("hidden");
  await ensureLoggedIn();
}

// Settings nav section switching
function switchSettingsSection(section){
  // Update nav buttons
  document.querySelectorAll(".settingsNavBtn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-section") === section);
  });
  // Update sections
  document.querySelectorAll(".settingsSection").forEach(sec => {
    sec.classList.toggle("active", sec.getAttribute("data-section") === section);
  });
  // Update sync section info if switching to sync
  if(section === "sync"){
    updateSyncSectionInfo();
  }
  // Update AI section info
  if(section === "ai"){
    updateAISectionInfo();
  }
}

// Update sync section with current user info
function updateSyncSectionInfo(){
  const loginLabel = $("syncLoginLabel");
  const userLabel = $("syncUserLabel");
  const banner = $("syncLoginStatus");
  
  if(currentUser){
    if(loginLabel) loginLabel.textContent = "Logged In" + (isAdminUser() ? " (Admin)" : "");
    if(userLabel) userLabel.textContent = `User: ${currentUser.display_name || currentUser.username}` + (isAdminUser() ? " (Admin)" : "");
    if(banner) banner.classList.remove("loggedOut");
  } else {
    if(loginLabel) loginLabel.textContent = "Not Logged In";
    if(userLabel) userLabel.textContent = "User: --";
    if(banner) banner.classList.add("loggedOut");
  }
  
  // Update last sync time from localStorage
  const lastSync = localStorage.getItem("kenpo_last_sync");
  const syncTime = $("syncLastTime");
  if(syncTime){
    if(lastSync){
      const d = new Date(parseInt(lastSync));
      syncTime.textContent = d.toLocaleString();
    } else {
      syncTime.textContent = "Never";
    }
  }
}

// Update AI section info
function updateAISectionInfo(){
  const chatgptStatus = $("aiChatgptStatus");
  const geminiStatus = $("aiGeminiStatus");
  
  if(chatgptStatus){
    if(aiStatus && aiStatus.openai_available){
      chatgptStatus.textContent = aiStatus.openai_model || "Available";
      chatgptStatus.className = "aiStatusValue active";
    } else {
      chatgptStatus.textContent = "Not configured";
      chatgptStatus.className = "aiStatusValue inactive";
    }
  }
  
  if(geminiStatus){
    if(aiStatus && aiStatus.gemini_available){
      geminiStatus.textContent = aiStatus.gemini_model || "Available";
      geminiStatus.className = "aiStatusValue active";
    } else {
      geminiStatus.textContent = "Not configured";
      geminiStatus.className = "aiStatusValue inactive";
    }
  }
}

// Sync push
async function doSyncPush(){
  const statusEl = $("syncStatus");
  try{
    statusEl.className = "syncStatus";
    statusEl.textContent = "Pushing...";
    statusEl.style.display = "block";
    
    // Get current progress and push (use web endpoint with session auth)
    const res = await jpost("/api/web/sync/push", {});
    
    localStorage.setItem("kenpo_last_sync", Date.now().toString());
    updateSyncSectionInfo();
    
    statusEl.className = "syncStatus success";
    statusEl.textContent = "✓ Push complete!";
    setTimeout(()=>{ statusEl.style.display = "none"; }, 3000);
  } catch(e){
    statusEl.className = "syncStatus error";
    statusEl.textContent = "✗ Push failed: " + (e.message || "Unknown error");
  }
}

// Sync pull
async function doSyncPull(){
  const statusEl = $("syncStatus");
  try{
    statusEl.className = "syncStatus";
    statusEl.textContent = "Pulling...";
    statusEl.style.display = "block";
    
    const res = await jget("/api/web/sync/pull");
    
    localStorage.setItem("kenpo_last_sync", Date.now().toString());
    updateSyncSectionInfo();
    
    // Refresh counts and view
    await refreshCounts();
    
    statusEl.className = "syncStatus success";
    statusEl.textContent = "✓ Pull complete!";
    setTimeout(()=>{ statusEl.style.display = "none"; }, 3000);
  } catch(e){
    statusEl.className = "syncStatus error";
    statusEl.textContent = "✗ Pull failed: " + (e.message || "Unknown error");
  }
}

// Sync breakdowns
async function doSyncBreakdowns(){
  const statusEl = $("syncStatus");
  try{
    statusEl.className = "syncStatus";
    statusEl.textContent = "Syncing breakdowns...";
    statusEl.style.display = "block";
    
    const res = await jget("/api/sync/breakdowns");
    
    // Update local breakdown cache
    if(res && res.breakdowns){
      for(const [id, bd] of Object.entries(res.breakdowns)){
        breakdownInlineCache[id] = bd;
      }
    }
    
    statusEl.className = "syncStatus success";
    statusEl.textContent = `✓ Synced ${Object.keys(res.breakdowns || {}).length} breakdowns!`;
    setTimeout(()=>{ statusEl.style.display = "none"; }, 3000);
  } catch(e){
    statusEl.className = "syncStatus error";
    statusEl.textContent = "✗ Sync failed: " + (e.message || "Unknown error");
  }
}

// Update star button on study card
function updateStudyStarButton(card){
  const btn = $("starStudyBtn");
  if(!btn) return;

  // In Custom tab, every card shown is in the Custom Set by definition.
  if(activeTab === "custom"){
    btn.textContent = "★";
    btn.classList.toggle("on", true);
    btn.style.color = "goldenrod"; // fallback color
    return;
  }

  // Other tabs: reflect actual membership
  const inSet = !!(card && card.in_custom_set);
  btn.textContent = inSet ? "★" : "☆";
  btn.classList.toggle("on", inSet);

  // Fallback color for all tabs when "on"
  btn.style.color = inSet ? "goldenrod" : "";
}

// ============================================================
// EDIT DECKS PAGE
// ============================================================

let currentDecks = [];
let userCards = [];
let activeDeckId = "kenpo";

// Edit Deck Modal (Edit Deck / Edit Cards)


// Edit Cards (within Edit Deck modal): in-modal notice that auto-hides
let _editCardsNoticeTimer = null;
function showEditCardsNotice(msg, type="error"){
  const box = $("editCardsNotice");
  if(!box) { 
    // fallback to global status
    try{ showEditDecksStatus(msg, type); }catch(e){}
    return;
  }
  if(_editCardsNoticeTimer) clearTimeout(_editCardsNoticeTimer);
  box.textContent = msg;
  box.classList.remove("error","success","show","hidden");
  box.classList.add("show");
  box.classList.add(type === "success" ? "success" : "error");
  _editCardsNoticeTimer = setTimeout(() => {
    box.classList.remove("show","error","success");
    box.textContent = "";
  }, 3200);
}

function clearEditCardsNotice(){
  const box = $("editCardsNotice");
  if(!box) return;
  if(_editCardsNoticeTimer) clearTimeout(_editCardsNoticeTimer);
  box.classList.remove("show","error","success");
  box.textContent = "";
}

function updateEditCardsSearchClear(){
  const input = $("editCardsSearch");
  const wrap = input?.closest(".searchWithClear");
  const btn = $("editCardsSearchClear");
  if(!input || !wrap || !btn) return;
  const has = !!(input.value || "").trim();
  if(has) wrap.classList.add("hasValue");
  else wrap.classList.remove("hasValue");
}

function resetEditCardsState(){
  // Clear search + selection when the Edit Deck modal is closed
  const input = $("editCardsSearch");
  if(input) input.value = "";
  updateEditCardsSearchClear();
  editDeckSelectedIds = new Set();
  clearEditCardsNotice();
  // Keep group filter + show-deleted as-is unless user changes it
  const count = $("editCardsSelectedCount");
  if(count) count.textContent = "0 selected";
}
let editDeckModalDeck = null;
let editDeckCardsCache = [];
let editDeckSelectedIds = new Set();
let editDeckModalTab = "deck";


// Hide all main views
function hideAllViews(){
  $("viewStudy")?.classList.add("hidden");
  $("viewList")?.classList.add("hidden");
  $("viewSettings")?.classList.add("hidden");
  $("viewEditDecks")?.classList.add("hidden");
}

// Open Edit Decks page
function openEditDecks(){
  hideAllViews();
  $("viewEditDecks").classList.remove("hidden");
  // Always start on Switch tab
  try { switchEditDecksTab("switch"); } catch(e){}
  try { switchAddCardsSubTab("single"); } catch(e){}
  try { resetDecksCollapsibles(); } catch(e){}
  loadDecks();
  loadUserCards();
  loadDeletedCards();
}

// Close Edit Decks page
function closeEditDecks(){
  // Reset Decks UI so next open defaults correctly
  try { switchEditDecksTab("switch"); } catch(e){}
  try { switchAddCardsSubTab("single"); } catch(e){}
  try { resetDecksCollapsibles(); } catch(e){}
  hideAllViews();
  $("viewStudy").classList.remove("hidden");
  refresh();
}


function toggleCollapsible(id){
  const el = $(id);
  if(!el) return;
  el.classList.toggle("collapsed");
}

function resetDecksCollapsibles(){
  ["collCreateDeck","collRedeemCode"].forEach(id => {
    const el = $(id);
    if(el) el.classList.add("collapsed");
  });
}

function switchAddCardsSubTab(sub){
  // Buttons
  document.querySelectorAll("#addCardsSubTabs .subTabBtn").forEach(b => b.classList.remove("active"));
  document.querySelector(`#addCardsSubTabs .subTabBtn[data-subtab="${sub}"]`)?.classList.add("active");

  // Sections
  document.querySelectorAll("#editDecksAddTab .subTabSection").forEach(s => s.classList.remove("active"));
  document.querySelector(`#editDecksAddTab .subTabSection[data-subtab-body="${sub}"]`)?.classList.add("active");

  // Clear any visible status when switching
  if(sub === "single"){
    // nothing
  }
}

// Switch Edit Decks tabs
function switchEditDecksTab(tabName){
  try{
    const curTab = document.querySelector(".editDecksTab.active")?.dataset?.tab;
    if(curTab === "generate" && tabName !== "generate"){
      aiGenClearInputs({clearKeywords:true, clearMax:true, clearInstructions:true});
    }
  }catch(e){}

  document.querySelectorAll(".editDecksTab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".editDecksSection").forEach(s => s.classList.remove("active"));
  
  document.querySelector(`.editDecksTab[data-tab="${tabName}"]`)?.classList.add("active");
  document.querySelector(`.editDecksSection[data-section="${tabName}"]`)?.classList.add("active");
  
  // Load deck-specific settings when generate tab opens
  if(tabName === "generate") loadDeckAiSettings();
}

// Show status message in Edit Decks
function showEditDecksStatus(message, type = "info"){
  const el = $("editDecksStatus");
  el.textContent = message;
  el.className = `editDecksStatus ${type}`;
  el.style.display = "block";
  if(type === "success"){
    setTimeout(() => { el.style.display = "none"; }, 3000);
  }
}

// Load decks
async function loadDecks(){
  try {
    currentDecks = await jget("/api/decks");
    
    // Load saved active deck from settings
    try {
      const settingsResp = await jget("/api/settings?scope=all");
      const settings = (settingsResp && settingsResp.settings) ? settingsResp.settings : settingsResp;
      if(settings && settings.activeDeckId){
        activeDeckId = settings.activeDeckId;
      }
    } catch(e){}
    
    renderDecksList();
    updateDeckDropdown();
  
    updateHeaderDeckName();
    updateHeaderDeckLogo();
} catch(e){
    showEditDecksStatus("Failed to load decks: " + e.message, "error");
  }
}

// Render decks list
function renderDecksList(){
  const list = $("decksList");
  if(!list) return;
  
  list.innerHTML = "";
  
  for(const deck of currentDecks){
    const isActive = deck.id === activeDeckId;
    const accessType = deck.accessType || (deck.isBuiltIn ? "built-in" : "owned");
    // Use data attributes for icon-only mode on mobile
    const accessBadge = accessType === "shared" ? '<span class="deckBadge shared" title="Shared">👥<span class="badgeText"> Shared</span></span>' : 
                        (accessType === "unlocked" ? '<span class="deckBadge unlocked" title="Unlocked">🔓<span class="badgeText"> Unlocked</span></span>' : 
                        (accessType === "built-in" ? '<span class="deckBadge builtin" title="Built-in">📦<span class="badgeText"> Built-in</span></span>' : ''));
    
    const div = document.createElement("div");
    div.className = "deckItem" + (isActive ? " active" : "");
    div.innerHTML = `
      <img class="deckMiniLogo" alt="Deck icon" />
      <div class="deckInfo">
        <div class="deckName">
          ${escapeHtml(deck.name)}
          ${accessBadge}
          ${deck.isDefault ? '<span class="deckBadge default" title="Default">★<span class="badgeText"> Default</span></span>' : ''}
        </div>
        <div class="deckDesc">${escapeHtml(deck.description || "")}</div>
        <div class="deckCount">${deck.cardCount} cards</div>
      </div>
      <div class="deckActions">
        ${!isActive ? '<button class="deckSwitchBtn appBtn primary small" title="Switch to this deck">Switch</button>' : '<span class="deckActiveLabel">✓ Active</span>'}
        ${!deck.isDefault ? '<button class="deckDefaultBtn" title="Set as default startup deck">★</button>' : '<button class="deckClearDefaultBtn" title="Clear default (no startup deck)">★</button>'}
        ${deck.canEdit ? '<button class="deckEditBtn" title="Edit deck">✏️</button>' : ''}
        ${deck.canDelete ? '<button class="deckDeleteBtn" title="Delete deck">🗑️</button>' : ''}
      </div>
    `;
    
    // Deck mini icon
    const icon = div.querySelector(".deckMiniLogo");
    if(icon){
      const url = (deck && deck.logoPath) ? deck.logoPath : DEFAULT_DECK_LOGO_URL;
      icon.src = url;
      icon.onerror = () => { icon.onerror = null; icon.src = DEFAULT_DECK_LOGO_URL; };
    }
    
    const switchBtn = div.querySelector(".deckSwitchBtn");
    if(switchBtn){
      switchBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        switchToDeck(deck.id);
      });
    }
    
    const defaultBtn = div.querySelector(".deckDefaultBtn");
    if(defaultBtn){
      defaultBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setDefaultDeck(deck.id, deck.name);
      });
    }
    
    const clearDefaultBtn = div.querySelector(".deckClearDefaultBtn");
    if(clearDefaultBtn){
      clearDefaultBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        clearDefaultDeck(deck.id, deck.name);
      });
    }
    
    const editBtn = div.querySelector(".deckEditBtn");
    if(editBtn){
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showEditDeckModal(deck);
      });
    }
    
    const deleteBtn = div.querySelector(".deckDeleteBtn");
    if(deleteBtn){
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteDeck(deck.id, deck.name);
      });
    }
    
    list.appendChild(div);
  }
  
  // Update current deck banner
  const currentDeck = currentDecks.find(d => d.id === activeDeckId) || currentDecks[0];
  if(currentDeck){
    $("currentDeckName").textContent = currentDeck.name;
    $("currentDeckCount").textContent = `${currentDeck.cardCount} cards`;
  }
}

// Clear default deck
async function clearDefaultDeck(deckId, deckName){
  try {
    await jpost(`/api/decks/${deckId}/clear_default`, {});
    showEditDecksStatus(`"${deckName}" is no longer the default`, "success");
    await loadDecks();
  } catch(e){
    console.error(e);
    showEditDecksStatus("Failed to clear default", "error");
  }
}

// Actually switch to a deck (loads cards)
async function switchToDeck(deckId){
  const deck = currentDecks.find(d => d.id === deckId);
  const deckName = deck?.name || deckId;
  
  activeDeckId = deckId;
  renderDecksList();
  
  // Save active deck preference
  try {
    await jpost("/api/settings", { scope: "all", settings: { activeDeckId: deckId } });
  } catch(e){
    console.error("Failed to save deck preference:", e);
  }
  
  showEditDecksStatus(`Switched to "${deckName}"`, "success");
  
  // Update header deck name
  updateHeaderDeckName();
  updateHeaderDeckLogo();
  
  // Reload groups for the new deck
  await reloadGroupsForDeck();
  
  // Reload counts and cards for the new deck
  await refreshCounts();
  
  // Reload study deck
  await loadDeckForStudy();
  
  // Update AI generator deck display
  updateAiGenDeckName();
  
  // Reload user cards list
  loadUserCards();
}

// Reload groups dropdown for current deck
async function reloadGroupsForDeck(){
  const deckParam = activeDeckId ? `?deck_id=${encodeURIComponent(activeDeckId)}` : "";
  allGroups = await jget("/api/groups" + deckParam);
  
  const sel = $("groupSelect");
  sel.innerHTML = "";
  const optPick = document.createElement("option");
  optPick.value = "";
  optPick.textContent = "Select group…";
  sel.appendChild(optPick);
  
  for(const g of allGroups){
    const o = document.createElement("option");
    o.value = g;
    o.textContent = g;
    sel.appendChild(o);
  }
  
  scopeGroup = "";
  sel.value = "";
  allCardsMode = true;
  
  updateFilterHighlight();
  setupGroupDropdown(allGroups);
}

// Delete a deck
async function deleteDeck(deckId, deckName){
  if(!confirm(`Delete deck "${deckName}"? This cannot be undone.`)) return;
  
  try {
    await fetch(`/api/decks/${deckId}`, { method: "DELETE" });
    showEditDecksStatus(`Deleted "${deckName}"`, "success");
    loadDecks();
  } catch(e){
    showEditDecksStatus("Failed to delete deck: " + e.message, "error");
  }
}

// Set a deck as the default startup deck
async function setDefaultDeck(deckId, deckName){
  try {
    await jpost(`/api/decks/${deckId}/set_default`, {});
    showEditDecksStatus(`Set "${deckName}" as default startup deck`, "success");
    loadDecks();
  } catch(e){
    showEditDecksStatus("Failed to set default: " + e.message, "error");
  }
}

// Redeem an invite code
async function redeemInviteCode(){
  const input = $("inviteCodeInput");
  const code = (input?.value || "").trim();
  
  if(!code){
    showEditDecksStatus("Please enter an invite code", "error");
    return;
  }
  
  try {
    const result = await jpost("/api/redeem-invite-code", { code });
    showEditDecksStatus(`🎉 Unlocked deck: "${result.deckName}"`, "success");
    input.value = "";
    await loadDecks();
  } catch(e){
    const msg = e.message || "";
    if(msg.includes("Invalid") || msg.includes("404")){
      showEditDecksStatus("Invalid invite code", "error");
    } else if(msg.includes("already")){
      showEditDecksStatus("You already have access to this deck", "error");
    } else {
      showEditDecksStatus("Failed to redeem code: " + msg, "error");
    }
  }
}

// Show edit deck modal
function showEditDeckModal(deck){
  const modal = $("editDeckModal");
  if(!modal) return;

  // Track current deck for the modal (Edit Deck / Edit Cards)
  editDeckModalDeck = deck;

  $("editDeckId").value = deck.id;
  $("editDeckName").value = deck.name;
  $("editDeckDescription").value = deck.description || "";

  const nameEl = $("editDeckModalDeckName");
  if(nameEl){
    nameEl.textContent = deck && deck.name ? `(${deck.name})` : "";
  }

  // Populate "Add Card" tab target deck (fixed to this deck)
  try{
    const sel = $("editDeckBulkAiDeckSelect");
    if(sel){
      sel.innerHTML = "";
      const opt = document.createElement("option");
      opt.value = deck.id;
      opt.textContent = deck.name;
      opt.selected = true;
      sel.appendChild(opt);
    }
  }catch(e){}

  // Clear Add Card (AI) inputs from any prior open
  try{ editBulkClearInputs(); }catch(e){}

  // Default to Edit Deck tab every time
  switchEditDeckModalTab("deck");

  modal.classList.remove("hidden");
  document.body.classList.add("modalLock");
}

// Close edit deck modal


// Switch Edit Deck Modal tabs
function switchEditDeckModalTab(tab){
  const prevTab = editDeckModalTab;
  editDeckModalTab = tab;
  // Leaving Add Card tab? Clear Bulk Add (AI) inputs like Create Deck generator does.
  if(prevTab === "addcard" && tab !== "addcard"){
    try{ editBulkClearInputs(); }catch(e){}
  }
  document.querySelectorAll("#editDeckModal .modalTab").forEach(b => b.classList.remove("active"));
  document.querySelectorAll("#editDeckModal .modalTabBody").forEach(s => s.classList.remove("active"));

  document.querySelector(`#editDeckModal .modalTab[data-edittab="${tab}"]`)?.classList.add("active");
  document.querySelector(`#editDeckModal .modalTabBody[data-edittab-body="${tab}"]`)?.classList.add("active");

  // Top close button: show only on Edit Cards tab
  const topClose = $("editCardsCloseTop");
  if(topClose){
    if(tab === "cards") topClose.classList.remove("hidden");
    else topClose.classList.add("hidden");
  }

  if(tab === "cards"){
    // Lazy-load cards only when the user opens Edit Cards
    loadEditDeckCards(false);
    updateEditCardsSearchClear();
    clearEditCardsNotice();
  }
}

// Utility: show a choice modal with buttons
function showChoiceModal(title, text, options){
  return new Promise((resolve) => {
    const overlay = $("choiceModal");
    if(!overlay){
      // Fallback
      const v = prompt(`${title}\n\n${text}\n\n${options.map((o,i)=>`${i+1}) ${o.label}`).join("\n")}`);
      const idx = parseInt(v || "", 10) - 1;
      resolve((idx >= 0 && idx < options.length) ? options[idx].key : null);
      return;
    }
    $("choiceModalTitle").textContent = title || "Choose";
    $("choiceModalText").textContent = text || "";
    const btns = $("choiceModalBtns");
    btns.innerHTML = "";
    for(const opt of options){
      const b = document.createElement("button");
      b.className = opt.className || "secondary";
      b.textContent = opt.label;
      b.addEventListener("click", () => {
        overlay.classList.add("hidden");
        resolve(opt.key);
      });
      btns.appendChild(b);
    }
    overlay.classList.remove("hidden");
  });
}

// Utility: preview modal for bulk actions
function showPreviewModal(title, text, items, applyLabel="Apply"){
  return new Promise((resolve) => {
    const overlay = $("previewModal");
    if(!overlay){
      resolve(confirm(`${title}\n\n${text}\n\n${items.join("\n")}\n\nProceed?`));
      return;
    }
    $("previewModalTitle").textContent = title || "Preview";
    $("previewModalText").textContent = text || "";
    const list = $("previewModalList");
    list.innerHTML = items.join("");
    $("previewApplyBtn").textContent = applyLabel;

    const cancel = () => { overlay.classList.add("hidden"); resolve(false); };
    const apply = () => { overlay.classList.add("hidden"); resolve(true); };

    $("previewCancelBtn").onclick = cancel;
    $("previewApplyBtn").onclick = apply;

    overlay.classList.remove("hidden");
  });
}

// Load cards for the deck currently being edited
async function loadEditDeckCards(force){
  if(!editDeckModalDeck) return;
  if(!force && editDeckCardsCache && editDeckCardsCache.length){
    renderEditDeckCards();
    return;
  }
  try{
    const deckId = editDeckModalDeck.id;
    const cards = await jget(`/api/cards?deck_id=${encodeURIComponent(deckId)}&status=all`);
    editDeckCardsCache = Array.isArray(cards) ? cards : [];
    // Reset selection on refresh
    editDeckSelectedIds = new Set();
    buildEditCardsGroupFilter();
    renderEditDeckCards();
  }catch(e){
    showEditDecksStatus("Failed to load deck cards: " + (e.message || e), "error");
  }
}

function buildEditCardsGroupFilter(){
  const sel = $("editCardsGroupFilter");
  if(!sel) return;
  const groups = new Set();
  for(const c of editDeckCardsCache){
    const g = (c.group || "").trim();
    if(g) groups.add(g);
  }
  const current = sel.value || "";
  sel.innerHTML = '<option value="">All groups</option>';
  [...groups].sort((a,b)=>a.localeCompare(b)).forEach(g=>{
    const o=document.createElement("option");
    o.value=g; o.textContent=g;
    sel.appendChild(o);
  });
  sel.value = current;
}

function getVisibleEditDeckCards(){
  const q = ($("editCardsSearch")?.value || "").trim().toLowerCase();
  const g = ($("editCardsGroupFilter")?.value || "").trim();
  const showDeleted = !!$("editCardsShowDeleted")?.checked;

  return editDeckCardsCache.filter(c=>{
    if(!showDeleted && c.status === "deleted") return false;
    if(g && (c.group || "") !== g) return false;
    if(q){
      const hay = `${c.term||""} ${c.meaning||""} ${c.pron||""}`.toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
}

function updateEditCardsSelectedCount(){
  const el = $("editCardsSelectedCount");
  if(el) el.textContent = `${editDeckSelectedIds.size} selected`;
}

function renderEditDeckCards(){
  const list = $("editCardsList");
  if(!list) return;

  const cards = getVisibleEditDeckCards();
  updateEditCardsSelectedCount();

  if(cards.length === 0){
    list.innerHTML = '<div class="emptyState"><div class="icon">🗂️</div>No cards match your filters</div>';
    return;
  }

  list.innerHTML = "";
  for(const card of cards){
    const row = document.createElement("div");
    row.className = "editCardRow" + (card.status === "deleted" ? " deleted" : "");
    row.dataset.id = card.id;

    row.innerHTML = `
      <input class="editCardSelect" type="checkbox" ${editDeckSelectedIds.has(card.id) ? "checked" : ""} />
      <div class="editCardMain">
        <div class="editCardTerm">${escapeHtml(card.term || "")}</div>
        <div class="editCardMeaning">${escapeHtml(card.meaning || "")}</div>
        <div class="editCardMeta">${escapeHtml(card.pron || "")}${(card.pron && card.group) ? " • " : ""}${escapeHtml(card.group || "")}</div>
      </div>
      <div class="editCardActions">
        <button class="appBtn secondary small editBtn">Edit</button>
        ${card.status === "deleted" ? '<button class="appBtn secondary small restoreBtn">Restore</button>' : '<button class="appBtn danger small removeBtn">Remove</button>'}
      </div>
    `;

    const cb = row.querySelector(".editCardSelect");
    cb.addEventListener("change", () => {
      if(cb.checked) editDeckSelectedIds.add(card.id);
      else editDeckSelectedIds.delete(card.id);
      updateEditCardsSelectedCount();
    });

    const removeBtn = row.querySelector(".removeBtn");
    if(removeBtn){
      removeBtn.addEventListener("click", async () => {
        if(!confirm(`Remove "${card.term}" from study? (You can restore it in Deleted)`)) return;
        try{
          await jpost("/api/set_status", { id: card.id, status: "deleted" });
          showEditDecksStatus(`Removed "${card.term}"`, "success");
          await loadDeletedCards();
          await loadEditDeckCards(true);
          refreshCounts();
        }catch(e){
          showEditDecksStatus("Failed to remove: " + (e.message || e), "error");
        }
      });
    }

    const restoreBtn = row.querySelector(".restoreBtn");
    if(restoreBtn){
      restoreBtn.addEventListener("click", async () => {
        try{
          await jpost("/api/set_status", { id: card.id, status: "active" });
          showEditDecksStatus(`Restored "${card.term}"`, "success");
          await loadDeletedCards();
          await loadEditDeckCards(true);
          refreshCounts();
        }catch(e){
          showEditDecksStatus("Failed to restore: " + (e.message || e), "error");
        }
      });
    }

    row.querySelector(".editBtn").addEventListener("click", () => {
      openInlineCardEditor(row, card);
    });

    list.appendChild(row);
  }
}

// Inline editor UI for a single card
function openInlineCardEditor(row, card){
  const main = row.querySelector(".editCardMain");
  const actions = row.querySelector(".editCardActions");
  if(!main || !actions) return;

  const orig = { term: card.term || "", meaning: card.meaning || "", pron: card.pron || "", group: card.group || "" };

  // Render editor in a compact, list-like box (no accordion feel), with Save/Cancel contained
  // inside the row to avoid layout issues on smaller screens.
  main.innerHTML = `
    <div class="editCardEditBox">
      <div class="editCardEditGrid">
        <label class="field">
          <span>Term *</span>
          <input class="editTerm" value="${escapeAttr(orig.term)}" />
        </label>
        <label class="field">
          <span>Definition *</span>
          <input class="editMeaning" value="${escapeAttr(orig.meaning)}" />
        </label>
        <div class="row2">
          <label class="field">
            <span>Pronunciation</span>
            <input class="editPron" value="${escapeAttr(orig.pron)}" />
          </label>
          <label class="field">
            <span>Group</span>
            <input class="editGroup" value="${escapeAttr(orig.group)}" />
          </label>
        </div>
      </div>
      <div class="editCardEditBtns">
        <button class="appBtn good small saveBtn">Save</button>
        <button class="appBtn secondary small cancelBtn">Cancel</button>
      </div>
    </div>
  `;

  // Hide the right-side actions while editing so the row stays clean and responsive
  actions.innerHTML = "";
  actions.style.display = "none";

  const cancelBtn = main.querySelector(".cancelBtn");
  const saveBtn = main.querySelector(".saveBtn");

  cancelBtn.addEventListener("click", () => {
    // Restore original row render by reloading cached list
    renderEditDeckCards();
  });

  saveBtn.addEventListener("click", async () => {
    const newTerm = row.querySelector(".editTerm").value.trim();
    const newMeaning = row.querySelector(".editMeaning").value.trim();
    const newPron = row.querySelector(".editPron").value.trim();
    const newGroup = row.querySelector(".editGroup").value.trim();

    if(!newTerm){
      showEditDecksStatus("Term is required", "error");
      return;
    }
    if(!newMeaning){
      showEditDecksStatus("Definition is required", "error");
      return;
    }

    // Duplicate detection (within deck, excluding this card)
    const dup = findDuplicateCardInCache(newTerm, card.id);
    if(dup){
      const choice = await showChoiceModal(
        "Duplicate term detected",
        `"${newTerm}" already exists in this deck.\n\nChoose what you want to do:`,
        [
          { key: "add", label: "Add duplicate (keep both)", className: "secondary" },
          { key: "replace", label: "Replace existing duplicate", className: "primary" },
          { key: "cancel", label: "Cancel", className: "secondary" }
        ]
      );
      if(choice === "cancel" || !choice) return;

      if(choice === "replace"){
        try{
          await fetch(`/api/user_cards/${dup.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ term: newTerm, meaning: newMeaning, pron: newPron, group: newGroup, deckId: editDeckModalDeck?.id })
          });
          // Remove this card from study (soft delete)
          await jpost("/api/set_status", { id: card.id, status: "deleted" });
          showEditDecksStatus(`Replaced duplicate "${newTerm}" (this card moved to Deleted)`, "success");
          await loadDeletedCards();
          await loadEditDeckCards(true);
          return;
        }catch(e){
          showEditDecksStatus("Failed to replace duplicate: " + (e.message || e), "error");
          return;
        }
      }
      // else "add": proceed with updating this card normally
    }

    try{
      saveBtn.disabled = true;
      await fetch(`/api/user_cards/${card.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: newTerm, meaning: newMeaning, pron: newPron, group: newGroup, deckId: editDeckModalDeck?.id })
      });
      showEditDecksStatus(`Updated "${newTerm}"`, "success");
      await loadEditDeckCards(true);
      await loadEditedHistory();
    }catch(e){
      showEditDecksStatus("Failed to update card: " + (e.message || e), "error");
      saveBtn.disabled = false;
    }
  });
}

function findDuplicateCardInCache(term, excludeId){
  const t = (term || "").trim().toLowerCase();
  if(!t) return null;
  for(const c of editDeckCardsCache){
    if(excludeId && c.id === excludeId) continue;
    if((c.term || "").trim().toLowerCase() === t && c.status !== "deleted"){
      return c;
    }
  }
  return null;
}

// Bulk: State-only definition transformation
function computeStateOnlyDefinition(def){
  const s = String(def || "").trim();
  if(!s) return s;
  // Look for "capital of X" pattern (handles "The Capital of Texas")
  const m = s.match(/(?:^|\\b)(?:the\\s+)?capital\\s+of\\s+([A-Za-z][A-Za-z .'-]+)/i);
  if(m && m[1]){
    return m[1].trim().replace(/\\.+$/, "").trim();
  }
  // If definition starts with "Capital of X"
  const m2 = s.match(/^\\s*(?:the\\s+)?capital\\s+of\\s+(.+)$/i);
  if(m2 && m2[1]) return m2[1].trim();
  return s;
}

async function openAiTemplateModal(){
  const ids = [...editDeckSelectedIds];
  if(ids.length === 0){
    showEditCardsNotice("Select at least one card first", "error");
    return;
  }
  const modal = $("aiTemplateModal");
  if(!modal){
    showEditCardsNotice("AI template window is missing (page HTML error). Please refresh.", "error");
    return;
  }

  // Reset form each time it opens
  aiTemplateResetForm(ids.length);

  // Show/hide formatting helpers based on deck setting
  try {
    const s = await jget(`/api/decks/${encodeURIComponent(activeDeckId)}/settings`);
    $("aiTemplateFormatHelpers")?.classList.toggle("hidden", !s.aiShowFormatHelpers);
  } catch(e){
    $("aiTemplateFormatHelpers")?.classList.add("hidden");
  }
  aiTemplateBindFormatHelpers();

  modal.classList.remove("hidden");

  // Kick an initial example update (will show placeholder until instruction exists)
  aiTemplateScheduleAutoExample();
}

function aiTemplateGetSelectedFields(){

const sel = $("aiTemplateFieldSelect");
if(sel){
  const v = (sel.value || "meaning").trim();
  if(v === "both") return ["meaning","term"];
  if(v === "term") return ["term"];
  if(v === "pron") return ["pron"];
  if(v === "group") return ["group"];
  return ["meaning"];
}

  const menu = $("aiTemplateFieldsMenu");
  // Backward compat (older HTML)
  const legacy = $("aiTemplateField");
  if(!menu && legacy){
    const f = (legacy.value || "meaning").trim();
    return [f || "meaning"];
  }
  if(!menu) return ["meaning"];

  const checks = [...menu.querySelectorAll('input[type="checkbox"]')];
  let fields = checks.filter(ch => ch.checked).map(ch => (ch.value || "").trim()).filter(Boolean);
  if(!fields.length){
    const def = menu.querySelector('input[value="meaning"]') || checks[0];
    if(def) def.checked = true;
    fields = ["meaning"];
  }
  // de-dupe
  const seen = new Set();
  fields = fields.filter(f => (seen.has(f) ? false : (seen.add(f), true)));
  return fields;
}

function aiTemplateUpdateFieldsBtn(){
  const btn = $("aiTemplateFieldsBtn");
  if(!btn) return aiTemplateGetSelectedFields();
  const fields = aiTemplateGetSelectedFields();
  const labelMap = { meaning:"Definition", term:"Term", pron:"Pronunciation", group:"Group" };
  const labels = fields.map(f => labelMap[f] || f);
  btn.textContent = (labels.length === 1) ? labels[0] : `${labels[0]} (+${labels.length-1})`;
  return fields;
}

function aiTemplateResetForm(selectedCount){
  // Reset instruction
  const instr = $("aiTemplateInstruction");
  if(instr) instr.value = "";
  const sel = $("aiTemplateFieldSelect");
  if(sel) sel.value = "meaning";


  // Reset field selection to Definition only
  const menu = $("aiTemplateFieldsMenu");
  if(menu){
    [...menu.querySelectorAll('input[type="checkbox"]')].forEach(ch => {
      ch.checked = (ch.value === "meaning");
    });
    menu.classList.add("hidden");
  }else if($("aiTemplateField")){
    $("aiTemplateField").value = "meaning";
  }
  aiTemplateUpdateFieldsBtn();

  // Clear example box
  const box = $("aiTemplateExampleBox");
  if(box) box.innerHTML = "";

  const hint = $("aiTemplatePreviewHint");
  if(hint){
    const n = (typeof selectedCount === "number") ? selectedCount : ([...editDeckSelectedIds].length);
    hint.textContent = `Selected ${n} card(s). Type an instruction to see an example. Click Preview All to see the full list.`;
  }

  _aiTemplateLastPreview = null;
}

function closeAiTemplateModal(){
  const modal = $("aiTemplateModal");
  if(modal) modal.classList.add("hidden");
  // Clear inputs whenever the modal is closed (X, Cancel, outside click)
  aiTemplateResetForm([...editDeckSelectedIds].length);
}

let _aiTemplateLastPreview = null;
let _aiTemplateAutoTimer = null;


let __aiTemplateFormatBound = false;
function aiTemplateBindFormatHelpers(){
  if(__aiTemplateFormatBound) return;
  const btn = $("aiTemplateInsertFormatBtn");
  const menu = $("aiTemplateInsertFormatMenu");
  if(!btn || !menu) return;

  __aiTemplateFormatBound = true;

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    menu.classList.toggle("hidden");
  });

  menu.querySelectorAll("button[data-kind]").forEach(b => {
    b.addEventListener("click", () => {
      const kind = b.dataset.kind || "both";
      const ta = $("aiTemplateInstruction");
      if(!ta) return;
      const block = (kind === "term") ? "FORMAT EXAMPLE (TERM):\nTerm: <your term here>\n\n" :
                   (kind === "definition") ? "FORMAT EXAMPLE (DEFINITION):\nDefinition: <your definition here>\n\n" :
                   "FORMAT EXAMPLE (TERM + DEFINITION):\nTerm: <your term here>\nDefinition: <your definition here>\n\n";
      const cur = (ta.value || "");
const curTrim = cur.trim();
// If user hasn't typed anything meaningful yet (or it's only example/format), replace; otherwise append.
const replace = (!curTrim) || curTrim.startsWith("FORMAT EXAMPLE");
if(replace){
  ta.value = block;
} else {
  ta.value = cur + (cur.endsWith("\n") ? "" : "\n") + block;
}
      menu.classList.add("hidden");
      aiTemplateScheduleAutoExample();
      ta.focus();
    });
  });

  document.addEventListener("click", (ev) => {
    if(!menu.classList.contains("hidden")){
      const t = ev.target;
      if(!menu.contains(t) && t !== btn){
        menu.classList.add("hidden");
      }
    }
  });
}

function aiTemplateScheduleAutoExample(){
  if(_aiTemplateAutoTimer) clearTimeout(_aiTemplateAutoTimer);
  _aiTemplateAutoTimer = setTimeout(aiTemplateAutoExample, 500);
}

function _aiFieldLabel(field){
  return (field === "meaning" ? "Definition" : (field === "term" ? "Term" : (field === "pron" ? "Pronunciation" : "Group")));
}

function _groupChangesByCard(res, ids){
  const changes = (res?.changes || []);
  const byId = new Map();
  for(const ch of changes){
    const cid = ch.id;
    if(!byId.has(cid)) byId.set(cid, []);
    byId.get(cid).push(ch);
  }
  // stable order: first selected ids, then remaining
  const ordered = [];
  for(const cid of ids){
    if(byId.has(cid)) ordered.push([cid, byId.get(cid)]);
  }
  for(const [cid, arr] of byId.entries()){
    if(!ids.includes(cid)) ordered.push([cid, arr]);
  }
  return ordered;
}

// Auto example shown inside the AI template window (1 example)
async function aiTemplateAutoExample(){
  const modal = $("aiTemplateModal");
  if(!modal || modal.classList.contains("hidden")) return;

  const ids = [...editDeckSelectedIds];
  const hint = $("aiTemplatePreviewHint");
  const box = $("aiTemplateExampleBox");

  if(!ids.length){
    if(hint) hint.textContent = "Select at least one card first.";
    if(box) box.innerHTML = "";
    return;
  }

  const instruction = ($("aiTemplateInstruction")?.value || "").trim();
  const fields = aiTemplateUpdateFieldsBtn();

  if(!instruction){
    if(hint) hint.textContent = `Selected ${ids.length} card(s). Type an instruction to see an example. Click Preview All to see the full list.`;
    if(box) box.innerHTML = "";
    return;
  }

  try{
    if(hint) hint.textContent = "Generating example...";
    if(box) box.innerHTML = "";

    const res = await jpost("/api/ai_template/preview", {
      deckId: editDeckModalDeck?.id,
      ids,
      fields,
      instruction
    });

    if(res?.error){
      throw new Error(res.error);
    }
    _aiTemplateLastPreview = res;

    const grouped = _groupChangesByCard(res, ids);
    if(!grouped.length){
      if(hint) hint.textContent = "No changes proposed yet (try refining your instruction).";
      return;
    }

    const [cid, arr] = grouped[0];
    const term = (arr[0]?.term || "");
    const lines = arr
      .filter(ch => fields.includes(ch.field))
      .map(ch => {
        const fl = _aiFieldLabel(ch.field);
        return `<div class="beforeAfter">
          <span class="label">${fl}:</span>
          <span class="before">${escapeHtml(ch.before || "")}</span>
          <span class="arrow"> &gt; </span>
          <span class="after">${escapeHtml(ch.after || "")}</span>
        </div>`;
      }).join("");

    const total = (res?.total || ids.length);
    if(hint){
      hint.textContent = `Example (1 card). Click Preview All to see all changes (${total} selected).`;
    }
    if(box){
      box.innerHTML = `
        <div class="previewItem">
          <div class="top">
            <div class="term">${escapeHtml(term)}</div>
          </div>
          ${lines || `<div class="mini muted">No changes for this example card.</div>`}
        </div>
      `;
    }

  }catch(e){
    if(hint) hint.textContent = "Example failed.";
    showEditCardsNotice("AI example failed: " + (e.message || e), "error");
    if(box) box.innerHTML = "";
  }
}

// Preview ALL (opens the preview modal showing proposed changes)
async function aiTemplatePreviewAll(){
  const ids = [...editDeckSelectedIds];
  if(ids.length === 0){
    showEditCardsNotice("Select at least one card first", "error");
    return;
  }
  const instruction = ($("aiTemplateInstruction")?.value || "").trim();
  const fields = aiTemplateUpdateFieldsBtn();
  if(!instruction){
    showEditCardsNotice("Type an instruction for the AI first", "error");
    return;
  }

  try{
    const res = await jpost("/api/ai_template/preview", {
      deckId: editDeckModalDeck?.id,
      ids,
      fields,
      instruction
    });
    if(res?.error) throw new Error(res.error);

    _aiTemplateLastPreview = res;

    const grouped = _groupChangesByCard(res, ids);
    const items = [];

    for(const [cid, arr] of grouped){
      const term = (arr[0]?.term || "");
      const lines = arr
        .filter(ch => fields.includes(ch.field))
        .map(ch => {
          const fl = _aiFieldLabel(ch.field);
          return `<div class="beforeAfter">
            <span class="label">${fl}:</span>
            <span class="before">${escapeHtml(ch.before || "")}</span>
            <span class="arrow"> &gt; </span>
            <span class="after">${escapeHtml(ch.after || "")}</span>
          </div>`;
        }).join("");

      items.push(`
        <div class="previewItem">
          <div class="top">
            <div class="term">${escapeHtml(term)}</div>
          </div>
          ${lines || `<div class="mini muted">No changes</div>`}
        </div>
      `);
    }

    await showPreviewModal(
      "Preview: AI template",
      `Showing proposed changes for ${Math.min(grouped.length, ids.length)} card(s).`,
      items,
      "Close"
    );

  }catch(e){
    showEditCardsNotice("AI preview failed: " + (e.message || e), "error");
  }
}

async function aiTemplateApply(){
  const ids = [...editDeckSelectedIds];
  if(ids.length === 0){
    showEditCardsNotice("Select at least one card first", "error");
    return;
  }
  const instruction = ($("aiTemplateInstruction")?.value || "").trim();
  const fields = aiTemplateUpdateFieldsBtn();
  if(!instruction){
    showEditCardsNotice("Type an instruction for the AI first", "error");
    return;
  }

  if(!confirm(`Apply AI template to ${ids.length} selected card(s)?`)) return;

  try{
    const res = await jpost("/api/ai_template/apply", {
      deckId: editDeckModalDeck?.id,
      ids,
      fields,
      instruction
    });

    if(res?.error){
      throw new Error(res.error);
    }

    const updated = res.updated || 0;
    const skipped = res.skipped || 0;
    const conflicts = res.conflicts || [];

    if(conflicts.length){
      showEditDecksStatus(`Applied to ${updated}. Skipped ${skipped}. Conflicts: ${conflicts.length} (see console)`, "error");
      console.warn("AI template conflicts:", conflicts);
    }else{
      showEditDecksStatus(`Applied AI template to ${updated} card(s)`, "success");
    }

    closeAiTemplateModal();
    await loadEditDeckCards(true);
    await loadEditedHistory();
    refreshCounts();

  }catch(e){
    showEditCardsNotice("AI apply failed: " + (e.message || e), "error");
  }
}

async function bulkDeleteSelected(){
  const ids = [...editDeckSelectedIds];
  if(ids.length === 0){
    showEditCardsNotice("Select at least one card first", "error");
    return;
  }

  const cardsById = new Map(editDeckCardsCache.map(c=>[c.id,c]));
  const targets = ids.map(id => cardsById.get(id)).filter(c => c && c.status !== "deleted");
  if(targets.length === 0){
    showEditDecksStatus("No selectable (non-deleted) cards in selection", "error");
    return;
  }

  const items = targets.slice(0, 250).map(c => `
    <div class="previewItem">
      <div class="top">
        <div class="term">${escapeHtml(c.term || "")}</div>
        <div class="note">will be moved to Deleted</div>
      </div>
      <div class="beforeAfter">
        <div class="before">${escapeHtml(c.meaning || "")}</div>
      </div>
    </div>
  `);

  const ok = await showPreviewModal(
    "Preview: Delete selected",
    `This will mark ${targets.length} card(s) as Deleted (restorable).`,
    items,
    "Delete"
  );
  if(!ok) return;

  try{
    for(const c of targets){
      await jpost("/api/set_status", { id: c.id, status: "deleted" });
    }
    showEditDecksStatus(`Deleted ${targets.length} card(s)`, "success");
    await loadDeletedCards();
    await loadEditDeckCards(true);
    refreshCounts();
  }catch(e){
    showEditDecksStatus("Bulk delete failed: " + (e.message || e), "error");
  }
}

// Edited history (shows under Edit Decks > Deleted tab)
async function loadEditedHistory(){
  try{
    const data = await jget("/api/edit_history");
    renderEditedHistory(Array.isArray(data) ? data : (data.items || []));
  }catch(e){
    // ignore if not available
  }
}

function renderEditedHistory(items){
  const list = $("editedCardsList");
  const countEl = $("editedCount");
  const searchEl = $("editedSearch");
  if(!list) return;

  const q = (searchEl?.value || "").trim().toLowerCase();
  const filtered = q ? items.filter(it => {
    const t = `${it.term_after||""} ${it.meaning_after||""} ${it.term_before||""} ${it.meaning_before||""}`.toLowerCase();
    return t.includes(q);
  }) : items;

  if(countEl) countEl.textContent = `${filtered.length} edited`;

  if(filtered.length === 0){
    list.innerHTML = '<div class="emptyState"><div class="icon">✏️</div>No edited cards</div>';
    return;
  }

  list.innerHTML = "";
  for(const it of filtered){
    const div = document.createElement("div");
    div.className = "editedCardItem";
    const dt = it.ts ? new Date(it.ts * 1000) : null;
    const timeStr = dt ? dt.toLocaleString() : "";
    div.innerHTML = `
      <div class="editedTop">
        <div class="editedTerm">${escapeHtml(it.term_after || it.term_before || "")}</div>
        <div class="editedTopRight">
          <div class="editedTime">${escapeHtml(timeStr)}</div>
          <button class="appBtn secondary small restoreEditBtn" title="Restore this card back to the 'Before' values">Restore</button>
        </div>
      </div>
      <div class="editedDetail">
        <div class="before">Before: ${escapeHtml(it.meaning_before || "")}</div>
        <div>After: ${escapeHtml(it.meaning_after || "")}</div>
      </div>
    `;
    div.querySelector(".restoreEditBtn")?.addEventListener("click", async () => {
      if(!confirm("Restore this card back to the 'Before' values?")) return;
      try{
        await jpost("/api/edit_history/restore", { ts: it.ts, card_id: it.card_id });
        showEditDecksStatus(`Restored "${it.term_before || it.term_after || ""}"`, "success");
        await loadEditedHistory();
        await loadEditDeckCards(true);
        refreshCounts();
      }catch(e){
        showEditDecksStatus("Failed to restore: " + (e.message || e), "error");
      }
    });
    list.appendChild(div);
  }
}

// Sub-tabs inside Deleted tab (Deleted / Edited)
function initDeletedSubTabs(){
  document.querySelectorAll("#editDecksDeletedTab .subTab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#editDecksDeletedTab .subTab").forEach(b => b.classList.remove("active"));
      document.querySelectorAll("#editDecksDeletedTab .subTabBody").forEach(s => s.classList.remove("active"));
      btn.classList.add("active");
      document.querySelector(`#editDecksDeletedTab .subTabBody[data-subtab-body="${btn.dataset.subtab}"]`)?.classList.add("active");
      if(btn.dataset.subtab === "edited"){
        loadEditedHistory();
      }else{
        loadDeletedCards();
      }
    });
  });

  $("editedSearch")?.addEventListener("input", () => loadEditedHistory());
  $("clearEditedHistoryBtn")?.addEventListener("click", async () => {
    if(!confirm("Clear edited cards history?")) return;
    try{
      await jpost("/api/edit_history/clear", {});
      showEditDecksStatus("Cleared edited history", "success");
      loadEditedHistory();
    }catch(e){
      showEditDecksStatus("Failed to clear: " + (e.message || e), "error");
    }
  });


  $("deletedSearch")?.addEventListener("input", () => loadDeletedCards());

  $("clearDeletedAllBtn")?.addEventListener("click", async () => {
    if(!confirm("Permanently clear all deleted cards? (This cannot be undone)")) return;
    try{
      await jpost("/api/deleted/clear_all", {});
      showEditDecksStatus("Cleared deleted cards", "success");
      loadDeletedCards();
      refreshCounts();
    }catch(e){
      showEditDecksStatus("Failed to clear deleted: " + (e.message || e), "error");
    }
  });
}

// DOM bindings for Edit Deck Modal controls
function initEditDeckModalBindings(){
  // Tabs
  document.querySelectorAll("#editDeckModal .modalTab").forEach(b => {
    b.addEventListener("click", () => switchEditDeckModalTab(b.dataset.edittab));
  });

  // Close button in tab row (only visible in Edit Cards)
  $("editCardsCloseTop")?.addEventListener("click", closeEditDeckModal);

  // Edit Cards controls
  $("refreshEditCardsBtn")?.addEventListener("click", () => loadEditDeckCards(true));
  $("editCardsSearch")?.addEventListener("input", renderEditDeckCards);
  $("editCardsSearch")?.addEventListener("input", updateEditCardsSearchClear);
  $("editCardsSearchClear")?.addEventListener("click", () => {
    const input = $("editCardsSearch");
    if(input){ input.value = ""; }
    updateEditCardsSearchClear();
    renderEditDeckCards();
  });
  $("editCardsGroupFilter")?.addEventListener("change", renderEditDeckCards);
  $("editCardsShowDeleted")?.addEventListener("change", renderEditDeckCards);

  $("editCardsSelectAllBtn")?.addEventListener("click", () => {
    const cards = getVisibleEditDeckCards();
    cards.forEach(c => { if(c.status !== "deleted") editDeckSelectedIds.add(c.id); });
    renderEditDeckCards();
  });
  $("editCardsClearSelBtn")?.addEventListener("click", () => {
    editDeckSelectedIds = new Set();
    renderEditDeckCards();
  });

  $("bulkAiTemplateBtn")?.addEventListener("click", openAiTemplateModal);
  $("aiTemplateCancelBtn")?.addEventListener("click", closeAiTemplateModal);

$("aiTemplateCloseX")?.addEventListener("click", closeAiTemplateModal);

// Multi-field dropdown toggle + auto example triggers
$("aiTemplateFieldsBtn")?.addEventListener("click", (e) => {
  e.preventDefault();
  const menu = $("aiTemplateFieldsMenu");
  if(!menu) return;
  menu.classList.toggle("hidden");
});
$("aiTemplateFieldsMenu")?.addEventListener("change", () => {
  aiTemplateUpdateFieldsBtn();
  aiTemplateScheduleAutoExample();
});
$("aiTemplateInstruction")?.addEventListener("input", aiTemplateScheduleAutoExample);

// Click outside the fields menu closes it
document.addEventListener("click", (e) => {
  const menu = $("aiTemplateFieldsMenu");
  const btn = $("aiTemplateFieldsBtn");
  if(!menu || menu.classList.contains("hidden")) return;
  if(e.target === menu || menu.contains(e.target) || e.target === btn || btn.contains(e.target)) return;
  menu.classList.add("hidden");
});
  $("aiTemplatePreviewBtn")?.addEventListener("click", aiTemplatePreviewAll);
  $("aiTemplateApplyBtn")?.addEventListener("click", aiTemplateApply);
  $("aiTemplateModal")?.addEventListener("click", (e) => { if(e.target === $("aiTemplateModal")) closeAiTemplateModal(); });
  $("bulkDeleteBtn")?.addEventListener("click", bulkDeleteSelected);

  // Close modals by clicking overlay background
  $("choiceModal")?.addEventListener("click", (e) => {
    if(e.target === $("choiceModal")) $("choiceModal").classList.add("hidden");
  });
  $("previewModal")?.addEventListener("click", (e) => {
    if(e.target === $("previewModal")) $("previewModal").classList.add("hidden");
  });

  initDeletedSubTabs();
}

// Upload deck logo from Edit Deck modal
async function uploadDeckLogo(){
  const deckId = $("editDeckId").value;
  const fileInput = $("editDeckLogoFile");
  if(!deckId || !fileInput || !fileInput.files || !fileInput.files.length){
    showEditDecksStatus("Please choose an image file to upload", "error");
    return;
  }
  const file = fileInput.files[0];
  try{
    const fd = new FormData();
    fd.append("file", file);
    const resp = await fetch(`/api/decks/${encodeURIComponent(deckId)}/upload_logo`, { method: "POST", body: fd });
    const data = await resp.json().catch(() => ({}));
    if(!resp.ok){
      throw new Error(data.error || "Upload failed");
    }
    showEditDecksStatus("Logo uploaded", "success");
    fileInput.value = "";
    await loadDecks();
    updateHeaderDeckLogo();
  }catch(e){
    showEditDecksStatus("Failed to upload logo: " + (e.message || e), "error");
  }
}

// Clear deck logo (use default)
async function clearDeckLogo(){
  const deckId = $("editDeckId").value;
  if(!deckId){
    return;
  }
  try{
    await jpost(`/api/decks/${deckId}`, { logoPath: null, name: $("editDeckName").value.trim(), description: $("editDeckDescription").value.trim() });
    showEditDecksStatus("Using default logo", "success");
    await loadDecks();
    updateHeaderDeckLogo();
  }catch(e){
    showEditDecksStatus("Failed to clear logo: " + e.message, "error");
  }
}


function closeEditDeckModal(){
  const modal = $("editDeckModal");
  if(modal) modal.classList.add("hidden");
  // Also close nested overlays
  $("aiTemplateModal")?.classList.add("hidden");
  $("choiceModal")?.classList.add("hidden");
  $("previewModal")?.classList.add("hidden");

  // Clear Add Card (AI) inputs on exit
  try{ editBulkClearInputs(); }catch(e){}
  resetEditCardsState();
  document.body.classList.remove("modalLock");
}

// Save deck edits
async function saveEditDeck(){
  const deckId = $("editDeckId").value;
  const name = $("editDeckName").value.trim();
  const description = $("editDeckDescription").value.trim();
  
  if(!name){
    showEditDecksStatus("Deck name is required", "error");
    return;
  }
  
  try {
    await jpost(`/api/decks/${deckId}`, { name, description });
    closeEditDeckModal();
    showEditDecksStatus(`Updated "${name}"`, "success");
    loadDecks();
  } catch(e){
    showEditDecksStatus("Failed to update deck: " + e.message, "error");
  }
}

// Create a new deck
async function createDeck(){
  const name = $("newDeckName").value.trim();
  const description = $("newDeckDescription").value.trim();
  const addMethod = ($("newDeckAddMethod")?.value || "none");
  const logoInput = $("newDeckLogoFile");
  const logoFile = (logoInput && logoInput.files && logoInput.files.length) ? logoInput.files[0] : null;

  if(!name){
    showEditDecksStatus("Please enter a deck name", "error");
    return;
  }

  try {
    const created = await jpost("/api/decks", { name, description });

    // Optional logo upload
    if(logoFile && created && created.id){
      try{
        const fd = new FormData();
        fd.append("file", logoFile);
        await fetch(`/api/decks/${encodeURIComponent(created.id)}/upload_logo`, { method: "POST", body: fd });
      }catch(e){
        console.warn("Deck created but logo upload failed:", e);
      }
    }

    // Reset create form
    $("newDeckName").value = "";
    $("newDeckDescription").value = "";
    if($("newDeckAddMethod")) $("newDeckAddMethod").value = "none";
    if(logoInput) logoInput.value = "";

    showEditDecksStatus(`Created deck "${name}"`, "success");

    // Refresh decks and set the new deck active
    await loadDecks();
    if(created && created.id){
      try{ await switchToDeck(created.id); } catch(e){ activeDeckId = created.id; }
    }

    // Optionally jump into an add-cards method
    if(addMethod !== "none" && created && created.id){
      switchEditDecksTab("generate");
      // Ensure keywords method active by default (it is) - explicitly select
      const clickMethodTab = (m) => document.querySelector(`.genMethodTab[data-method="${m}"]`)?.click();

      if(addMethod === "keywords"){
        clickMethodTab("keywords");
        const kw = [name, description].filter(Boolean).join(" ").trim();
        if($("aiGenKeywords")) $("aiGenKeywords").value = kw;
        if($("aiGenMaxCards")) $("aiGenMaxCards").value = "25";
        // Trigger generate
        $("aiGenSearchBtn")?.click();
      } else if(addMethod === "photo"){
        clickMethodTab("photo");
        // Open file picker
        $("photoUploadZone")?.click();
      } else if(addMethod === "document"){
        clickMethodTab("document");
        $("docUploadZone")?.click();
      }
    }
  } catch(e){
    showEditDecksStatus("Failed to create deck: " + e.message, "error");
  }
}

// Update deck dropdown in Add Cards tab
function updateDeckDropdown(){
  const selects = [$("addCardsDeckSelect"), $("addCardDeck")].filter(Boolean);
  if(selects.length === 0) return;

  for(const select of selects){
    select.innerHTML = "";
    for(const deck of currentDecks){
      const opt = document.createElement("option");
      opt.value = deck.id;
      opt.textContent = deck.name;
      if(deck.id === activeDeckId) opt.selected = true;
      select.appendChild(opt);
    }
  }
}

// Load user cards
async function loadUserCards(){
  try {
    userCards = await jget("/api/user_cards");
    renderUserCards();
  } catch(e){
    console.error("Failed to load user cards:", e);
  }
}

// Render user cards list
function renderUserCards(){
  const list = $("userCardsList");
  if(!list) return;
  
  if(userCards.length === 0){
    list.innerHTML = '<div class="emptyState"><div class="icon">📝</div>No cards added yet</div>';
    return;
  }
  
  list.innerHTML = "";
  for(const card of userCards){
    const div = document.createElement("div");
    div.className = "userCardItem";
    div.innerHTML = `
      <div class="userCardInfo">
        <div class="userCardTerm">${escapeHtml(card.term)}</div>
        <div class="userCardMeaning">${escapeHtml(card.meaning)}</div>
      </div>
      <div class="userCardActions">
        <button class="edit" title="Edit">✏️</button>
        <button class="delete" title="Delete">🗑️</button>
      </div>
    `;
    
    div.querySelector(".edit").addEventListener("click", () => editUserCard(card));
    div.querySelector(".delete").addEventListener("click", () => deleteUserCard(card.id, card.term));
    
    list.appendChild(div);
  }
}

// Toggle user cards visibility
function toggleUserCards(){
  const list = $("userCardsList");
  const btn = $("toggleUserCardsBtn");
  if(list.classList.contains("hidden")){
    list.classList.remove("hidden");
    btn.textContent = "Hide";
  } else {
    list.classList.add("hidden");
    btn.textContent = "Show";
  }
}

// Add a new card
async function addUserCard(){
  const term = $("addCardTerm").value.trim();
  const meaning = $("addCardMeaning").value.trim();
  const pron = $("addCardPron").value.trim();
  const group = $("addCardGroup").value.trim();
  const deckId = ($("addCardsDeckSelect")?.value || $("addCardDeck")?.value || activeDeckId || "kenpo");
  
  if(!term){
    showEditDecksStatus("Please enter a term", "error");
    return;
  }
  if(!meaning){
    showEditDecksStatus("Please enter a definition", "error");
    return;
  }
  
  try {
    await jpost("/api/user_cards", { term, meaning, pron, group, deckId });
    clearAddCardForm();
    showEditDecksStatus(`Added "${term}"`, "success");
    loadUserCards();
    loadDecks(); // Refresh card counts
  } catch(e){
    showEditDecksStatus("Failed to add card: " + e.message, "error");
  }
}

// Clear add card form
function clearAddCardForm(){
  $("addCardTerm").value = "";
  $("addCardMeaning").value = "";
  $("addCardPron").value = "";
  $("addCardGroup").value = "";
  $("aiDefDropdown").classList.add("hidden");
  $("aiGroupDropdown").classList.add("hidden");
}

// Edit user card (simple prompt-based for now)
function editUserCard(card){
  const newTerm = prompt("Edit term:", card.term);
  if(newTerm === null) return;
  
  const newMeaning = prompt("Edit definition:", card.meaning);
  if(newMeaning === null) return;
  
  updateUserCard(card.id, { term: newTerm, meaning: newMeaning });
}

// Update user card
async function updateUserCard(cardId, updates){
  try {
    await fetch(`/api/user_cards/${cardId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
    showEditDecksStatus("Card updated", "success");
    loadUserCards();
  } catch(e){
    showEditDecksStatus("Failed to update card: " + e.message, "error");
  }
}

// Delete user card
async function deleteUserCard(cardId, term){
  if(!confirm(`Delete "${term}"?`)) return;
  
  try {
    await fetch(`/api/user_cards/${cardId}`, { method: "DELETE" });
    showEditDecksStatus(`Deleted "${term}"`, "success");
    loadUserCards();
    loadDecks();
  } catch(e){
    showEditDecksStatus("Failed to delete card: " + e.message, "error");
  }
}

// AI Generate Definition
async function aiGenerateDefinition(){
  const term = $("addCardTerm").value.trim();
  if(!term){
    showEditDecksStatus("Please enter a term first", "error");
    return;
  }
  
  // Get current deck context for better AI results
  const deck = currentDecks.find(d => d.id === activeDeckId);
  const deckName = deck?.name || "General";
  const deckDesc = deck?.description || "";
  
  const dropdown = $("aiDefDropdown");
  const list = $("aiDefList");
  dropdown.classList.remove("hidden");
  list.innerHTML = '<div class="aiLoading">🤖 Generating...</div>';
  
  try {
    const res = await jpost("/api/ai/generate_definition", { term, deckName, deckDescription: deckDesc });
    list.innerHTML = "";
    
    for(const def of (res.definitions || [])){
      const opt = document.createElement("div");
      opt.className = "aiOption";
      opt.textContent = def;
      opt.addEventListener("click", () => {
        $("addCardMeaning").value = def;
        dropdown.classList.add("hidden");
      });
      list.appendChild(opt);
    }
  } catch(e){
    list.innerHTML = `<div class="aiOption" style="color:#f87171">Error: ${e.message}</div>`;
  }
}

// AI Generate Pronunciation
async function aiGeneratePronunciation(){
  const term = $("addCardTerm").value.trim();
  if(!term){
    showEditDecksStatus("Please enter a term first", "error");
    return;
  }
  
  const btn = $("aiGenPronBtn");
  btn.textContent = "...";
  btn.disabled = true;
  
  try {
    const res = await jpost("/api/ai/generate_pronunciation", { term });
    $("addCardPron").value = res.pronunciation || "";
    showEditDecksStatus("Pronunciation generated", "success");
  } catch(e){
    showEditDecksStatus("Failed to generate: " + e.message, "error");
  } finally {
    btn.textContent = "🤖";
    btn.disabled = false;
  }
}

// AI Generate Group
async function aiGenerateGroup(){
  const term = $("addCardTerm").value.trim();
  const meaning = $("addCardMeaning").value.trim();
  if(!term){
    showEditDecksStatus("Please enter a term first", "error");
    return;
  }
  
  const dropdown = $("aiGroupDropdown");
  const list = $("aiGroupList");
  dropdown.classList.remove("hidden");
  list.innerHTML = '<div class="aiLoading">🤖 Generating...</div>';
  
  // Get existing groups from cards
  const existingGroups = [...new Set(allGroups || [])];
  
  try {
    const res = await jpost("/api/ai/generate_group", { term, meaning, existingGroups });
    list.innerHTML = "";
    
    for(const grp of (res.groups || [])){
      const opt = document.createElement("div");
      opt.className = "aiOption";
      opt.textContent = grp;
      opt.addEventListener("click", () => {
        $("addCardGroup").value = grp;
        dropdown.classList.add("hidden");
      });
      list.appendChild(opt);
    }
  } catch(e){
    list.innerHTML = `<div class="aiOption" style="color:#f87171">Error: ${e.message}</div>`;
  }
}

// Load deleted cards
async function loadDeletedCards(){
  try {
    const cards = await jget("/api/cards?status=deleted");
    renderDeletedCards(cards);
  } catch(e){
    console.error("Failed to load deleted cards:", e);
  }
}

// Render deleted cards list
function renderDeletedCards(cards){
  const list = $("deletedCardsList");
  const countEl = $("deletedCount");
  const searchEl = $("deletedSearch");
  
  if(!list) return;
  
  const searchTerm = (searchEl?.value || "").toLowerCase();
  const filtered = searchTerm 
    ? cards.filter(c => c.term.toLowerCase().includes(searchTerm) || c.meaning.toLowerCase().includes(searchTerm))
    : cards;
  
  countEl.textContent = `${filtered.length} deleted`;
  
  if(filtered.length === 0){
    list.innerHTML = '<div class="emptyState"><div class="icon">🗑️</div>No deleted cards</div>';
    return;
  }
  
  list.innerHTML = "";
  for(const card of filtered){
    const div = document.createElement("div");
    div.className = "deletedCardItem";
    div.innerHTML = `
      <div class="deletedCardInfo">
        <div class="deletedCardTerm">${escapeHtml(card.term)}</div>
        <div class="deletedCardMeaning">${escapeHtml(card.meaning)}</div>
      </div>
      <button class="restoreBtn">Restore</button>
    `;
    
    div.querySelector(".restoreBtn").addEventListener("click", async () => {
      try {
        await jpost("/api/set_status", { id: card.id, status: "active" });
        showEditDecksStatus(`Restored "${card.term}"`, "success");
        loadDeletedCards();
        refreshCounts();
      } catch(e){
        showEditDecksStatus("Failed to restore: " + e.message, "error");
      }
    });
    
    list.appendChild(div);
  }
}

// Event bindings for Edit Decks
document.addEventListener("DOMContentLoaded", () => {
  // Init Edit Deck Modal (tabs + edit cards + bulk tools)
  initEditDeckModalBindings();

// Global safety: ESC closes any open modal overlays
document.addEventListener("keydown", (e) => {
  if(e.key !== "Escape") return;
  const ai = $("aiTemplateModal");
  if(ai && !ai.classList.contains("hidden")){
    closeAiTemplateModal();
    return;
  }
  const prev = $("previewModal");
  if(prev && !prev.classList.contains("hidden")){
    const cancelBtn = $("previewCancelBtn");
    if(cancelBtn) cancelBtn.click();
    else prev.classList.add("hidden");
    return;
  }
  const ed = $("editDeckModal");
  if(ed && !ed.classList.contains("hidden")){
    closeEditDecks();
    return;
  }
  const ch = $("choiceModal");
  if(ch && !ch.classList.contains("hidden")){
    ch.classList.add("hidden");
    return;
  }
});


  // Open/Close Edit Decks
  $("openEditDecksBtn")?.addEventListener("click", openEditDecks);
  $("closeEditDecksBtn")?.addEventListener("click", closeEditDecks);
  
  // Tab switching
  document.querySelectorAll(".editDecksTab").forEach(tab => {
    tab.addEventListener("click", () => switchEditDecksTab(tab.dataset.tab));

  // Boot auth + initial data load
  try{
    ensureLoggedIn();
  }catch(e){
    console.error('ensureLoggedIn failed', e);
  }

  });
  
  // Create deck
  $("createDeckBtn")?.addEventListener("click", createDeck);
  
  // Redeem invite code
  $("redeemCodeBtn")?.addEventListener("click", redeemInviteCode);
  
  // Add card
  $("addCardBtn")?.addEventListener("click", addUserCard);
  $("clearAddCardBtn")?.addEventListener("click", clearAddCardForm);
  $("toggleUserCardsBtn")?.addEventListener("click", toggleUserCards);


  // Add Cards sub-tabs (manual vs bulk AI)
  document.querySelectorAll("#addCardsSubTabs .subTabBtn").forEach(btn => {
    btn.addEventListener("click", () => switchAddCardsSubTab(btn.dataset.subtab));
  });

  // Init Bulk Add AI generators
  initBulkAddAiGenerator();
  initEditDeckBulkAiGenerator();
  
  // AI buttons
  $("aiGenDefBtn")?.addEventListener("click", aiGenerateDefinition);
  $("aiGenPronBtn")?.addEventListener("click", aiGeneratePronunciation);
  $("aiGenGroupBtn")?.addEventListener("click", aiGenerateGroup);
  
  // Deleted search
  $("deletedSearch")?.addEventListener("input", () => loadDeletedCards());
  
  // AI Generator bindings
  initAiGenerator();
  
  // Edit Deck Modal - close on outside click
  $("editDeckModal")?.addEventListener("click", (e) => {
    if(e.target.id === "editDeckModal") closeEditDeckModal();
  });
});

// ========== AI DECK GENERATOR ==========
let aiGeneratedCards = [];
let aiSelectedIndices = new Set();
let aiPhotoData = null;
let aiDocData = null;
let _aiGenPreExampleTimer = null;
let _aiGenPreExampleLastSig = "";

// ========== BULK ADD (AI) ==========
let bulkAiGeneratedCards = [];
let bulkAiSelectedIndices = new Set();
let bulkAiPhotoData = null;
let bulkAiDocData = null;
let _bulkAiPreExampleTimer = null;
let _bulkAiPreExampleLastSig = "";

// ========== EDIT DECK MODAL: BULK ADD (AI) ==========
let editBulkAiGeneratedCards = [];
let editBulkAiSelectedIndices = new Set();
let editBulkAiPhotoData = null;
let editBulkAiDocData = null;
let _editBulkAiPreExampleTimer = null;
let _editBulkAiPreExampleLastSig = "";

function getAddCardsTargetDeckId(){
  return ($("addCardsDeckSelect")?.value || activeDeckId || "kenpo");
}

function initBulkAddAiGenerator(){
  // Sub-generator in Decks > Add Cards
  autoGrowTextarea($("bulkAiInstructions"));

  // Method tabs (scoped via unique classes)
  document.querySelectorAll(".bulkGenMethodTab").forEach(tab => {
    tab.addEventListener("click", () => {
      const method = tab.dataset.method;
      document.querySelectorAll(".bulkGenMethodTab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".bulkGenMethodSection").forEach(s => s.classList.add("hidden"));
      tab.classList.add("active");
      document.querySelector(`.bulkGenMethodSection[data-method="${method}"]`)?.classList.remove("hidden");
    });
  });

  $("bulkAiSearchBtn")?.addEventListener("click", bulkAiFromKeywords);
  $("bulkAiPreviewAllBtn")?.addEventListener("click", bulkAiPreviewAll);
  $("bulkAiClearInstructionsBtn")?.addEventListener("click", () => { if($("bulkAiInstructions")){ $("bulkAiInstructions").value=""; autoGrowTextarea($("bulkAiInstructions")); } bulkApplyUiSettings(); });

  $("bulkAiKeywords")?.addEventListener("input", () => { bulkApplyUiSettings(); bulkSchedulePreExample(); });
  $("bulkAiInstructions")?.addEventListener("input", () => { autoGrowTextarea($("bulkAiInstructions")); bulkApplyUiSettings(); bulkSchedulePreExample(); });

  $("bulkAiInsertFormatBtn")?.addEventListener("click", () => {
    $("bulkAiInsertFormatMenu")?.classList.toggle("hidden");
  });
  document.querySelectorAll("#bulkAiInsertFormatMenu .aiGenInsertItem").forEach(item => {
    item.addEventListener("click", () => {
      const which = item.dataset.insert;
      bulkInsertExampleFormat(which);
      $("bulkAiInsertFormatMenu")?.classList.add("hidden");
    });
  });

  // Uploads
  $("bulkPhotoFileInput")?.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if(f) bulkHandlePhotoFile(f);
  });
  $("bulkDocFileInput")?.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if(f) bulkHandleDocFile(f);
  });
  $("bulkAiPhotoBtn")?.addEventListener("click", bulkAiFromPhoto);
  $("bulkAiDocBtn")?.addEventListener("click", bulkAiFromDocument);

  // Results
  $("bulkAiSelectAll")?.addEventListener("change", (e) => {
    if(e.target.checked){
      bulkAiSelectedIndices = new Set(bulkAiGeneratedCards.map((_, i) => i));
    } else {
      bulkAiSelectedIndices.clear();
    }
    bulkRenderResults();
  });
  $("bulkAiClearResultsBtn")?.addEventListener("click", bulkClearResults);
  $("bulkAiAddSelectedBtn")?.addEventListener("click", bulkAddSelectedCards);

  // Initial UI settings
  bulkApplyUiSettings();
}

function initEditDeckBulkAiGenerator(){
  // Generator inside Edit Deck modal (Add Card tab)
  autoGrowTextarea($("editBulkAiInstructions"));

  document.querySelectorAll(".editBulkGenMethodTab").forEach(tab => {
    tab.addEventListener("click", () => {
      const method = tab.dataset.method;
      document.querySelectorAll(".editBulkGenMethodTab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".editBulkGenMethodSection").forEach(s => s.classList.add("hidden"));
      tab.classList.add("active");
      document.querySelector(`.editBulkGenMethodSection[data-method="${method}"]`)?.classList.remove("hidden");
    });
  });

  $("editBulkAiSearchBtn")?.addEventListener("click", editBulkAiFromKeywords);
  $("editBulkAiPreviewAllBtn")?.addEventListener("click", editBulkAiPreviewAll);
  $("editBulkAiClearInstructionsBtn")?.addEventListener("click", () => { if($("editBulkAiInstructions")){ $("editBulkAiInstructions").value=""; autoGrowTextarea($("editBulkAiInstructions")); } editBulkApplyUiSettings(); });

  $("editBulkAiKeywords")?.addEventListener("input", () => { editBulkApplyUiSettings(); editBulkSchedulePreExample(); });
  $("editBulkAiInstructions")?.addEventListener("input", () => { autoGrowTextarea($("editBulkAiInstructions")); editBulkApplyUiSettings(); editBulkSchedulePreExample(); });

  $("editBulkAiInsertFormatBtn")?.addEventListener("click", () => {
    $("editBulkAiInsertFormatMenu")?.classList.toggle("hidden");
  });
  document.querySelectorAll("#editBulkAiInsertFormatMenu .aiGenInsertItem").forEach(item => {
    item.addEventListener("click", () => {
      const which = item.dataset.insert;
      editBulkInsertExampleFormat(which);
      $("editBulkAiInsertFormatMenu")?.classList.add("hidden");
    });
  });

  // Uploads
  $("editBulkPhotoFileInput")?.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if(f) editBulkHandlePhotoFile(f);
  });
  $("editBulkDocFileInput")?.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if(f) editBulkHandleDocFile(f);
  });
  $("editBulkAiPhotoBtn")?.addEventListener("click", editBulkAiFromPhoto);
  $("editBulkAiDocBtn")?.addEventListener("click", editBulkAiFromDocument);

  // Results
  $("editBulkAiSelectAll")?.addEventListener("change", (e) => {
    if(e.target.checked){
      editBulkAiSelectedIndices = new Set(editBulkAiGeneratedCards.map((_, i) => i));
    } else {
      editBulkAiSelectedIndices.clear();
    }
    editBulkRenderResults();
  });
  $("editBulkAiClearResultsBtn")?.addEventListener("click", editBulkClearResults);
  $("editBulkAiAddSelectedBtn")?.addEventListener("click", editBulkAddSelectedCards);

  editBulkApplyUiSettings();
}

function bulkApplyUiSettings(){
  const showHelpers = !!($("deckAiShowFormatHelpers") && $("deckAiShowFormatHelpers").checked);
  $("bulkAiFormatHelpers")?.classList.toggle("hidden", !showHelpers);

  const showExample = !!($("deckAiShowPreExample") && $("deckAiShowPreExample").checked);
  const wrap = $("bulkAiPreExampleWrap");
  if(wrap){
    const shouldShow = showExample && bulkShouldShowPreExample();
    wrap.classList.toggle("hidden", !shouldShow);
  }
}

function bulkShouldShowPreExample(){
  const kw = ($("bulkAiKeywords")?.value || "").trim();
  const instr = ($("bulkAiInstructions")?.value || "").trim();
  return !!(kw || instr);
}

function bulkSchedulePreExample(){
  try{ clearTimeout(_bulkAiPreExampleTimer); }catch(e){}
  _bulkAiPreExampleTimer = setTimeout(bulkUpdatePreExample, 250);
}

async function bulkUpdatePreExample(){
  if(!($("deckAiShowPreExample") && $("deckAiShowPreExample").checked)) return;
  if(!bulkShouldShowPreExample()) return;

  const kw = ($("bulkAiKeywords")?.value || "").trim();
  const instr = ($("bulkAiInstructions")?.value || "").trim();
  const sig = `${kw}||${instr}`;
  if(sig === _bulkAiPreExampleLastSig) return;
  _bulkAiPreExampleLastSig = sig;

  // Use the existing /api/ai/template endpoint if present, else show a simple preview
  const box = $("bulkAiPreExampleBox");
  if(!box) return;
  box.innerHTML = `<div class="mini muted">Term — Definition</div><div>${escapeHtml(kw || "Example Term")} — ${escapeHtml(instr ? "Definition (per your instructions)" : "Example Definition")}</div>`;
}

function bulkInsertExampleFormat(which){
  const ta = $("bulkAiInstructions");
  if(!ta) return;
  const termExample = "Term: {TERM}";
  const defExample  = "Definition: {DEFINITION}";
  if(which === "term") ta.value = (ta.value ? (ta.value+"\n") : "") + termExample;
  if(which === "definition") ta.value = (ta.value ? (ta.value+"\n") : "") + defExample;
  if(which === "both") ta.value = (ta.value ? (ta.value+"\n") : "") + termExample + "\n" + defExample;
  autoGrowTextarea(ta);
  bulkSchedulePreExample();
}

function bulkHandlePhotoFile(file){
  if(!file.type.startsWith("image/")){
    showEditDecksStatus("Please select an image file", "error");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    bulkAiPhotoData = e.target.result;
    showEditDecksStatus("Photo loaded. Ready to generate.", "success");
  };
  reader.readAsDataURL(file);
}

function bulkHandleDocFile(file){
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  const reader = new FileReader();
  reader.onload = (e) => {
    bulkAiDocData = {
      name: file.name,
      type: file.type || (ext === ".pdf" ? "application/pdf" : "text/plain"),
      content: e.target.result
    };
    showEditDecksStatus("Document loaded. Ready to generate.", "success");
  };
  if(file.type === "application/pdf" || ext === ".pdf") reader.readAsDataURL(file);
  else reader.readAsText(file);
}

async function bulkAiFromKeywords(){
  const deckId = getAddCardsTargetDeckId();
  let keywords = ($("bulkAiKeywords")?.value || "").trim();
  const maxCards = parseInt($("bulkAiMaxCards")?.value) || 25;

  if(!keywords){
    const deck = currentDecks.find(d => d.id === deckId);
    if(deck && deck.name){
      keywords = deck.name + (deck.description ? (" " + deck.description) : "");
    } else {
      showEditDecksStatus("Please enter keywords or choose a target deck", "error");
      return;
    }
  }

  let shortAnswers = false;
  let instructions = ($("bulkAiInstructions")?.value || "").trim();
  try{
    const ds = await jget(`/api/decks/${encodeURIComponent(deckId)}/settings`);
    shortAnswers = !!ds.shortAnswers;
  }catch(e){}
  if(instructions) shortAnswers = false;

  await bulkGenerateCards({ type:"keywords", keywords, maxCards, shortAnswers, instructions }, deckId);
}

async function bulkAiFromPhoto(){
  const deckId = getAddCardsTargetDeckId();
  if(!bulkAiPhotoData){
    showEditDecksStatus("Please upload a photo first", "error");
    return;
  }
  const maxCards = parseInt($("bulkAiPhotoMaxCards")?.value) || 25;
  await bulkGenerateCards({ type:"photo", imageData: bulkAiPhotoData, maxCards }, deckId);
}

async function bulkAiFromDocument(){
  const deckId = getAddCardsTargetDeckId();
  if(!bulkAiDocData){
    showEditDecksStatus("Please upload a document first", "error");
    return;
  }
  const maxCards = parseInt($("bulkAiDocMaxCards")?.value) || 25;
  await bulkGenerateCards({ type:"document", document: bulkAiDocData, maxCards }, deckId);
}

async function bulkGenerateCards(params, deckId){
  $("bulkAiLoading")?.classList.remove("hidden");
  $("bulkAiResults")?.classList.add("hidden");

  try{
    const result = await jpost("/api/ai/generate_deck", params);
    if(result.cards && result.cards.length){
      // existing terms in target deck
      const existing = new Set();
      const baseCards = await jget("/api/cards?deck_id=" + encodeURIComponent(deckId)).catch(() => []);
      if(Array.isArray(baseCards)) baseCards.forEach(c => c.term && existing.add(c.term.toLowerCase().trim()));
      const userCards = await jget("/api/user_cards?deck_id=" + encodeURIComponent(deckId)).catch(() => []);
      if(Array.isArray(userCards)) userCards.forEach(c => c.term && existing.add(c.term.toLowerCase().trim()));

      const newCards = result.cards.filter(card => !existing.has((card.term||"").toLowerCase().trim()));
      const filteredCount = result.cards.length - newCards.length;

      if(newCards.length){
        bulkAiGeneratedCards = newCards;
        bulkAiSelectedIndices = new Set(newCards.map((_, i) => i));
        bulkRenderResults();
        $("bulkAiResults")?.classList.remove("hidden");

        let msg = `Generated ${newCards.length} new cards.`;
        if(filteredCount>0) msg += ` (${filteredCount} duplicates filtered out)`;
        showEditDecksStatus(msg, "success");
      } else {
        showEditDecksStatus(`All ${result.cards.length} generated cards already exist in your deck.`, "error");
      }
    } else {
      showEditDecksStatus("AI could not generate cards. Try different input.", "error");
    }
  }catch(e){
    showEditDecksStatus("Error: " + (e.message || "Failed to generate"), "error");
  }

  $("bulkAiLoading")?.classList.add("hidden");
}

function bulkRenderResults(){
  const list = $("bulkAiResultsList");
  if(!list) return;

  list.innerHTML = bulkAiGeneratedCards.map((card, idx) => {
    const selected = bulkAiSelectedIndices.has(idx);
    return `
      <div class="aiGenResultItem ${selected ? "selected" : ""}" data-idx="${idx}">
        <input type="checkbox" ${selected ? "checked" : ""} />
        <div class="aiGenResultInfo">
          <div class="aiGenResultTerm">${escapeHtml(card.term)}</div>
          <div class="aiGenResultDef">${escapeHtml(card.definition)}</div>
          <div class="aiGenResultMeta">
            ${card.group ? `<span class="aiGenResultGroup">${escapeHtml(card.group)}</span>` : ""}
            ${card.pronunciation ? `<span class="aiGenResultPron">${escapeHtml(card.pronunciation)}</span>` : ""}
          </div>
        </div>
      </div>
    `;
  }).join("");

  list.querySelectorAll(".aiGenResultItem").forEach(item => {
    item.addEventListener("click", (e) => {
      if(e.target.type === "checkbox") return;
      const idx = parseInt(item.dataset.idx);
      bulkToggleSelection(idx);
    });
    item.querySelector("input")?.addEventListener("change", () => {
      const idx = parseInt(item.dataset.idx);
      bulkToggleSelection(idx);
    });
  });

  // keep select-all checkbox in sync
  const selAll = $("bulkAiSelectAll");
  if(selAll){
    selAll.checked = (bulkAiGeneratedCards.length>0 && bulkAiSelectedIndices.size === bulkAiGeneratedCards.length);
  }
}

function bulkToggleSelection(idx){
  if(bulkAiSelectedIndices.has(idx)) bulkAiSelectedIndices.delete(idx);
  else bulkAiSelectedIndices.add(idx);
  bulkRenderResults();
}

function bulkClearResults(){
  bulkAiGeneratedCards = [];
  bulkAiSelectedIndices.clear();
  $("bulkAiResults")?.classList.add("hidden");
  const selAll = $("bulkAiSelectAll");
  if(selAll) selAll.checked = true;
}

function bulkAiPreviewAll(){
  const results = $("bulkAiResults");
  if(results && !results.classList.contains("hidden")){
    results.scrollIntoView({behavior:"smooth", block:"start"});
  }
}

async function bulkAddSelectedCards(){
  if(bulkAiSelectedIndices.size === 0){
    showEditDecksStatus("Please select at least one card to add", "error");
    return;
  }
  const deckId = getAddCardsTargetDeckId();
  const deck = currentDecks.find(d => d.id === deckId);
  const deckName = deck ? deck.name : "the deck";
  const cardsToAdd = Array.from(bulkAiSelectedIndices).map(i => bulkAiGeneratedCards[i]);

  let added = 0, failed = 0;
  for(const card of cardsToAdd){
    try{
      await jpost("/api/user_cards", {
        term: card.term,
        meaning: card.definition,
        pron: card.pronunciation || "",
        group: card.group || "",
        deckId
      });
      added++;
    }catch(e){
      console.error("Failed to add card:", e);
      failed++;
    }
  }

  if(added>0){
    showEditDecksStatus(`Added ${added} cards to ${deckName}${failed>0 ? ` (${failed} failed)` : ""}`, "success");
    bulkClearResults();
    // refresh
    loadUserCards();
    loadDecks();
    await refreshCounts();
    if(deckId === activeDeckId) await loadDeckForStudy();
  } else {
    showEditDecksStatus("Failed to add cards", "error");
  }
}

// -------------------- Edit Deck modal bulk add --------------------

function getEditDeckTargetDeckId(){
  return ($("editDeckId")?.value || editDeckModalDeck?.id || activeDeckId || "kenpo");
}

function editBulkApplyUiSettings(){
  const showHelpers = !!($("deckAiShowFormatHelpers") && $("deckAiShowFormatHelpers").checked);
  $("editBulkAiFormatHelpers")?.classList.toggle("hidden", !showHelpers);

  const showExample = !!($("deckAiShowPreExample") && $("deckAiShowPreExample").checked);
  const wrap = $("editBulkAiPreExampleWrap");
  if(wrap){
    const shouldShow = showExample && editBulkShouldShowPreExample();
    wrap.classList.toggle("hidden", !shouldShow);
  }
}

function editBulkShouldShowPreExample(){
  const kw = ($("editBulkAiKeywords")?.value || "").trim();
  const instr = ($("editBulkAiInstructions")?.value || "").trim();
  return !!(kw || instr);
}

function editBulkSchedulePreExample(){
  try{ clearTimeout(_editBulkAiPreExampleTimer); }catch(e){}
  // Match Create Deck AI generator pacing (reduces API spam while typing)
  _editBulkAiPreExampleTimer = setTimeout(editBulkUpdatePreExample, 650);
}

async function editBulkUpdatePreExample(){
  const box  = $("editBulkAiPreExampleBox");
  const wrap = $("editBulkAiPreExampleWrap");
  const hint = $("editBulkAiPreExampleHint");
  if(!box || !wrap) return;

  // If hidden, clear and stop.
  if(wrap.classList.contains("hidden")){
    box.innerHTML = "";
    if(hint) hint.textContent = "Example output (updates as you type):";
    return;
  }

  const kw   = ($("editBulkAiKeywords")?.value || "").trim();
  const instr= ($("editBulkAiInstructions")?.value || "").trim();
  const deckName = (editDeckModalDeck?.name || "").trim();
  const deckDesc = (editDeckModalDeck?.description || "").trim();

  // Only show preview when there is something to base it on.
  if(!(kw || instr || deckName || deckDesc)){
    box.innerHTML = "";
    if(hint) hint.textContent = "Example output (updates as you type):";
    return;
  }

  const cbShort = $("deckShortAnswers");
  const shortOn = !!(cbShort && cbShort.checked);
  const sig = JSON.stringify({ kw, instr, deckName, deckDesc, shortOn });

  // Avoid re-requesting the same preview repeatedly.
  if(sig === _editBulkAiPreExampleLastSig && box.innerHTML.trim()){
    return;
  }
  _editBulkAiPreExampleLastSig = sig;

  if(hint) hint.textContent = "Generating example...";
  box.innerHTML = "";

  // Use the same preview endpoint + rendering style as Create Deck AI Generator.
  try{
    const res = await jpost("/api/ai/generate_deck_preview", {
      type: "keywords",
      keywords: kw || deckName || "Example",
      instructions: instr,
      shortAnswers: shortOn,
      deckName,
      deckDescription: deckDesc
    });

    if(res?.error){
      throw new Error(res.error);
    }

    const c = res?.card || {};
    const term = (c.term || kw.split(",")[0] || deckName || "Example Term").trim();
    const def  = (c.definition || "").trim() || "Example definition";
    const pron = (c.pronunciation || "").trim();
    const grp  = (c.group || "").trim();

    const extraBits = [
      pron ? `<div class="mini muted">Pronunciation: ${escapeHtml(pron)}</div>` : "",
      grp  ? `<div class="mini muted">Group: ${escapeHtml(grp)}</div>` : ""
    ].join("");

    if(hint) hint.textContent = "Example output (updates as you type):";
    box.innerHTML = `
      <div class="previewItem">
        <div class="top">
          <div class="term">${escapeHtml(term)}</div>
        </div>
        <div class="mini muted">Definition: ${escapeHtml(def)}</div>
        ${extraBits}
      </div>
    `;
    return;

  }catch(e){
    // Graceful fallback (no AI / error)
    try{ console.warn("Edit Deck Bulk Add preview failed:", e); }catch(_){}
    if(hint) hint.textContent = "Example output (updates as you type):";
    box.innerHTML = `<div class="mini muted">Term — Definition</div><div>${escapeHtml(kw || "Example Term")} — ${escapeHtml(instr ? "Definition (per your instructions)" : "Example Definition")}</div>`;
  }
}

// Clear Edit Deck modal Bulk Add (AI) inputs + preview + results
function editBulkClearInputs(){
  try{
    const kw = $("editBulkAiKeywords");
    if(kw) kw.value = "";
    const max = $("editBulkAiMaxCards");
    if(max){
      // Reset to default shown in UI
      max.value = 50;
    }
    const ta = $("editBulkAiInstructions");
    if(ta){
      ta.value = "";
      autoGrowTextarea(ta);
    }

    // Clear uploads
    editBulkAiPhotoData = null;
    editBulkAiDocData = null;
    const p = $("editBulkPhotoFileInput");
    if(p) p.value = "";
    const d = $("editBulkDocFileInput");
    if(d) d.value = "";

    // Close helper menu
    $("editBulkAiInsertFormatMenu")?.classList.add("hidden");

    // Clear preview box + hide wrap
    _editBulkAiPreExampleLastSig = "";
    const wrap = $("editBulkAiPreExampleWrap");
    if(wrap) wrap.classList.add("hidden");
    const box = $("editBulkAiPreExampleBox");
    if(box) box.innerHTML = "";
    const hint = $("editBulkAiPreExampleHint");
    if(hint) hint.textContent = "Example output (updates as you type):";

    // Clear results
    try{ editBulkClearResults(); }catch(e){}
    try{ editBulkApplyUiSettings(); }catch(e){}
  }catch(e){}
}

function editBulkInsertExampleFormat(which){
  const ta = $("editBulkAiInstructions");
  if(!ta) return;
  const termExample = "Term: {TERM}";
  const defExample  = "Definition: {DEFINITION}";
  if(which === "term") ta.value = (ta.value ? (ta.value+"\n") : "") + termExample;
  if(which === "definition") ta.value = (ta.value ? (ta.value+"\n") : "") + defExample;
  if(which === "both") ta.value = (ta.value ? (ta.value+"\n") : "") + termExample + "\n" + defExample;
  autoGrowTextarea(ta);
  editBulkSchedulePreExample();
}

function editBulkHandlePhotoFile(file){
  if(!file.type.startsWith("image/")){
    showEditDecksStatus("Please select an image file", "error");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    editBulkAiPhotoData = e.target.result;
    showEditDecksStatus("Photo loaded. Ready to generate.", "success");
  };
  reader.readAsDataURL(file);
}

function editBulkHandleDocFile(file){
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  const reader = new FileReader();
  reader.onload = (e) => {
    editBulkAiDocData = {
      name: file.name,
      type: file.type || (ext === ".pdf" ? "application/pdf" : "text/plain"),
      content: e.target.result
    };
    showEditDecksStatus("Document loaded. Ready to generate.", "success");
  };
  if(file.type === "application/pdf" || ext === ".pdf") reader.readAsDataURL(file);
  else reader.readAsText(file);
}

async function editBulkAiFromKeywords(){
  const deckId = getEditDeckTargetDeckId();
  let keywords = ($("editBulkAiKeywords")?.value || "").trim();
  const maxCards = parseInt($("editBulkAiMaxCards")?.value) || 25;

  if(!keywords){
    const deck = currentDecks.find(d => d.id === deckId);
    if(deck && deck.name){
      keywords = deck.name + (deck.description ? (" " + deck.description) : "");
    } else {
      showEditDecksStatus("Please enter keywords", "error");
      return;
    }
  }

  let shortAnswers = false;
  let instructions = ($("editBulkAiInstructions")?.value || "").trim();
  try{
    const ds = await jget(`/api/decks/${encodeURIComponent(deckId)}/settings`);
    shortAnswers = !!ds.shortAnswers;
  }catch(e){}
  if(instructions) shortAnswers = false;

  await editBulkGenerateCards({ type:"keywords", keywords, maxCards, shortAnswers, instructions }, deckId);
}

async function editBulkAiFromPhoto(){
  const deckId = getEditDeckTargetDeckId();
  if(!editBulkAiPhotoData){
    showEditDecksStatus("Please upload a photo first", "error");
    return;
  }
  const maxCards = parseInt($("editBulkAiPhotoMaxCards")?.value) || 25;
  await editBulkGenerateCards({ type:"photo", imageData: editBulkAiPhotoData, maxCards }, deckId);
}

async function editBulkAiFromDocument(){
  const deckId = getEditDeckTargetDeckId();
  if(!editBulkAiDocData){
    showEditDecksStatus("Please upload a document first", "error");
    return;
  }
  const maxCards = parseInt($("editBulkAiDocMaxCards")?.value) || 25;
  await editBulkGenerateCards({ type:"document", document: editBulkAiDocData, maxCards }, deckId);
}

async function editBulkGenerateCards(params, deckId){
  $("editBulkAiLoading")?.classList.remove("hidden");
  $("editBulkAiResults")?.classList.add("hidden");

  try{
    const result = await jpost("/api/ai/generate_deck", params);
    if(result.cards && result.cards.length){
      const existing = new Set();
      const baseCards = await jget("/api/cards?deck_id=" + encodeURIComponent(deckId)).catch(() => []);
      if(Array.isArray(baseCards)) baseCards.forEach(c => c.term && existing.add(c.term.toLowerCase().trim()));
      const userCards = await jget("/api/user_cards?deck_id=" + encodeURIComponent(deckId)).catch(() => []);
      if(Array.isArray(userCards)) userCards.forEach(c => c.term && existing.add(c.term.toLowerCase().trim()));

      const newCards = result.cards.filter(card => !existing.has((card.term||"").toLowerCase().trim()));
      const filteredCount = result.cards.length - newCards.length;

      if(newCards.length){
        editBulkAiGeneratedCards = newCards;
        editBulkAiSelectedIndices = new Set(newCards.map((_, i) => i));
        editBulkRenderResults();
        $("editBulkAiResults")?.classList.remove("hidden");

        let msg = `Generated ${newCards.length} new cards.`;
        if(filteredCount>0) msg += ` (${filteredCount} duplicates filtered out)`;
        showEditDecksStatus(msg, "success");
      } else {
        showEditDecksStatus(`All ${result.cards.length} generated cards already exist in your deck.`, "error");
      }
    } else {
      showEditDecksStatus("AI could not generate cards. Try different input.", "error");
    }
  }catch(e){
    showEditDecksStatus("Error: " + (e.message || "Failed to generate"), "error");
  }

  $("editBulkAiLoading")?.classList.add("hidden");
}

function editBulkRenderResults(){
  const list = $("editBulkAiResultsList");
  if(!list) return;

  list.innerHTML = editBulkAiGeneratedCards.map((card, idx) => {
    const selected = editBulkAiSelectedIndices.has(idx);
    return `
      <div class="aiGenResultItem ${selected ? "selected" : ""}" data-idx="${idx}">
        <input type="checkbox" ${selected ? "checked" : ""} />
        <div class="aiGenResultInfo">
          <div class="aiGenResultTerm">${escapeHtml(card.term)}</div>
          <div class="aiGenResultDef">${escapeHtml(card.definition)}</div>
          <div class="aiGenResultMeta">
            ${card.group ? `<span class="aiGenResultGroup">${escapeHtml(card.group)}</span>` : ""}
            ${card.pronunciation ? `<span class="aiGenResultPron">${escapeHtml(card.pronunciation)}</span>` : ""}
          </div>
        </div>
      </div>
    `;
  }).join("");

  list.querySelectorAll(".aiGenResultItem").forEach(item => {
    item.addEventListener("click", (e) => {
      if(e.target.type === "checkbox") return;
      const idx = parseInt(item.dataset.idx);
      editBulkToggleSelection(idx);
    });
    item.querySelector("input")?.addEventListener("change", () => {
      const idx = parseInt(item.dataset.idx);
      editBulkToggleSelection(idx);
    });
  });

  const selAll = $("editBulkAiSelectAll");
  if(selAll){
    selAll.checked = (editBulkAiGeneratedCards.length>0 && editBulkAiSelectedIndices.size === editBulkAiGeneratedCards.length);
  }
}

function editBulkToggleSelection(idx){
  if(editBulkAiSelectedIndices.has(idx)) editBulkAiSelectedIndices.delete(idx);
  else editBulkAiSelectedIndices.add(idx);
  editBulkRenderResults();
}

function editBulkClearResults(){
  editBulkAiGeneratedCards = [];
  editBulkAiSelectedIndices.clear();
  $("editBulkAiResults")?.classList.add("hidden");
  const selAll = $("editBulkAiSelectAll");
  if(selAll) selAll.checked = true;
}

function editBulkAiPreviewAll(){
  const results = $("editBulkAiResults");
  if(results && !results.classList.contains("hidden")){
    results.scrollIntoView({behavior:"smooth", block:"start"});
  }
}

async function editBulkAddSelectedCards(){
  if(editBulkAiSelectedIndices.size === 0){
    showEditDecksStatus("Please select at least one card to add", "error");
    return;
  }
  const deckId = getEditDeckTargetDeckId();
  const deck = currentDecks.find(d => d.id === deckId);
  const deckName = deck ? deck.name : "the deck";
  const cardsToAdd = Array.from(editBulkAiSelectedIndices).map(i => editBulkAiGeneratedCards[i]);

  let added = 0, failed = 0;
  for(const card of cardsToAdd){
    try{
      await jpost("/api/user_cards", {
        term: card.term,
        meaning: card.definition,
        pron: card.pronunciation || "",
        group: card.group || "",
        deckId
      });
      added++;
    }catch(e){
      console.error("Failed to add card:", e);
      failed++;
    }
  }

  if(added>0){
    showEditDecksStatus(`Added ${added} cards to ${deckName}${failed>0 ? ` (${failed} failed)` : ""}`, "success");
    editBulkClearResults();
    // refresh
    loadUserCards();
    loadDecks();
    await refreshCounts();
    if(deckId === activeDeckId) await loadDeckForStudy();
  } else {
    showEditDecksStatus("Failed to add cards", "error");
  }
}



function aiGenClearInputs(options = {}){
  const { clearKeywords=false, clearMax=false, clearInstructions=true } = options;
  if(clearKeywords && $("aiGenKeywords")) $("aiGenKeywords").value = "";
  if(clearMax && $("aiGenMaxCards")) $("aiGenMaxCards").value = "25";
  if(clearInstructions && $("aiGenInstructions")) { $("aiGenInstructions").value = ""; autoGrowTextarea($("aiGenInstructions")); }
  // close menu + clear preview box
  $("aiGenInsertFormatMenu")?.classList.add("hidden");
  const box = $("aiGenPreExampleBox");
  if(box) box.innerHTML = "";
  const hint = $("aiGenPreExampleHint");
  if(hint) hint.textContent = "Example output (updates as you type):";
  // also clear any generated results UI selection (keep results if user wants)
  applyAiGeneratorUiSettings();
  try{ bulkApplyUiSettings(); }catch(e){}
  try{ editBulkApplyUiSettings(); }catch(e){}
}

function aiGenGoToSwitch(){
  // Clear instructions when leaving generator
  aiGenClearInputs({clearKeywords:true, clearMax:true, clearInstructions:true});
  // Navigate back to "switch" tab in Edit Decks
  try { switchEditDecksTab("switch"); } catch(e){ /* ignore */ }
}

function aiGenPreviewAll(){
  // If we already have results, just reveal/scroll.
  const results = $("aiGenResults");
  if(results && !results.classList.contains("hidden")){
    results.scrollIntoView({behavior:"smooth", block:"start"});
    return;
  }
  // Otherwise run generate, then scroll to results when it appears.
  aiGenFromKeywords().then(() => {
    const r = $("aiGenResults");
    if(r && !r.classList.contains("hidden")){
      r.scrollIntoView({behavior:"smooth", block:"start"});
    }
  }).catch(()=>{});
}
function initAiGenerator(){
  autoGrowTextarea($("aiGenInstructions"));
  // Method tabs
  document.querySelectorAll(".genMethodTab").forEach(tab => {
    tab.addEventListener("click", () => {
      const method = tab.dataset.method;
      document.querySelectorAll(".genMethodTab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".genMethodSection").forEach(s => s.classList.add("hidden"));
      tab.classList.add("active");
      document.querySelector(`.genMethodSection[data-method="${method}"]`)?.classList.remove("hidden");
    });
  });
  
  // Keywords search
  $("aiGenSearchBtn")?.addEventListener("click", aiGenFromKeywords);
  $("aiGenCancelBtn")?.addEventListener("click", aiGenGoToSwitch);
  $("aiGenPreviewAllBtn")?.addEventListener("click", aiGenPreviewAll);
  $("aiGenClearInstructionsBtn")?.addEventListener("click", () => aiGenClearInputs({clearInstructions:true}));
  // Live example preview (before generating)
  $("aiGenKeywords")?.addEventListener("input", () => { applyAiGeneratorUiSettings(); aiGenSchedulePreExample(); });
  $("aiGenInstructions")?.addEventListener("input", () => { autoGrowTextarea($("aiGenInstructions")); applyAiGeneratorUiSettings(); aiGenSchedulePreExample(); });

  // Format helper dropdown (optional)
  const fmtBtn = $("aiGenInsertFormatBtn");
  const fmtMenu = $("aiGenInsertFormatMenu");
  if(fmtBtn && fmtMenu){
    fmtBtn.addEventListener("click", (e) => {
      e.preventDefault();
      fmtMenu.classList.toggle("hidden");
    });
    fmtMenu.querySelectorAll("button[data-kind]").forEach(b => {
      b.addEventListener("click", () => {
        const kind = b.dataset.kind || "both";
        const ta = $("aiGenInstructions");
        if(!ta) return;
        const block = (kind === "term") ? `FORMAT EXAMPLE (TERM):
Term: <your term here>` :
                      (kind === "definition") ? `FORMAT EXAMPLE (DEFINITION):
Definition: <your definition here>` :
                      `FORMAT EXAMPLE (TERM + DEFINITION):
Term: <your term here>
Definition: <your definition here>`;
        ta.value = block;
        autoGrowTextarea(ta);
        fmtMenu.classList.add("hidden");
        applyAiGeneratorUiSettings();
        ta.focus();
      });
    });
    // click outside to close
    document.addEventListener("click", (ev) => {
      if(!fmtMenu.classList.contains("hidden")){
        const t = ev.target;
        if(!fmtMenu.contains(t) && t !== fmtBtn){
          fmtMenu.classList.add("hidden");
        }
      }
    });
  }
  
  // Photo upload
  const photoZone = $("photoUploadZone");
  const photoInput = $("photoFileInput");
  if(photoZone && photoInput){
    photoZone.addEventListener("click", () => photoInput.click());
    photoZone.addEventListener("dragover", (e) => { e.preventDefault(); photoZone.classList.add("dragover"); });
    photoZone.addEventListener("dragleave", () => photoZone.classList.remove("dragover"));
    photoZone.addEventListener("drop", (e) => {
      e.preventDefault();
      photoZone.classList.remove("dragover");
      if(e.dataTransfer.files.length) handlePhotoFile(e.dataTransfer.files[0]);
    });
    photoInput.addEventListener("change", (e) => {
      if(e.target.files.length) handlePhotoFile(e.target.files[0]);
    });
  }
  $("clearPhotoBtn")?.addEventListener("click", clearPhotoUpload);
  $("aiGenPhotoBtn")?.addEventListener("click", aiGenFromPhoto);
  
  // Document upload
  const docZone = $("docUploadZone");
  const docInput = $("docFileInput");
  if(docZone && docInput){
    docZone.addEventListener("click", () => docInput.click());
    docZone.addEventListener("dragover", (e) => { e.preventDefault(); docZone.classList.add("dragover"); });
    docZone.addEventListener("dragleave", () => docZone.classList.remove("dragover"));
    docZone.addEventListener("drop", (e) => {
      e.preventDefault();
      docZone.classList.remove("dragover");
      if(e.dataTransfer.files.length) handleDocFile(e.dataTransfer.files[0]);
    });
    docInput.addEventListener("change", (e) => {
      if(e.target.files.length) handleDocFile(e.target.files[0]);
    });
  }
  $("clearDocBtn")?.addEventListener("click", clearDocUpload);
  $("aiGenDocBtn")?.addEventListener("click", aiGenFromDocument);
  
  // Result actions
  $("aiGenSelectAll")?.addEventListener("click", () => {
    aiSelectedIndices = new Set(aiGeneratedCards.map((_, i) => i));
    renderAiGenResults();
  });
  $("aiGenSelectNone")?.addEventListener("click", () => {
    aiSelectedIndices.clear();
    renderAiGenResults();
  });
  $("aiGenAddSelectedBtn")?.addEventListener("click", addSelectedAiCards);
  
  // Check AI availability
  checkAiAvailability();
}

async function checkAiAvailability(){
  try {
    const status = await jget("/api/ai/status");
    const available = status.openai_available || status.gemini_available;
    $("aiGenWarning")?.classList.toggle("hidden", available);
    $("aiGenSearchBtn")?.toggleAttribute("disabled", !available);
  } catch(e){
    $("aiGenWarning")?.classList.remove("hidden");
  }
}

function handlePhotoFile(file){
  if(!file.type.startsWith("image/")){
    showEditDecksStatus("Please select an image file", "error");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    aiPhotoData = e.target.result;
    $("photoPreviewImg").src = aiPhotoData;
    $("photoPreview")?.classList.remove("hidden");
    $("photoUploadZone")?.classList.add("hidden");
    $("aiGenPhotoBtn")?.removeAttribute("disabled");
  };
  reader.readAsDataURL(file);
}

function clearPhotoUpload(){
  aiPhotoData = null;
  $("photoPreview")?.classList.add("hidden");
  $("photoUploadZone")?.classList.remove("hidden");
  $("aiGenPhotoBtn")?.setAttribute("disabled", "");
  $("photoFileInput").value = "";
}

function handleDocFile(file){
  const validTypes = ["application/pdf", "text/plain", "text/markdown"];
  const validExts = [".pdf", ".txt", ".md", ".text"];
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  
  if(!validTypes.includes(file.type) && !validExts.includes(ext)){
    showEditDecksStatus("Please select a PDF or text file", "error");
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    aiDocData = {
      name: file.name,
      type: file.type || (ext === ".pdf" ? "application/pdf" : "text/plain"),
      content: e.target.result
    };
    $("docFileName").textContent = file.name;
    $("docPreview")?.classList.remove("hidden");
    $("docUploadZone")?.classList.add("hidden");
    $("aiGenDocBtn")?.removeAttribute("disabled");
  };
  
  if(file.type === "application/pdf" || ext === ".pdf"){
    reader.readAsDataURL(file);
  } else {
    reader.readAsText(file);
  }
}

function clearDocUpload(){
  aiDocData = null;
  $("docPreview")?.classList.add("hidden");
  $("docUploadZone")?.classList.remove("hidden");
  $("aiGenDocBtn")?.setAttribute("disabled", "");
  $("docFileInput").value = "";
}

async function aiGenFromKeywords(){
  let keywords = $("aiGenKeywords")?.value.trim();
  const maxCards = parseInt($("aiGenMaxCards")?.value) || 20;
  
  // If no keywords, use current deck name and description
  if(!keywords){
    const deck = currentDecks.find(d => d.id === activeDeckId);
    if(deck && deck.name && deck.name !== "Kenpo Vocabulary"){
      keywords = deck.name;
      if(deck.description) keywords += " " + deck.description;
    } else {
      showEditDecksStatus("Please enter search keywords or create a deck with a descriptive name", "error");
      return;
    }
  }
  
  // Deck AI settings (short answers + user instructions override)
  let shortAnswers = false;
  let instructions = ($("aiGenInstructions")?.value || "").trim();

  try {
    const ds = await jget(`/api/decks/${encodeURIComponent(activeDeckId)}/settings`);
    shortAnswers = !!ds.shortAnswers;
  } catch(e){}

  // If user typed instructions, they override short-answers mode
  if(instructions){
    shortAnswers = false;
  }

  await generateCards({ type: "keywords", keywords, maxCards, shortAnswers, instructions });
}

async function aiGenFromPhoto(){
  if(!aiPhotoData){
    showEditDecksStatus("Please upload an image first", "error");
    return;
  }
  const maxCards = parseInt($("aiGenPhotoMaxCards")?.value) || 20;
  await generateCards({ type: "photo", imageData: aiPhotoData, maxCards });
}

async function aiGenFromDocument(){
  if(!aiDocData){
    showEditDecksStatus("Please upload a document first", "error");
    return;
  }
  const maxCards = parseInt($("aiGenDocMaxCards")?.value) || 20;
  await generateCards({ type: "document", document: aiDocData, maxCards });
}

async function generateCards(params){
  $("aiGenLoading")?.classList.remove("hidden");
  $("aiGenResults")?.classList.add("hidden");
  
  try {
    const result = await jpost("/api/ai/generate_deck", params);
    
    if(result.cards && result.cards.length > 0){
      // Get existing terms to filter out duplicates
      const existingTerms = new Set();
      
      // Add terms from main cards
      if(window.allCards){
        window.allCards.forEach(c => {
          if(c.term) existingTerms.add(c.term.toLowerCase().trim());
        });
      }
      
      // Add terms from user cards
      const userCardsData = await jget("/api/user_cards?deck_id=" + activeDeckId).catch(() => []);
      if(Array.isArray(userCardsData)){
        userCardsData.forEach(c => {
          if(c.term) existingTerms.add(c.term.toLowerCase().trim());
        });
      }
      
      // Filter out cards that already exist
      const newCards = result.cards.filter(card => {
        const termLower = card.term.toLowerCase().trim();
        return !existingTerms.has(termLower);
      });
      
      const filteredCount = result.cards.length - newCards.length;
      
      if(newCards.length > 0){
        aiGeneratedCards = newCards;
        aiSelectedIndices = new Set(newCards.map((_, i) => i)); // Select all by default
        renderAiGenResults();
        $("aiGenResults")?.classList.remove("hidden");
        
        let msg = `Generated ${newCards.length} new cards.`;
        if(filteredCount > 0){
          msg += ` (${filteredCount} duplicates filtered out)`;
        }
        showEditDecksStatus(msg, "success");
      } else {
        showEditDecksStatus(`All ${result.cards.length} generated cards already exist in your deck.`, "error");
      }
    } else {
      showEditDecksStatus("AI could not generate cards. Try different input.", "error");
    }
  } catch(e){
    showEditDecksStatus("Error: " + (e.message || "Failed to generate"), "error");
  }
  
  $("aiGenLoading")?.classList.add("hidden");
}

function renderAiGenResults(){
  const list = $("aiGenResultsList");
  if(!list) return;
  
  list.innerHTML = aiGeneratedCards.map((card, idx) => {
    const selected = aiSelectedIndices.has(idx);
    return `
      <div class="aiGenResultItem ${selected ? "selected" : ""}" data-idx="${idx}">
        <input type="checkbox" ${selected ? "checked" : ""} />
        <div class="aiGenResultInfo">
          <div class="aiGenResultTerm">${escapeHtml(card.term)}</div>
          <div class="aiGenResultDef">${escapeHtml(card.definition)}</div>
          <div class="aiGenResultMeta">
            ${card.group ? `<span class="aiGenResultGroup">${escapeHtml(card.group)}</span>` : ""}
            ${card.pronunciation ? `<span class="aiGenResultPron">${escapeHtml(card.pronunciation)}</span>` : ""}
          </div>
        </div>
      </div>
    `;
  }).join("");
  
  // Add click handlers
  list.querySelectorAll(".aiGenResultItem").forEach(item => {
    item.addEventListener("click", (e) => {
      if(e.target.type === "checkbox") return;
      const idx = parseInt(item.dataset.idx);
      toggleAiCardSelection(idx);
    });
    item.querySelector("input")?.addEventListener("change", (e) => {
      const idx = parseInt(item.dataset.idx);
      toggleAiCardSelection(idx);
    });
  });
  
  updateAiGenCount();
}

function toggleAiCardSelection(idx){
  if(aiSelectedIndices.has(idx)){
    aiSelectedIndices.delete(idx);
  } else {
    aiSelectedIndices.add(idx);
  }
  renderAiGenResults();
}

function updateAiGenCount(){
  const count = $("aiGenResultsCount");
  if(count){
    count.textContent = `(${aiSelectedIndices.size}/${aiGeneratedCards.length} selected)`;
  }
  // Also update current deck name display
  updateAiGenDeckName();
}

function updateAiGenDeckName(){
  const nameEl = $("aiGenCurrentDeckName");
  if(nameEl){
    const deck = currentDecks.find(d => d.id === activeDeckId);
    nameEl.textContent = deck ? deck.name : "Kenpo Vocabulary";
  }
}

async function addSelectedAiCards(){
  if(aiSelectedIndices.size === 0){
    showEditDecksStatus("Please select at least one card to add", "error");
    return;
  }
  
  // Use the currently active deck
  const deckId = activeDeckId || "kenpo";
  const deck = currentDecks.find(d => d.id === deckId);
  const deckName = deck ? deck.name : "the deck";
  
  const cardsToAdd = Array.from(aiSelectedIndices).map(i => aiGeneratedCards[i]);
  
  let added = 0;
  let failed = 0;
  
  for(const card of cardsToAdd){
    try {
      await jpost("/api/user_cards", {
        term: card.term,
        meaning: card.definition,
        pron: card.pronunciation || "",
        group: card.group || "",
        deckId
      });
      added++;
    } catch(e){
      console.error("Failed to add card:", e);
      failed++;
    }
  }
  
  if(added > 0){
    showEditDecksStatus(`Added ${added} cards to ${deckName}${failed > 0 ? ` (${failed} failed)` : ""}`, "success");
    // Clear results
    aiGeneratedCards = [];
    aiSelectedIndices.clear();
    $("aiGenResults")?.classList.add("hidden");
    // Reset generator inputs (so they don't persist)
    if($("aiGenKeywords")) $("aiGenKeywords").value = "";
    if($("aiGenMaxCards")) $("aiGenMaxCards").value = "25";
    // Reset uploads
    aiPhotoData = null;
    aiDocData = null;
    try { $("photoFileInput").value = ""; } catch(e){}
    try { $("docFileInput").value = ""; } catch(e){}

    // Refresh user cards list and main app
    loadUserCards();
    loadDecks();
    // Also refresh counts and study deck
    await refreshCounts();
    await loadDeckForStudy();
    // Close Decks page after adding and return to Study; next open defaults to Switch
    try { switchEditDecksTab("switch"); } catch(e){}
    try { closeEditDecks(); } catch(e){}
  } else {
    showEditDecksStatus("Failed to add cards", "error");
  }
}

// ============ CUSTOM SET MODAL ============

let savedCustomSets = [];
let activeCustomSetId = "default";
let csAllCards = [];
let csCustomSetCards = [];

function openCustomSetModal(){
  const view = $("customSetView");
  if(!view) return;
  
  // Load current settings into view
  const settings = window.__activeSettings || settingsAll || {};
  if($("csRandomOrder")) $("csRandomOrder").checked = !!settings.randomize_custom_set;
  if($("csReflectStatus")) $("csReflectStatus").checked = !!settings.reflect_status_in_main;
  
  // Update current set display
  updateCurrentSetDisplay();
  
  // Reset to settings tab
  document.querySelectorAll(".csTab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".csTabContent").forEach(c => { c.classList.remove("active"); c.classList.add("hidden"); });
  document.querySelector(".csTab[data-cstab='settings']")?.classList.add("active");
  const settingsPane = $("csTab-settings");
  if(settingsPane){ settingsPane.classList.remove("hidden"); settingsPane.classList.add("active"); }
  
  // Load saved sets
  loadSavedCustomSets();
  
  // Hide all other views and show custom set view
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  view.classList.remove("hidden");
}

function closeCustomSetModal(){
  const view = $("customSetView");
  if(view) view.classList.add("hidden");
  
  // Save settings when closing
  saveCustomSetSettings();
  
  // Return to study view
  refresh();
}

function updateCurrentSetDisplay(){
  const display = $("csCurrentSetDisplay");
  if(!display) return;
  
  const currentSet = savedCustomSets.find(s => s.id === activeCustomSetId);
  display.textContent = currentSet ? `Current: ${currentSet.name}` : "Current: Default Set";
}

async function saveCustomSetSettings(){
  const randomize = $("csRandomOrder")?.checked || false;
  const reflect = $("csReflectStatus")?.checked || false;
  
  try {
    await jpost("/api/settings", { 
      scope: "all", 
      settings: { 
        randomize_custom_set: randomize,
        reflect_status_in_main: reflect 
      } 
    });
    
    if(settingsAll){
      settingsAll.randomize_custom_set = randomize;
      settingsAll.reflect_status_in_main = reflect;
    }
    window.__activeSettings = null;
  } catch(e){
    console.error("Failed to save custom set settings:", e);
  }
}

// Custom Set tabs
document.querySelectorAll(".csTab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".csTab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".csTabContent").forEach(c => { c.classList.remove("active"); c.classList.add("hidden"); });
    tab.classList.add("active");
    const tabId = "csTab-" + tab.dataset.cstab;
    const el = $(tabId);
    if(el){ el.classList.remove("hidden"); el.classList.add("active"); }
    
    if(tab.dataset.cstab === "manage"){
      loadManageCardsTab();
    } else if(tab.dataset.cstab === "saved"){
      loadSavedCustomSets();
    }
  });
});

// ========== MANAGE CARDS TAB ==========

async function loadManageCardsTab(){
  try {
    // Get all cards for current deck
    csAllCards = await jget("/api/cards?deck_id=" + encodeURIComponent(activeDeckId));
    
    // Get custom set cards
    const customSet = await jget(customSetApiUrl());
    const customCards = customSet.cards || [];
    const customCardIds = new Set(customCards.map(c => String(c.id)));
    const customStatusMap = {};
    customCards.forEach(c => { customStatusMap[String(c.id)] = c.custom_status || "active"; });

    // Split into in-set and available
    csCustomSetCards = csAllCards.filter(c => customCardIds.has(String(c.id))).map(c => ({
      ...c,
      customStatus: customStatusMap[String(c.id)] || "active"
    }));
    
    const availableCards = csAllCards.filter(c => !customCardIds.has(String(c.id)));
    
    // Render lists
    renderInSetList(csCustomSetCards);
    renderAvailableList(availableCards);
    
    // Update counts
    $("csInSetCount").textContent = csCustomSetCards.length;
    $("csAvailableCount").textContent = availableCards.length;

    // Ensure accordion state is correct after rendering (desktop + mobile)
    try{ updateCsAccordionMode(); }catch(_){ }
    
  } catch(e){
    console.error("Failed to load manage cards:", e);
  }
}

function renderInSetList(cards, filter = ""){
  const list = $("csInSetList");
  if(!list) return;
  
  const filtered = filter ? cards.filter(c => 
    c.term.toLowerCase().includes(filter) || 
    c.meaning.toLowerCase().includes(filter)
  ) : cards;
  
  if(filtered.length === 0){
    list.innerHTML = '<div class="csEmptyState">No cards in Custom Set</div>';
    return;
  }
  
  list.innerHTML = filtered.map(c => {
    const statusClass = c.customStatus === "learned" ? "learned" : (c.customStatus === "unsure" ? "unsure" : "");
    const statusLabel = c.customStatus === "learned" ? "L" : (c.customStatus === "unsure" ? "U" : "");
    return `
      <div class="csCardItem" onclick="toggleCardSelection(this)">
        <input type="checkbox" data-cardid="${c.id}" onclick="event.stopPropagation()" />
        <div class="cardInfo">
          <div class="cardTerm">${escapeHtml(c.term)}</div>
          <div class="cardMeaning">${escapeHtml(c.meaning)}</div>
        </div>
        ${statusLabel ? `<span class="cardStatus ${statusClass}">${statusLabel}</span>` : ''}
      </div>
    `;
  }).join('');
}

function renderAvailableList(cards, filter = ""){
  const list = $("csAvailableList");
  if(!list) return;
  
  const filtered = filter ? cards.filter(c => 
    c.term.toLowerCase().includes(filter) || 
    c.meaning.toLowerCase().includes(filter)
  ) : cards;
  
  if(filtered.length === 0){
    list.innerHTML = '<div class="csEmptyState">No available cards</div>';
    return;
  }
  
  list.innerHTML = filtered.map(c => {
    const mainStatusClass = c.status === "learned" ? "learned" : (c.status === "unsure" ? "unsure" : "");
    const mainStatusLabel = c.status === "learned" ? "L" : (c.status === "unsure" ? "U" : "");
    return `
    <div class="csCardItem" onclick="toggleCardSelection(this)">
      <input type="checkbox" data-cardid="${c.id}" onclick="event.stopPropagation()" />
      <div class="cardInfo">
        <div class="cardTerm">${escapeHtml(c.term)}</div>
        <div class="cardMeaning">${escapeHtml(c.meaning)}</div>
      </div>
      ${mainStatusLabel ? `<span class="cardStatus ${mainStatusClass}" title="Main status">${mainStatusLabel}</span>` : ''}
    </div>
  `;
  }).join('');
}

function toggleCardSelection(item){
  const cb = item.querySelector("input[type='checkbox']");
  if(cb) cb.checked = !cb.checked;
  item.classList.toggle("selected", cb?.checked);
}

function filterCustomSetList(which){
  const searchInput = which === "inSet" ? $("csInSetSearch") : $("csAvailableSearch");
  const filter = (searchInput?.value || "").toLowerCase().trim();
  
  if(which === "inSet"){
    renderInSetList(csCustomSetCards, filter);
  } else {
    const customIds = new Set(csCustomSetCards.map(c => c.id));
    const available = csAllCards.filter(c => !customIds.has(c.id));
    renderAvailableList(available, filter);
  }
}

function selectAllInSet(){
  document.querySelectorAll("#csInSetList .csCardItem").forEach(item => {
    const cb = item.querySelector("input[type='checkbox']");
    if(cb) cb.checked = true;
    item.classList.add("selected");
  });
}

function selectAllAvailable(){
  document.querySelectorAll("#csAvailableList .csCardItem").forEach(item => {
    const cb = item.querySelector("input[type='checkbox']");
    if(cb) cb.checked = true;
    item.classList.add("selected");
  });
}

async function removeSelectedFromSet(){
  const selected = Array.from(document.querySelectorAll("#csInSetList input[type='checkbox']:checked"))
    .map(cb => cb.dataset.cardid);
  
  if(selected.length === 0){
    alert("No cards selected to remove");
    return;
  }
  
  for(const id of selected){
    try {
      await jpost("/api/custom_set/remove", customSetBody({ id }));
    } catch(e){}
  }
  
  await loadManageCardsTab();
  await refreshCounts();
}

async function addSelectedToSet(){
  const selected = Array.from(document.querySelectorAll("#csAvailableList input[type='checkbox']:checked"))
    .map(cb => cb.dataset.cardid);
  
  if(selected.length === 0){
    alert("No cards selected to add");
    return;
  }
  
  let added = 0;
  for(const id of selected){
    try {
      await jpost("/api/custom_set/add", customSetBody({ id }));
      added++;
    } catch(e){}
  }
  
  await loadManageCardsTab();
  await refreshCounts();
}

async function bulkMarkLearned(){
  const selected = Array.from(document.querySelectorAll("#csInSetList input[type='checkbox']:checked"))
    .map(cb => cb.dataset.cardid);
  
  if(selected.length === 0){
    alert("No cards selected");
    return;
  }
  
  const reflectMain = $("csReflectStatus")?.checked || false;
  
  for(const id of selected){
    try {
      await jpost("/api/custom_set/set_status", customSetBody({ id, status: "learned" }));
      if(reflectMain){
        await jpost("/api/set_status", { id, status: "learned" });
      }
    } catch(e){}
  }
  
  await loadManageCardsTab();
  await refreshCounts();
}

async function bulkMarkUnsure(){
  const selected = Array.from(document.querySelectorAll("#csInSetList input[type='checkbox']:checked"))
    .map(cb => cb.dataset.cardid);
  
  if(selected.length === 0){
    alert("No cards selected");
    return;
  }
  
  const reflectMain = $("csReflectStatus")?.checked || false;
  
  for(const id of selected){
    try {
      await jpost("/api/custom_set/set_status", customSetBody({ id, status: "unsure" }));
      if(reflectMain){
        await jpost("/api/set_status", { id, status: "unsure" });
      }
    } catch(e){}
  }
  
  await loadManageCardsTab();
  await refreshCounts();
}

async function clearCustomSet(){
  if(!confirm("Clear all cards from Custom Set? This cannot be undone.")) return;
  
  try {
    await jpost("/api/custom_set/clear", customSetBody({}));
    await loadManageCardsTab();
    await refreshCounts();
    await refresh();
  } catch(e){
    console.error("Failed to clear custom set:", e);
  }
}

async function pickRandomCardsToCustom(){
  const countInput = $("csRandomPickCount");
  const n = parseInt(countInput?.value || "10", 10);
  
  if(isNaN(n) || n < 1){
    alert("Please enter a valid number");
    return;
  }
  
  try {
    const cards = await jget("/api/cards?deck_id=" + encodeURIComponent(activeDeckId));
    const customSet = await jget(customSetApiUrl());
    const existingIds = new Set(customSet.cards || []);
    
    // Only pick from cards not already in set
    const available = cards.filter(c => !existingIds.has(c.id));
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.min(n, shuffled.length));
    
    let added = 0;
    for(const card of picked){
      try {
        await jpost("/api/custom_set/add", customSetBody({ id: card.id  }));
        added++;
      } catch(e){}
    }
    
    alert(`Added ${added} random cards to Custom Set`);
    await refreshCounts();
  } catch(e){
    console.error("Failed to pick random cards:", e);
    alert("Failed to add random cards");
  }
}

// ========== SAVED SETS TAB ==========

function loadSavedCustomSets(){
  const list = $("csSavedSetsList");
  if(!list) return;
  
  try {
    savedCustomSets = JSON.parse(localStorage.getItem(savedSetsKey()) || "[]");
  } catch(e){
    savedCustomSets = [];
  }
  
  // Ensure each set has an ID
  savedCustomSets.forEach((set, i) => {
    if(!set.id) set.id = "set_" + Date.now() + "_" + i;
  });
  
  if(savedCustomSets.length === 0){
    list.innerHTML = '<div class="csEmptyState">No saved sets yet. Save your current Custom Set above.</div>';
    return;
  }
  
  list.innerHTML = savedCustomSets.map((set, i) => {
    const isActive = set.id === activeCustomSetId;
    return `
      <div class="csSavedItem ${isActive ? 'active' : ''}">
        <div class="setInfo">
          <div class="setName">${escapeHtml(set.name)}${isActive ? ' ✓' : ''}</div>
          <div class="setMeta">${set.cardIds.length} cards • ${new Date(set.savedAt).toLocaleDateString()}</div>
        </div>
        <div class="setActions">
          <button class="appBtn ${isActive ? 'primary' : 'secondary'} small" onclick="switchToSavedSet(${i})">${isActive ? 'Active' : 'Switch'}</button>
          <button class="appBtn secondary small" onclick="renameSavedSet(${i})" title="Rename">✏️</button>
          <button class="appBtn danger small" onclick="deleteSavedSet(${i})" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
  
  updateCurrentSetDisplay();
}

// Quick save from Settings tab
async function quickSaveCustomSet(){
  const nameInput = $("csQuickSaveName");
  const name = nameInput?.value?.trim();
  if(!name){ alert("Please enter a name"); return; }
  
  try {
    const customSet = await jget(customSetApiUrl());
    const cardIds = (customSet.cards || []).map(c => c.id);
    const statuses = Object.fromEntries((customSet.cards || []).map(c => [String(c.id), c.custom_status || "active"]));
    
    // Check if set with same name exists - overwrite it
    const existIdx = savedCustomSets.findIndex(s => s.name.toLowerCase() === name.toLowerCase());
    const newSet = {
      id: existIdx >= 0 ? savedCustomSets[existIdx].id : "set_" + Date.now(),
      name,
      cardIds,
      statuses,
      settings: { randomize: $("csRandomOrder")?.checked||false, reflectStatus: $("csReflectStatus")?.checked||false },
      savedAt: Date.now()
    };
    
    if(existIdx >= 0) savedCustomSets[existIdx] = newSet;
    else savedCustomSets.push(newSet);
    
    localStorage.setItem(savedSetsKey(), JSON.stringify(savedCustomSets));
    nameInput.value = "";
    activeCustomSetId = newSet.id;
    updateCurrentSetDisplay();
    alert(`Saved "${name}" with ${cardIds.length} cards`);
  } catch(e){
    alert("Failed to save: " + e.message);
  }
}

// Create new empty set (auto-saves current first)
async function createNewEmptySet(){
  const nameInput = $("csNewEmptyName");
  const name = nameInput?.value?.trim();
  if(!name){ alert("Please enter a name"); return; }
  
  try {
    // Auto-save current set if it has cards
    const currentCustom = await jget(customSetApiUrl());
    if((currentCustom.cards||[]).length > 0 && activeCustomSetId !== "default"){
      const activeSet = savedCustomSets.find(s => s.id === activeCustomSetId);
      if(activeSet){
        activeSet.cardIds = currentCustom.cards || [];
        activeSet.statuses = currentCustom.statuses || {};
        activeSet.savedAt = Date.now();
        localStorage.setItem(savedSetsKey(), JSON.stringify(savedCustomSets));
      }
    }
    
    // Clear current custom set
    await jpost("/api/custom_set/clear", customSetBody({}));
    
    // Create new saved entry
    const newSet = {
      id: "set_" + Date.now(),
      name,
      cardIds: [],
      statuses: {},
      settings: { randomize: false, reflectStatus: false },
      savedAt: Date.now()
    };
    savedCustomSets.push(newSet);
    localStorage.setItem(savedSetsKey(), JSON.stringify(savedCustomSets));
    
    activeCustomSetId = newSet.id;
    nameInput.value = "";
    loadSavedCustomSets();
    updateCurrentSetDisplay();
    await refreshCounts();
    alert(`Created empty set "${name}". Add cards via Manage Cards tab.`);
  } catch(e){
    alert("Failed: " + e.message);
  }
}

// Rename a saved set
function renameSavedSet(index){
  const set = savedCustomSets[index];
  if(!set) return;
  const newName = prompt("Rename custom deck:", set.name);
  if(!newName || !newName.trim()) return;
  set.name = newName.trim();
  localStorage.setItem(savedSetsKey(), JSON.stringify(savedCustomSets));
  loadSavedCustomSets();
  updateCurrentSetDisplay();
}

async function saveCurrentCustomSet(){
  const nameInput = $("csSaveSetName");
  const name = nameInput?.value?.trim();
  
  if(!name){
    alert("Please enter a name for the set");
    return;
  }
  
  try {
    const customSet = await jget(customSetApiUrl());
    const cardIds = (customSet.cards || []).map(c => c.id);
    const statuses = Object.fromEntries((customSet.cards || []).map(c => [String(c.id), c.custom_status || "active"]));
    
    const newSet = {
      id: "set_" + Date.now(),
      name,
      cardIds,
      statuses,
      settings: {
        randomize: $("csRandomOrder")?.checked || false,
        reflectStatus: $("csReflectStatus")?.checked || false
      },
      savedAt: Date.now()
    };
    
    savedCustomSets.push(newSet);
    localStorage.setItem(savedSetsKey(), JSON.stringify(savedCustomSets));
    
    nameInput.value = "";
    activeCustomSetId = newSet.id;
    loadSavedCustomSets();
    alert(`Saved "${name}" with ${cardIds.length} cards`);
  } catch(e){
    console.error("Failed to save custom set:", e);
    alert("Failed to save set");
  }
}

async function switchToSavedSet(index){
  const set = savedCustomSets[index];
  if(!set) return;
  
  if(set.id === activeCustomSetId){
    return; // Already active
  }
  
  try {
    // Clear current custom set
    await jpost("/api/custom_set/clear", customSetBody({}));
    
    // Add saved cards
    for(const id of set.cardIds){
      try {
        await jpost("/api/custom_set/add", customSetBody({ id }));
      } catch(e){}
    }
    
    // Restore statuses
    if(set.statuses){
      for(const [id, status] of Object.entries(set.statuses)){
        try {
          await jpost("/api/custom_set/set_status", customSetBody({ id, status }));
        } catch(e){}
      }
    }
    
    // Restore settings
    if(set.settings){
      if($("csRandomOrder")) $("csRandomOrder").checked = !!set.settings.randomize;
      if($("csReflectStatus")) $("csReflectStatus").checked = !!set.settings.reflectStatus;
    }
    
    activeCustomSetId = set.id;
    loadSavedCustomSets();
    await refreshCounts();
    await refresh();
  } catch(e){
    console.error("Failed to switch to saved set:", e);
    alert("Failed to load set");
  }
}

function deleteSavedSet(index){
  const set = savedCustomSets[index];
  if(!set) return;
  
  if(!confirm(`Delete saved set "${set.name}"?`)) return;
  
  if(set.id === activeCustomSetId){
    activeCustomSetId = "default";
  }
  
  savedCustomSets.splice(index, 1);
  localStorage.setItem(savedSetsKey(), JSON.stringify(savedCustomSets));
  loadSavedCustomSets();
}

// ========== DECK-SPECIFIC SETTINGS ==========

async function loadDeckAiSettings(){
  const cbShort = $("deckShortAnswers");
  const cbHelpers = $("deckAiShowFormatHelpers");
  const cbExample = $("deckAiShowPreExample");
  if(!cbShort) return;
  try {
    const s = await jget(`/api/decks/${encodeURIComponent(activeDeckId)}/settings`);
    cbShort.checked = !!s.shortAnswers;
    if(cbHelpers) cbHelpers.checked = !!s.aiShowFormatHelpers; // default off
    if(cbExample) cbExample.checked = (typeof s.aiShowPreExample === "boolean") ? s.aiShowPreExample : true; // default on
  } catch(e){
    cbShort.checked = false;
    if(cbHelpers) cbHelpers.checked = false;
    if(cbExample) cbExample.checked = true;
  }
  applyAiGeneratorUiSettings();
}

async function toggleDeckShortAnswers(){
  const cb = $("deckShortAnswers");
  if(!cb) return;
  try {
    await jpost(`/api/decks/${encodeURIComponent(activeDeckId)}/settings`, { shortAnswers: cb.checked });
    showEditDecksStatus(cb.checked ? "Short answers mode ON for this deck" : "Short answers mode OFF", "success");
  } catch(e){
    console.error("Failed to save deck setting:", e);
  }
}

async function toggleDeckAiShowFormatHelpers(){
  const cb = $("deckAiShowFormatHelpers");
  if(!cb) return;
  try {
    await jpost(`/api/decks/${encodeURIComponent(activeDeckId)}/settings`, { aiShowFormatHelpers: cb.checked });
    applyAiGeneratorUiSettings();
    try{ bulkApplyUiSettings(); }catch(e){}
    try{ editBulkApplyUiSettings(); }catch(e){}
  } catch(e){
    console.error("Failed to save deck AI helper setting:", e);
  }
}

async function toggleDeckAiShowPreExample(){
  const cb = $("deckAiShowPreExample");
  if(!cb) return;
  try {
    await jpost(`/api/decks/${encodeURIComponent(activeDeckId)}/settings`, { aiShowPreExample: cb.checked });
    applyAiGeneratorUiSettings();
    try{ bulkApplyUiSettings(); }catch(e){}
    try{ editBulkApplyUiSettings(); }catch(e){}
  } catch(e){
    console.error("Failed to save deck AI example setting:", e);
  }
}

function applyAiGeneratorUiSettings(){
  const showHelpers = !!($("deckAiShowFormatHelpers") && $("deckAiShowFormatHelpers").checked);
  const helpersWrap = $("aiGenFormatHelpers");
  if(helpersWrap) helpersWrap.classList.toggle("hidden", !showHelpers);

  const showExample = !!($("deckAiShowPreExample") && $("deckAiShowPreExample").checked);
  const exWrap = $("aiGenPreExampleWrap");
  if(exWrap){
    const shouldShow = showExample && aiGenShouldShowPreExample();
    exWrap.classList.toggle("hidden", !shouldShow);
  }
  aiGenSchedulePreExample();
}

function aiGenShouldShowPreExample(){
  const kw = ($("aiGenKeywords")?.value || "").trim();
  const instr = ($("aiGenInstructions")?.value || "").trim();
  const deckName = (window.activeDeckName || "").trim();
  const deckDesc = (window.activeDeckDescription || "").trim();
  return !!(kw || instr || deckName || deckDesc);
}

function aiGenSchedulePreExample(){
  if(_aiGenPreExampleTimer) clearTimeout(_aiGenPreExampleTimer);
  _aiGenPreExampleTimer = setTimeout(aiGenUpdatePreExample, 650);
}

async function aiGenUpdatePreExample(){
  const box = $("aiGenPreExampleBox");
  const wrap = $("aiGenPreExampleWrap");
  const hint = $("aiGenPreExampleHint");
  if(!box || !wrap) return;

  // If the wrapper is hidden, clear and stop.
  if(wrap.classList.contains("hidden")){
    box.innerHTML = "";
    if(hint) hint.textContent = "Example output (updates as you type):";
    return;
  }

  // Only show preview when there is something to base it on.
  const kw = ($("aiGenKeywords")?.value || "").trim();
  const instr = ($("aiGenInstructions")?.value || "").trim();
  const deckName = (window.activeDeckName || "").trim();
  const deckDesc = (window.activeDeckDescription || "").trim();

  if(!(kw || instr || deckName || deckDesc)){
    box.innerHTML = "";
    if(hint) hint.textContent = "Example output (updates as you type):";
    return;
  }

  const cbShort = $("deckShortAnswers");
  const shortOn = !!(cbShort && cbShort.checked);
  const sig = JSON.stringify({ kw, instr, deckName, deckDesc, shortOn });

  // Avoid re-requesting the same preview repeatedly.
  if(sig === _aiGenPreExampleLastSig && box.innerHTML.trim()){
    return;
  }
  _aiGenPreExampleLastSig = sig;

  if(hint) hint.textContent = "Generating example...";
  box.innerHTML = "";

  // Try a real AI preview (like the AI Template), with graceful fallback.
  try{
    const res = await jpost("/api/ai/generate_deck_preview", {
      type: "keywords",
      keywords: kw || deckName || "Example",
      instructions: instr,
      shortAnswers: shortOn,
      deckName,
      deckDescription: deckDesc
    });

    if(res?.error){
      throw new Error(res.error);
    }

    const c = res?.card || {};
    const term = (c.term || kw.split(",")[0] || deckName || "Example Term").trim();
    const def = (c.definition || "").trim() || "Example definition";
    const pron = (c.pronunciation || "").trim();
    const grp = (c.group || "").trim();

    const extraBits = [
      pron ? `<div class="mini muted">Pronunciation: ${escapeHtml(pron)}</div>` : "",
      grp ? `<div class="mini muted">Group: ${escapeHtml(grp)}</div>` : ""
    ].join("");

    if(hint) hint.textContent = "Example output (updates as you type):";
    box.innerHTML = `
      <div class="previewItem">
        <div class="top">
          <div class="term">${escapeHtml(term)}</div>
        </div>
        <div class="mini muted">Definition: ${escapeHtml(def)}</div>
        ${extraBits}
      </div>
    `;
    return;

  }catch(e){
    console.warn("AI generator preview failed, falling back to local example:", e);
  }

  // Fallback: simple local example (no AI call)
  let term = "";
  if(kw){
    term = kw.split(",")[0].split(";")[0].trim();
  }
  if(!term) term = (deckName || "Example Term");
  const def = instr
    ? "Follows your instruction (example output)."
    : (shortOn ? "Short definition" : `Definition about ${term}`);

  if(hint) hint.textContent = "Example output (updates as you type):";
  box.innerHTML = `
    <div class="previewItem">
      <div class="top">
        <div class="term">${escapeHtml(term || "Example Term")}</div>
      </div>
      <div class="mini muted">Definition: ${escapeHtml(def)}</div>
    </div>
  `;
}

// Bind custom set settings button
document.addEventListener("DOMContentLoaded", () => {
  const btn = $("customSetSettingsBtn");
  if(btn){
    btn.addEventListener("click", openCustomSetModal);
  }
  window.addEventListener("resize", () => { if(typeof resizeCard === "function") resizeCard(); });
})
function customSetApiUrl(){
  const did = (typeof activeDeckId !== "undefined" && activeDeckId) ? activeDeckId : "kenpo";
  return `/api/custom_set?deck_id=${encodeURIComponent(did)}`;
}
function customSetBody(extra){
  const did = (typeof activeDeckId !== "undefined" && activeDeckId) ? activeDeckId : "kenpo";
  return Object.assign({ deck_id: did }, extra || {});
}


function savedSetsKey(){
  const u = (currentUser && (currentUser.id || currentUser.username)) ? (currentUser.id || currentUser.username) : "anon";
  const did = (typeof activeDeckId !== "undefined" && activeDeckId) ? activeDeckId : "kenpo";
  return `af_saved_custom_sets_${u}_${did}`;
}

;

// ===== Custom Set Manage Cards: Accordion support (ALL viewports) =====
let csAccordionEnabled = false;

function updateCsAccordionMode(){
  const view = $("customSetView");
  if(!view || view.classList.contains("hidden")) return;

  // Enable accordion whenever the Manage Cards layout is stacked (column).
  // This keeps behavior consistent on desktop + mobile.
  const split = document.querySelector("#csTab-manage .csManageSplit");
  if(!split) return;

  const flexDir = (window.getComputedStyle(split).flexDirection || "").toLowerCase();
  const enabled = (flexDir === "column");
  const panes = Array.from(document.querySelectorAll("#csTab-manage .csManagePane"));

  if(enabled && !csAccordionEnabled){
    // Start collapsed (user opens what they want)
    panes.forEach(p => p.classList.add("collapsed"));
    csAccordionEnabled = true;
  }else if(!enabled && csAccordionEnabled){
    panes.forEach(p => p.classList.remove("collapsed"));
    csAccordionEnabled = false;
  }
}

function toggleCsPane(which){
  updateCsAccordionMode();
  if(!csAccordionEnabled) return;
  const panes = Array.from(document.querySelectorAll(".csManagePane"));
  panes.forEach(p => {
    const name = p.getAttribute("data-pane");
    if(name === which){
      p.classList.toggle("collapsed");
    }else{
      p.classList.add("collapsed");
    }
  });
}

window.addEventListener("resize", () => {
  try{ updateCsAccordionMode(); }catch(_){}
});

// Hook accordion update when opening the modal
const _origOpenCustomSetModal = openCustomSetModal;
openCustomSetModal = function(){
  _origOpenCustomSetModal();
  try{ updateCsAccordionMode(); }catch(_){}
};


// ===== UI Error Log (optional) =====
let uiLogEnabled = false;
let uiLogInstalled = false;

function toggleUiLog(show){
  const panel = $("uiLogPanel");
  if(!panel) return;
  if(show){
    panel.classList.remove("hidden");
  }else{
    panel.classList.add("hidden");
  }
}

function clearUiLog(){
  const body = $("uiLogBody");
  if(body) body.innerHTML = "";
}

function _appendUiLogLine(tag, msg){
  const body = $("uiLogBody");
  if(!body) return;
  const line = document.createElement("div");
  line.className = "uiLogLine";
  const ts = new Date().toLocaleTimeString();
  line.textContent = `[${ts}] ${tag}: ${msg}`;
  body.appendChild(line);
  // keep scrolled to bottom
  body.scrollTop = body.scrollHeight;
}

function logUiError(tag, message){
  if(!uiLogEnabled) return;
  _appendUiLogLine(tag, String(message || ""));
  toggleUiLog(true);
}

function installUiErrorLog(enabled){
  uiLogEnabled = !!enabled;
  if(!uiLogEnabled){
    toggleUiLog(false);
    return;
  }
  if(uiLogInstalled) return;
  uiLogInstalled = true;

  window.addEventListener("error", (e) => {
    try{
      const msg = e && (e.message || e.error?.message) ? (e.message || e.error.message) : "Unknown error";
      logUiError("error", msg);
    }catch(_){}
  });

  window.addEventListener("unhandledrejection", (e) => {
    try{
      const msg = e && e.reason ? (e.reason.message || String(e.reason)) : "Unhandled rejection";
      logUiError("promise", msg);
    }catch(_){}
  });

  // Optional: capture console.error
  try{
    const _ce = console.error.bind(console);
    console.error = function(...args){
      try{ logUiError("console", args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")); }catch(_){}
      _ce(...args);
    };
  }catch(_){}
}

// Enable/disable based on settings after login and after settings changes
const _origLoadSettingsUI = loadSettingsUI;
loadSettingsUI = function(settings){
  _origLoadSettingsUI(settings);
  try{ installUiErrorLog(!!(settings && settings.show_ui_error_log)); }catch(_){}
};

const _origSaveSettings = saveSettings;
saveSettings = async function(){
  const r = await _origSaveSettings();
  try{
    const s = await jget("/api/settings");
    installUiErrorLog(!!(s && s.show_ui_error_log));
  }catch(_){}
  return r;
};
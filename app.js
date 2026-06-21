/* Flashcards arabe — logique de l'application (vanilla JS).
   État sauvegardé dans localStorage sous la clé "flashcards-arabe". */

(function () {
  "use strict";

  const STORAGE_KEY = "flashcards-arabe";

  // Langues prédéfinies : { id, name, rtl (droite→gauche), nonLatin (phonétique utile) }.
  const LANG_PRESETS = [
    { id: "ar", name: "Arabe", rtl: true, nonLatin: true },
    { id: "en", name: "Anglais", rtl: false, nonLatin: false },
    { id: "es", name: "Espagnol", rtl: false, nonLatin: false },
    { id: "de", name: "Allemand", rtl: false, nonLatin: false },
    { id: "it", name: "Italien", rtl: false, nonLatin: false },
    { id: "pt", name: "Portugais", rtl: false, nonLatin: false },
    { id: "ru", name: "Russe", rtl: false, nonLatin: true },
    { id: "ja", name: "Japonais", rtl: false, nonLatin: true },
    { id: "zh", name: "Chinois", rtl: false, nonLatin: true },
    { id: "el", name: "Grec", rtl: false, nonLatin: true },
  ];

  // Maîtrise = réussir dans les deux sens.
  const DIR_TARGET = 5;             // réussites requises par sens (AR→FR et FR→AR)
  const MASTER = DIR_TARGET * 2;    // total visé : 10 points
  const LEARNING = 5;               // seuil « En cours »

  // Réussites par sens, plafonnées à DIR_TARGET (utilisées pour la maîtrise).
  function af(c) { return Math.min(c.af || 0, DIR_TARGET); }   // AR → FR
  function fa(c) { return Math.min(c.fa || 0, DIR_TARGET); }   // FR → AR
  function points(c) { return af(c) + fa(c); }                 // 0..10

  // Niveau d'un total de points : new / seen / learning / master.
  function levelOf(pts) {
    if (pts >= MASTER) return { key: "master", label: "Maîtrisé" };
    if (pts >= LEARNING) return { key: "learning", label: "En cours" };
    if (pts >= 1) return { key: "seen", label: "Vu" };
    return { key: "new", label: "À apprendre" };
  }
  function isMastered(c) { return (c.af || 0) >= DIR_TARGET && (c.fa || 0) >= DIR_TARGET; }

  // --- État ---
  let cards = [];          // [{ id, ar, translit, fr, known }]
  let order = [];          // indices dans "cards", éventuellement mélangés/filtrés
  let pos = 0;             // position dans "order"
  let flipped = false;     // carte retournée ?
  let sensMode = "af";     // sens : "af" (AR→FR), "fa" (FR→AR), "mix" (aléatoire)
  let curAr = true;        // sens réellement affiché pour la carte en cours
  let curId = null;        // id de la carte en cours (pour figer le sens en mode mix)
  let reviewOnly = false;  // n'afficher que les mots "à revoir"
  let lists = [];          // catalogue des listes de la langue active
  let cat = "all";         // liste active ("all" = toutes)
  let languages = [];      // [{ id, name, rtl, nonLatin, cards:[...], lists:[...] }]
  let activeLang = "ar";   // id de la langue active
  let editingId = null;    // id du mot en cours d'édition (null = ajout)
  let sb = null;           // client Supabase (null = synchro désactivée)
  let user = null;         // utilisateur connecté (null = hors-ligne / local)
  let cloudTimer = null;   // minuterie de synchro différée (debounce)

  // --- Éléments du DOM ---
  const el = {
    progress: document.getElementById("progress"),
    card: document.getElementById("card"),
    frontHint: document.getElementById("frontHint"),
    frontMain: document.getElementById("frontMain"),
    frontSub: document.getElementById("frontSub"),
    frontPhon: document.getElementById("frontPhon"),
    frontHintBtn: document.getElementById("frontHintBtn"),
    backHint: document.getElementById("backHint"),
    backMain: document.getElementById("backMain"),
    backSub: document.getElementById("backSub"),
    backPhon: document.getElementById("backPhon"),
    backHintBtn: document.getElementById("backHintBtn"),
    prevBtn: document.getElementById("prevBtn"),
    nextBtn: document.getElementById("nextBtn"),
    passBtn: document.getElementById("passBtn"),
    failBtn: document.getElementById("failBtn"),
    mastery: document.getElementById("mastery"),
    statsBody: document.getElementById("statsBody"),
    resetProgressBtn: document.getElementById("resetProgressBtn"),
    shuffleBtn: document.getElementById("shuffleBtn"),
    directionBtn: document.getElementById("directionBtn"),
    directionLabel: document.getElementById("directionLabel"),
    reviewBtn: document.getElementById("reviewBtn"),
    cats: document.getElementById("cats"),
    addForm: document.getElementById("addForm"),
    inAr: document.getElementById("inAr"),
    inTranslit: document.getElementById("inTranslit"),
    inFr: document.getElementById("inFr"),
    inCat: document.getElementById("inCat"),
    catList: document.getElementById("catList"),
    submitBtn: document.getElementById("submitBtn"),
    cancelEditBtn: document.getElementById("cancelEditBtn"),
    newListName: document.getElementById("newListName"),
    createListBtn: document.getElementById("createListBtn"),
    listManager: document.getElementById("listManager"),
    exportBtn: document.getElementById("exportBtn"),
    importBtn: document.getElementById("importBtn"),
    importFile: document.getElementById("importFile"),
    resetBtn: document.getElementById("resetBtn"),
    wordList: document.getElementById("wordList"),
    countInfo: document.getElementById("countInfo"),
    // Langues
    langBtn: document.getElementById("langBtn"),
    langBtnName: document.getElementById("langBtnName"),
    langModal: document.getElementById("langModal"),
    langPresets: document.getElementById("langPresets"),
    langForm: document.getElementById("langForm"),
    langName: document.getElementById("langName"),
    langRtl: document.getElementById("langRtl"),
    langNonLatin: document.getElementById("langNonLatin"),
    langExisting: document.getElementById("langExisting"),
    // Bienvenue (onboarding)
    welcomeModal: document.getElementById("welcomeModal"),
    welcomeStep1: document.getElementById("welcomeStep1"),
    welcomeStep2: document.getElementById("welcomeStep2"),
    welcomePresets: document.getElementById("welcomePresets"),
    welcomeCustomForm: document.getElementById("welcomeCustomForm"),
    welcomeLangName: document.getElementById("welcomeLangName"),
    welcomeRtl: document.getElementById("welcomeRtl"),
    welcomeNonLatin: document.getElementById("welcomeNonLatin"),
    loadStarterBtn: document.getElementById("loadStarterBtn"),
    startEmptyBtn: document.getElementById("startEmptyBtn"),
    manageDetails: document.getElementById("manageDetails"),
    // Compte / synchro
    accountBtn: document.getElementById("accountBtn"),
    authModal: document.getElementById("authModal"),
    authClose: document.getElementById("authClose"),
    authLoggedOut: document.getElementById("authLoggedOut"),
    authForm: document.getElementById("authForm"),
    authEmail: document.getElementById("authEmail"),
    authPassword: document.getElementById("authPassword"),
    loginBtn: document.getElementById("loginBtn"),
    signupBtn: document.getElementById("signupBtn"),
    forgotBtn: document.getElementById("forgotBtn"),
    pwToggle: document.getElementById("pwToggle"),
    authRecovery: document.getElementById("authRecovery"),
    recoveryForm: document.getElementById("recoveryForm"),
    newPw: document.getElementById("newPw"),
    newPwToggle: document.getElementById("newPwToggle"),
    recoveryMsg: document.getElementById("recoveryMsg"),
    googleBtn: document.getElementById("googleBtn"),
    authMsg: document.getElementById("authMsg"),
    authLoggedIn: document.getElementById("authLoggedIn"),
    authUser: document.getElementById("authUser"),
    authLogout: document.getElementById("authLogout"),
    syncState: document.getElementById("syncState"),
    syncDot: document.getElementById("syncDot"),
  };

  // --- Persistance ---
  // Format v3 : { v:3, activeLang, languages:[{id,name,rtl,nonLatin,cards,lists}] }.
  // Anciens formats : tableau de cartes, ou { v:2, cards, lists } → 1 langue "Arabe".
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return fromStored(JSON.parse(raw));
    } catch (e) { /* ignore */ }
    return { languages: [arabicLang(seedFromDefaults(), [])], activeLang: "ar" };
  }

  // Convertit n'importe quel format (stocké / importé / cloud) en { languages, activeLang }.
  function fromStored(parsed) {
    if (parsed && Array.isArray(parsed.languages) && parsed.languages.length) {
      return {
        languages: parsed.languages.map(normalizeLang),
        activeLang: parsed.activeLang || parsed.languages[0].id,
      };
    }
    // Anciens formats mono-langue (arabe).
    let oldCards = null, oldLists = null;
    if (Array.isArray(parsed)) oldCards = parsed;
    else if (parsed && Array.isArray(parsed.cards)) {
      oldCards = parsed.cards;
      oldLists = Array.isArray(parsed.lists) ? parsed.lists : null;
    }
    if (oldCards) return { languages: [arabicLang(oldCards, oldLists || [])], activeLang: "ar" };
    return { languages: [arabicLang(seedFromDefaults(), [])], activeLang: "ar" };
  }

  function arabicLang(cardsArr, listsArr) {
    return { id: "ar", name: "Arabe", rtl: true, nonLatin: true, cards: cardsArr, lists: listsArr };
  }

  function normalizeLang(l) {
    return {
      id: l.id || makeId(0),
      name: l.name || "Langue",
      rtl: !!l.rtl,
      nonLatin: !!l.nonLatin,
      cards: normalizeCards(l.cards || []),
      lists: Array.isArray(l.lists) ? l.lists.slice() : [],
    };
  }

  function seedFromDefaults() {
    const defaults = window.DEFAULT_WORDS || [];
    return defaults.map((w, i) => ({
      id: makeId(i),
      ar: w.ar, translit: w.translit || "", fr: w.fr,
      cat: w.cat || "Autres", af: 0, fa: 0,
    }));
  }

  // --- Langue active ---
  function activeLangObj() { return languages.find((l) => l.id === activeLang) || languages[0]; }

  // Écrit les variables de travail (cards/lists) dans l'objet de la langue active.
  function commitActiveLang() {
    const lo = activeLangObj();
    if (lo) { lo.cards = cards; lo.lists = lists; }
  }

  function payload() {
    commitActiveLang();
    return { v: 3, activeLang: activeLang, languages: languages };
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload())); } catch (e) {}
    if (user) scheduleCloudSync();
  }

  function makeId(seed) {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7) + "-" + seed;
  }

  // Valide / nettoie un tableau de cartes (import fichier ou synchro cloud).
  function normalizeCards(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map((w, i) => ({
      id: w.id || makeId(i),
      ar: w.ar || "", translit: w.translit || "", fr: w.fr || "",
      cat: w.cat || "Autres",
      af: Math.min(Math.max(+w.af || 0, 0), DIR_TARGET),
      fa: Math.min(Math.max(+w.fa || 0, 0), DIR_TARGET),
    })).filter((w) => w.ar && w.fr);
  }

  // --- Ordre / filtre ---
  function rebuildOrder(keepCurrentId) {
    const currentId = keepCurrentId != null ? keepCurrentId : currentCardId();
    // Si la catégorie active n'existe plus, revenir à "Tous".
    if (cat !== "all" && !cards.some((c) => c.cat === cat)) cat = "all";
    let indices = cards.map((_, i) => i);
    if (cat !== "all") indices = indices.filter((i) => cards[i].cat === cat);
    if (reviewOnly) indices = indices.filter((i) => !isMastered(cards[i]));
    order = indices;
    // Replacer sur la même carte si possible
    const newPos = order.findIndex((i) => cards[i].id === currentId);
    pos = newPos >= 0 ? newPos : 0;
    if (pos >= order.length) pos = 0;
  }

  function shuffleOrder() {
    for (let k = order.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [order[k], order[j]] = [order[j], order[k]];
    }
    pos = 0;
  }

  function currentCard() {
    if (!order.length) return null;
    return cards[order[pos]];
  }
  function currentCardId() {
    const c = currentCard();
    return c ? c.id : null;
  }

  // Catalogue des listes : noms du catalogue + tout thème présent sur une carte.
  function categories() { return lists.slice(); }

  // Garantit que le catalogue contient toutes les listes utilisées par les cartes.
  function ensureLists() {
    if (!Array.isArray(lists)) lists = [];
    cards.forEach((c) => {
      if (c.cat && lists.indexOf(c.cat) === -1) lists.push(c.cat);
    });
  }

  function listExists(name) { return lists.indexOf(name) !== -1; }

  // --- Rendu ---
  function render() {
    const c = currentCard();
    flipped = false;
    el.card.classList.remove("flipped");

    renderLangBtn();
    adaptWordForm();
    renderCats();
    renderStats();
    renderListManager();

    if (!c) {
      const empty = !cards.length;
      const cta = empty && !reviewOnly;
      el.frontHint.textContent = reviewOnly
        ? "🎉 tout est maîtrisé"
        : cta ? "Clique pour ajouter ton premier mot" : "aucune carte dans ce filtre";
      el.frontMain.textContent = reviewOnly ? "Bravo !" : cta ? "＋" : "Aucune carte";
      el.frontMain.className = "card-main";
      el.frontPhon.hidden = true;
      el.card.classList.toggle("empty-cta", cta);
      el.backMain.textContent = "";
      el.backSub.textContent = "";
      el.backHint.textContent = "";
      el.backPhon.hidden = true;
      el.progress.textContent = "0 / 0";
      el.mastery.innerHTML = "";
      el.card.classList.remove("master");
      el.passBtn.disabled = el.failBtn.disabled = true;
      renderWordList();
      return;
    }
    el.passBtn.disabled = el.failBtn.disabled = false;
    el.card.classList.remove("empty-cta");

    // Sens affiché : fixe (af/fa) ou aléatoire figé tant qu'on reste sur la carte.
    if (sensMode === "af") curAr = true;
    else if (sensMode === "fa") curAr = false;
    else if (c.id !== curId) curAr = Math.random() < 0.5;
    curId = c.id;

    // Face avant et arrière selon le sens. Côté « cible » = la langue apprise.
    const lang = activeLangObj();
    const phon = lang.nonLatin ? c.translit : "";
    if (curAr) {
      setFace("front", lang.name, c.ar, phon, lang);
      setFace("back", "Français", c.fr, "", null);
    } else {
      setFace("front", "Français", c.fr, "", null);
      setFace("back", lang.name, c.ar, phon, lang);
    }

    const lvl = levelOf(points(c));
    el.card.classList.toggle("master", lvl.key === "master");
    renderMastery(c, lvl);

    el.progress.textContent = (pos + 1) + " / " + order.length;
    renderWordList();
  }

  // Badge de maîtrise sous la carte : niveau + compteurs par sens.
  function renderMastery(c, lvl) {
    el.mastery.innerHTML = "";
    el.mastery.className = "mastery level-" + lvl.key;

    const tag = document.createElement("span");
    tag.className = "m-label";
    tag.textContent = lvl.label;

    // Deux jauges : LANGUE→FR et FR→LANGUE. Le sens en cours est mis en avant.
    const ab = langAbbr(activeLangObj());
    const dirs = document.createElement("span");
    dirs.className = "m-dirs";
    [[ab + "→FR", af(c), curAr], ["FR→" + ab, fa(c), !curAr]].forEach(([name, n, current]) => {
      const d = document.createElement("span");
      d.className = "m-dir" + (current ? " current" : "") + (n >= DIR_TARGET ? " done" : "");
      d.textContent = name + " " + n + "/" + DIR_TARGET;
      dirs.append(d);
    });

    el.mastery.append(tag, dirs);
  }

  // Les 4 niveaux, dans l'ordre de progression.
  var LEVELS = [
    { key: "new", label: "À apprendre" },
    { key: "seen", label: "Vu" },
    { key: "learning", label: "En cours" },
    { key: "master", label: "Maîtrisé" },
  ];

  // Progression par thème : barre segmentée par niveau.
  function renderStats() {
    el.statsBody.innerHTML = "";

    // Légende (une seule fois, en haut).
    const legend = document.createElement("div");
    legend.className = "stat-legend";
    LEVELS.forEach((lv) => {
      const item = document.createElement("span");
      item.className = "leg-item";
      item.innerHTML = '<i class="leg-dot level-' + lv.key + '"></i>';
      item.append(lv.label);
      legend.append(item);
    });
    el.statsBody.append(legend);

    const rows = [["Tous", cards]].concat(
      categories().map((name) => [name, cards.filter((c) => c.cat === name)])
    );
    rows.forEach(([name, list]) => {
      if (!list.length) return;

      // Comptage par niveau.
      const counts = { new: 0, seen: 0, learning: 0, master: 0 };
      list.forEach((c) => { counts[levelOf(points(c)).key]++; });
      const mastered = counts.master;

      const row = document.createElement("div");
      row.className = "stat-row";

      const head = document.createElement("div");
      head.className = "stat-head";
      const nm = document.createElement("span");
      nm.className = "stat-name";
      nm.textContent = name;
      const val = document.createElement("span");
      val.className = "stat-val";
      val.textContent = mastered + " / " + list.length + " maîtrisés";
      head.append(nm, val);

      // Barre segmentée : un bloc par niveau, largeur proportionnelle.
      const bar = document.createElement("div");
      bar.className = "stat-bar";
      LEVELS.forEach((lv) => {
        if (!counts[lv.key]) return;
        if (lv.key === "new") return; // « à apprendre » = piste vide (reset bien visible)
        const seg = document.createElement("div");
        seg.className = "stat-seg level-" + lv.key;
        seg.style.width = (counts[lv.key] / list.length * 100) + "%";
        seg.title = lv.label + " : " + counts[lv.key];
        bar.append(seg);
      });

      row.append(head, bar);
      el.statsBody.append(row);
    });
  }

  // lang = objet langue pour le côté « cible » (style écriture), null = côté français.
  function setFace(side, hint, main, sub, lang) {
    el[side + "Hint"].textContent = hint;
    const mainEl = el[side + "Main"];
    mainEl.textContent = main;
    let cls = "card-main";
    if (lang) {
      cls += " tgt";
      if (lang.nonLatin) cls += " non-latin";
      if (lang.rtl) cls += " rtl";
    }
    mainEl.className = cls;

    // Phonétique : masquée par défaut, révélée via le bouton « indice ».
    const phon = el[side + "Phon"];
    el[side + "Sub"].textContent = sub || "";
    phon.classList.remove("revealed");
    phon.hidden = !sub;
  }

  // Abréviation courte d'une langue (pour les jauges de sens).
  function langAbbr(lang) {
    const base = lang.id && lang.id.length <= 3 ? lang.id : lang.name;
    return base.slice(0, 2).toUpperCase();
  }

  function renderCats() {
    const list = categories();

    // Boutons de filtre : « Tous » + une puce par thème.
    el.cats.innerHTML = "";
    const make = (label, value, count) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cat" + (cat === value ? " active" : "");
      btn.innerHTML = "";
      btn.append(label);
      const c = document.createElement("span");
      c.className = "cat-count";
      c.textContent = count;
      btn.append(c);
      btn.addEventListener("click", () => {
        cat = value;
        rebuildOrder();
        render();
      });
      el.cats.append(btn);
    };
    make("Tous", "all", cards.length);
    list.forEach((name) => make(name, name, cards.filter((c) => c.cat === name).length));

    // Datalist du formulaire d'ajout.
    el.catList.innerHTML = "";
    list.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      el.catList.append(opt);
    });
  }

  function renderWordList() {
    const lang = activeLangObj();
    const masteredCount = cards.filter(isMastered).length;
    el.countInfo.textContent = cards.length + " mots · " + masteredCount + " maîtrisés";

    el.wordList.innerHTML = "";
    cards.forEach((c) => {
      const li = document.createElement("li");

      const lvl = levelOf(points(c));
      const dot = document.createElement("span");
      dot.className = "wl-dot level-" + lvl.key;
      dot.title = lvl.label;

      const ar = document.createElement("span");
      ar.className = "wl-ar" + (lang.nonLatin ? " non-latin" : "") + (lang.rtl ? " rtl" : "");
      ar.textContent = c.ar;

      const rest = document.createElement("span");
      rest.className = "wl-rest";
      rest.innerHTML = "<b></b>";
      rest.querySelector("b").textContent = c.fr;
      if (c.translit && lang.nonLatin) rest.append(" · " + c.translit);
      if (c.cat) {
        const tag = document.createElement("span");
        tag.className = "wl-cat";
        tag.textContent = c.cat;
        rest.append(" ", tag);
      }

      const edit = document.createElement("button");
      edit.className = "wl-edit";
      edit.type = "button";
      edit.title = "Modifier";
      edit.setAttribute("aria-label", "Modifier");
      edit.textContent = "✎";
      edit.addEventListener("click", () => editCard(c.id));

      const del = document.createElement("button");
      del.className = "wl-del";
      del.type = "button";
      del.title = "Supprimer";
      del.setAttribute("aria-label", "Supprimer");
      del.textContent = "🗑";
      del.addEventListener("click", () => removeCard(c.id));

      li.append(dot, ar, rest, edit, del);
      el.wordList.append(li);
    });
  }

  // --- Actions ---
  function next() { if (!order.length) return; pos = (pos + 1) % order.length; render(); }
  function prev() { if (!order.length) return; pos = (pos - 1 + order.length) % order.length; render(); }
  function flip() {
    if (el.card.classList.contains("empty-cta")) { guideToFirstCard(); return; }
    flipped = !flipped;
    el.card.classList.toggle("flipped", flipped);
  }

  // Clé du compteur correspondant au sens affiché (af = AR→FR, fa = FR→AR).
  function dirKey() { return curAr ? "af" : "fa"; }

  // Réussite : +1 au compteur du sens en cours, puis carte suivante.
  function pass() {
    const c = currentCard();
    if (!c) return;
    const wasMastered = isMastered(c);
    const k = dirKey();
    c[k] = (c[k] || 0) + 1;
    save();
    if (!wasMastered && isMastered(c)) celebrate();
    if (reviewOnly && isMastered(c)) {
      rebuildOrder();   // la carte maîtrisée sort du filtre « à revoir »
      render();
    } else {
      advanceAfterAnswer();
    }
  }

  // Échec : la série du sens en cours repart à zéro, puis carte suivante.
  function fail() {
    const c = currentCard();
    if (!c) return;
    c[dirKey()] = 0;
    save();
    advanceAfterAnswer();
  }

  function advanceAfterAnswer() {
    if (order.length <= 1) { render(); return; }
    pos = (pos + 1) % order.length;
    render();
  }

  function resetProgress() {
    if (!confirm("Remettre à zéro toute la progression (les compteurs de réussites) ? Les mots sont conservés.")) return;
    cards.forEach((c) => { c.af = 0; c.fa = 0; });
    save();
    rebuildOrder();
    render();
  }

  function submitForm(ev) {
    ev.preventDefault();
    const ar = el.inAr.value.trim();
    const fr = el.inFr.value.trim();
    if (!ar || !fr) return;
    const translit = el.inTranslit.value.trim();
    const newCat = el.inCat.value.trim() || (cat !== "all" ? cat : "Autres");
    if (!listExists(newCat)) lists.push(newCat);

    if (editingId) {
      const c = cards.find((x) => x.id === editingId);
      if (c) { c.ar = ar; c.fr = fr; c.translit = translit; c.cat = newCat; }
      cancelEdit();
    } else {
      cards.push({
        id: makeId(cards.length),
        ar, translit, fr, cat: newCat, af: 0, fa: 0,
      });
      el.addForm.reset();
      el.inAr.focus();
    }
    save();
    rebuildOrder();
    render();
  }

  function editCard(id) {
    const c = cards.find((x) => x.id === id);
    if (!c) return;
    editingId = id;
    el.inAr.value = c.ar;
    el.inTranslit.value = c.translit || "";
    el.inFr.value = c.fr;
    el.inCat.value = c.cat || "";
    el.submitBtn.textContent = "Enregistrer";
    el.cancelEditBtn.hidden = false;
    el.inFr.focus();
    el.addForm.scrollIntoView({ block: "nearest" });
  }

  function cancelEdit() {
    editingId = null;
    el.addForm.reset();
    el.submitBtn.textContent = "Ajouter";
    el.cancelEditBtn.hidden = true;
  }

  function removeCard(id) {
    if (editingId === id) cancelEdit();
    cards = cards.filter((c) => c.id !== id);
    save();
    rebuildOrder();
    render();
  }

  // Sauvegarde : télécharge le paquet (mots + progression) en JSON.
  function exportDeck() {
    const blob = new Blob([JSON.stringify(payload(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = "flashcards-arabe-" + date + ".json";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Restauration : remplace le paquet par le contenu d'un fichier JSON.
  function importDeck(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const st = fromStored(JSON.parse(reader.result));
        const total = st.languages.reduce((n, l) => n + l.cards.length, 0);
        if (!total) throw new Error("vide");
        if (!confirm("Remplacer tes données par l'import (" + total + " mots) ?")) return;
        languages = st.languages;
        activeLang = st.activeLang;
        loadActiveIntoWorking();
        ensureLists();
        cancelEdit();
        cat = "all";
        updateDirectionLabel();
        save();
        rebuildOrder();
        render();
      } catch (e) {
        alert("Fichier invalide : impossible d'importer ce paquet.");
      } finally {
        el.importFile.value = "";
      }
    };
    reader.readAsText(file);
  }

  function resetDeck() {
    if (!confirm("Réinitialiser la langue « " + activeLangObj().name + " » au paquet de départ ? Ses mots, listes et progression seront perdus.")) return;
    // Seul l'arabe a un paquet de départ ; les autres langues repartent à vide.
    cards = activeLang === "ar" ? seedFromDefaults() : [];
    lists = [];
    ensureLists();
    save();
    cancelEdit();
    reviewOnly = false;
    sensMode = "af";
    curId = null;
    cat = "all";
    el.reviewBtn.classList.remove("active");
    el.shuffleBtn.classList.remove("active");
    updateDirectionLabel();
    rebuildOrder();
    render();
  }

  // --- Gestion des listes ---
  function createList() {
    const name = (el.newListName.value || "").trim();
    if (!name) return;
    if (!listExists(name)) lists.push(name);
    cat = name;            // active la nouvelle liste (les ajouts iront dedans)
    el.newListName.value = "";
    save();
    rebuildOrder();
    render();
  }

  function renameList(name) {
    const nv = prompt("Nouveau nom pour la liste « " + name + " » :", name);
    if (nv === null) return;
    const nn = nv.trim();
    if (!nn || nn === name) return;
    if (listExists(nn)) { alert("Une liste « " + nn + " » existe déjà."); return; }
    const i = lists.indexOf(name);
    if (i >= 0) lists[i] = nn;
    cards.forEach((c) => { if (c.cat === name) c.cat = nn; });
    if (cat === name) cat = nn;
    save();
    rebuildOrder();
    render();
  }

  function deleteList(name) {
    const n = cards.filter((c) => c.cat === name).length;
    const msg = n
      ? "Supprimer la liste « " + name + " » et ses " + n + " mot(s) ?"
      : "Supprimer la liste vide « " + name + " » ?";
    if (!confirm(msg)) return;
    lists = lists.filter((l) => l !== name);
    cards = cards.filter((c) => c.cat !== name);
    if (cat === name) cat = "all";
    if (editingId) cancelEdit();
    save();
    rebuildOrder();
    render();
  }

  function renderListManager() {
    el.listManager.innerHTML = "";
    if (!lists.length) {
      const li = document.createElement("li");
      li.className = "lm-empty";
      li.textContent = "Aucune liste pour l'instant.";
      el.listManager.append(li);
      return;
    }
    lists.forEach((name) => {
      const count = cards.filter((c) => c.cat === name).length;
      const li = document.createElement("li");
      li.className = "lm-item" + (cat === name ? " active" : "");

      const nm = document.createElement("button");
      nm.type = "button";
      nm.className = "lm-name";
      nm.textContent = name;
      const cc = document.createElement("span");
      cc.className = "lm-count";
      cc.textContent = count;
      nm.append(cc);
      nm.title = "Réviser cette liste";
      nm.addEventListener("click", () => {
        cat = cat === name ? "all" : name;
        rebuildOrder();
        render();
      });

      const ren = document.createElement("button");
      ren.type = "button"; ren.className = "lm-act";
      ren.textContent = "✎"; ren.title = "Renommer"; ren.setAttribute("aria-label", "Renommer la liste");
      ren.addEventListener("click", () => renameList(name));

      const del = document.createElement("button");
      del.type = "button"; del.className = "lm-act";
      del.textContent = "🗑"; del.title = "Supprimer"; del.setAttribute("aria-label", "Supprimer la liste");
      del.addEventListener("click", () => deleteList(name));

      li.append(nm, ren, del);
      el.listManager.append(li);
    });
  }

  function updateDirectionLabel() {
    const ab = langAbbr(activeLangObj());
    el.directionLabel.textContent =
      sensMode === "af" ? ab + " → FR" : sensMode === "fa" ? "FR → " + ab : "Aléatoire";
  }

  // Petit éclat quand une carte vient d'être maîtrisée.
  function celebrate() {
    el.card.classList.remove("just-mastered");
    void el.card.offsetWidth; // relance l'animation
    el.card.classList.add("just-mastered");
  }

  // --- Langues ---
  function slugify(s) {
    return ((s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")) || "lang";
  }

  function switchLang(id) {
    if (id === activeLang) return;
    commitActiveLang();              // sauve la langue courante
    activeLang = id;
    loadActiveIntoWorking();
    migrate();
    ensureLists();
    cat = "all"; cancelEdit(); reviewOnly = false; sensMode = "af"; curId = null;
    el.reviewBtn.classList.remove("active");
    el.reviewBtn.setAttribute("aria-pressed", "false");
    updateDirectionLabel();
    save();
    rebuildOrder();
    render();
  }

  function addLanguage(name, rtl, nonLatin, presetId) {
    name = (name || "").trim();
    if (!name) return;
    let lo = languages.find((l) =>
      (presetId && l.id === presetId) || l.name.toLowerCase() === name.toLowerCase());
    if (!lo) {
      const id = presetId || (slugify(name) + "-" + Math.random().toString(36).slice(2, 5));
      lo = { id: id, name: name, rtl: !!rtl, nonLatin: !!nonLatin, cards: [], lists: [] };
      languages.push(lo);
    }
    closeLangModal();
    switchLang(lo.id);
  }

  function deleteLanguage(id) {
    if (languages.length <= 1) { alert("Garde au moins une langue."); return; }
    const lo = languages.find((l) => l.id === id);
    if (!lo) return;
    const n = lo.cards.length;
    if (!confirm("Supprimer la langue « " + lo.name + " »" + (n ? " et ses " + n + " mot(s)" : "") + " ?")) return;
    languages = languages.filter((l) => l.id !== id);
    if (activeLang === id) {
      activeLang = languages[0].id;
      loadActiveIntoWorking();
      migrate(); ensureLists();
      cat = "all"; updateDirectionLabel();
    }
    save();
    renderLangModal();
    rebuildOrder();
    render();
  }

  function renderLangBtn() {
    el.langBtnName.textContent = activeLangObj().name;
  }

  function openLangModal() { renderLangModal(); el.langModal.hidden = false; }
  function closeLangModal() { el.langModal.hidden = true; }

  function renderLangModal() {
    // Langues prédéfinies pas encore ajoutées.
    el.langPresets.innerHTML = "";
    const remaining = LANG_PRESETS.filter((p) => !languages.some((l) => l.id === p.id));
    remaining.forEach((p) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "lang-chip"; b.textContent = p.name;
      b.addEventListener("click", () => addLanguage(p.name, p.rtl, p.nonLatin, p.id));
      el.langPresets.append(b);
    });
    if (!remaining.length) {
      const s = document.createElement("span");
      s.className = "lm-empty";
      s.textContent = "Toutes les langues prédéfinies sont déjà ajoutées.";
      el.langPresets.append(s);
    }

    // Langues actuelles : cliquer le nom = changer de langue, 🗑 = supprimer.
    el.langExisting.innerHTML = "";
    languages.forEach((l) => {
      const row = document.createElement("div");
      row.className = "lang-exist-row" + (l.id === activeLang ? " active" : "");

      const pick = document.createElement("button");
      pick.type = "button"; pick.className = "lang-pick-name";
      pick.innerHTML = "";
      pick.append(l.name);
      const cc = document.createElement("span");
      cc.className = "lm-count";
      cc.textContent = l.cards.length;
      pick.append(cc);
      if (l.id === activeLang) {
        const chk = document.createElement("span");
        chk.className = "lang-active-chk"; chk.textContent = "✓";
        pick.append(chk);
      }
      pick.addEventListener("click", () => { switchLang(l.id); closeLangModal(); });

      const del = document.createElement("button");
      del.type = "button"; del.className = "lm-act";
      del.textContent = "🗑"; del.title = "Supprimer la langue";
      del.setAttribute("aria-label", "Supprimer la langue " + l.name);
      del.addEventListener("click", () => deleteLanguage(l.id));

      row.append(pick, del);
      el.langExisting.append(row);
    });
  }

  // Adapte le formulaire d'ajout à la langue active (sens d'écriture, phonétique).
  function adaptWordForm() {
    const lang = activeLangObj();
    el.inAr.dir = lang.rtl ? "rtl" : "ltr";
    el.inAr.placeholder = "Mot en " + lang.name.toLowerCase();
    el.inAr.classList.toggle("script-arabic", !!lang.nonLatin && !!lang.rtl);
    el.inTranslit.hidden = !lang.nonLatin;
    if (!lang.nonLatin) el.inTranslit.value = "";
  }

  // --- Branchement des événements ---
  function bind() {
    el.card.addEventListener("click", flip);
    el.card.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); flip(); }
    });

    // Boutons « indice » : révèlent la phonétique sans retourner la carte.
    [el.frontHintBtn, el.backHintBtn].forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        btn.closest(".phonetic").classList.add("revealed");
      });
    });

    el.nextBtn.addEventListener("click", next);
    el.prevBtn.addEventListener("click", prev);
    el.passBtn.addEventListener("click", pass);
    el.failBtn.addEventListener("click", fail);
    el.resetProgressBtn.addEventListener("click", resetProgress);

    el.shuffleBtn.addEventListener("click", () => {
      rebuildOrder();
      shuffleOrder();
      el.shuffleBtn.classList.add("active");
      render();
      setTimeout(() => el.shuffleBtn.classList.remove("active"), 600);
    });

    el.directionBtn.addEventListener("click", () => {
      sensMode = sensMode === "af" ? "fa" : sensMode === "fa" ? "mix" : "af";
      curId = null; // force un nouveau tirage en mode aléatoire
      updateDirectionLabel();
      render();
    });

    el.exportBtn.addEventListener("click", exportDeck);
    el.importBtn.addEventListener("click", () => el.importFile.click());
    el.importFile.addEventListener("change", importDeck);
    el.cancelEditBtn.addEventListener("click", cancelEdit);

    el.reviewBtn.addEventListener("click", () => {
      reviewOnly = !reviewOnly;
      el.reviewBtn.classList.toggle("active", reviewOnly);
      el.reviewBtn.setAttribute("aria-pressed", String(reviewOnly));
      rebuildOrder();
      render();
    });

    el.addForm.addEventListener("submit", submitForm);
    el.resetBtn.addEventListener("click", resetDeck);
    el.createListBtn.addEventListener("click", createList);
    el.newListName.addEventListener("keydown", (e) => {
      if (e.code === "Enter") { e.preventDefault(); createList(); }
    });
    el.loadStarterBtn.addEventListener("click", loadStarter);
    el.startEmptyBtn.addEventListener("click", startEmpty);
    el.welcomeCustomForm.addEventListener("submit", (e) => {
      e.preventDefault();
      pickWelcomeLang(el.welcomeLangName.value, el.welcomeRtl.checked, el.welcomeNonLatin.checked);
    });

    // Langues : pastille ouvre la modale (changer / ajouter / supprimer).
    el.langBtn.addEventListener("click", openLangModal);
    el.langModal.querySelectorAll("[data-langclose]").forEach((n) =>
      n.addEventListener("click", closeLangModal));
    document.addEventListener("keydown", (e) => {
      if (e.code === "Escape" && !el.langModal.hidden) closeLangModal();
    });
    el.langForm.addEventListener("submit", (e) => {
      e.preventDefault();
      addLanguage(el.langName.value, el.langRtl.checked, el.langNonLatin.checked);
      el.langForm.reset();
    });

    // Flèches clavier pour naviguer
    document.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT") return;
      if (e.code === "ArrowRight") next();
      else if (e.code === "ArrowLeft") prev();
      else if (e.code === "ArrowUp") { e.preventDefault(); pass(); }
      else if (e.code === "ArrowDown") { e.preventDefault(); fail(); }
    });
  }

  // --- Compte & synchronisation cloud (Supabase) ---
  function initAccount() {
    const cfg = window.SUPABASE_CONFIG || {};
    // Sans config ou sans SDK : pas de compte, l'app reste 100 % locale.
    if (!cfg.url || !cfg.anonKey || !window.supabase) return;

    sb = window.supabase.createClient(cfg.url, cfg.anonKey);
    el.accountBtn.hidden = false;

    el.authForm.addEventListener("submit", signInPassword);
    el.signupBtn.addEventListener("click", signUpPassword);
    el.forgotBtn.addEventListener("click", forgotPassword);
    el.recoveryForm.addEventListener("submit", handleRecovery);
    wireEye(el.authPassword, el.pwToggle);
    wireEye(el.newPw, el.newPwToggle);
    el.googleBtn.addEventListener("click", signInGoogle);
    el.authLogout.addEventListener("click", logout);

    // Ouverture / fermeture de la modale.
    el.accountBtn.addEventListener("click", openAuthModal);
    el.authModal.querySelectorAll("[data-close]").forEach((n) =>
      n.addEventListener("click", closeAuthModal));
    document.addEventListener("keydown", (e) => {
      if (e.code === "Escape" && !el.authModal.hidden) closeAuthModal();
    });

    // Session existante + réaction aux connexions/déconnexions.
    sb.auth.getSession().then(({ data }) => onAuth(data.session));
    sb.auth.onAuthStateChange((evt, session) => onAuth(session, evt));
  }

  // Envoi d'un email de réinitialisation du mot de passe.
  async function forgotPassword() {
    const email = el.authEmail.value.trim();
    if (!email) { el.authMsg.textContent = "Entre ton email ci-dessus, puis reclique."; return; }
    el.forgotBtn.disabled = true;
    el.authMsg.textContent = "Envoi…";
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() });
      if (error) throw error;
      el.authMsg.textContent = "Email de réinitialisation envoyé ! Vérifie ta boîte mail.";
    } catch (e) {
      el.authMsg.textContent = "Erreur : " + frError(e);
    } finally {
      el.forgotBtn.disabled = false;
    }
  }

  // Œil afficher/masquer réutilisable.
  function wireEye(input, btn) {
    btn.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.classList.toggle("on", show);
      btn.setAttribute("aria-pressed", String(show));
      btn.setAttribute("aria-label", show ? "Masquer le mot de passe" : "Afficher le mot de passe");
    });
  }

  // Retour via le lien de récupération : vue dédiée pour le nouveau mot de passe.
  function openRecovery() {
    el.authModal.hidden = false;
    el.authLoggedOut.hidden = true;
    el.authLoggedIn.hidden = true;
    el.authRecovery.hidden = false;
    el.recoveryMsg.textContent = "";
    el.newPw.value = "";
    setTimeout(() => { try { el.newPw.focus(); } catch (e) {} }, 50);
  }

  async function handleRecovery(ev) {
    ev.preventDefault();
    const pw = el.newPw.value;
    if (pw.length < 6) { el.recoveryMsg.textContent = "6 caractères minimum."; return; }
    el.recoveryMsg.textContent = "Enregistrement…";
    try {
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) throw error;
      el.authRecovery.hidden = true;
      refreshAccountUI();
      closeAuthModal();
      pullOrPush();
      alert("Mot de passe mis à jour. Tu es connecté.");
    } catch (e) {
      el.recoveryMsg.textContent = "Erreur : " + frError(e);
    }
  }

  function openAuthModal() {
    el.authModal.hidden = false;
    el.authMsg.textContent = "";
    const focusTarget = user ? el.authLogout : el.authEmail;
    if (focusTarget) focusTarget.focus();
  }
  function closeAuthModal() {
    el.authModal.hidden = true;
    el.accountBtn.focus();
  }

  function onAuth(session, evt) {
    const newUser = session ? session.user : null;
    const changed = (newUser && newUser.id) !== (user && user.id);
    user = newUser;
    refreshAccountUI();
    if (evt === "PASSWORD_RECOVERY") { openRecovery(); return; }
    if (user && changed) {
      if (!el.authModal.hidden) closeAuthModal();  // connexion réussie → on ferme
      pullOrPush();
    }
  }

  function refreshAccountUI() {
    const inLog = !!user;
    el.authLoggedOut.hidden = inLog;
    el.authLoggedIn.hidden = !inLog;
    if (inLog) el.authUser.textContent = user.email || "connecté";

    // Bouton de l'en-tête : « Se connecter » ou pastille verte + email complet.
    el.accountBtn.classList.toggle("is-connected", inLog);
    if (inLog) {
      el.accountBtn.innerHTML =
        '<span class="account-dot sync-ok" id="accDot"></span><span class="account-email"></span>';
      el.accountBtn.querySelector(".account-email").textContent = user.email || "Compte";
      el.accountBtn.title = "Connecté : " + (user.email || "");
    } else {
      el.accountBtn.textContent = "Se connecter";
      el.accountBtn.title = "Se connecter pour synchroniser";
    }
  }

  function setSync(state, text) {
    // state : "ok" | "pending" | "error"
    // Dans la modale : 3 couleurs (détail). Dans l'en-tête : vert sauf erreur (rouge).
    el.syncDot.className = "acc-dot sync-" + state;
    el.syncState.textContent = text || "";
    const accDot = document.getElementById("accDot");
    if (accDot) accDot.className = "account-dot sync-" + (state === "error" ? "error" : "ok");
  }

  function redirectTo() { return window.location.origin + window.location.pathname; }

  async function signInPassword(ev) {
    ev.preventDefault();
    const email = el.authEmail.value.trim();
    const password = el.authPassword.value;
    if (!email || !password) return;
    el.loginBtn.disabled = true;
    el.authMsg.textContent = "Connexion…";
    try {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      el.authMsg.textContent = "";
    } catch (e) {
      el.authMsg.textContent = "Erreur : " + frError(e);
    } finally {
      el.loginBtn.disabled = false;
    }
  }

  async function signUpPassword() {
    const email = el.authEmail.value.trim();
    const password = el.authPassword.value;
    if (!email || password.length < 6) {
      el.authMsg.textContent = "Entre un email et un mot de passe d'au moins 6 caractères.";
      return;
    }
    el.signupBtn.disabled = true;
    el.authMsg.textContent = "Création…";
    try {
      const { data, error } = await sb.auth.signUp({
        email, password, options: { emailRedirectTo: redirectTo() },
      });
      if (error) throw error;
      // Si la confirmation d'email est activée, pas encore de session.
      el.authMsg.textContent = data.session
        ? "Compte créé, connecté !"
        : "Compte créé ! Confirme ton email puis connecte-toi.";
    } catch (e) {
      el.authMsg.textContent = "Erreur : " + frError(e);
    } finally {
      el.signupBtn.disabled = false;
    }
  }

  async function signInGoogle() {
    el.authMsg.textContent = "Redirection vers Google…";
    try {
      const { error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectTo() },
      });
      if (error) throw error;
    } catch (e) {
      el.authMsg.textContent = "Erreur : " + frError(e);
    }
  }

  // Messages d'erreur courants traduits.
  function frError(e) {
    const m = (e && e.message) || "";
    if (/Invalid login credentials/i.test(m)) return "email ou mot de passe incorrect";
    if (/already registered/i.test(m)) return "cet email a déjà un compte — connecte-toi";
    if (/Email not confirmed/i.test(m)) return "email non confirmé (vérifie ta boîte mail)";
    if (/provider is not enabled/i.test(m)) return "Google n'est pas activé côté Supabase";
    return m || "réessaie";
  }

  async function logout() {
    await sb.auth.signOut();
    // Retour aux données locales.
    const st = load();
    languages = st.languages;
    activeLang = st.activeLang;
    loadActiveIntoWorking();
    migrate();
    ensureLists();
    rebuildOrder();
    render();
  }

  // À la connexion : si le cloud a déjà un paquet, on le récupère ;
  // sinon on y envoie le paquet local actuel.
  async function pullOrPush() {
    setSync("pending", "Synchro…");
    try {
      const { data, error } = await sb
        .from("decks").select("data").eq("user_id", user.id).maybeSingle();
      if (error) throw error;

      const remote = data && data.data ? fromStored(data.data) : null;
      const hasContent = remote && remote.languages.some((l) => l.cards.length);
      if (hasContent) {
        el.welcomeModal.hidden = true; // utilisateur existant : pas d'écran de bienvenue
        languages = remote.languages;
        activeLang = remote.activeLang;
        loadActiveIntoWorking();
        migrate();
        ensureLists();
        save();              // met aussi le cache local à jour
        cancelEdit();
        cat = "all";
        updateDirectionLabel();
        rebuildOrder();
        render();
        setSync("ok", "Synchronisé");
      } else {
        await cloudSyncNow(); // premier envoi du paquet local
      }
    } catch (e) {
      syncError(e);
    }
  }

  // Affiche un message d'erreur de synchro utile (et logue le détail en console).
  function syncError(e) {
    console.error("[Sync] erreur :", e);
    const m = (e && (e.message || e.error_description || e.hint)) || "";
    let hint = "Hors-ligne";
    if (/relation .*decks.* does not exist|Could not find the table|schema cache/i.test(m))
      hint = "Table « decks » absente — lance le script SQL";
    else if (/row-level security|RLS|permission denied|not authorized/i.test(m))
      hint = "Accès refusé (règles RLS manquantes)";
    else if (/JWT|token|Invalid API key/i.test(m))
      hint = "Clé/API invalide";
    else if (m)
      hint = "Erreur : " + m.slice(0, 60);
    setSync("error", hint);
  }

  function scheduleCloudSync() {
    if (!user) return;
    setSync("pending", "Synchro…");
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(cloudSyncNow, 1200);
  }

  async function cloudSyncNow() {
    if (!user || !sb) return;
    try {
      const { error } = await sb.from("decks").upsert({
        user_id: user.id,
        data: payload(),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setSync("ok", "Synchronisé");
    } catch (e) {
      syncError(e);
    }
  }

  // Normalise les cartes chargées (catégorie + scores par sens, anciens formats).
  function migrate() {
    const catByAr = {};
    (window.DEFAULT_WORDS || []).forEach((w) => { if (w.cat) catByAr[w.ar] = w.cat; });
    cards.forEach((c) => {
      if (!c.cat || c.cat === "Autres") c.cat = catByAr[c.ar] || c.cat || "Autres";
      if (typeof c.af !== "number" || typeof c.fa !== "number") {
        // Ancien format : un seul "score" (ou booléen "known") → réparti sur les deux sens.
        const s = typeof c.score === "number" ? c.score : (c.known ? MASTER : 0);
        c.af = Math.min(s, DIR_TARGET);
        c.fa = Math.max(0, Math.min(s - DIR_TARGET, DIR_TARGET));
      }
      delete c.known; delete c.score;
    });
  }

  // --- Onboarding (premier lancement) ---
  function openWelcome() {
    el.welcomeStep1.hidden = false;
    el.welcomeStep2.hidden = true;
    renderWelcomePresets();
    el.welcomeModal.hidden = false;
  }

  function renderWelcomePresets() {
    el.welcomePresets.innerHTML = "";
    LANG_PRESETS.forEach((p) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "lang-chip"; b.textContent = p.name;
      b.addEventListener("click", () => pickWelcomeLang(p.name, p.rtl, p.nonLatin, p.id));
      el.welcomePresets.append(b);
    });
  }

  // Choix de la 1re langue : remplace la langue par défaut.
  function pickWelcomeLang(name, rtl, nonLatin, presetId) {
    name = (name || "").trim();
    if (!name) return;
    const id = presetId || (slugify(name) + "-" + Math.random().toString(36).slice(2, 5));
    languages = [{ id: id, name: name, rtl: !!rtl, nonLatin: !!nonLatin, cards: [], lists: [] }];
    activeLang = id;
    loadActiveIntoWorking();
    updateDirectionLabel();
    if (presetId === "ar") {
      // Étape 2 : proposer la liste de base.
      el.welcomeStep1.hidden = true;
      el.welcomeStep2.hidden = false;
    } else {
      finishWelcome(true); // langue latine/autre : démarre à vide puis guide
    }
  }

  function loadStarter() {
    cards = seedFromDefaults();
    lists = [];
    ensureLists();
    finishWelcome(false);
  }
  function startEmpty() {
    cards = [];
    lists = [];
    finishWelcome(true);
  }

  function finishWelcome(isEmpty) {
    el.welcomeModal.hidden = true;
    cat = "all";
    save();           // crée l'entrée localStorage → la bienvenue ne réapparaît plus
    rebuildOrder();
    render();
    if (isEmpty) guideToFirstCard();
  }

  // Guide l'utilisateur vers l'ajout de son premier mot.
  function guideToFirstCard() {
    if (el.manageDetails) el.manageDetails.open = true;
    setTimeout(() => {
      try {
        el.addForm.scrollIntoView({ behavior: "smooth", block: "center" });
        el.inAr.focus();
      } catch (e) { /* ignore */ }
    }, 150);
  }

  function loadActiveIntoWorking() {
    const lo = activeLangObj();
    cards = lo.cards;
    lists = lo.lists;
  }

  // --- Démarrage ---
  function init() {
    const firstRun = localStorage.getItem(STORAGE_KEY) === null;
    const st = load();
    languages = st.languages;
    activeLang = st.activeLang;
    if (firstRun) {
      // Langue arabe vide ; l'utilisateur choisira via l'écran de bienvenue.
      languages = [arabicLang([], [])];
      activeLang = "ar";
    }
    loadActiveIntoWorking();
    migrate();
    ensureLists();
    if (!firstRun) save();
    updateDirectionLabel();
    rebuildOrder();
    bind();
    render();
    initAccount();
    if (firstRun) openWelcome();
  }

  init();
})();

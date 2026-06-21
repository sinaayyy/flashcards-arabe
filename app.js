/* Flashcards arabe — logique de l'application (vanilla JS).
   État sauvegardé dans localStorage sous la clé "flashcards-arabe". */

(function () {
  "use strict";

  const STORAGE_KEY = "flashcards-arabe";

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
  let cat = "all";         // catégorie / thème actif ("all" = tous)
  let editingId = null;    // id du mot en cours d'édition (null = ajout)

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
    exportBtn: document.getElementById("exportBtn"),
    importBtn: document.getElementById("importBtn"),
    importFile: document.getElementById("importFile"),
    resetBtn: document.getElementById("resetBtn"),
    wordList: document.getElementById("wordList"),
    countInfo: document.getElementById("countInfo"),
  };

  // --- Persistance ---
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) { /* ignore */ }
    return seedFromDefaults();
  }

  function seedFromDefaults() {
    const defaults = window.DEFAULT_WORDS || [];
    return defaults.map((w, i) => ({
      id: makeId(i),
      ar: w.ar, translit: w.translit || "", fr: w.fr,
      cat: w.cat || "Autres", af: 0, fa: 0,
    }));
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cards)); } catch (e) {}
  }

  function makeId(seed) {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7) + "-" + seed;
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

  // Liste ordonnée des catégories présentes (ordre de première apparition).
  function categories() {
    const seen = [];
    cards.forEach((c) => { if (c.cat && seen.indexOf(c.cat) === -1) seen.push(c.cat); });
    return seen;
  }

  // --- Rendu ---
  function render() {
    const c = currentCard();
    flipped = false;
    el.card.classList.remove("flipped");

    renderCats();
    renderStats();

    if (!c) {
      el.frontHint.textContent = "";
      el.frontMain.textContent = "Aucune carte";
      el.frontMain.className = "card-main";
      el.frontSub.textContent = reviewOnly ? "Tout est maîtrisé ici 🎉" : "Ajoute des mots ci-dessous";
      el.frontPhon.hidden = true;
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

    // Sens affiché : fixe (af/fa) ou aléatoire figé tant qu'on reste sur la carte.
    if (sensMode === "af") curAr = true;
    else if (sensMode === "fa") curAr = false;
    else if (c.id !== curId) curAr = Math.random() < 0.5;
    curId = c.id;

    // Face avant et arrière selon le sens
    if (curAr) {
      setFace("front", "arabe", c.ar, c.translit, true);
      setFace("back", "français", c.fr, "", false);
    } else {
      setFace("front", "français", c.fr, "", false);
      setFace("back", "arabe", c.ar, c.translit, true);
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

    // Deux jauges : AR→FR et FR→AR. Le sens en cours est mis en avant.
    const dirs = document.createElement("span");
    dirs.className = "m-dirs";
    [["AR→FR", af(c), curAr], ["FR→AR", fa(c), !curAr]].forEach(([name, n, current]) => {
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

  function setFace(side, hint, main, sub, isArabic) {
    el[side + "Hint"].textContent = hint;
    const mainEl = el[side + "Main"];
    mainEl.textContent = main;
    mainEl.className = "card-main" + (isArabic ? " arabic" : "");

    // Phonétique : masquée par défaut, révélée via le bouton « indice ».
    const phon = el[side + "Phon"];
    el[side + "Sub"].textContent = sub || "";
    phon.classList.remove("revealed");
    phon.hidden = !sub;
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
      ar.className = "wl-ar";
      ar.textContent = c.ar;

      const rest = document.createElement("span");
      rest.className = "wl-rest";
      rest.innerHTML = "<b></b>";
      rest.querySelector("b").textContent = c.fr;
      if (c.translit) rest.append(" · " + c.translit);
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
  function flip() { flipped = !flipped; el.card.classList.toggle("flipped", flipped); }

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
    const blob = new Blob([JSON.stringify(cards, null, 2)], { type: "application/json" });
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
        const parsed = JSON.parse(reader.result);
        if (!Array.isArray(parsed) || !parsed.length) throw new Error("vide");
        if (!confirm("Remplacer le paquet actuel par les " + parsed.length + " mots importés ?")) return;
        cards = parsed.map((w, i) => ({
          id: w.id || makeId(i),
          ar: w.ar || "", translit: w.translit || "", fr: w.fr || "",
          cat: w.cat || "Autres",
          af: Math.min(Math.max(+w.af || 0, 0), DIR_TARGET),
          fa: Math.min(Math.max(+w.fa || 0, 0), DIR_TARGET),
        })).filter((w) => w.ar && w.fr);
        cancelEdit();
        cat = "all";
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
    if (!confirm("Réinitialiser au paquet de départ ? Tes ajouts et ta progression seront perdus.")) return;
    cards = seedFromDefaults();
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

  function updateDirectionLabel() {
    el.directionLabel.textContent =
      sensMode === "af" ? "AR → FR" : sensMode === "fa" ? "FR → AR" : "Aléatoire";
  }

  // Petit éclat quand une carte vient d'être maîtrisée.
  function celebrate() {
    el.card.classList.remove("just-mastered");
    void el.card.offsetWidth; // relance l'animation
    el.card.classList.add("just-mastered");
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

    // Flèches clavier pour naviguer
    document.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT") return;
      if (e.code === "ArrowRight") next();
      else if (e.code === "ArrowLeft") prev();
      else if (e.code === "ArrowUp") { e.preventDefault(); pass(); }
      else if (e.code === "ArrowDown") { e.preventDefault(); fail(); }
    });
  }

  // --- Démarrage ---
  function init() {
    cards = load();
    // Correspondance mot arabe -> thème, d'après le paquet de départ.
    const catByAr = {};
    (window.DEFAULT_WORDS || []).forEach((w) => { if (w.cat) catByAr[w.ar] = w.cat; });

    // Migration des anciennes données (catégorie + scores par sens).
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
    save(); // fige le paquet de départ au premier lancement
    updateDirectionLabel();
    rebuildOrder();
    bind();
    render();
  }

  init();
})();

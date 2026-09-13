# Reprise — bloc « Jumu'a »

Note de passation écrite le 2026-08-07, mise à jour le 2026-09-13 : le bloc est
mergé et déployé. Le fichier reste tant que la réserve sur la vocalisation
n'est pas levée — il documente aussi comment régénérer le corpus.

## Où on en est

**Mergé dans `main` le 2026-09-13** (commit `2307b56`, rebasé sur le bloc
« Cours 2 — hammam »). `app.js` : `KIT_CATS` passe de 2 à 6 entrées.
`words.js` : 275 cartes ajoutées à `DEFAULT_WORDS`.

**275 cartes** en 4 listes opt-in :

| Catégorie (`cat`) | Cartes |
|---|---|
| `Jumu'a — Rituel & ouverture` | 55 |
| `Jumu'a — Vocabulaire du sermon` | 98 |
| `Jumu'a — Coran & hadith` | 61 |
| `Jumu'a — Thèmes fréquents` | 61 |

## Vérification navigateur — faite le 2026-09-13

Le point qui bloquait. L'extension Claude in Chrome n'était toujours pas
joignable ; la vérification a été faite avec Playwright, en mesurant les
478 cartes du paquet à 320, 375 et 1280 px.

- Les 4 puces `Jumu'a — …` s'affichent en `0/55`, `0/98`, `0/61`, `0/61`.
- Un clic charge la liste (185 → 246 cartes pour « Coran & hadith »), la puce
  passe en `✓`, la catégorie apparaît dans le filtre, la progression est
  conservée.
- **Aucune carte n'est coupée**, sur les 478. Les trois cartes identifiées
  comme les plus à risque tiennent en entier :
  `الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ` s'affiche sur 3 lignes
  dans une carte de 362 px.
- « Réinitialiser » → paquet de départ de 185 cartes, dont **0** Jumu'a.
- 0 erreur console.

La cause du risque a d'ailleurs été corrigée à la racine : `.card-face` était
en `position:absolute; inset:0` dans une `.card` en `display:grid`, donc les
faces ne poussaient pas la hauteur du parent et tout texte arabe passant à la
2e ligne était tronqué (`overflow:hidden` ne scrolle pas). Les faces sont
passées en `grid-area: 1 / 1` — voir le commentaire dans `style.css:659`.
Avant ce correctif, 17 cartes du paquet étaient coupées à 375 px, dont 4 déjà
en production.

## Ce qui a déjà été vérifié (en headless, Node)

- `node --check` OK sur `words.js` et `app.js`
- 409 entrées dans `DEFAULT_WORDS`, 0 incomplète
- 0 doublon arabe dans le bloc, 0 collision sur la clé `ar|fr` (celle qu'utilise
  `loadKit()` pour dédoublonner) sur l'ensemble du paquet
- 0 carte > 8 mots, 0 carte sans vocalisation
- Paquet de départ après filtre `KIT_CATS` = 116 cartes, dont **0 Jumu'a**
- Les 4 puces se calculent avec les bons compteurs

Commande de contrôle rapide :

```bash
node -e "global.window={};require('./words.js');
const w=window.DEFAULT_WORDS, c={};
w.forEach(x=>c[x.cat]=(c[x.cat]||0)+1);
Object.keys(c).filter(k=>k.startsWith('Jumu')).forEach(k=>console.log(c[k],k));"
```

## La réserve qui reste

**La vocalisation n'est pas sourcée.** Les textes du corpus ne sont pas
vocalisés : l'analyse de fréquence a dit *quels* mots méritaient une carte, mais
les harakat et l'i'rab des 275 cartes ont été écrits par Claude. C'est le point le
plus susceptible de contenir une erreur, et une harakat fausse s'apprend mal.
Une relecture par quelqu'un de solide en grammaire arabe serait utile.

**Traductions du sens, sans glose.** Les citations coraniques et fragments de
hadith sont rendus au sens, sans interprétation. Rien n'a été tranché sur des
points demandant un arbitrage théologique. Signaler tout terme mal rendu plutôt
que de supposer un choix délibéré.

## Le corpus (`_jumua-corpus/`, gitignoré)

- `corpus/` — 200 khutbas en texte intégral (2,5 Mo), une par fichier
- `crawl.py` — le crawler (Alukah, section « منبر الجمعة »)
- `freq.py` — l'analyse : unigrammes + n-grammes 2-5, classés par **document
  frequency** (part des 200 sermons où la forme apparaît), pas par compte brut
- `freq.txt` — la sortie complète, c'est le fichier à rouvrir pour arbitrer
  l'ajout ou le retrait d'une carte
- `unigrams.json` — top 1500 unigrammes, `{forme: [DF, TF]}`

Pour régénérer (~15 min) :

```bash
cd _jumua-corpus && python crawl.py 200 && python freq.py > freq.txt
```

Source : <https://www.alukah.net/sharia/1128/> — ≥40 pages × 30 sermons.
Autres archives repérées et accessibles, non exploitées : habous.gov.ma
(khutbas officielles marocaines, titres vocalisés — nécessite `curl -k`),
awqaf.gov.jo, et sermons.islamic.network/uae-awqaf (khutbas des EAU traduites
en anglais, utile pour recouper des traductions ; l'arabe n'y est qu'en audio).

## Repères dans le code

- `words.js` — le bloc est en fin de `window.DEFAULT_WORDS`, sous le commentaire
  `// 🕌 Bloc « Jumu'a »`
- `app.js:262` — `KIT_CATS` : les catégories qui y figurent sont exclues du
  paquet de base (`seedFromDefaults()`) et deviennent des listes chargeables
- `app.js:272-308` — `packCategories()` / `kitCardsFor()` / `loadKit()` dérivent
  tout automatiquement du champ `cat` : **aucun autre câblage n'est nécessaire**
  pour ajouter une liste

## Suite envisagée

Avant ce bloc, la piste retenue était les **statistiques** (historique, séries de
jours, courbe de progression). Elle reste à faire.

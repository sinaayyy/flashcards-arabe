# Reprise — bloc « Jumu'a »

Note de passation, écrite le 2026-08-07. À supprimer une fois la feature validée
et mergée.

## Où on en est

Branche **`feat/bloc-jumua`**. Le travail est **fait et non commité** :

```
 M .gitignore     ignore _jumua-corpus/
 M README.md      +4 lignes dans « Fonctionnalités »
 M app.js         KIT_CATS passe de 2 à 6 entrées (ligne ~262)
 M words.js       +307 lignes : 275 cartes ajoutées à DEFAULT_WORDS
?? REPRISE-jumua.md   ce fichier
?? _jumua-corpus/     corpus + scripts (gitignoré)
```

**275 cartes** en 4 listes opt-in :

| Catégorie (`cat`) | Cartes |
|---|---|
| `Jumu'a — Rituel & ouverture` | 55 |
| `Jumu'a — Vocabulaire du sermon` | 98 |
| `Jumu'a — Coran & hadith` | 61 |
| `Jumu'a — Thèmes fréquents` | 61 |

## Ce qui reste à faire

**La vérification visuelle en navigateur.** C'est le seul point ouvert.

L'extension Claude in Chrome a été installée en cours de session mais n'était pas
visible depuis celle-ci (liste d'outils figée au démarrage du CLI). Il faut une
**nouvelle session Claude Code** pour qu'elle soit détectée — `/chrome` si la
connexion ne se fait pas seule.

Pour servir le site en local :

```bash
cd flashcards-arabe
python -m http.server 8765
# puis http://127.0.0.1:8765/index.html
```

À contrôler :

1. Onglet **Gérer** → « Listes prêtes à charger » : les 4 puces `Jumu'a — …`
   avec `0/55`, `0/98`, `0/61`, `0/61`.
2. Cliquer une puce → les cartes se chargent, la liste apparaît dans le filtre
   par catégorie, la puce passe en `✓` une fois tout chargé.
3. Réviser dans les deux sens (AR→FR et FR→AR) : affichage RTL, vocalisation,
   translittération.
4. **Largeur mobile ~375 px** — le point le plus important. `.card-face` est en
   `position:absolute; inset:0; overflow:hidden` (`style.css:659`) sur une carte
   de 250 px en mobile (`style.css:1266`) : un texte trop long est **coupé, pas
   scrollé**. Les cartes ont été plafonnées à 8 mots arabes, mais c'est une
   estimation, pas une mesure. Vérifier les plus longues :
   - `الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ` (7 mots, 62 caractères)
   - `وَمَا خَلَقْتُ الْجِنَّ وَالْإِنْسَ إِلَّا لِيَعْبُدُونِ`
   - `وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ`
5. « Réinitialiser » → vérifier que le paquet de départ (116 cartes) ne contient
   **aucune** carte Jumu'a.
6. Recharger la page → cartes chargées et progression conservées (`localStorage`).

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

## Deux réserves à lever avant mise en ligne

**1. La vocalisation n'est pas sourcée.** Les textes du corpus ne sont pas
vocalisés : l'analyse de fréquence a dit *quels* mots méritaient une carte, mais
les harakat et l'i'rab des 275 cartes ont été écrits par Claude. C'est le point le
plus susceptible de contenir une erreur, et une harakat fausse s'apprend mal.
Une relecture par quelqu'un de solide en grammaire arabe serait utile.

**2. Traductions du sens, sans glose.** Les citations coraniques et fragments de
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

# Flashcards arabe

Petit site pour réviser du vocabulaire arabe avec des flashcards. 100 % statique
(HTML/CSS/JS), aucune installation, aucune base de données.

## Fonctionnalités
- Cartes recto/verso : arabe + translittération + français.
- Retourner la carte (clic ou barre Espace), naviguer (boutons ou flèches ← →).
- 🔀 Mélanger le paquet (ordre aléatoire).
- ↔︎ Inverser le sens (AR → FR ou FR → AR).
- 🎯 Réviser seulement les mots « à revoir ».
- Marquer un mot « connu », compteur de progression.
- Ajouter / supprimer des mots (sauvegardés dans le navigateur via `localStorage`).
- Bouton pour réinitialiser au paquet de départ.
- 🚿 Cours 2 « الحمّام » : 69 cartes en 2 listes — le lexique de la salle de bain
  et de la routine (48), et les أسماء الإشارة / démonstratifs (21). Chargeables
  depuis l'onglet « Gérer » sans perdre la progression en cours.
- 🕌 Bloc « Jumu'a » : 275 cartes pour suivre la prêche du vendredi en arabe
  littéraire, en 4 listes à charger à la demande (rituel & ouverture, vocabulaire
  du sermon, coran & hadith, thèmes fréquents). Construit à partir d'une analyse
  de fréquence sur un corpus de 200 khutbas complètes.

## Utilisation en local
Ouvre simplement `index.html` dans ton navigateur (double-clic).

Pour modifier la liste de départ à la main, édite `words.js`.

## Déploiement sur Vercel

Le site est statique : Vercel le déploie sans aucune configuration.

### Option 1 — Glisser-déposer (le plus simple)
1. Va sur [vercel.com](https://vercel.com) et connecte-toi.
2. « Add New… » → « Project ».
3. Fais glisser le dossier `flashcards-arabe` dans la zone d'import (ou utilise
   l'option de déploiement par dossier).
4. Clique sur **Deploy**. C'est en ligne.

### Option 2 — Avec la CLI Vercel
```bash
npm i -g vercel
cd flashcards-arabe
vercel
```
Suis les questions (accepte les valeurs par défaut), puis `vercel --prod` pour la
mise en production.

### Option 3 — Via GitHub
1. Pousse le dossier `flashcards-arabe` sur un dépôt GitHub.
2. Sur Vercel : « Add New… » → « Project » → importe le dépôt.
3. Aucun réglage de build nécessaire (Framework Preset : « Other »). Deploy.

> Note : les mots ajoutés et la progression sont stockés dans le navigateur de
> chaque visiteur (`localStorage`). Il n'y a pas de données partagées entre
> appareils — parfait pour un usage personnel de révision.

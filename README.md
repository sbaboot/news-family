# Briefing quotidien

Site statique à deux onglets (**Sébastien** / **Diabète**) qui affiche l'actualité du jour,
mise à jour automatiquement toutes les 3 heures via une GitHub Action, et publié sur GitHub Pages.

- **Sébastien** : Monde, Canada, Québec, France, Veille technologique
- **Diabète** : actualité diabète en français et en anglais, mélangée et triée par date.
  Combine 5 médias spécialisés (Diabétologie Pratique, Diabetes Daily, Insulin Nation,
  ScienceDaily) et 4 recherches Google News (FR, FR-Canada, EN-US, EN-UK) qui agrègent
  elles-mêmes des centaines de sources — jusqu'à 40 articles gardés par cycle.

## Comment ça marche

1. Une GitHub Action (`.github/workflows/update-news.yml`) tourne toutes les 3 heures.
2. Elle exécute `scripts/fetch_news.py`, qui va lire les flux RSS listés dans `feeds.yaml`
   et écrit le résultat dans `data/news.json`.
3. Si `data/news.json` a changé, l'Action le commit et le pousse sur `main`.
4. GitHub Pages sert directement les fichiers statiques (`index.html`, `style.css`, `app.js`)
   qui vont chercher `data/news.json` à chaque visite : c'est ce qui rend le site "live".

Aucun serveur, aucune base de données : tout est statique + un cron GitHub gratuit.

## Déploiement — étape par étape

### 1. Crée le repo sur GitHub
Sur [github.com/new](https://github.com/new), crée un nouveau repo (ex: `briefing-quotidien`),
public de préférence (GitHub Pages est gratuit sur les repos publics).

### 2. Pousse ce dossier
Depuis ce dossier, en local :

```bash
git init
git add .
git commit -m "Site initial"
git branch -M main
git remote add origin https://github.com/<ton-compte>/briefing-quotidien.git
git push -u origin main
```

### 3. Active GitHub Pages
Dans le repo GitHub → **Settings → Pages** :
- Source : **Deploy from a branch**
- Branch : **main** / **/ (root)**
- Save

Ton site sera disponible à `https://<ton-compte>.github.io/briefing-quotidien/` (peut prendre 1-2 min).

### 4. Autorise l'Action à commit (important)
Dans **Settings → Actions → General → Workflow permissions** :
- Coche **"Read and write permissions"**
- Save

Sans ça, l'Action ne pourra pas pousser les mises à jour de `data/news.json`.

### 5. Lance la première mise à jour manuellement
Dans l'onglet **Actions** du repo → workflow **"Mise à jour des actualités"** → **Run workflow**.
Ça peuple `data/news.json` tout de suite, sans attendre le premier cycle de 3h.

C'est tout — le site va maintenant se mettre à jour tout seul.

## Personnaliser

- **Sources et mots-clés** : tout est dans `feeds.yaml`. Ajoute/retire des flux RSS,
  ajuste les `max_items`, ou ajoute un nouvel onglet (chaque clé de premier niveau = un onglet,
  pris en compte automatiquement par `scripts/fetch_news.py`).
- **Fréquence de mise à jour** : modifie le `cron` dans `.github/workflows/update-news.yml`
  (actuellement `0 */3 * * *` = toutes les 3h).
- **Design** : tout est dans `style.css` (variables CSS en haut du fichier pour changer
  les couleurs, clair/sombre automatique selon le système).

## À savoir sur Google News

Les liens Google News passent par une redirection (`news.google.com/rss/articles/...`)
avant d'arriver sur l'article réel — c'est normal, ça fonctionne, juste un clic
intermédiaire invisible. Le script récupère aussi le vrai nom du média (ex: "Le Monde",
"Reuters") depuis chaque article agrégé plutôt que d'afficher "Google News" partout.

## Structure du projet

```
index.html              page unique, deux onglets
style.css                design
app.js                   charge data/news.json et affiche les cartes
feeds.yaml                configuration des flux RSS par section
scripts/fetch_news.py     script qui génère data/news.json
data/news.json            données actuelles (généré automatiquement)
.github/workflows/update-news.yml   cron GitHub Actions
requirements.txt          dépendances Python du script
```

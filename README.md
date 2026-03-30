# 🚀 Shaarp Universal Expo Scraper (V2 Tout-Terrain)

> **L'agent d'extraction B2B intelligent qui transforme n'importe quel site de salon en une base de données qualifiée.**

Bienvenue dans l'**Universal Deep Scraper**, une solution de prospection automatisée développée pour **Shaarp**. Cet agent n'est pas un simple scraper statique : il utilise l'**Intelligence Artificielle** pour comprendre dynamiquement la structure de n'importe quel site web de salon professionnel et en extraire l'intégralité des données de contact.

---

## 🔥 Caractéristiques "Tout-Terrain"

### 🤖 Analyse de Structure par LLM (V2)
Fini les sélecteurs CSS codés en dur. À chaque nouveau site, l'agent effectue une **Phase 0 d'analyse** : il observe les liens, les boutons et le comportement de la page pour identifier automatiquement comment naviguer et où se cachent les fiches exposants.

### 🔄 Moteur de Navigation Hybride
Que le salon utilise une **Pagination classique**, un **Défilement Infini (Infinite Scroll)** ou un bouton **"Charger plus"**, l'agent s'adapte. Il moissonne les liens en boucle jusqu'à l'épuisement total de la liste.

### 📱 Extraction "Icon-Aware" (Socials & Contacts)
L'agent ne se contente pas de lire le texte. Il analyse les métadonnées des icônes (`aria-label`, `title`, `alt`) pour identifier les réseaux sociaux (LinkedIn, X, Facebook, Instagram, etc.) même lorsqu'aucun texte n'est présent.

### 🔬 Scan DOM Profond
- **Emails & Téléphones** : Extraction directe des liens `mailto:` et `tel:` cachés dans le code.
- **Nettoyage Anti-Obstacle** : Suppression automatique des bannières de cookies et modales RGPD qui bloquent la navigation.
- **Parallélisation Massive** : Traitement par batchs de 5 fiches simultanées pour une vitesse d'exécution optimale.

---

## 🛠 Stack Technique

- **Framework** : [Next.js 16](https://nextjs.org/) (App Router & Turbopack)
- **IA Orchestration** : [Vercel AI SDK](https://sdk.vercel.ai/) & [GPT-4.1-mini](https://openai.com/)
- **Automation** : [Playwright](https://playwright.dev/) (Headless Browser)
- **Styling** : TailwindCSS & Framer Motion (Animations dynamiques)
- **Data** : Zod (Validation stricte des schémas de contact)

---

## 🚀 Installation Rapide

1. **Cloner le dépôt** :
   ```bash
   git clone https://github.com/supermedmed-hash/Challenge-48H.git
   cd shaarp-scraper
   ```

2. **Installer les dépendances** :
   ```bash
   npm install
   npm install next-themes
   npx playwright install chromium
   ```

3. **Configuration** :
   Créez un fichier `.env.local` à la racine et ajoutez votre clé OpenAI :
   ```env
   OPENAI_API_KEY=votre_cle_ici
   ```

4. **Lancer l'application** :
   ```bash
   npm run dev
   ```

---

## 📖 Utilisation

1. **Lancez le scan** : Fournissez simplement l'URL de la liste des exposants (ex: MWC Barcelona, VivaTech).
2. **Suivez le robot** : Le chat affiche en temps réel les étapes (Analyse de structure -> Collecte -> Extraction).
3. **Exportez vos Leads** : Une fois terminé, cliquez sur **"Export CSV"** pour obtenir votre fichier de prospection prêt à l'emploi.

---

## 🏗️ Architecture des Branches

- **`master`** : Branche principale stable, robuste et optimisée.
- **`DEV`** : Branche de développement pour les itérations UI/UX et les tests de nouvelles fonctionnalités.

---

*Développé avec ❤️ pour Shaarp par Antigravity Agent.*

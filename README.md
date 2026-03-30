# Shaarp Expo Scraper - Hackathon MVP

Bienvenue dans l'Exhibition Scraper Agent, un outil construit en 48h pour la startup **Shaarp** dans le cadre du Hackathon.  
Cet agent navigue de manière autonome sur les sites web de salons professionnels et extrait la liste des exposants de manière intelligente grâce à l'IA.

## Architecture

Ce projet utilise une stack performante :
- **Next.js 14/15 (App Router)** pour structurer l'interface et l'API IA.
- **shadcn/ui & TailwindCSS** pour un design moderne, vibrant, et dynamique.
- **Vercel AI SDK** pour le flux conversationnel et l'outillage (`tools`). Zod est employé pour garantir la structure (JSON schema) de l'extraction.
- **Playwright** pour assurer l'accès aux sites qui chargent dynamiquement via JavaScript (contournant via un délai random et l'auto-scroll).

La logique globale sépare nettement :
- `components/Chat.tsx` & `ExhibitorsTable.tsx` pour l'interface client (réactive, avec téléchargement CSV en local).
- `api/chat/route.ts` & `lib/tools/scrapeExhibitors.ts` pour la récupération serveur, l'headless browser et le prompt Engineering.

## Installation

1. Pré-requis matériels et logiciels : **NodeJS 18+** et connexion réseau directe.
2. Installation des dépendances locales :
   ```bash
   npm install
   ```
3. Installation du navigateur Headless pour l'extraction :
   ```bash
   npx playwright install chromium
   ```
4. Configuration des clés d'API :
   - Dupliquez le fichier `.env.example` vers un nouveau fichier `.env.local`
   - Modifiez `OPENAI_API_KEY` avec votre clé de service.

## Lancement Local

Pour démarrer votre environnement de développement :
```bash
npm run dev
```

Ouvrez ensuite [http://localhost:3000](http://localhost:3000) :
1. Envoyez l'URL du salon dans le chat.
2. Suivez le feedback de l'IA.
3. Bénéficiez du tableau une fois le web-scraping complété et téléchargez le résultat via le bouton *"Export CSV"*.

import { chromium, Page, BrowserContext } from 'playwright';
import { generateObject, zodSchema } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { singleExhibitorProcessSchema, Exhibitor } from '../schema';

/**
 * BIENVENUE DANS LE CŒUR DU ROBOT (SCRAPER)
 * Ce fichier contient toute la logique pour naviguer sur le web,
 * trouver des entreprises et extraire leurs informations.
 */

/** 
 * UTILS : Petites fonctions d'aide pour le comportement du robot 
 */

/** 
 * Délai humain : Le robot attend un temps aléatoire entre deux actions.
 * Pourquoi ? Pour ne pas être détecté comme un robot qui clique trop vite.
 */
const randomDelay = (min = 800, max = 2500) => {
  // On privilégie les délais courts (85% du temps), mais parfois on fait une pause plus longue.
  const rand = Math.random();
  const weighted = rand < 0.85 ? rand / 0.85 : 1;
  const delay = Math.floor(min + weighted * (max - min));
  return new Promise(resolve => setTimeout(resolve, delay));
};

/** Backoff exponentiel avec jitter pour les retry */
const backoffDelay = (attempt: number) => {
  const base = Math.min(1000 * Math.pow(2, attempt), 30000);
  const jitter = Math.random() * 1000;
  return new Promise(resolve => setTimeout(resolve, base + jitter));
};

/** 
 * Retry générique : Si une action échoue (ex: bug réseau), on réessaie jusqu'à 3 fois.
 * On attend de plus en plus longtemps entre chaque essai (backoff).
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  label = 'operation'
): Promise<T | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isLast = attempt === maxAttempts - 1;
      const status = err?.response?.status || err?.status;

      if (status === 429 || status === 503) {
        // 429 = Trop de requêtes. Le site nous dit de ralentir.
        await backoffDelay(attempt + 2);
      } else if (isLast) {
        console.error(`[${label}] Échec après ${maxAttempts} tentatives:`, err?.message);
        return null;
      } else {
        await backoffDelay(attempt);
      }
    }
  }
  return null;
}

// ========================================
// Scroll & DOM Helpers
// ========================================

/**
 * Scroll incrémental avec détection de nouveaux éléments.
 * Retourne le nombre de nouveaux nœuds apparus pendant le scroll.
 */
async function autoScrollAndDetectNew(page: Page, selector: string): Promise<number> {
  return page.evaluate(async (sel: string) => {
    const countBefore = document.querySelectorAll(sel).length;

    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      let stableCount = 0;
      let lastHeight = document.body.scrollHeight;

      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;

        const newHeight = document.body.scrollHeight;
        if (newHeight === lastHeight) {
          stableCount++;
          if (stableCount >= 5 || totalHeight > 40000) {
            clearInterval(timer);
            resolve();
          }
        } else {
          stableCount = 0;
          lastHeight = newHeight;
        }
      }, 150);
    });

    return document.querySelectorAll(sel).length - countBefore;
  }, selector);
}

/**
 * Nettoyage : Supprime les bannières de cookies, les popups et les overlays 
 * qui pourraient empêcher le robot de cliquer sur les boutons.
 */
async function cleanPageObstacles(page: Page) {
  try {
    await page.evaluate(() => {
      const selectors = [
        '[id*="cookie"]', '[class*="cookie"]', '[id*="consent"]', '[class*="consent"]',
        '.modal-backdrop', '.modal-open', '.sp-overlay', '#onetrust-banner-sdk',
        '.gdpr-banner', '.didomi-popup-view', '[id*="gdpr"]', '[class*="gdpr"]',
        '[class*="overlay"]', '[id*="overlay"]',
      ];
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => (el as HTMLElement).style.display = 'none');
      });
      // On s'assure que le scroll n'est pas bloqué par une popup fermée
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    });
  } catch { }
}

/**
 * Attend qu'un sélecteur produise plus d'éléments qu'avant.
 * Utile après un clic de pagination pour confirmer que le DOM a changé.
 */
async function waitForMoreElements(
  page: Page,
  selector: string,
  previousCount: number,
  timeout = 8000
): Promise<boolean> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const count = await page.evaluate(
      (sel: string) => document.querySelectorAll(sel).length,
      selector
    );
    if (count > previousCount) return true;
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

/**
 * PHASE 0 : ANALYSE DE LA PAGE
 * On demande à l'Intelligence Artificielle (GPT-4 mini) de regarder le code HTML
 * et de nous dire où se trouvent les liens des exposants et le bouton "Suivant".
 */

type NavType = 'pagination' | 'infiniteScroll' | 'loadMore';

interface PageSelectors {
  exhibitorSelector: string; // Où sont les liens des entreprises ?
  nextSelector: string;      // Où est le bouton "Suivant" ?
  navType: NavType;          // Comment on change de page sur ce site ?
  fallbackExhibitorSelectors: string[]; // Solutions de secours si le premier sélecteur rate.
}

async function analyzePageStructure(page: Page): Promise<PageSelectors> {
  // On envoie au LLM un snapshot HTML structurel réel (pas juste les liens)
  const structureData = await page.evaluate(() => {
    // Récupère les 80 premiers liens avec leur contexte HTML complet
    const anchors = Array.from(document.querySelectorAll('a[href]')).slice(0, 80);
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]')).slice(0, 30);

    // Extrait un aperçu HTML de la zone principale de contenu
    const mainZone =
      document.querySelector('main, [role="main"], #content, .content, #exhibitors, .exhibitors-list') ||
      document.body;
    const htmlSnippet = mainZone.innerHTML
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .substring(0, 6000); // Plus de contexte HTML réel

    return {
      url: window.location.href,
      title: document.title,
      htmlSnippet,
      links: anchors.map(a => ({
        text: (a as HTMLElement).innerText.substring(0, 60).trim(),
        href: (a as HTMLAnchorElement).href,
        className: a.className.substring(0, 80),
        id: a.id,
        parentTag: a.parentElement?.tagName,
        parentClass: a.parentElement?.className.substring(0, 80),
        grandParentTag: a.parentElement?.parentElement?.tagName,
        ariaLabel: a.getAttribute('aria-label') || '',
        rel: a.getAttribute('rel') || '',
      })),
      buttons: buttons.map(b => ({
        text: (b as HTMLElement).innerText.substring(0, 40).trim(),
        className: b.className.substring(0, 80),
        id: b.id,
        ariaLabel: b.getAttribute('aria-label') || '',
        dataAttrs: Object.fromEntries(
          Array.from(b.attributes)
            .filter(a => a.name.startsWith('data-'))
            .map(a => [a.name, a.value])
        ),
      })),
      // Patterns d'URL pour détecter la pagination
      paginationLinks: anchors
        .filter(a => /page[=\/]\d|p=\d|\?p\d|\/\d+$/.test((a as HTMLAnchorElement).href))
        .map(a => ({ href: (a as HTMLAnchorElement).href, text: (a as HTMLElement).innerText.trim() }))
        .slice(0, 10),
    };
  });

  const { object } = (await generateObject({
    model: openai.chat('gpt-4.1-mini'),
    schema: zodSchema(z.object({
      exhibitorSelector: z.string().describe(
        "Sélecteur CSS PRÉCIS pour les liens vers les fiches exposants individuels. " +
        "Doit cibler les <a> ou conteneurs cliquables. Exemple: 'ul.exhibitor-list li a', '.card--exhibitor a.card__link'. " +
        "ÉVITER les sélecteurs trop larges comme 'a' ou '.card'. " +
        "ÉVITER les pseudo-classes CSS4 non supportées (:has, :is avec virgules complexes)."
      ),
      fallbackExhibitorSelectors: z.array(z.string()).describe(
        "2-3 sélecteurs alternatifs par ordre de spécificité décroissante, au cas où le principal échoue."
      ),
      nextSelector: z.string().describe(
        "Sélecteur CSS pour le bouton/lien 'page suivante' ou 'charger plus'. " +
        "Préférer les sélecteurs sur l'attribut [aria-label], [data-*], ou classes spécifiques. " +
        "Exemples: 'a[aria-label=\"Next page\"]', '.pagination__next', 'button[data-action=\"load-more\"]'."
      ),
      navType: z.enum(['pagination', 'infiniteScroll', 'loadMore']).describe(
        "Type de navigation: 'pagination' si boutons/liens de page, 'infiniteScroll' si scroll déclenche le chargement, 'loadMore' si bouton explicite."
      ),
      confidence: z.number().min(0).max(1).describe("Confiance dans l'analyse (0-1)"),
    })),
    prompt: `Tu analyses la structure d'un site de salon/exposition pour en extraire les fiches exposants.

URL: ${structureData.url}
Titre: ${structureData.title}

LIENS PAGINATION DÉTECTÉS: ${JSON.stringify(structureData.paginationLinks)}

EXTRAIT HTML DE LA ZONE PRINCIPALE:
${structureData.htmlSnippet}

LIENS (avec contexte):
${JSON.stringify(structureData.links, null, 2)}

BOUTONS:
${JSON.stringify(structureData.buttons, null, 2)}

RÈGLES IMPORTANTES:
1. Le sélecteur exhibitorSelector doit cibler des liens INDIVIDUELS vers des fiches exposants (pas les filtres, menus, breadcrumbs).
2. Les fiches exposants ont souvent des URLs avec /exhibitor/, /exposant/, /company/, /stand/, /participant/ ou un ID numérique.
3. Pour nextSelector: cherche les éléments avec aria-label contenant "next", "suivant", "page suivante", ou des classes comme .next, .pagination-next, ou des boutons "Load more", "Voir plus".
4. Si tu vois des liens de pagination (?page=2, /page/2), c'est 'pagination'. Si les données semblent chargées dynamiquement sans bouton, c'est 'infiniteScroll'. Si bouton explicite "charger plus", c'est 'loadMore'.
5. Les sélecteurs doivent être valides pour document.querySelector() — pas de :has(), pas de virgules multiples dans les pseudo-classes.`,
  })) as any;

  return {
    exhibitorSelector: object.exhibitorSelector,
    nextSelector: object.nextSelector,
    navType: object.navType as NavType,
    fallbackExhibitorSelectors: object.fallbackExhibitorSelectors || [],
  };
}

// ========================================
// Résolution du meilleur sélecteur au runtime
// ========================================

async function resolveBestSelector(page: Page, selectors: PageSelectors): Promise<string> {
  const candidates = [selectors.exhibitorSelector, ...selectors.fallbackExhibitorSelectors];

  for (const sel of candidates) {
    try {
      const count = await page.evaluate((s: string) => {
        try { return document.querySelectorAll(s).length; } catch { return 0; }
      }, sel);

      if (count > 0) {
        console.log(`[Selector] ✅ "${sel}" → ${count} éléments trouvés`);
        return sel;
      } else {
        console.log(`[Selector] ❌ "${sel}" → 0 éléments`);
      }
    } catch { }
  }

  // Dernier recours : heuristique basée sur les patterns d'URL courants
  console.warn('[Selector] Tous les sélecteurs LLM ont échoué, passage en mode heuristique');
  const heuristicSelector = await page.evaluate(() => {
    const patterns = ['/exhibitor', '/exposant', '/company', '/stand', '/participant', '/brand', '/marque'];
    const links = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
    const matches = links.filter(a => patterns.some(p => a.href.includes(p)));
    if (matches.length > 3) {
      // Remonte pour trouver un sélecteur commun
      const parent = matches[0].closest('li, article, .card, [class*="item"], [class*="row"]');
      if (parent && parent.className) {
        const cls = parent.className.split(' ')[0];
        return `.${cls} a`;
      }
      return 'a[href*="/exhibitor"], a[href*="/exposant"], a[href*="/company"], a[href*="/stand"]';
    }
    return null;
  });

  return heuristicSelector || 'a[href*="/exhibitor"], a[href*="/exposant"], a[href*="/company"]';
}

// ========================================
// PHASE 1a : ESPIONNAGE RÉSEAU (API Hunter)
// Avant de chercher dans le texte, on regarde si le site web n'utilise pas 
// une "base de données cachée" (API JSON). C'est 100x plus rapide si ça marche.
// ========================================

interface ApiCandidate {
  url: string;
  method: string;
  body?: string;
}

async function interceptApiRequests(
  page: Page,
  triggerFn: () => Promise<void>,
  timeoutMs = 5000
): Promise<ApiCandidate[]> {
  const candidates: ApiCandidate[] = [];

  // Écoute toutes les requêtes réseau pendant le trigger
  const handler = (request: any) => {
    const url = request.url();
    const method = request.method();
    // Filtre : JSON/REST APIs, ignore assets statiques
    if (
      (url.includes('/api/') || url.includes('/wp-json/') || url.includes('/graphql') ||
        url.includes('/appearances') || url.includes('/startups') || url.includes('/exhibitors') ||
        url.includes('page=') || url.includes('per_page=') || url.includes('offset=') ||
        url.includes('cursor=') || url.includes('_page=')) &&
      !url.match(/\.(js|css|png|jpg|svg|woff|ico)(\?|$)/)
    ) {
      candidates.push({ url, method, body: request.postData() || undefined });
    }
  };

  page.on('request', handler);
  await triggerFn();
  await new Promise(r => setTimeout(r, timeoutMs));
  page.off('request', handler);

  return candidates;
}

// ========================================
// Phase 1b: Collecte via API JSON (si détectée)
// ========================================

async function* collectViaApi(
  page: Page,
  apiUrl: string,
  linkPattern: RegExp
): AsyncGenerator<ScrapeProgressEvent, { links: string[]; names: string[] }> {
  const allLinks: Map<string, string> = new Map();

  yield { type: 'status', message: `🚀 API détectée: ${apiUrl} — collecte directe...` };

  // Déterminer le style de pagination de l'API
  const urlObj = new URL(apiUrl);
  const hasPage = urlObj.searchParams.has('page') || urlObj.searchParams.has('_page');
  const hasOffset = urlObj.searchParams.has('offset');
  const hasCursor = urlObj.searchParams.has('cursor') || urlObj.searchParams.has('after');
  const perPage = parseInt(urlObj.searchParams.get('per_page') || urlObj.searchParams.get('limit') || '50');

  let pageNum = 1;
  let offset = 0;
  let cursor: string | null = null;
  const maxIterations = 100;

  for (let i = 0; i < maxIterations; i++) {
    const iterUrl = new URL(apiUrl);

    if (hasCursor && cursor) {
      iterUrl.searchParams.set('cursor', cursor);
    } else if (hasOffset) {
      iterUrl.searchParams.set('offset', String(offset));
    } else if (hasPage) {
      const pageParam = urlObj.searchParams.has('_page') ? '_page' : 'page';
      iterUrl.searchParams.set(pageParam, String(pageNum));
    } else {
      // Essayer page= en fallback
      iterUrl.searchParams.set('page', String(pageNum));
    }

    // Utilise Playwright pour la requête (même session/cookies)
    const responseData = await page.evaluate(async (url: string) => {
      try {
        const res = await fetch(url, {
          headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (!res.ok) return { error: res.status };
        const text = await res.text();
        return { text };
      } catch (e: any) {
        return { error: e.message };
      }
    }, iterUrl.toString());

    if ('error' in responseData) {
      yield { type: 'status', message: `⚠️ API erreur ${responseData.error} à l'itération ${i + 1}` };
      break;
    }

    let json: any;
    try { json = JSON.parse(responseData.text!); } catch { break; }

    // Extraction des liens depuis la réponse JSON (structure variable)
    const items: any[] = Array.isArray(json) ? json
      : json.data || json.results || json.items || json.startups
      || json.exhibitors || json.appearances || json.companies || [];

    if (!items.length) {
      yield { type: 'status', message: `✅ API: plus de données à la page ${pageNum}` };
      break;
    }

    let newCount = 0;
    for (const item of items) {
      // Cherche une URL de profil dans les champs courants
      const profileUrl =
        item.link || item.url || item.profile_url || item.slug
          ? `${new URL(apiUrl).origin}${item.slug?.startsWith('/') ? '' : '/appearances/van26/'}${item.slug || ''}`
          : null;

      // Fallback: chercher dans les champs string un pattern d'URL de fiche
      const urlFromFields = profileUrl || Object.values(item)
        .find((v): v is string => typeof v === 'string' && linkPattern.test(v)) as string | undefined;

      if (urlFromFields && !allLinks.has(urlFromFields)) {
        const name = item.name || item.title || item.company || item.startup_name || 'Inconnu';
        allLinks.set(urlFromFields, typeof name === 'string' ? name : 'Inconnu');
        newCount++;
      }
    }

    // Cursor pour la prochaine page
    cursor = json.next_cursor || json.cursor || json.pagination?.next_cursor || null;

    yield {
      type: 'status',
      message: `📡 API page ${pageNum} — +${newCount} nouveaux (total: ${allLinks.size})`,
    };

    if (items.length < perPage && !cursor) break; // Dernière page
    pageNum++;
    offset += perPage;

    if (!cursor && !hasPage && !hasOffset) break; // Pas de pagination détectée
    await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
  }

  return { links: Array.from(allLinks.keys()), names: Array.from(allLinks.values()) };
}

/**
 * PHASE principale de collecte des liens.
 * Cette fonction est un "générateur" (yield) : elle renvoie des nouvelles au fur et à mesure.
 */
async function* collectExhibitorLinksUniversal(
  page: Page,
  baseUrl: string,
  selectors: PageSelectors
): AsyncGenerator<ScrapeProgressEvent, { links: string[]; names: string[] }> {

  const allLinks: Map<string, string> = new Map();
  let pageNum = 1;
  const maxPages = 60;
  let consecutiveEmpty = 0;
  const MAX_CONSECUTIVE_EMPTY = 4;

  // --- TENTATIVE D'INTERCEPTION API ---
  // On scroll légèrement pour déclencher un premier chargement XHR
  yield { type: 'status', message: `🔎 Analyse des requêtes réseau pour détecter une API...` };

  const linkPattern = /\/appearances\/|\/exhibitor\/|\/exposant\/|\/company\/|\/startup\//;

  const apiCandidates = await interceptApiRequests(page, async () => {
    await page.evaluate(() => window.scrollBy(0, 600));
    await new Promise(r => setTimeout(r, 2000));
    await page.evaluate(() => window.scrollBy(0, 600));
  }, 4000);

  if (apiCandidates.length > 0) {
    yield { type: 'status', message: `🎯 ${apiCandidates.length} requête(s) API candidates interceptée(s)` };

    // Tester chaque candidate
    for (const candidate of apiCandidates) {
      yield { type: 'status', message: `🧪 Test API: ${candidate.url}` };
      const apiGen = collectViaApi(page, candidate.url, linkPattern);

      while (true) {
        const { done, value } = await apiGen.next();
        if (done) {
          if (value.links.length > 0) {
            yield { type: 'status', message: `✅ API productive: ${value.links.length} liens collectés` };
            return value;
          }
          break;
        }
        yield value as ScrapeProgressEvent;
      }
    }

    yield { type: 'status', message: `⚠️ API(s) non productives, basculement en mode DOM...` };
  } else {
    yield { type: 'status', message: `ℹ️ Pas d'API détectée, mode DOM activé` };
  }

  // --- MODE DOM AVEC ANTI-VIRTUALISATION ---
  // Recharge la page pour partir d'un état propre
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await cleanPageObstacles(page);
  await randomDelay(1500, 2500);

  let activeSelector = await resolveBestSelector(page, selectors);
  yield { type: 'status', message: `🔍 Navigation: ${selectors.navType.toUpperCase()} | Sélecteur: ${activeSelector}` };

  /**
   * extractLinks avec SNAPSHOT HTML COMPLET :
   * Au lieu de regarder seulement ce que l'œil humain voit (le DOM),
   * on scanne le code source "brut" de la page.
   * Pourquoi ? Car certains sites (WebSummit) suppriment les entreprises du haut 
   * de la page quand on descend tout en bas. En scannant le code brut, on les garde !
   */
  const extractAllLinksFromHtml = async (): Promise<number> => {
    const extracted = await page.evaluate((pattern: string) => {
      const html = document.documentElement.innerHTML;
      const urlRegex = /href="([^"]*(?:\/appearances\/|\/exhibitor\/|\/exposant\/|\/company\/|\/startup\/)[^"]*)"/g;

      const results: { href: string; name: string }[] = [];
      const seen = new Set<string>();
      let match;

      while ((match = urlRegex.exec(html)) !== null) {
        const href = match[1].startsWith('http')
          ? match[1]
          : new URL(match[1], window.location.origin).href;
        if (!seen.has(href)) {
          seen.add(href);
          // On essaie de trouver le nom de l'entreprise à côté du lien
          const el = document.querySelector(`a[href="${match[1]}"]`);
          const name = el
            ? (el.closest('li, article, div[class*="card"], div[class*="item"]') as HTMLElement)
              ?.innerText?.split('\n')[0].trim() || el.textContent?.trim() || 'Inconnu'
            : 'Inconnu';
          results.push({ href, name });
        }
      }
      return results;
    }, linkPattern.source);

    let newCount = 0;
    for (const item of extracted) {
      if (!allLinks.has(item.href)) {
        allLinks.set(item.href, item.name);
        newCount++;
      }
    }
    return newCount;
  };

  // --- PAGINATION ---
  if (selectors.navType === 'pagination') {
    while (pageNum <= maxPages) {
      await cleanPageObstacles(page);
      await randomDelay(1200, 2800);

      const countBefore = allLinks.size;
      const domCount = await page.evaluate(
        (sel: string) => { try { return document.querySelectorAll(sel).length; } catch { return -1; } },
        activeSelector
      );

      if (domCount === 0 && pageNum > 1) {
        yield { type: 'status', message: `\u{1F504} Page ${pageNum} — sélecteur voit 0 éléments, re-résolution...` };
        const newSelector = await resolveBestSelector(page, selectors);
        if (newSelector !== activeSelector) {
          activeSelector = newSelector;
          yield { type: 'status', message: `\u{1F501} Nouveau sélecteur: "${activeSelector}"` };
        }
      }

      await extractAllLinksFromHtml();
      const newFound = allLinks.size - countBefore;
      yield { type: 'status', message: `\u{1F4C4} Page ${pageNum} — DOM: ${domCount} éléments | +${newFound} nouveaux (total: ${allLinks.size})` };

      if (newFound === 0) {
        consecutiveEmpty++;
        if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) break;
      } else {
        consecutiveEmpty = 0;
      }

      const currentCount = await page.evaluate(
        (sel: string) => document.querySelectorAll(sel).length,
        activeSelector
      );

      const clicked = await page.evaluate((sel: string) => {
        try {
          const el = document.querySelector(sel) as HTMLElement;
          if (!el) return false;
          if (
            el.getAttribute('aria-disabled') === 'true' ||
            el.classList.contains('disabled') ||
            (el as HTMLButtonElement).disabled
          ) return false;
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.click();
          return true;
        } catch { return false; }
      }, selectors.nextSelector);

      if (!clicked) {
        yield { type: 'status', message: `\u26A0\uFE0F Bouton "suivant" introuvable — fin de pagination` };
        break;
      }

      const domChanged = await waitForMoreElements(page, activeSelector, currentCount, 10000);
      if (!domChanged) {
        await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => { });
      }
      pageNum++;
    }

    // --- LOAD MORE ---
  } else if (selectors.navType === 'loadMore') {
    while (pageNum <= maxPages) {
      await cleanPageObstacles(page);

      const countBefore = allLinks.size;
      await extractAllLinksFromHtml();
      yield { type: 'status', message: `\u{1F504} Chargement ${pageNum} — total: ${allLinks.size} liens` };

      if (allLinks.size === countBefore) {
        consecutiveEmpty++;
        if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) break;
      } else {
        consecutiveEmpty = 0;
      }

      const currentDOMCount = await page.evaluate(
        (sel: string) => document.querySelectorAll(sel).length,
        activeSelector
      );

      const clicked = await page.evaluate((sel: string) => {
        const btn = document.querySelector(sel) as HTMLElement;
        if (!btn || btn.getAttribute('aria-disabled') === 'true') return false;
        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        btn.click();
        return true;
      }, selectors.nextSelector);

      if (!clicked) break;

      const appeared = await waitForMoreElements(page, activeSelector, currentDOMCount, 10000);
      if (!appeared) break;

      await randomDelay(800, 1500);
      pageNum++;
    }

    // --- INFINITE SCROLL avec anti-virtualisation ---
  } else {
    // Stratégie: scroll lent avec snapshot HTML à chaque palier
    // On ne fait PAS confiance au DOM visible, on parse le HTML brut
    let lastScrollY = 0;
    let stableScrollCount = 0;

    while (pageNum <= maxPages) {
      await cleanPageObstacles(page);

      const countBefore = allLinks.size;

      // Snapshot HTML AVANT le scroll (capture les items qui vont être dépilés)
      await extractAllLinksFromHtml();

      // Scroll progressif (pas trop vite pour laisser charger)
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.5));
      await randomDelay(1500, 2500);

      // Snapshot HTML APRÈS le scroll (capture les nouveaux items)
      await extractAllLinksFromHtml();

      const newLinks = allLinks.size - countBefore;
      const scrollY = await page.evaluate(() => window.scrollY);
      const scrollHeight = await page.evaluate(() => document.body.scrollHeight);

      yield {
        type: 'status',
        message: `\u{1F4E1} Scroll ${pageNum} — +${newLinks} nouveaux | total: ${allLinks.size} | pos: ${Math.round(scrollY / scrollHeight * 100)}%`
      };

      if (scrollY === lastScrollY) {
        stableScrollCount++;
        if (stableScrollCount >= 3) {
          yield { type: 'status', message: `\u2705 Fin du scroll infini (position stable)` };
          break;
        }
        await randomDelay(2000, 4000); // Attendre un chargement lent éventuel
      } else {
        stableScrollCount = 0;
        lastScrollY = scrollY;
        if (newLinks === 0) {
          consecutiveEmpty++;
          if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) break;
        } else {
          consecutiveEmpty = 0;
        }
      }

      pageNum++;
    }
  }

  yield { type: 'status', message: `\u2705 Collecte terminée — ${allLinks.size} fiches identifiées` };
  return {
    links: Array.from(allLinks.keys()),
    names: Array.from(allLinks.values()),
  };
}
/**
 * PHASE 2 : RÉCOLTE DES DÉTAILS
 * Maintenant qu'on a tous les liens, on va visiter chaque page une par une
 * pour récupérer les réseaux sociaux, emails et descriptions.
 */
async function scrapeExhibitorDetailUniversal(
  context: BrowserContext,
  url: string,
  fallbackName: string
): Promise<Exhibitor | null> {
  return withRetry(async () => {
    const page = await context.newPage();

    try {
      // Headers humains supplémentaires
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Cache-Control': 'no-cache',
      });

      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Détection rate-limiting HTTP
      if (response?.status() === 429 || response?.status() === 503) {
        throw Object.assign(new Error('Rate limited'), { status: response.status() });
      }

      await cleanPageObstacles(page);
      await randomDelay(800, 1800);

      const rawData = await page.evaluate(() => {
        document.querySelectorAll('script, style, noscript, svg, iframe').forEach(el => el.remove());

        const emails: string[] = [];
        const phones: string[] = [];

        const anchors = Array.from(document.querySelectorAll('a[href]'));
        const enrichedLinks = anchors.map(a => {
          const href = (a as HTMLAnchorElement).href;
          if (href.startsWith('mailto:')) emails.push(href.replace('mailto:', '').split('?')[0]);
          if (href.startsWith('tel:')) phones.push(href.replace('tel:', '').trim());

          return {
            url: href,
            text: (a as HTMLElement).innerText?.trim().substring(0, 40),
            title: (a as HTMLElement).title || '',
            label: a.getAttribute('aria-label') || '',
            hasImg: !!a.querySelector('img'),
            imgAlt: a.querySelector('img')?.getAttribute('alt') || '',
          };
        });

        const main =
          document.querySelector('main, [role="main"]') ||
          document.querySelector('#content, .content, article') ||
          document.body;

        return {
          text: (main as HTMLElement).innerText.substring(0, 30000),
          emails,
          phones,
          allLinksEnriched: enrichedLinks.slice(0, 200),
        };
      });

      const result = (await generateObject({
        model: openai.chat('gpt-4.1-mini'),
        schema: zodSchema(singleExhibitorProcessSchema),
        prompt: `Entreprise : "${fallbackName}".

TEXTE PRINCIPAL :
${rawData.text}

EMAILS TROUVÉS : ${rawData.emails.join(', ')}
TÉLÉPHONES TROUVÉS : ${rawData.phones.join(', ')}

LIENS ENRICHIS :
${JSON.stringify(rawData.allLinksEnriched)}

MISSION : Extraire les coordonnées de contact (email, site web, LinkedIn, X/Twitter, Facebook, Instagram, TikTok, numéro de stand).
- Pour les réseaux sociaux, fiez-vous aux labels aria-label, title, et imgAlt, même si l'URL est obscurcie.
- Un lien avec imgAlt="LinkedIn" ou label="Suivez-nous sur LinkedIn" → c'est le LinkedIn.
- Extraire le numéro de stand s'il est mentionné (ex: "Hall 5 - Stand B42", "Stand: A12").`,
      })) as any;

      return result.object.exhibitor;
    } finally {
      await page.close();
    }
  }, 3, `scrape:${url.split('/').pop()}`);
}

// ========================================
// Phase 3: Orchestrateur (avec throttle adaptatif)
// ========================================

export interface ScrapeProgressEvent {
  type: 'status' | 'progress' | 'exhibitor' | 'done' | 'error';
  message?: string;
  current?: number;
  total?: number;
  exhibitor?: Exhibitor;
}

export async function* scrapeExhibitorsStream(url: string): AsyncGenerator<ScrapeProgressEvent> {
  yield { type: 'status', message: `🚀 Initialisation du scraper...` };

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
      // Masquer les traces d'automation
      extraHTTPHeaders: {
        'sec-ch-ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
      },
    });

    // Masquer navigator.webdriver
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      (window as any).chrome = { runtime: {} };
    });

    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await cleanPageObstacles(page);
    await randomDelay(2500, 4000);

    // Analyse de structure
    yield { type: 'status', message: `🧠 Analyse de la structure de la page...` };
    const selectors = await analyzePageStructure(page);
    yield {
      type: 'status',
      message: `📋 Structure détectée — Nav: ${selectors.navType} | LLM confiance: OK`,
    };

    // Collecte des liens
    let links: string[] = [];
    let names: string[] = [];
    const collector = collectExhibitorLinksUniversal(page, url, selectors);

    while (true) {
      const { done, value } = await collector.next();
      if (done) {
        links = value.links;
        names = value.names;
        break;
      }
      yield value as ScrapeProgressEvent;
    }

    await page.close();

    if (links.length === 0) {
      yield { type: 'error', message: `❌ Aucun lien exposant détecté.` };
      return;
    }

    const total = Math.min(links.length, 500);
    yield { type: 'status', message: `🔬 Extraction des détails (${total} fiches)...` };

    // Throttle adaptatif : commence petit, augmente si pas de 429
    let batchSize = 2;
    let errorStreak = 0;
    let processed = 0;

    for (let i = 0; i < total; i += batchSize) {
      const batch = links.slice(i, Math.min(i + batchSize, total));
      const batchNames = batch.map((_, idx) => names[i + idx] || `Entreprise ${i + idx + 1}`);

      const results = await Promise.allSettled(
        batch.map((link, idx) =>
          scrapeExhibitorDetailUniversal(context, link, batchNames[idx])
        )
      );

      let batchErrors = 0;
      for (const result of results) {
        processed++;
        if (result.status === 'fulfilled' && result.value) {
          errorStreak = 0;
          yield { type: 'exhibitor', exhibitor: result.value, current: processed, total };
        } else {
          batchErrors++;
          errorStreak++;
        }
      }

      yield { type: 'progress', current: processed, total, message: `${processed}/${total} traités` };

      // Throttle adaptatif
      if (errorStreak >= 3) {
        batchSize = Math.max(1, batchSize - 1);
        yield { type: 'status', message: `⚠️ Trop d'erreurs, réduction de la parallélisation (batch: ${batchSize})` };
        await backoffDelay(errorStreak);
      } else if (errorStreak === 0 && batchSize < 4) {
        batchSize = Math.min(4, batchSize + 1);
      }

      // Pause inter-batch avec variation humaine
      await randomDelay(1500, 3500);
    }

    yield {
      type: 'done',
      total: processed,
      message: `✅ Terminé — ${processed} fiches extraites sur ${total}`,
    };
  } catch (error: any) {
    yield { type: 'error', message: `❌ Erreur fatale: ${error.message}` };
  } finally {
    await browser.close();
  }
}
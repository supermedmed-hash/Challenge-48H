import { chromium, Page, BrowserContext } from 'playwright';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { zodSchema } from 'ai';
import { z } from 'zod';
import { extractionProcessSchema, singleExhibitorProcessSchema, Exhibitor } from '../schema';

const randomDelay = (min = 800, max = 1500) => new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min)) + min));

async function autoScroll(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 200;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight - window.innerHeight || totalHeight > 20000) {
          clearInterval(timer);
          resolve();
        }
      }, 120);
    });
  });
}

// ========================================
// Helper: Clean page of common overlays (Cookies, modales)
// ========================================
async function cleanPageObstacles(page: Page) {
  try {
    await page.evaluate(() => {
      const commonSelectors = [
        '[id*="cookie"]', '[class*="cookie"]', '[id*="consent"]', '[class*="consent"]',
        '.modal-backdrop', '.modal-open', '.sp-overlay', '#onetrust-banner-sdk',
        '.gdpr-banner', '.didomi-popup-view'
      ];
      commonSelectors.forEach(sel => {
        try {
          const elements = document.querySelectorAll(sel);
          elements.forEach(el => (el as HTMLElement).style.display = 'none');
        } catch {}
      });
      // Force scrollability in case modale locked it
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    });
  } catch {}
}

// ========================================
// Phase 0: Structure Analysis via LLM
// ========================================
type NavType = 'pagination' | 'infiniteScroll' | 'loadMore';

async function analyzePageStructure(page: Page): Promise<{ exhibitorSelector: string, nextSelector: string, navType: NavType }> {
  const structureData = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href]')).slice(0, 150);
    const buttons = Array.from(document.querySelectorAll('button')).slice(0, 50);
    
    return {
      links: anchors.map(a => ({
        text: (a as HTMLElement).innerText.substring(0, 50).trim(),
        href: (a as HTMLAnchorElement).href,
        className: a.className,
        parentClass: a.parentElement?.className,
      })),
      potentialButtons: buttons.map(b => ({
        text: b.innerText.substring(0, 30).trim(),
        className: b.className
      }))
    };
  });

  const { object } = (await generateObject({
    model: openai.chat('gpt-4.1-mini'),
    schema: zodSchema(z.object({
      exhibitorSelector: z.string().describe("Sélecteur CSS pour les liens fiches (ex: '.card a')"),
      nextSelector: z.string().describe("Sélecteur pour Suivant / Charger plus (ex: '.next')"),
      navType: z.enum(['pagination', 'infiniteScroll', 'loadMore']).describe("Type de navigation détecté"),
    })),
    prompt: `Analyse cette structure d'un site de salon :\n\n${JSON.stringify(structureData)}\n\nTA MISSION :\n1. Trouve le sélecteur CSS des liens fiches exposants.\n2. Identifie si le site utilise un bouton "Suivant" (pagination), un défilement infini (infiniteScroll) ou un bouton "Charger plus" (loadMore).\n\nRenvoie uniquement des sélecteurs valides.`,
  })) as any;

  return { 
    exhibitorSelector: object.exhibitorSelector || 'a[href*="/exhibitor"], a[href*="/exposant"], a[href*="/company"]', 
    nextSelector: object.nextSelector || 'a[aria-label="Next"], button:has-text("More")',
    navType: object.navType as NavType || 'pagination'
  };
}

// ========================================
// Phase 1: Collect exhibitor links (Universal v2)
// ========================================
async function* collectExhibitorLinksUniversal(
  page: Page,
  baseUrl: string,
  selectors: { exhibitorSelector: string, nextSelector: string, navType: NavType }
): AsyncGenerator<ScrapeProgressEvent, { links: string[]; names: string[] }> {
  const allLinks: Map<string, string> = new Map(); // href -> name
  let pageNum = 1;
  const maxPages = 40;
  let lastLinksCount = -1;
  let stableStrike = 0;

  yield { type: 'status', message: `🔍 Mode de navigation : ${selectors.navType.toUpperCase()}` };

  while (pageNum <= maxPages) {
    yield { type: 'status', message: `📄 Collecte en cours... (${allLinks.size} liens identifiés)` };
    await cleanPageObstacles(page);
    await autoScroll(page);
    await randomDelay(1500, 2500);

    // Smart extraction: Handle empty links (overlays) by looking at neighbors
    const extracted = await page.evaluate((sel: string) => {
      const items = Array.from(document.querySelectorAll(sel));
      return items.map(el => {
        const href = (el as HTMLAnchorElement).href;
        let name = (el as HTMLElement).innerText?.trim();
        
        // If empty text (common for overlays), look at parent container
        if (!name || name.length < 2) {
          const container = el.closest('div, li, article');
          name = container ? (container as HTMLElement).innerText?.split('\n')[0].trim() : "Inconnu";
        }
        
        return { href, name };
      }).filter(x => x.href && !x.href.includes('#') && !x.href.includes('javascript:'));
    }, selectors.exhibitorSelector);

    for (const item of extracted) {
      if (!allLinks.has(item.href)) {
        allLinks.set(item.href, item.name);
      }
    }

    // Stop if we don't find new links (for Infinite Scroll / Load More)
    if (allLinks.size === lastLinksCount) {
      stableStrike++;
      if (stableStrike >= 3) {
        yield { type: 'status', message: `✅ Collecte terminée (nombre de liens stabilisé).` };
        break;
      }
    } else {
      stableStrike = 0;
      lastLinksCount = allLinks.size;
    }

    if (selectors.navType === 'pagination') {
      const clicked = await page.evaluate((sel: string) => {
        try {
          const next = document.querySelector(sel) as HTMLElement;
          if (next && next.offsetParent !== null) {
            next.scrollIntoView();
            next.click();
            return true;
          }
        } catch {}
        return false;
      }, selectors.nextSelector);

      if (!clicked) break;
      pageNum++;
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    } else if (selectors.navType === 'loadMore') {
      const clicked = await page.evaluate((sel: string) => {
        try {
          const btn = document.querySelector(sel) as HTMLElement;
          if (btn && btn.offsetParent !== null) {
            btn.click();
            return true;
          }
        } catch {}
        return false;
      }, selectors.nextSelector);
      if (!clicked) break;
      await randomDelay(2000, 3000);
    } else { // infiniteScroll
      // Just continue looping, autoScroll does the job
      if (pageNum > 20) break; // Hard limit for infinite scroll
      pageNum++;
    }
  }

  return { 
    links: Array.from(allLinks.keys()), 
    names: Array.from(allLinks.values()) 
  };
}

// ========================================
// Phase 2: Scrape detail (Deep Universal)
// ========================================
async function scrapeExhibitorDetailUniversal(
  context: BrowserContext,
  url: string,
  fallbackName: string
): Promise<Exhibitor | null> {
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await cleanPageObstacles(page);
    await randomDelay(1000, 2000);

    const rawData = await page.evaluate(() => {
      document.querySelectorAll('script, style, noscript, svg, iframe').forEach(el => el.remove());
      const emails: string[] = [];
      const phones: string[] = [];
      const links = Array.from(document.querySelectorAll('a[href]'));
      
      for (const a of links) {
        const href = (a as HTMLAnchorElement).href;
        if (href.startsWith('mailto:')) emails.push(href.replace('mailto:', '').split('?')[0]);
        if (href.startsWith('tel:')) phones.push(href.replace('tel:', '').trim());
      }

      const main = document.querySelector('main') || document.querySelector('#content') || document.body;
      return {
        text: (main as HTMLElement).innerText.substring(0, 35000),
        emails,
        phones,
        allLinks: links.map(a => (a as HTMLAnchorElement).href).slice(0, 70)
      };
    });

    const { object } = (await generateObject({
      model: openai.chat('gpt-4.1-mini'),
      schema: zodSchema(singleExhibitorProcessSchema),
      prompt: `Entreprise : "${fallbackName}". 

TEXTE : ${rawData.text}
EMAILS : ${rawData.emails.join(', ')}
LIENS : ${rawData.allLinks.join(', ')}

TA MISSION : Extraire UNIQUEMENT les contacts directs. Priorité aux emails mailto.`,
    })) as any;

    return object.exhibitor;
  } catch {
    return null;
  } finally {
    await page.close();
  }
}

// ========================================
// Phase 3: Orchestrator
// ========================================
export interface ScrapeProgressEvent {
  type: 'status' | 'progress' | 'exhibitor' | 'done' | 'error';
  message?: string;
  current?: number;
  total?: number;
  exhibitor?: Exhibitor;
}

export async function* scrapeExhibitorsStream(url: string): AsyncGenerator<ScrapeProgressEvent> {
  yield { type: 'status', message: `🚀 Initialisation du moteur Tout-Terrain...` };
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await cleanPageObstacles(page);
    await randomDelay(2000, 3000);

    const selectors = await analyzePageStructure(page);
    
    let links: string[] = [];
    let names: string[] = [];
    const collector = collectExhibitorLinksUniversal(page, url, selectors);
    
    while (true) {
      const { done, value } = await collector.next();
      if (done) {
        links = value.links;
        names = value.names;
        break;
      } else {
        yield value as ScrapeProgressEvent;
      }
    }
    
    if (links.length > 0) {
      const total = Math.min(links.length, 300);
      yield { type: 'status', message: `🔬 Extraction approfondie (${total} fiches)...` };

      const batchSize = 5;
      let processed = 0;

      for (let i = 0; i < total; i += batchSize) {
        const batch = links.slice(i, Math.min(i + batchSize, total));
        const batchNames = batch.map((_: string, idx: number) => names[i + idx] || `Entreprise ${i + idx + 1}`);

        const results = await Promise.allSettled(
          batch.map((link: string, idx: number) => scrapeExhibitorDetailUniversal(context, link, batchNames[idx]))
        );

        for (const result of results) {
          processed++;
          if (result.status === 'fulfilled' && result.value) {
            yield { type: 'exhibitor', exhibitor: result.value, current: processed, total };
          }
        }
        
        yield { type: 'progress', current: processed, total, message: `Analyse: ${processed}/${total}` };
      }

      yield { type: 'done', total: processed, message: `✅ Terminé (${processed} fiches).` };
    } else {
       yield { type: 'error', message: `Aucun lien détecté.` };
    }

  } catch (error: any) {
    yield { type: 'error', message: `❌ Erreur: ${error.message}` };
  } finally {
    await browser.close();
  }
}

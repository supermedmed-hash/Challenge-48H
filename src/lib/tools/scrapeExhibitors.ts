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
// Phase 0: Structure Analysis via LLM
// ========================================
async function analyzePageStructure(page: Page): Promise<{ exhibitorSelector: string, nextSelector: string }> {
  const structureData = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href]')).slice(0, 150);
    return anchors.map(a => ({
      text: (a as HTMLElement).innerText.substring(0, 50).trim(),
      href: (a as HTMLAnchorElement).href,
      className: a.className,
      parentClass: a.parentElement?.className,
      grandParentClass: a.parentElement?.parentElement?.className,
    }));
  });

  const { object } = (await generateObject({
    model: openai.chat('gpt-4o-mini'),
    schema: zodSchema(z.object({
      exhibitorSelector: z.string().describe("Sélecteur CSS ou pattern d'identifiant pour les liens vers les fiches exposants (ex: '.exhibitor-list-item a' ou 'a.profile-link')"),
      nextSelector: z.string().describe("Sélecteur CSS pour le bouton de page suivante (ex: 'a.next', 'li.pagination-next a')"),
    })),
    prompt: `Analyse cette structure de liens d'un site de salon professionnel :\n\n${JSON.stringify(structureData)}\n\nIDENTIFIE :\n1. Le sélecteur CSS le plus probable pour cliquer sur le NOM ou le LIEN de chaque exposant individuel.\n2. Le sélecteur CSS du bouton "Suivant" (pagination).\n\nRenvoie uniquement les sélecteurs CSS valides. Si tu ne trouves pas, renvoie une chaîne vide.`,
  })) as any;

  return { 
    exhibitorSelector: object.exhibitorSelector || 'a[href*="/exhibitor"], a[href*="/exposant"], a[href*="/company"]', 
    nextSelector: object.nextSelector || 'a[aria-label="Next"], a:has-text("Next"), a:has-text("Suivant")'
  };
}

// ========================================
// Phase 1: Collect exhibitor links (Universal)
// ========================================
async function collectExhibitorLinksUniversal(
  page: Page,
  baseUrl: string,
  selectors: { exhibitorSelector: string, nextSelector: string },
  onProgress: (msg: string) => void
): Promise<{ links: string[]; names: string[] }> {
  const allLinks: Map<string, string> = new Map(); // href -> name
  let pageNum = 1;
  const maxPages = 40; // High limit for integral scraping

  while (pageNum <= maxPages) {
    onProgress(`📄 Intégration de la page ${pageNum}...`);
    await autoScroll(page);
    await randomDelay(1000, 2000);

    const extracted = await page.evaluate((sel: string) => {
      const items = Array.from(document.querySelectorAll(sel));
      return items.map(el => ({
        href: (el as HTMLAnchorElement).href,
        name: (el as HTMLElement).innerText?.trim() || "Inconnu"
      })).filter(x => x.href && !x.href.includes('#') && !x.href.includes('javascript:'));
    }, selectors.exhibitorSelector);

    for (const item of extracted) {
      if (!allLinks.has(item.href)) {
        allLinks.set(item.href, item.name);
      }
    }

    onProgress(`📄 Page ${pageNum}: ${allLinks.size} liens récoltés.`);

    // Click Next
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

    if (!clicked) {
      onProgress(`✅ Fin de la navigation (pas de bouton Suivant détecté).`);
      break;
    }

    pageNum++;
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await randomDelay(1500, 2500);
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
    await randomDelay(800, 1500);

    // Deep extraction: text + emails/phones in DOM
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
        text: (main as HTMLElement).innerText.substring(0, 30000),
        emails,
        phones,
        allLinks: links.map(a => (a as HTMLAnchorElement).href).slice(0, 50)
      };
    });

    const { object } = (await generateObject({
      model: openai.chat('gpt-4o-mini'),
      schema: zodSchema(singleExhibitorProcessSchema),
      prompt: `Voici le contenu d'une fiche d'entreprise : "${fallbackName}". 

TEXTE : ${rawData.text}
EMAILS DÉTECTÉS : ${rawData.emails.join(', ')}
TÉLÉPHONES : ${rawData.phones.join(', ')}
LIENS : ${rawData.allLinks.join(', ')}

TA MISSION : Extraire UNIQUEMENT les COORDONNÉES DE CONTACT Direct (email, site officiel, LinkedIn, Twitter, téléphone, stand).

Si tu vois une URL de type "https://www.linkedin.com/company/...", c'est le LinkedIn. 
Si l'email n'est pas dans le texte mais dans les emails de secours, utilise-le.`,
    })) as any;

    return object.exhibitor;
  } catch (error: any) {
    console.warn(`[detail] Erreur sur ${url}: ${error.message}`);
    return null;
  } finally {
    await page.close();
  }
}

// ========================================
// Phase 3: Orchestrator (Universal Streaming)
// ========================================
export interface ScrapeProgressEvent {
  type: 'status' | 'progress' | 'exhibitor' | 'done' | 'error';
  message?: string;
  current?: number;
  total?: number;
  exhibitor?: Exhibitor;
}

export async function* scrapeExhibitorsStream(url: string): AsyncGenerator<ScrapeProgressEvent> {
  yield { type: 'status', message: `🚀 Initialisation du robot universel...` };
  
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();
    yield { type: 'status', message: `🌐 Chargement et analyse de la structure du site...` };

    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await randomDelay(2000, 3000);

    // Step 0: Analyze structure
    const selectors = await analyzePageStructure(page);
    yield { type: 'status', message: `🤖 Structure détectée (Lien: "${selectors.exhibitorSelector}", Page: "${selectors.nextSelector}").` };

    // Step 1: Integral Collection
    const { links, names } = await collectExhibitorLinksUniversal(page, url, selectors, (msg) => {
      // yield inside if would require generator, using simple messages for now
    });
    
    // Manual yield of progress
    yield { type: 'status', message: `📍 Analyse intégrale : ${links.length} fiches identifiées.` };

    if (links.length > 0) {
      const total = Math.min(links.length, 300); // Higher safety cap
      yield { type: 'status', message: `🔬 Extraction approfondie de ${total} contacts...` };

      // Optimized Parallelism: Batch of 5
      const batchSize = 5;
      let processed = 0;

      for (let i = 0; i < total; i += batchSize) {
        const batch = links.slice(i, Math.min(i + batchSize, total));
        const batchNames = batch.map((_, idx) => names[i + idx] || `Entreprise ${i + idx + 1}`);

        const results = await Promise.allSettled(
          batch.map((link, idx) => scrapeExhibitorDetailUniversal(context, link, batchNames[idx]))
        );

        for (const result of results) {
          processed++;
          if (result.status === 'fulfilled' && result.value) {
            yield {
              type: 'exhibitor',
              exhibitor: result.value,
              current: processed,
              total,
            };
          }
        }
        
        yield { type: 'progress', current: processed, total, message: `Analyse: ${processed}/${total}` };
        await randomDelay(200, 500);
      }

      yield { type: 'done', total: processed, message: `✅ Traitement intégral terminé (${processed} fiches).` };
    } else {
       yield { type: 'error', message: `Aucune fiche d'entreprise n'a été détectée. Vérifiez l'URL ou essayez une page plus spécifique.` };
    }

  } catch (error: any) {
    console.error("[scrapeExhibitors] Erreur:", error.message);
    yield { type: 'error', message: `❌ Erreur critique: ${error.message}` };
  } finally {
    await browser.close();
  }
}

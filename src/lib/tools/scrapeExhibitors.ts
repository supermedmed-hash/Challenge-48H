import { chromium, Page } from 'playwright';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { zodSchema } from 'ai';
import { extractionProcessSchema } from '../schema';

const randomDelay = () => new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 1000) + 1000));

async function autoScroll(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

export async function scrapeExhibitors(url: string) {
  console.log(`[scrapeExhibitors] Début du scraping pour: ${url}`);
  const browser = await chromium.launch({ headless: true });
  
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });
    
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay();
    
    console.log('[scrapeExhibitors] Scrolling...');
    await autoScroll(page);
    await randomDelay();

    const pageData = await page.evaluate(() => {
      document.querySelectorAll('script, style, noscript, svg, footer, header, nav').forEach(el => el.remove());
      return document.body.innerText.substring(0, 100000);
    });

    console.log('[scrapeExhibitors] Contenu récupéré, analyse LLM...');

    const { object } = await generateObject({
      model: openai.chat('gpt-4o-mini'),
      schema: zodSchema(extractionProcessSchema),
      prompt: `Tu es un expert en extraction de données. Voici le texte extrait d'une page web de salon professionnel recensant des exposants :\n\n${pageData}\n\nIdentifie et extrais tous les exposants listés dans ce texte. Remplis les champs requis du schéma. S'il n'y a pas l'information (ex: pas d'email), laisse vide.`,
    });

    console.log(`[scrapeExhibitors] ${object.exhibitors.length} exposants trouvés.`);
    return {
      success: true,
      exhibitors: object.exhibitors,
      message: `Extraction terminée. ${object.exhibitors.length} exposants trouvés.`
    };

  } catch (error: any) {
    console.error("[scrapeExhibitors] Erreur:", error.message);
    return {
      success: false,
      exhibitors: [],
      message: `Erreur lors du scraping: ${error.message}`
    };
  } finally {
    await browser.close();
  }
}

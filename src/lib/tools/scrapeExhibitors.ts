import { tool, zodSchema } from 'ai';
import { z } from 'zod';
import { chromium, Page } from 'playwright';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
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

// Build the tool params schema using zodSchema wrapper (required for Zod v4 compat)
const toolParamsZod = z.object({
  url: z.string().describe("L'URL de la page web listant les exposants du salon."),
});

export const scrapeExhibitors = tool({
  description: "Extrait la liste des exposants d'un salon professionnel à partir de l'URL fournie.",
  parameters: zodSchema(toolParamsZod),
  execute: async ({ url }: { url: string }) => {
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
        message: `J'ai terminé l'extraction. J'ai trouvé ${object.exhibitors.length} exposants sur cette page.`
      };

    } catch (error: any) {
      console.error("[scrapeExhibitors] Erreur:", error);
      return {
        success: false,
        exhibitors: [],
        message: `Une erreur est survenue lors du scraping: ${error.message}`
      };
    } finally {
      await browser.close();
    }
  },
});

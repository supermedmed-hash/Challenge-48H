import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { scrapeExhibitorsStream, ScrapeProgressEvent } from '@/lib/tools/scrapeExhibitors';

/**
 * API ROUTE : CHAT & SCRAPING
 * C'est ici que l'application reçoit les demandes de l'utilisateur.
 */

export const maxDuration = 300; // On laisse 5 minutes au robot pour travailler (Deep Scraping)

// Petite fonction pour voir si l'utilisateur a envoyé un lien (URL)
function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s"'<>]+/i);
  return match ? match[0] : null;
}

export async function POST(req: Request) {
  const body = await req.json();

  const rawMessages = body.messages || [];
  const messages = rawMessages.map((m: any) => {
    if (m.content) return { role: m.role, content: m.content };
    if (m.prompt) return { role: m.role || 'user', content: m.prompt };
    if (m.parts) {
      const textParts = m.parts
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text);
      return { role: m.role, content: textParts.join('') || '' };
    }
    return { role: m.role || 'user', content: '' };
  });

  // Get the last user message
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
  const url = lastUserMsg ? extractUrl(lastUserMsg.content) : null;

  // SI UNE URL EST DÉTECTÉE : On lance le robot de scraping en mode "Streaming" 
  if (url) {
    console.log(`[route] URL détectée: ${url}, démarrage du robot...`);

    const encoder = new TextEncoder();
    // On crée un flux (stream) pour envoyer les progrès en temps réel
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // On appelle notre robot (fourni par scrapeExhibitors.ts)
          for await (const event of scrapeExhibitorsStream(url)) {
            const line = JSON.stringify(event) + '\n';
            controller.enqueue(encoder.encode(line));
          }
        } catch (error: any) {
          const errorEvent: ScrapeProgressEvent = { type: 'error', message: error.message };
          controller.enqueue(encoder.encode(JSON.stringify(errorEvent) + '\n'));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked', // Permet d'envoyer des morceaux de texte petit à petit
        'X-Scrape-Stream': 'true',
      },
    });
  }

  // No URL: just chat normally
  const result = streamText({
    model: openai.chat('gpt-4.1-mini'),
    messages,
    system: `Tu es "Shaarp Expo Scraper", un agent d'extraction B2B.
Ton rôle est d'extraire la liste des exposants depuis les sites web de salons professionnels.
Si l'utilisateur te fournit une URL, tu vas analyser la page et extraire les données.
Si l'utilisateur ne fournit pas d'URL, demande-lui poliment de fournir l'URL de la page d'exposants du salon qu'il souhaite analyser.
Reste toujours courtois, professionnel et concis.`,
  });

  return result.toTextStreamResponse();
}

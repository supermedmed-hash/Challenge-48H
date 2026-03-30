import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { scrapeExhibitors } from '@/lib/tools/scrapeExhibitors';

export const maxDuration = 120;

// Simple URL detection
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

  // If URL detected, scrape directly (bypasses broken tool schema serialization)
  if (url) {
    console.log(`[route] URL detected: ${url}, starting scrape...`);
    
    const scrapeResult = await scrapeExhibitors(url);
    
    // Now ask the LLM to write a summary response
    const summaryMessages = [
      ...messages,
      { 
        role: 'assistant' as const, 
        content: `J'ai analysé la page ${url}. Résultat: ${scrapeResult.message}` 
      }
    ];

    const result = streamText({
      model: openai.chat('gpt-4o-mini'),
      messages: summaryMessages,
      system: `Tu es "Shaarp Expo Scraper", un agent d'extraction B2B. Tu viens de terminer une extraction d'exposants. Résume les résultats de manière professionnelle et concise. Ne liste pas les exposants individuellement.`,
    });

    // Return the LLM response + the scrape data as custom header
    const response = result.toTextStreamResponse();
    
    // Add scrape results as a custom header (JSON-encoded)
    const headers = new Headers(response.headers);
    headers.set('X-Scrape-Result', JSON.stringify(scrapeResult));
    
    return new Response(response.body, {
      status: response.status,
      headers,
    });
  }

  // No URL: just chat normally without tools
  const result = streamText({
    model: openai.chat('gpt-4o-mini'),
    messages,
    system: `Tu es "Shaarp Expo Scraper", un agent d'extraction B2B.
Ton rôle est d'extraire la liste des exposants depuis les sites web de salons professionnels.
Si l'utilisateur te fournit une URL, tu vas analyser la page et extraire les données.
Si l'utilisateur ne fournit pas d'URL, demande-lui poliment de fournir l'URL de la page d'exposants du salon qu'il souhaite analyser.
Reste toujours courtois, professionnel et concis.`,
  });

  return result.toTextStreamResponse();
}

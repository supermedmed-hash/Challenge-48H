import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { scrapeExhibitors } from '@/lib/tools/scrapeExhibitors';

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json();
  
  // v3 SDK sends messages with 'prompt' instead of 'content' for user messages
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

  // Use openai.chat() to force Chat Completions API (avoids Responses API schema issues)
  const result = streamText({
    model: openai.chat('gpt-4o-mini'),
    messages,
    system: `Tu es "Shaarp Expo Scraper", un agent d'extraction B2B.
Ton rôle principal est d'extraire la liste des exposants depuis les sites web de salons professionnels.
Tu as accès à l'outil 'scrapeExhibitors' qui peut naviguer sur une page et récupérer ces données.

CONSIGNES :
1. Si l'utilisateur te fournit une URL, dis-lui que tu commences immédiatement l'analyse (ex: "Je vais analyser la page et commencer l'extraction...").
2. Appelle ensuite l'outil 'scrapeExhibitors' avec l'URL fournie.
3. Une fois l'outil terminé, résume combien d'exposants ont été trouvés et confirme que les données sont ajoutées au tableau à côté. Ne liste pas tous les exposants dans le chat, ils sont affichés dans le tableau de l'interface graphique.
4. Reste toujours courtois, professionnel et concis.
`,
    tools: {
      scrapeExhibitors,
    },
    maxSteps: 3,
  });

  return result.toUIMessageStreamResponse();
}

'use client';

import { useState, useCallback } from 'react';
import { ExhibitorsTable } from '@/components/ExhibitorsTable';
import { Chat } from '@/components/Chat';
import { Exhibitor } from '@/lib/schema';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };
    
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setExhibitors([]); // Reset on new scrape
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      // Check for scrape results in custom header
      const scrapeHeader = res.headers.get('X-Scrape-Result');
      console.log('[Home] Scrape header:', scrapeHeader ? 'received' : 'not found');
      
      if (scrapeHeader) {
        try {
          const scrapeData = JSON.parse(scrapeHeader);
          if (scrapeData.success && scrapeData.exhibitors?.length > 0) {
            console.log('[Home] Updating exhibitors table with', scrapeData.exhibitors.length, 'items');
            setExhibitors(scrapeData.exhibitors);
          } else {
            console.log('[Home] Scrape failed or returned 0 results:', scrapeData.message);
          }
        } catch (e) {
          console.error('[Home] Failed to parse scrape header:', e);
        }
      }

      // Read the streamed text response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
      };
      setMessages(prev => [...prev, assistantMsg]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          assistantContent += chunk;
          
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: assistantContent,
            };
            return updated;
          });
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Désolé, une erreur est survenue. Veuillez réessayer.',
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground md:flex-row font-sans">
      <div className="flex w-full flex-col border-r border-border md:h-full md:w-[400px] lg:w-[450px] overflow-hidden">
        <div className="flex h-16 items-center border-b px-6 bg-muted/30 shrink-0">
          <h1 className="text-xl font-bold tracking-tight text-primary">Shaarp Scraper AI</h1>
        </div>
        <Chat 
           messages={messages} 
           sendMessage={sendMessage}
           isLoading={isLoading} 
        />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden bg-muted/10">
        <ExhibitorsTable exhibitors={exhibitors} />
      </div>
    </div>
  );
}

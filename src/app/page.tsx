'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ExhibitorsTable } from '@/components/ExhibitorsTable';
import { Chat } from '@/components/Chat';
import { ScrapeProgress } from '@/components/ScrapeProgress';
import { Exhibitor } from '@/lib/schema';
import { Search, CheckCircle2, XCircle, Loader2, Moon, Sun } from 'lucide-react';
import { useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ProgressState {
  active: boolean;
  status: string;
  current: number;
  total: number;
  phase: 'idle' | 'connecting' | 'collecting' | 'scraping' | 'done' | 'error';
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({
    active: false, status: '', current: 0, total: 0, phase: 'idle',
  });

  const [isDarkMode, setIsDarkMode] = useState(false);

  // Initialize theme
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    }
  }, []);

  const toggleTheme = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };
    
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    // Detect if message contains URL
    const hasUrl = /https?:\/\/[^\s"'<>]+/i.test(text);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          exhibitors: exhibitors,
        }),
      });

      const isScrapeStream = res.headers.get('X-Scrape-Stream') === 'true';

      if (isScrapeStream && hasUrl) {
        // Handle streaming scrape events
        setExhibitors([]);
        setProgress({ active: true, status: 'Connexion...', current: 0, total: 0, phase: 'connecting' });

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const collectedExhibitors: Exhibitor[] = [];

        // Add a status message
        const statusMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Extraction en cours...',
        };
        setMessages(prev => [...prev, statusMsg]);

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const event = JSON.parse(line);
                
                switch (event.type) {
                  case 'status':
                    setProgress(prev => ({ 
                      ...prev, 
                      status: event.message || '',
                      phase: event.message?.includes('Recherche') ? 'collecting' : 
                             event.message?.includes('Deep') ? 'scraping' : prev.phase,
                    }));
                    // Update the assistant message in real time
                    setMessages(prev => {
                      const updated = [...prev];
                      updated[updated.length - 1] = {
                        ...updated[updated.length - 1],
                        content: event.message || '',
                      };
                      return updated;
                    });
                    break;

                  case 'progress':
                    setProgress(prev => ({
                      ...prev,
                      current: event.current || prev.current,
                      total: event.total || prev.total,
                      status: event.message || prev.status,
                      phase: 'scraping',
                    }));
                    break;

                  case 'exhibitor':
                    if (event.exhibitor) {
                      collectedExhibitors.push(event.exhibitor);
                      setExhibitors([...collectedExhibitors]);
                      setProgress(prev => ({
                        ...prev,
                        current: event.current || collectedExhibitors.length,
                        total: event.total || prev.total,
                        phase: 'scraping',
                      }));
                    }
                    break;

                  case 'done':
                    setProgress({
                      active: false,
                      status: event.message || 'Terminé',
                      current: event.total || collectedExhibitors.length,
                      total: event.total || collectedExhibitors.length,
                      phase: 'done',
                    });
                    setMessages(prev => {
                      const updated = [...prev];
                      updated[updated.length - 1] = {
                        ...updated[updated.length - 1],
                        content: `Extraction terminée ! ${collectedExhibitors.length} exposants récupérés avec les informations détaillées.`,
                      };
                      return updated;
                    });
                    break;

                  case 'error':
                    setProgress(prev => ({ ...prev, active: false, phase: 'error', status: event.message || 'Erreur' }));
                    setMessages(prev => {
                      const updated = [...prev];
                      updated[updated.length - 1] = {
                        ...updated[updated.length - 1],
                        content: `${event.message || 'Une erreur est survenue.'}`,
                      };
                      return updated;
                    });
                    break;
                }
              } catch {
                // Skip malformed lines
              }
            }
          }
        }
      } else {
        // Normal chat response (no URL)
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
      }
    } catch (error) {
      console.error('Chat error:', error);
      setProgress(prev => ({ ...prev, active: false, phase: 'error' }));
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
        <div className="flex h-16 items-center border-b px-6 bg-muted/30 shrink-0 justify-between">
          <div className="flex items-center gap-2">
            <Image 
              src="/logo-shaarp.png" 
              alt="Shaarp Logo" 
              width={110} 
              height={36} 
              className="h-8 w-auto object-contain dark:invert"
              priority
            />
          </div>
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title={isDarkMode ? "Passer au thème clair" : "Passer au thème sombre"}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
        <Chat 
           messages={messages} 
           sendMessage={sendMessage}
           isLoading={isLoading} 
        />
        <footer className="h-10 border-t shrink-0 flex items-center justify-center gap-4 text-[10px] text-muted-foreground uppercase tracking-widest bg-muted/10">
          <Link href="/legal/privacy" className="hover:text-primary transition-colors">Mention RGPD</Link>
          <span className="text-muted-foreground/30">•</span>
          <Link href="/legal/terms" className="hover:text-primary transition-colors">Conditions d'utilisation</Link>
        </footer>
      </div>
      <div className="flex flex-1 flex-col overflow-hidden bg-muted/10">
        {progress.active && (
          <ScrapeProgress 
            status={progress.status}
            current={progress.current}
            total={progress.total}
            phase={progress.phase}
          />
        )}
        <ExhibitorsTable exhibitors={exhibitors} isLoading={progress.active} />
      </div>
    </div>
  );
}

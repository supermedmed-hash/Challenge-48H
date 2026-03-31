import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, Loader2, CheckCircle2, AlertCircle, Search } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatProps {
  messages: Message[];
  sendMessage: (text: string) => void;
  isLoading: boolean;
}

export function Chat({ messages, sendMessage, isLoading }: ChatProps) {
  const [inputValue, setInputValue] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;
    sendMessage(trimmed);
    setInputValue('');
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="flex flex-col gap-4 pb-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-10">
              <p>Bonjour ! Fournissez l&apos;URL d&apos;un salon professionnel pour commencer à extraire les exposants.</p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role !== 'user' && (
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot size={18} />
                </div>
              )}
              <div className={`flex flex-col max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                {m.content && (
                  <div className={`rounded-lg px-4 py-2 text-sm whitespace-pre-wrap flex items-start gap-2 ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted shadow-sm'}`}>
                    {m.role === 'assistant' && m.content.includes('Extraction terminée') && <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />}
                    {m.role === 'assistant' && (m.content.includes('Erreur') || m.content.includes('erreur')) && <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />}
                    {m.role === 'assistant' && m.content.includes('Extraction en cours') && <Loader2 size={16} className="text-primary animate-spin shrink-0 mt-0.5" />}
                    <span className={m.content.includes('Extraction en cours') ? 'text-primary font-medium animate-pulse' : ''}>{m.content}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (messages.length === 0 || messages[messages.length - 1]?.role === 'user') && (
            <div className="flex gap-3 justify-start">
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Loader2 size={18} className="animate-spin" />
              </div>
              <div className="bg-muted rounded-lg px-4 py-2 text-sm text-muted-foreground">
                Analyse en cours... (cela peut prendre 30-60 secondes)
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="p-4 border-t bg-background shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Entrez un message, une url ..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || inputValue.length === 0}>
            <Send size={18} />
          </Button>
        </form>
      </div>
    </div>
  );
}

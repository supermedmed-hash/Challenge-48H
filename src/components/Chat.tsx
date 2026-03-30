import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, Loader2 } from 'lucide-react';

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
    <div className="flex flex-1 flex-col h-full overflow-hidden shrink-0">
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4 h-full">
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
                  <Bot size={18}/>
                </div>
              )}
              <div className={`flex flex-col max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                {m.content && (
                  <div className={`rounded-xl px-4 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {m.content}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (messages.length === 0 || messages[messages.length-1]?.role === 'user') && (
            <div className="flex gap-3 justify-start">
               <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                 <Loader2 size={18} className="animate-spin"/>
               </div>
               <div className="bg-muted rounded-xl px-4 py-2 text-sm text-muted-foreground">
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
            placeholder="Entrez une URL (ex: https://...)" 
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

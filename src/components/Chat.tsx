import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, Loader2 } from 'lucide-react';

interface ChatProps {
  messages: any[];
  sendMessage: (message: { prompt: string }) => void;
  isLoading: boolean;
}

export function Chat({ messages, sendMessage, isLoading }: ChatProps) {
  // 100% local state for the input field - guaranteed to work
  const [inputValue, setInputValue] = useState('');
  const safeMessages = messages || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;
    
    // v3 API: sendMessage accepts { prompt: string }
    sendMessage({ prompt: trimmed });
    setInputValue('');
  };

  // Extract text content from v3 message parts
  const getMessageContent = (m: any): string => {
    if (m.content) return m.content;
    if (m.parts) {
      return m.parts
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join('');
    }
    return '';
  };

  // Extract tool invocations from v3 message parts
  const getToolInvocations = (m: any): any[] => {
    const tools: any[] = [];
    if (m.toolInvocations) {
      tools.push(...m.toolInvocations);
    }
    if (m.parts) {
      m.parts.forEach((p: any) => {
        if (p.type === 'tool-invocation' && p.toolInvocation) {
          tools.push(p.toolInvocation);
        }
      });
    }
    return tools;
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col gap-4 pb-4">
          {safeMessages.length === 0 && (
            <div className="text-center text-muted-foreground py-10">
              <p>Bonjour ! Fournissez l&apos;URL d&apos;un salon professionnel pour commencer à extraire les exposants.</p>
            </div>
          )}
          {safeMessages.map((m: any) => {
            const content = getMessageContent(m);
            const toolInvocations = getToolInvocations(m);
            
            return (
              <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role !== 'user' && (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot size={18}/>
                  </div>
                )}
                
                <div className={`flex flex-col max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {content && (
                    <div className={`rounded-xl px-4 py-2 ${m.role === 'user' ? 'bg-primary text-primary-foreground text-sm' : 'bg-muted text-sm'}`}>
                      {content}
                    </div>
                  )}
                  
                  {toolInvocations.map((ti: any, idx: number) => (
                    <div key={ti.toolCallId || idx} className="mt-2 w-full rounded-lg border bg-background p-3 shadow-sm">
                       <p className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                          {ti.state === 'result' ? '✅ Extraction terminée' : <><Loader2 className="animate-spin w-3 h-3"/> Extraction en cours...</>}
                       </p>
                       {ti.state === 'call' && (
                         <p className="text-xs mt-1 text-muted-foreground truncate" title={ti.args?.url}>{ti.args?.url}</p>
                       )}
                       {ti.state === 'result' && ti.result?.success && (
                          <p className="text-xs mt-1 text-green-600 font-medium">
                            {ti.result.exhibitors?.length || 0} exposants extraits.
                          </p>
                       )}
                       {ti.state === 'result' && ti.result && !ti.result.success && (
                          <p className="text-xs mt-1 border-l-2 border-destructive pl-2 text-destructive">
                             {ti.result.message}
                          </p>
                       )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {isLoading && safeMessages.length > 0 && safeMessages[safeMessages.length-1]?.role === 'user' && (
            <div className="flex gap-3 justify-start">
               <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                 <Loader2 size={18} className="animate-spin"/>
               </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="p-4 border-t bg-background">
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

'use client';

import { useChat } from '@ai-sdk/react';
import { ExhibitorsTable } from '@/components/ExhibitorsTable';
import { Chat } from '@/components/Chat';
import { useEffect, useState } from 'react';
import { Exhibitor } from '@/lib/schema';

export default function Home() {
  // @ts-ignore - v3 API: sendMessage, status, messages, setMessages
  const { messages, sendMessage, status } = useChat();
  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([]);

  // Extract exhibitors from tool invocations in messages
  useEffect(() => {
    let latestExhibitors: Exhibitor[] = [];
    const safeMessages = messages || [];
    
    safeMessages.forEach((m: any) => {
      // In v3, tool results are in message parts
      if (m?.parts) {
        m.parts.forEach((part: any) => {
          if (part?.type === 'tool-invocation' && part?.toolInvocation) {
            const ti = part.toolInvocation;
            if (ti?.toolName === 'scrapeExhibitors' && ti?.state === 'result') {
              if (ti.result?.exhibitors && Array.isArray(ti.result.exhibitors)) {
                latestExhibitors = ti.result.exhibitors;
              }
            }
          }
        });
      }
      // Also check legacy toolInvocations format
      if (m?.toolInvocations) {
        m.toolInvocations.forEach((ti: any) => {
          if (ti?.toolName === 'scrapeExhibitors' && ti?.state === 'result') {
            if (ti.result?.exhibitors && Array.isArray(ti.result.exhibitors)) {
              latestExhibitors = ti.result.exhibitors;
            }
          }
        });
      }
    });

    if (latestExhibitors.length > 0 && latestExhibitors.length !== exhibitors.length) {
      setExhibitors([...latestExhibitors]);
    }
  }, [messages, exhibitors.length]);

  const isLoading = status === 'streaming' || status === 'submitted';

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground md:flex-row font-sans">
      <div className="flex w-full flex-col border-r border-border md:w-[400px] lg:w-[450px]">
        <div className="flex h-16 items-center border-b px-6 bg-muted/30">
          <h1 className="text-xl font-bold tracking-tight text-primary">Shaarp Scraper AI</h1>
        </div>
        <Chat 
           messages={messages || []} 
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

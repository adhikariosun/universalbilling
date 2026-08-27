import { useState, useRef, useEffect, FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Sparkles, Trash2, User, Bot, FileText, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import {
  fetchChatHistory,
  sendChatMessage,
  saveChatMessage,
  clearChatHistory,
} from '@/lib/api';
import type { ChatMessage } from '@/lib/types';
import { formatTime } from '@/lib/format';

function getContextFromPath(pathname: string): {
  context_type: string;
  label: string;
} {
  if (pathname.startsWith('/customers')) return { context_type: 'customer-view', label: 'Customers' };
  if (pathname.startsWith('/bills/create')) return { context_type: 'bill-creation', label: 'Bill Creation' };
  if (pathname.startsWith('/bills')) return { context_type: 'bill-view', label: 'Bills' };
  return { context_type: 'dashboard', label: 'Dashboard' };
}

export function ChatSidebar() {
  const location = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  const context = getContextFromPath(location.pathname);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadHistory();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  async function loadHistory() {
    setLoading(true);
    setError(null);
    try {
      const history = await fetchChatHistory();
      setMessages(history);
    } catch (err) {
      setError('Failed to load chat history');
      console.error('Chat history error:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);

    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      user_id: '',
      role: 'user',
      content: userMessage,
      context_type: context.context_type,
      customer_id: null,
      bill_id: null,
      sources: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    setSending(true);

    try {
      const result = await sendChatMessage(userMessage, {
        context_type: context.context_type,
        customer_id: null,
        bill_id: null,
      });

      const assistantMessage: ChatMessage = {
        id: `temp-ai-${Date.now()}`,
        user_id: '',
        role: 'assistant',
        content: result.reply,
        context_type: context.context_type,
        customer_id: null,
        bill_id: null,
        sources: result.sources,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      await saveChatMessage({
        role: 'user',
        content: userMessage,
        context_type: context.context_type,
        customer_id: null,
        bill_id: null,
        sources: null,
      });
      await saveChatMessage({
        role: 'assistant',
        content: result.reply,
        context_type: context.context_type,
        customer_id: null,
        bill_id: null,
        sources: result.sources,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
      console.error('Chat send error:', err);
    } finally {
      setSending(false);
    }
  };

  const handleClear = async () => {
    try {
      await clearChatHistory();
      setMessages([]);
    } catch (err) {
      console.error('Clear chat error:', err);
    }
  };

  return (
    <aside className="flex h-full w-full flex-col border-l border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <Sparkles size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">AI Assistant</h2>
            <p className="text-xs text-gray-400">Context: {context.label}</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-500"
            title="Clear chat"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size={24} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-500">
              <Bot size={24} />
            </div>
            <p className="text-sm font-medium text-gray-700">Ask me anything</p>
            <p className="mt-1 text-xs text-gray-400">
              I can help with bills, customers, and your business data
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                  }`}
                >
                  {msg.role === 'user' ? <User size={15} /> : <Bot size={15} />}
                </div>
                <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-sm ${
                      msg.role === 'user'
                        ? 'rounded-tr-sm bg-blue-600 text-white'
                        : 'rounded-tl-sm bg-gray-100 text-gray-800'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <div className={`mt-1 flex items-center gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                    <span className="text-[10px] text-gray-400">{formatTime(msg.created_at)}</span>
                    {msg.sources && msg.sources.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-gray-400">
                        <FileText size={10} />
                        {msg.sources.length} source{msg.sources.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                  <Bot size={15} />
                </div>
                <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-red-600">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as FormEvent);
              }
            }}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{ maxHeight: '120px' }}
            disabled={sending}
          />
          <Button type="submit" size="md" disabled={!input.trim() || sending} className="shrink-0">
            {sending ? <Spinner size={16} className="text-white" /> : <Send size={16} />}
          </Button>
        </div>
      </form>
    </aside>
  );
}

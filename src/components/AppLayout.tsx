import { ReactNode, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { ChatSidebar } from '@/components/ChatSidebar';
import { MessageSquare, X } from 'lucide-react';

export function AppLayout({ children }: { children: ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto">{children}</main>
        <div className="hidden w-80 shrink-0 lg:block xl:w-96">
          <ChatSidebar />
        </div>
      </div>

      {/* Mobile chat toggle */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-colors hover:bg-blue-700 lg:hidden"
      >
        {chatOpen ? <X size={22} /> : <MessageSquare size={22} />}
      </button>

      {/* Mobile chat overlay */}
      {chatOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-gray-900/30" onClick={() => setChatOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-80 max-w-[85vw]">
            <ChatSidebar />
          </div>
        </div>
      )}
    </div>
  );
}

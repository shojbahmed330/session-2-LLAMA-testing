
import React from 'react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { Sparkles, ShoppingCart, Layout, Globe, MessageSquare, Zap } from 'lucide-react';

interface ChatEmptyStateProps {
  onTemplateClick?: (prompt: string) => void;
}

const ChatEmptyState: React.FC<ChatEmptyStateProps> = ({ onTemplateClick }) => {
  const { t } = useLanguage();
  
  const templates = [
    { icon: <ShoppingCart size={14}/>, label: "E-commerce App", prompt: "Build a modern e-commerce mobile app with a product grid, cart functionality, and a database-backed user profile." },
    { icon: <Layout size={14}/>, label: "Admin Dashboard", prompt: "Create a mobile-optimized admin dashboard with real-time analytics, data tables, and secure database integration." },
    { icon: <MessageSquare size={14}/>, label: "Chat Application", prompt: "Design a real-time mobile chat app with message history, database storage, and smooth UI transitions." },
    { icon: <Globe size={14}/>, label: "Service Booking App", prompt: "Build a mobile service booking app with appointment scheduling, user accounts, and a robust database backend." }
  ];

  const examples = [
    "Create a mobile SaaS app for task management",
    "Build a fitness tracker mobile app with database",
    "Design a minimalist mobile blog app",
    "Create a mobile restaurant ordering system"
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-6 md:p-10 space-y-12 animate-in fade-in duration-700">
      <div className="space-y-6">
        <div className="w-20 h-20 bg-pink-500/10 rounded-[2rem] border border-pink-500/20 flex items-center justify-center mx-auto text-pink-500 relative group transition-all duration-500 hover:scale-110">
          <div className="absolute inset-0 bg-pink-500/20 blur-2xl rounded-full animate-pulse"></div>
          <Sparkles size={40} className="relative z-10" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter">
            {t('chat.empty_title')}
          </h3>
          <div className="flex items-center justify-center gap-2">
            <Zap size={12} className="text-pink-500 fill-pink-500" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">{t('chat.secure_uplink')}</p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-lg space-y-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/5"></div>
            <span className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Example Prompts</span>
            <div className="h-px flex-1 bg-white/5"></div>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {examples.map((ex, i) => (
              <button 
                key={i}
                onClick={() => onTemplateClick?.(ex)}
                className="px-4 py-2 bg-white/5 border border-white/5 rounded-full text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-pink-600/20 hover:border-pink-500/30 transition-all active:scale-95"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/5"></div>
            <span className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Quick Start Templates</span>
            <div className="h-px flex-1 bg-white/5"></div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {templates.map((tpl, i) => (
              <button 
                key={i}
                onClick={() => onTemplateClick?.(tpl.prompt)}
                className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-left hover:bg-pink-600/10 hover:border-pink-500/30 transition-all group active:scale-95"
              >
                <div className="p-2.5 bg-white/5 rounded-xl text-zinc-500 group-hover:text-pink-500 group-hover:bg-pink-500/10 transition-colors">
                  {tpl.icon}
                </div>
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 group-hover:text-white">
                  {tpl.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatEmptyState;

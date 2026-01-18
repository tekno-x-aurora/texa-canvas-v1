
import React, { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { AITool } from '../types';
import { TexaUser } from '../services/firebase';
import ToolCard from './ToolCard';
import { subscribeToCatalog, CatalogItem } from '../services/catalogService';

// Fallback mock tools (used when Firestore is empty)
const MOCK_TOOLS: AITool[] = [
  {
    id: '1',
    name: 'ChatGPT Plus (Shared)',
    description: 'Akses penuh ke GPT-4o, DALL·E 3, dan fitur analisis data tercanggih.',
    category: 'Menulis & Riset',
    imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=400',
    targetUrl: 'https://chat.openai.com',
    status: 'active',
    priceMonthly: 45000
  },
  {
    id: '2',
    name: 'Midjourney Pro',
    description: 'Generate gambar AI kualitas tinggi tanpa batas dengan mode cepat.',
    category: 'Desain & Art',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=400',
    targetUrl: 'https://midjourney.com',
    status: 'active',
    priceMonthly: 75000
  },
  {
    id: '3',
    name: 'Canva Pro Teams',
    description: 'Buka jutaan aset premium dan hapus background otomatis.',
    category: 'Desain Grafis',
    imageUrl: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&q=80&w=400',
    targetUrl: 'https://canva.com',
    status: 'active',
    priceMonthly: 15000
  },
  {
    id: '4',
    name: 'Jasper AI Business',
    description: 'Bikin konten sosmed dan iklan 10x lebih cepat dengan AI.',
    category: 'Marketing',
    imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=400',
    targetUrl: 'https://jasper.ai',
    status: 'active',
    priceMonthly: 99000
  },
  {
    id: '5',
    name: 'Claude 3.5 Sonnet',
    description: 'AI cerdas untuk coding dan penulisan kreatif dengan konteks luas.',
    category: 'Coding & Teks',
    imageUrl: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=400',
    targetUrl: 'https://claude.ai',
    status: 'active',
    priceMonthly: 55000
  },
  {
    id: '6',
    name: 'Grammarly Premium',
    description: 'Cek tata bahasa Inggris otomatis dan kirim email tanpa typo.',
    category: 'Produktivitas',
    imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&q=80&w=400',
    targetUrl: 'https://grammarly.com',
    status: 'active',
    priceMonthly: 25000
  }
];

interface MarketplaceProps {
  user: TexaUser | null;
}

type SetterFn = (v: number | string) => void;

const Marketplace: React.FC<MarketplaceProps> = ({ user }) => {
  const [filter, setFilter] = useState('Semua');
  const [tools, setTools] = useState<AITool[]>(MOCK_TOOLS);
  const [loading, setLoading] = useState(true);

  // ChromaGrid spotlight effect refs
  const gridRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const setX = useRef<SetterFn | null>(null);
  const setY = useRef<SetterFn | null>(null);
  const pos = useRef({ x: 0, y: 0 });

  // Subscribe to catalog from Firestore
  useEffect(() => {
    const unsubscribe = subscribeToCatalog((items: CatalogItem[]) => {
      // Only show active items
      const activeItems = items.filter(item => item.status === 'active');

      if (activeItems.length > 0) {
        setTools(activeItems);
      } else {
        // Fallback to mock if no items in Firestore
        setTools(MOCK_TOOLS);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Initialize GSAP spotlight effect
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    setX.current = gsap.quickSetter(el, '--spotlight-x', 'px') as SetterFn;
    setY.current = gsap.quickSetter(el, '--spotlight-y', 'px') as SetterFn;
    const { width, height } = el.getBoundingClientRect();
    pos.current = { x: width / 2, y: height / 2 };
    setX.current(pos.current.x);
    setY.current(pos.current.y);
  }, []);

  const moveTo = (x: number, y: number) => {
    gsap.to(pos.current, {
      x,
      y,
      duration: 0.45,
      ease: 'power3.out',
      onUpdate: () => {
        setX.current?.(pos.current.x);
        setY.current?.(pos.current.y);
      },
      overwrite: true
    });
  };

  const handleMove = (e: React.PointerEvent) => {
    const r = gridRef.current!.getBoundingClientRect();
    moveTo(e.clientX - r.left, e.clientY - r.top);
    gsap.to(fadeRef.current, { opacity: 0, duration: 0.25, overwrite: true });
  };

  const handleLeave = () => {
    gsap.to(fadeRef.current, {
      opacity: 1,
      duration: 0.6,
      overwrite: true
    });
  };

  const categories = ['Semua', ...new Set(tools.map(t => t.category))];

  const filteredTools = filter === 'Semua'
    ? tools
    : tools.filter(t => t.category === filter);

  return (
    <section id="marketplace" className="py-4 md:py-8 scroll-mt-24">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 md:mb-10 gap-4 md:gap-8 px-2">
        <div className="max-w-xl">
          <h2 className="text-xl md:text-3xl font-black mb-1 md:mb-2 tracking-tight">Katalog AI Premium</h2>
          <p className="text-xs md:text-base text-slate-400 font-medium">Aktifkan tool favoritmu dalam hitungan detik.</p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 w-full lg:w-auto no-scrollbar mask-fade-right">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-4 md:px-5 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold transition-all whitespace-nowrap border smooth-animate ${filter === cat
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg'
                : 'glass border-white/5 text-slate-400 hover:text-white hover:border-white/10'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Glass Frame Container with Spotlight Effect */}
      <div
        ref={gridRef}
        className="relative rounded-[24px] md:rounded-[32px] p-4 md:p-6 overflow-hidden"
        style={{
          '--spotlight-x': '50%',
          '--spotlight-y': '50%',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)'
        } as React.CSSProperties}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
      >
        {/* Spotlight Overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-10 rounded-[24px] md:rounded-[32px]"
          style={{
            background: 'radial-gradient(circle 400px at var(--spotlight-x) var(--spotlight-y), transparent 0%, rgba(0, 0, 0, 0.4) 100%)',
            mixBlendMode: 'multiply'
          }}
        />

        {/* Fade Overlay */}
        <div
          ref={fadeRef}
          className="absolute inset-0 pointer-events-none z-20 rounded-[24px] md:rounded-[32px]"
          style={{
            background: 'rgba(0, 0, 0, 0.2)',
            opacity: 1
          }}
        />

        {/* Decorative Border Glow */}
        <div
          className="absolute inset-0 pointer-events-none rounded-[24px] md:rounded-[32px]"
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1), rgba(6, 182, 212, 0.1))',
            opacity: 0.5
          }}
        />

        {/* Grid Content */}
        <div className="relative z-30 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {filteredTools.map(tool => {
            // Check if user has active subscription
            const hasActiveSubscription = user?.subscriptionEnd
              ? new Date(user.subscriptionEnd) > new Date()
              : false;

            return (
              <ToolCard
                key={tool.id}
                tool={tool}
                hasAccess={hasActiveSubscription}
                user={user}
              />
            );
          })}
        </div>

        {/* Bottom Gradient Accent */}
        <div
          className="absolute bottom-0 left-0 right-0 h-1 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #06b6d4, #6366f1)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 3s linear infinite',
            borderRadius: '0 0 24px 24px'
          }}
        />
      </div>

      {/* Shimmer Animation */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </section>
  );
};

export default Marketplace;

import React, { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import './ChromaGrid.css';

export interface ChromaItem {
    image: string;
    title: string;
    subtitle: string;
    handle?: string;
    location?: string;
    borderColor?: string;
    gradient?: string;
    url?: string;
    category?: string;
    price?: string;
    hasVideo?: boolean;
    onAction?: () => void;
    actionLabel?: string;
    actionType?: 'primary' | 'success';
}

export interface ChromaGridProps {
    items?: ChromaItem[];
    className?: string;
    radius?: number;
    columns?: number;
    rows?: number;
    damping?: number;
    fadeOut?: number;
    ease?: string;
}

type SetterFn = (v: number | string) => void;

export const ChromaGrid: React.FC<ChromaGridProps> = ({
    items,
    className = '',
    radius = 300,
    columns = 3,
    rows = 2,
    damping = 0.45,
    fadeOut = 0.6,
    ease = 'power3.out'
}) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const fadeRef = useRef<HTMLDivElement>(null);
    const setX = useRef<SetterFn | null>(null);
    const setY = useRef<SetterFn | null>(null);
    const pos = useRef({ x: 0, y: 0 });

    const demo: ChromaItem[] = [
        {
            image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=400',
            title: 'ChatGPT Plus',
            subtitle: 'Akses penuh ke GPT-4o, DALL·E 3',
            category: 'AI Assistant',
            borderColor: '#10B981',
            gradient: 'linear-gradient(145deg, #10B981, #000)',
            price: 'Rp 45.000',
            actionLabel: '🛒 Beli',
            actionType: 'primary'
        },
        {
            image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=400',
            title: 'Midjourney Pro',
            subtitle: 'Generate gambar AI tanpa batas',
            category: 'AI Art',
            borderColor: '#8B5CF6',
            gradient: 'linear-gradient(145deg, #8B5CF6, #000)',
            price: 'Rp 75.000',
            hasVideo: true,
            actionLabel: '🛒 Beli',
            actionType: 'primary'
        },
        {
            image: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&q=80&w=400',
            title: 'Canva Pro',
            subtitle: 'Jutaan aset premium & tools',
            category: 'Design',
            borderColor: '#06B6D4',
            gradient: 'linear-gradient(145deg, #06B6D4, #000)',
            price: 'Rp 15.000',
            actionLabel: '🚀 Open',
            actionType: 'success'
        }
    ];

    const data = items?.length ? items : demo;

    useEffect(() => {
        const el = rootRef.current;
        if (!el) return;
        setX.current = gsap.quickSetter(el, '--x', 'px') as SetterFn;
        setY.current = gsap.quickSetter(el, '--y', 'px') as SetterFn;
        const { width, height } = el.getBoundingClientRect();
        pos.current = { x: width / 2, y: height / 2 };
        setX.current(pos.current.x);
        setY.current(pos.current.y);
    }, []);

    const moveTo = (x: number, y: number) => {
        gsap.to(pos.current, {
            x,
            y,
            duration: damping,
            ease,
            onUpdate: () => {
                setX.current?.(pos.current.x);
                setY.current?.(pos.current.y);
            },
            overwrite: true
        });
    };

    const handleMove = (e: React.PointerEvent) => {
        const r = rootRef.current!.getBoundingClientRect();
        moveTo(e.clientX - r.left, e.clientY - r.top);
        gsap.to(fadeRef.current, { opacity: 0, duration: 0.25, overwrite: true });
    };

    const handleLeave = () => {
        gsap.to(fadeRef.current, {
            opacity: 1,
            duration: fadeOut,
            overwrite: true
        });
    };

    const handleCardClick = (item: ChromaItem) => {
        if (item.onAction) {
            item.onAction();
        } else if (item.url) {
            window.open(item.url, '_blank', 'noopener,noreferrer');
        }
    };

    const handleCardMove: React.MouseEventHandler<HTMLElement> = e => {
        const card = e.currentTarget as HTMLElement;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
    };

    return (
        <div
            ref={rootRef}
            className={`chroma-grid ${className}`}
            style={
                {
                    '--r': `${radius}px`,
                    '--cols': columns,
                    '--rows': rows
                } as React.CSSProperties
            }
            onPointerMove={handleMove}
            onPointerLeave={handleLeave}
        >
            {data.map((c, i) => (
                <article
                    key={i}
                    className="chroma-card"
                    onMouseMove={handleCardMove}
                    style={
                        {
                            '--card-border': c.borderColor || 'transparent',
                            '--card-gradient': c.gradient
                        } as React.CSSProperties
                    }
                >
                    <div className="chroma-img-wrapper">
                        <img src={c.image} alt={c.title} loading="lazy" />

                        {/* Category Badge */}
                        {c.category && (
                            <span className="category-badge">{c.category}</span>
                        )}

                        {/* Price Tag */}
                        {c.price && (
                            <span className="price-tag">{c.price}</span>
                        )}

                        {/* Video Badge */}
                        {c.hasVideo && (
                            <span className="video-badge">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                                Video
                            </span>
                        )}

                        {/* Play Overlay */}
                        {c.hasVideo && (
                            <div className="play-overlay">
                                <button className="play-btn">
                                    <svg viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>

                    <footer className="chroma-info">
                        <h3 className="name">{c.title}</h3>
                        {c.handle && <span className="handle">{c.handle}</span>}
                        <p className="role">{c.subtitle}</p>
                        {c.location && <span className="location">{c.location}</span>}

                        {/* Action Button */}
                        {c.actionLabel && (
                            <button
                                className={`action-btn ${c.actionType || 'primary'}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleCardClick(c);
                                }}
                            >
                                {c.actionLabel}
                            </button>
                        )}
                    </footer>
                </article>
            ))}
            <div className="chroma-overlay" />
            <div ref={fadeRef} className="chroma-fade" />
        </div>
    );
};

export default ChromaGrid;

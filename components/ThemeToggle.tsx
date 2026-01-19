import React from 'react';
import { useTheme } from '../services/themeContext';
import { motion } from 'framer-motion';

export default function ThemeToggle() {
    const { toggleTheme, isDark } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className={`fixed top-16 right-3 md:top-4 md:right-4 z-[200] w-8 h-8 md:w-10 md:h-10 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 backdrop-blur-xl border ${isDark
                ? 'bg-slate-900/80 border-white/10 hover:bg-slate-800/90'
                : 'bg-white/80 border-black/10 hover:bg-white/95'
                }`}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
        >
            <motion.div
                initial={false}
                animate={{
                    rotate: isDark ? 0 : 180,
                    scale: [1, 1.2, 1]
                }}
                transition={{
                    duration: 0.5,
                    ease: 'easeInOut'
                }}
            >
                {isDark ? (
                    // Moon icon
                    <svg className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                ) : (
                    // Sun icon
                    <svg className="w-4 h-4 md:w-5 md:h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                    </svg>
                )}
            </motion.div>
        </button>
    );
}

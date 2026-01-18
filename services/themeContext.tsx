import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
    isDark: boolean;
    isLight: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Aurora color presets for each theme
export const AURORA_COLORS = {
    dark: ['#5227FF', '#7cff67', '#5227FF'],
    light: ['#FF9FFC', '#67d4ff', '#FF9FFC']
};

// Glass effect styles for each theme
export const GLASS_STYLES = {
    dark: {
        background: 'rgba(0, 0, 0, 0.6)',
        border: 'rgba(255, 255, 255, 0.1)',
        text: '#ffffff',
        textSecondary: '#94a3b8',
        card: 'rgba(255, 255, 255, 0.05)'
    },
    light: {
        background: 'rgba(255, 255, 255, 0.7)',
        border: 'rgba(0, 0, 0, 0.1)',
        text: '#1e293b',
        textSecondary: '#64748b',
        card: 'rgba(0, 0, 0, 0.03)'
    }
};

interface ThemeProviderProps {
    children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    // Get initial theme from localStorage or default to dark
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('texa-theme');
            if (saved === 'light' || saved === 'dark') return saved;
        }
        return 'dark';
    });

    // Update localStorage and document class when theme changes
    useEffect(() => {
        localStorage.setItem('texa-theme', theme);

        // Update document class for global CSS
        if (theme === 'dark') {
            document.documentElement.classList.remove('light-theme');
            document.documentElement.classList.add('dark-theme');
        } else {
            document.documentElement.classList.remove('dark-theme');
            document.documentElement.classList.add('light-theme');
        }
    }, [theme]);

    const toggleTheme = () => {
        setThemeState(prev => prev === 'dark' ? 'light' : 'dark');
    };

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
    };

    return (
        <ThemeContext.Provider value={{
            theme,
            toggleTheme,
            setTheme,
            isDark: theme === 'dark',
            isLight: theme === 'light'
        }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

export default ThemeContext;

// =============================================
// TEXA Offscreen Document Script
// Silent Token Scraping without visible UI
// =============================================

const GOOGLE_LABS_URL = 'https://labs.google/fx/tools/flow';
const TOKEN_REGEX = /ya29\.[a-zA-Z0-9_-]{100,}/g;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OFFSCREEN_SCRAPE_TOKEN') {
        console.log('TEXA Offscreen: Starting silent scrape...');
        scrapeTokenSilently()
            .then(result => sendResponse(result))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true; // async response
    }

    if (message.type === 'OFFSCREEN_CHECK_LOGIN') {
        console.log('TEXA Offscreen: Checking Google login status...');
        checkGoogleLoginStatus()
            .then(result => sendResponse(result))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }
});

// Silent token scraping via fetch with credentials
async function scrapeTokenSilently() {
    try {
        // Method 1: Direct fetch with credentials (works if user has Google session)
        const response = await fetch(GOOGLE_LABS_URL, {
            credentials: 'include',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'User-Agent': navigator.userAgent
            }
        });

        if (response.ok) {
            const html = await response.text();
            const matches = html.match(TOKEN_REGEX);

            if (matches && matches.length > 0) {
                // Get longest token (most complete)
                const token = matches.reduce((a, b) => a.length > b.length ? a : b);
                console.log('TEXA Offscreen: Token found via fetch!');

                // Notify background
                chrome.runtime.sendMessage({
                    type: 'TEXA_TOKEN_FOUND',
                    token: token,
                    source: 'Offscreen Silent Fetch'
                });

                return { success: true, token: token, method: 'offscreen_fetch' };
            }

            // Check if page indicates not logged in
            if (html.includes('Sign in') || html.includes('accounts.google.com')) {
                console.log('TEXA Offscreen: User not logged in to Google');
                return { success: false, notLoggedIn: true, error: 'Not logged in' };
            }
        }

        // Method 2: If fetch didn't work, try iframe approach
        console.log('TEXA Offscreen: Trying iframe method...');
        return await scrapeViaIframe();

    } catch (error) {
        console.error('TEXA Offscreen: Scrape error:', error);
        return { success: false, error: error.message };
    }
}

// Scrape via invisible iframe
async function scrapeViaIframe() {
    return new Promise((resolve, reject) => {
        const iframe = document.getElementById('scraper-frame');

        if (!iframe) {
            reject(new Error('Iframe not found'));
            return;
        }

        // Set timeout
        const timeout = setTimeout(() => {
            resolve({ success: false, error: 'Iframe timeout' });
        }, 15000);

        // Listen for load
        iframe.onload = () => {
            try {
                // Try to access iframe content (may fail due to CORS)
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

                if (iframeDoc) {
                    const html = iframeDoc.documentElement.outerHTML;
                    const matches = html.match(TOKEN_REGEX);

                    if (matches && matches.length > 0) {
                        clearTimeout(timeout);
                        const token = matches.reduce((a, b) => a.length > b.length ? a : b);

                        chrome.runtime.sendMessage({
                            type: 'TEXA_TOKEN_FOUND',
                            token: token,
                            source: 'Offscreen Iframe'
                        });

                        resolve({ success: true, token: token, method: 'offscreen_iframe' });
                        return;
                    }
                }
            } catch (e) {
                // CORS blocking - expected for cross-origin
                console.log('TEXA Offscreen: Cannot access iframe content (CORS)');
            }

            clearTimeout(timeout);
            resolve({ success: false, error: 'Could not extract token from iframe' });
        };

        iframe.onerror = () => {
            clearTimeout(timeout);
            resolve({ success: false, error: 'Iframe load error' });
        };

        // Load the page
        iframe.src = GOOGLE_LABS_URL;
    });
}

// Check if user is logged in to Google
async function checkGoogleLoginStatus() {
    try {
        const response = await fetch('https://accounts.google.com/CheckCookie', {
            credentials: 'include',
            redirect: 'manual'
        });

        // If we get redirected, user might not be logged in
        if (response.type === 'opaqueredirect') {
            return { loggedIn: false };
        }

        // Check for session indicators
        const text = await response.text();
        const loggedIn = !text.includes('Sign in') && !text.includes('identifier');

        return { loggedIn: loggedIn };
    } catch (error) {
        console.error('TEXA Offscreen: Login check error:', error);
        return { loggedIn: false, error: error.message };
    }
}

console.log('TEXA Offscreen Document Loaded');

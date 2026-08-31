export const isTidalAudioUrl = () => false;

// List of proxy servers.
// You can uncomment and add your own self-hosted proxy (like Octo-Fiesta) here.
const PROXY_LIST = [
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url=',
    'https://thingproxy.freeboard.io/fetch/'
    // 'http://localhost:3000/proxy?url=', // Example for local Octo-Fiesta
];

let currentProxyIndex = Math.floor(Math.random() * PROXY_LIST.length);

export const getProxyUrl = (url) => {
    if (!url) return url;
    
    // Do not proxy data or blob URIs
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    
    // Check if the URL is already proxied to prevent double proxying
    if (PROXY_LIST.some(proxy => url.startsWith(proxy))) return url;

    const proxy = PROXY_LIST[currentProxyIndex];
    
    // Rotate to the next proxy for the next request
    currentProxyIndex = (currentProxyIndex + 1) % PROXY_LIST.length;

    // Encode the URL so it's safely passed as a parameter to the proxy
    return `${proxy}${encodeURIComponent(url)}`;
};

export const wrapTidalUrl = (url) => {
    if (!url || typeof url !== 'string') return url;
    return url
        .replace('openapi.tidal.com', 'lol.samidy.workers.dev/openapi')
        .replace('api.tidal.com', 'lol.samidy.workers.dev/api')
        .replace('https://tidal.com', 'https://lol.samidy.workers.dev/tidal');
};

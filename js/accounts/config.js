// js/accounts/config.js
import { createAuthClient } from 'better-auth/client';

const getBaseURL = () => {
    const local = localStorage.getItem('monochrome-auth-url');
    if (local) return local;

    if (window.__AUTH_URL__) return window.__AUTH_URL__;

    return 'https://auth.monochrome.tf';
};

export const AUTH_BASE_URL = getBaseURL();

export const authClient = createAuthClient({
    baseURL: AUTH_BASE_URL,
});

export { authClient as auth };

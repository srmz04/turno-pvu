/**
 * srmz04/turno-pvu
 * AuthManager: Gestion de sesiones JWT
 */

import { CONFIG } from './config.js';

class AuthManager {
    constructor() {
        this.tokenKey = 'turno_pvu_token';
        this.userKey = 'turno_pvu_user';
        this.currentUser = this.loadUser();
    }

    loadUser() {
        const savedUser = localStorage.getItem(this.userKey);
        return savedUser ? JSON.parse(savedUser) : null;
    }

    getToken() {
        return localStorage.getItem(this.tokenKey);
    }

    isAuthenticated() {
        const token = this.getToken();
        if (!token) return false;

        // Check expiry
        const user = this.currentUser;
        if (user && user.exp) {
            const now = Math.floor(Date.now() / 1000);
            if (now >= user.exp) {
                this.logout();
                return false;
            }
        }
        return true;
    }

    async login(username, password) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login fallido');
            }

            this.setSession(data.token, data.user);
            return { success: true, user: data.user };
        } catch (error) {
            console.error('Auth error:', error);
            throw error;
        }
    }

    setSession(token, user) {
        // Decode token payload if user not provided fully (backend should provide basics)
        // Here we assume backend returns user object or we decode token
        if (!user) {
            user = this.decodeToken(token);
        }

        localStorage.setItem(this.tokenKey, token);
        localStorage.setItem(this.userKey, JSON.stringify(user));
        this.currentUser = user;

        // Trigger event if needed
        window.dispatchEvent(new Event('auth-changed'));
    }

    logout() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        this.currentUser = null;
        window.dispatchEvent(new Event('auth-changed'));
        // Cada modulo decide a donde redirigir post-logout
    }

    decodeToken(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            return null;
        }
    }

    checkRole(allowedRoles) {
        if (!this.currentUser) return false;
        if (this.currentUser.rol === CONFIG.ROLES.ADMIN) return true; // Admin always Access
        return allowedRoles.includes(this.currentUser.rol);
    }

    getUser() {
        return this.currentUser;
    }
}

export const auth = new AuthManager();

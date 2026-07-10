import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { setToken } from '@/lib/api';

export type AppModule = 'NQAS' | 'NABH' | 'KAYAKALPA';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'HOD' | 'ASSESSOR';
  department?: { id: string; name: string; code: string } | null;
  isActive: boolean;
  moduleAccess: AppModule[];
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  selectedModule: AppModule | null;
  hydrated: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  setSelectedModule: (module: AppModule) => void;
  clearSelectedModule: () => void;
  updateToken: (accessToken: string) => void;
  updateUser: (user: Partial<AuthUser>) => void;
  clearAuth: () => void;
  _setHydrated: () => void;
}

function setCookie(name: string, value: string, maxAge: number) {
  if (typeof document !== 'undefined') {
    document.cookie = `${name}=${value}; path=/; samesite=strict; max-age=${maxAge}`;
  }
}

function deleteCookie(name: string) {
  if (typeof document !== 'undefined') {
    document.cookie = `${name}=; path=/; max-age=0`;
  }
}

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      selectedModule: null,
      hydrated: false,

      setAuth(user, accessToken, refreshToken) {
        setToken(accessToken, refreshToken);
        setCookie('auth_token', accessToken, 43200);
        // Reset the active module on every login so a module persisted from a
        // previous session/user can never carry over. The select-module page then
        // resolves it (admins choose; single-module users auto-select).
        set({ user, accessToken, refreshToken, selectedModule: null });
      },

      setSelectedModule(module) {
        set({ selectedModule: module });
      },

      clearSelectedModule() {
        set({ selectedModule: null });
      },

      updateToken(accessToken) {
        setToken(accessToken);
        setCookie('auth_token', accessToken, 43200);
        set({ accessToken });
      },

      updateUser(partial) {
        const current = get().user;
        if (!current) return;
        set({ user: { ...current, ...partial } });
      },

      clearAuth() {
        setToken(null, null);
        deleteCookie('auth_token');
        set({ user: null, accessToken: null, refreshToken: null, selectedModule: null });
      },

      _setHydrated() {
        set({ hydrated: true });
      },
    }),
    {
      name: 'qps-auth-v1',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : noopStorage,
      ),
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        selectedModule: s.selectedModule,
      }),
      onRehydrateStorage: (preState) => (state) => {
        if (state) {
          setToken(state.accessToken ?? null, state.refreshToken ?? null);
          if (state.accessToken) {
            setCookie('auth_token', state.accessToken, 43200);
          }
        }
        // Always mark hydrated — preState always has methods even if state is null
        (state ?? preState)._setHydrated();
      },
    },
  ),
);

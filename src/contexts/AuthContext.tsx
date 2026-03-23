import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface AuthContextType {
  user: UserSettings | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; invoice_platform?: string }) => Promise<void>;
  updateUser: (data: Partial<UserSettings>) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  googleLogin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  updateUser: async () => {},
  logout: async () => {},
  resetPassword: async () => {},
  googleLogin: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.electronAPI.getUser()
      .then(u => {
        if (u) setUser(u);
      })
      .catch(() => { /* no session */ })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const u = await window.electronAPI.loginUser({ email, password });
    setUser(u);
  };

  const register = async (data: { name: string; email: string; password: string; invoice_platform?: string }) => {
    const u = await window.electronAPI.registerUser(data);
    setUser(u);
  };

  const updateUser = async (data: Partial<UserSettings>) => {
    if (!user) return;
    const u = await window.electronAPI.updateUser(user.id, data);
    setUser(u);
  };

  const logout = async () => {
    await window.electronAPI.logoutUser();
    setUser(null);
  };

  const resetPassword = async (email: string) => {
    await window.electronAPI.resetPassword(email);
  };

  const googleLogin = async () => {
    const u = await window.electronAPI.googleAuth();
    setUser(u);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, updateUser, logout, resetPassword, googleLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

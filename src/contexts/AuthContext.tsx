import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface AuthContextType {
  user: UserSettings | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; invoice_platform?: string }) => Promise<void>;
  updateUser: (data: Partial<UserSettings>) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  googleLogin: () => Promise<void>;
  checkEmailConfirmed: (email: string, password: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  updateUser: async () => {},
  logout: async () => {},
  resetPassword: async () => {},
  changePassword: async () => {},
  googleLogin: async () => {},
  checkEmailConfirmed: async () => false,
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

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await window.electronAPI.changePassword({ currentPassword, newPassword });
  };

  const googleLogin = async () => {
    const u = await window.electronAPI.googleAuth();
    setUser(u);
  };

  const checkEmailConfirmed = async (email: string, password: string) => {
    const result = await window.electronAPI.checkEmailConfirmed({ email, password });
    if (result.confirmed && result.user) {
      setUser(result.user as UserSettings);
    }
    return result.confirmed;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, updateUser, logout, resetPassword, changePassword, googleLogin, checkEmailConfirmed }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = not authed

  useEffect(() => {
    api.me()
      .then(res => setUser(res.user))
      .catch(() => setUser(null));
  }, []);

  async function login(username, password) {
    const res = await api.login(username, password);
    setUser(res.user);
    return res.user;
  }

  async function logout() {
    await api.logout();
    setUser(null);
  }

  async function register(username, password, inviteToken) {
    const res = await api.register(username, password, inviteToken);
    setUser(res.user);
    return res.user;
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, register, loading: user === undefined }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { getMe, logout as apiLogout } from '../api/auth';
import { clearAllCache } from '../services/cache';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) { setLoading(false); return; }
      const data = await getMe();
      const u = data?.user || data;
      setUser({
        id: u?.user_id || u?.id,
        name: u?.name,
        email: u?.email,
        avatar: u?.profile_url,
        orgId: u?.organization_id || u?.org_id,
        orgName: u?.organization_name,
        roleId: u?.role_id,
        roleKey: u?.role_key,
      });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const logout = useCallback(async () => {
    await apiLogout();
    await clearAllCache();
    setUser(null);
  }, []);

  const refreshUser = loadUser;

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

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
      // Decode JWT for role fallback (payload is base64 middle part)
      let tokenPayload = {};
      try { tokenPayload = JSON.parse(atob(token.split('.')[1])); } catch {}
      const data = await getMe();
      const u = data?.user || data;
      const roleObj = data?.user_role || data?.organization_member || {};
      setUser({
        id: u?.user_id || u?.id,
        name: u?.name,
        email: u?.email,
        avatar: u?.profile_url,
        orgId: u?.organization_id || u?.org_id || tokenPayload.org,
        orgName: data?.organization?.name || u?.organization_name,
        role_id: roleObj.role_id || u?.role_id || tokenPayload.role_id,
        role_key: roleObj.role_key || u?.role_key || tokenPayload.role,
        role_name: roleObj.role_name || u?.role_name,
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

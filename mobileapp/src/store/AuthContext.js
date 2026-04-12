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

      // Try to get fresh user data from API
      try {
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
          role_id: Number(roleObj.role_id || u?.role_id || tokenPayload.role_id) || null,
          role_key: roleObj.role_key || u?.role_key || tokenPayload.role,
          role_name: roleObj.role_name || u?.role_name,
        });
      } catch (apiErr) {
        // If 401/403 = truly unauthorized, clear user
        const status = apiErr?.response?.status;
        if (status === 401 || status === 403) {
          setUser(null);
        } else {
          // Network error / server down — use token payload as fallback user
          // so user stays logged in even without network
          setUser({
            id: tokenPayload.id || tokenPayload.user_id || tokenPayload.sub,
            name: tokenPayload.name || 'User',
            email: tokenPayload.email || '',
            avatar: null,
            orgId: tokenPayload.org || tokenPayload.organization_id,
            orgName: tokenPayload.org_name || '',
            role_id: Number(tokenPayload.role_id) || null,
            role_key: tokenPayload.role || null,
            role_name: tokenPayload.role_name || null,
          });
        }
      }
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

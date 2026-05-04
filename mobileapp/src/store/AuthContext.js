import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { getMe, logout as apiLogout } from '../api/auth';
import { getOrganizations } from '../api/chat';
import { clearAllCache } from '../services/cache';

const ACTIVE_ORG_KEY = 'activeOrgId';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState([]);
  const [orgsLoading, setOrgsLoading] = useState(false);

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
        const tokenOrgId = u?.organization_id || u?.org_id || tokenPayload.org;
        // Honor stored active org if user has multiple memberships
        const stored = await SecureStore.getItemAsync(ACTIVE_ORG_KEY).catch(() => null);
        const activeOrgId = stored ? Number(stored) : tokenOrgId;
        setUser({
          id: u?.user_id || u?.id,
          name: u?.name,
          email: u?.email,
          avatar: u?.profile_url,
          orgId: activeOrgId || tokenOrgId,
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
    try { await SecureStore.deleteItemAsync(ACTIVE_ORG_KEY); } catch {}
    setUser(null);
    setOrganizations([]);
  }, []);

  const refreshUser = loadUser;

  const loadOrganizations = useCallback(async () => {
    if (!user) return;
    setOrgsLoading(true);
    try {
      const orgs = await getOrganizations();
      setOrganizations(Array.isArray(orgs) ? orgs : []);
    } catch (e) {
      console.warn('[auth] org list failed:', e?.message);
    } finally {
      setOrgsLoading(false);
    }
  }, [user]);

  const switchOrganization = useCallback(async (orgId) => {
    const n = Number(orgId);
    if (!Number.isFinite(n) || n <= 0) return;
    try { await SecureStore.setItemAsync(ACTIVE_ORG_KEY, String(n)); } catch {}
    // Find org meta from cached list to update display name immediately
    const target = organizations.find((o) => Number(o.organization_id) === n);
    setUser((prev) => prev ? {
      ...prev,
      orgId: n,
      orgName: target?.org_name || prev.orgName,
      role_id: target ? Number(target.role_id) : prev.role_id,
      role_key: target?.role_key || prev.role_key,
      role_name: target?.role_name || prev.role_name,
    } : prev);
  }, [organizations]);

  return (
    <AuthContext.Provider value={{
      user, loading, logout, refreshUser, setUser,
      organizations, orgsLoading, loadOrganizations, switchOrganization,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

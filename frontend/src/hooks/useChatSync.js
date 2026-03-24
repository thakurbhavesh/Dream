/**
 * useChatSync.js
 *
 * 1. Fetches all organizations the user is a member of (GET /chat/organizations)
 * 2. For each org, fetches threads in parallel (GET /chat/threads?org_id=X)
 * 3. Commits all orgs + their threads into threadService
 *
 * Falls back silently — if the API is unreachable, mock/cached data is kept.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchUserOrganizations, fetchThreads } from "../services/chatApi";
import { threadService } from "../services/threadService";

const useChatSync = () => {
  const [syncing, setSyncing] = useState(false);
  const [error, setError]     = useState(null);
  const [orgId, setOrgId]     = useState(null); // primary org ID (first / token org)
  const abortRef = useRef(null);

  const sync = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSyncing(true);
    setError(null);

    try {
      // Step 1 — get all orgs the user belongs to
      const orgs = await fetchUserOrganizations();
      if (controller.signal.aborted) return;
      if (!Array.isArray(orgs) || orgs.length === 0) return;

      // Step 2 — fetch threads for every org in parallel
      const results = await Promise.all(
        orgs.map((org) =>
          fetchThreads(org.organization_id).catch(() => ({
            threads: [],
            orgId: org.organization_id,
          }))
        )
      );
      if (controller.signal.aborted) return;

      // Step 3 — build the normalized organizations list
      // First org = primary (the one from the JWT token comes first from the query ORDER BY joined_at ASC)
      const normalizedOrgs = orgs.map((org, idx) => ({
        id: String(org.organization_id),
        label: org.org_name,
        logoUrl: org.logo_url || null,
        subdomain: org.subdomain || null,
        roleKey: org.role_key || null,
        isPrimary: idx === 0,
      }));

      // Step 4 — build threadsByOrg map
      const threadsByOrg = {};
      results.forEach((result, idx) => {
        const key = String(orgs[idx].organization_id);
        threadsByOrg[key] = Array.isArray(result.threads) ? result.threads : [];
      });

      // Step 5 — commit everything into threadService in one shot
      // Merge threads per-thread to preserve realtime socket updates (unreadCount, readStatus)
      threadService.commit((state) => {
        const existingOrgs = (state.organizations || []).filter(
          (o) => normalizedOrgs.some((n) => n.id === String(o.id))
        );
        const mergedOrgs = normalizedOrgs.map((n) => {
          const existing = existingOrgs.find((e) => String(e.id) === n.id);
          return existing ? { ...existing, ...n } : n;
        });

        // Merge threadsByOrg: API data + preserve higher local unreadCount from socket updates
        const mergedThreadsByOrg = { ...state.threadsByOrg };
        for (const [orgKey, apiThreads] of Object.entries(threadsByOrg)) {
          const existingThreads = state.threadsByOrg[orgKey] || [];
          const existingMap = new Map(existingThreads.map((t) => [t.id, t]));
          mergedThreadsByOrg[orgKey] = apiThreads.map((apiThread) => {
            const local = existingMap.get(apiThread.id);
            if (!local) return apiThread;
            // Preserve higher unreadCount (socket may have incremented before API responded)
            const localUnread = Number(local.unreadCount) || 0;
            const apiUnread = Number(apiThread.unreadCount) || 0;
            return {
              ...apiThread,
              unreadCount: Math.max(localUnread, apiUnread),
              readStatus: localUnread > apiUnread ? (local.readStatus || apiThread.readStatus) : apiThread.readStatus,
            };
          });
        }

        return {
          ...state,
          organizations: mergedOrgs,
          threadsByOrg: mergedThreadsByOrg,
          updatedAt: Date.now(),
          lastSyncError: null,
        };
      });

      // Primary org = first in list
      setOrgId(String(orgs[0].organization_id));
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err?.message ?? "Failed to sync");
      console.warn("[useChatSync]", err?.message);
    } finally {
      if (!controller.signal.aborted) setSyncing(false);
    }
  }, []);

  useEffect(() => {
    sync();
    return () => { abortRef.current?.abort(); };
  }, [sync]);

  return { syncing, error, refresh: sync, orgId };
};

export default useChatSync;

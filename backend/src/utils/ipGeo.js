let geoip = null;
try {
  // Optional dependency: if not installed, lookup gracefully no-ops.
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  geoip = require('geoip-lite');
} catch {
  geoip = null;
}

const LOCAL_IPS = new Set(['127.0.0.1', '::1', '0.0.0.0']);

const normalizeIp = (raw) => {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (value.startsWith('::ffff:')) return value.slice(7);
  return value;
};

const isPrivateIpv4 = (ip) => {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;
  const [a, b] = ip.split('.').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
};

const isPrivateIpv6 = (ip) => ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80');

const isPrivateOrLocalIp = (ip) => {
  if (!ip) return true;
  if (LOCAL_IPS.has(ip)) return true;
  if (ip.includes(':')) return isPrivateIpv6(ip.toLowerCase());
  return isPrivateIpv4(ip);
};

const resolveGeoFromIp = (ipAddress) => {
  const ip = normalizeIp(ipAddress);
  if (!ip || isPrivateOrLocalIp(ip) || !geoip) {
    return { ip_address: ip, country: null, city: null };
  }

  const info = geoip.lookup(ip);
  if (!info) {
    return { ip_address: ip, country: null, city: null };
  }

  return {
    ip_address: ip,
    country: info.country || null,
    city: info.city || null,
  };
};

module.exports = {
  normalizeIp,
  resolveGeoFromIp,
};

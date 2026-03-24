const FREE_EMAIL_DOMAINS = new Set([
  '163.com',
  '126.com',
  'gmail.com',
  'yahoo.com',
  'ymail.com',
  'rocketmail.com',
  'outlook.com',
  'outlook.in',
  'outlook.co.in',
  'outlook.co.uk',
  'hotmail.com',
  'hotmail.co.uk',
  'hotmail.fr',
  'hotmail.de',
  'live.com',
  'live.in',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'pm.me',
  'protonmail.ch',
  'tutanota.com',
  'tuta.io',
  'fastmail.com',
  'gmx.com',
  'gmx.de',
  'gmx.net',
  'mail.com',
  'inbox.com',
  'yandex.com',
  'yandex.ru',
  'yandex.com.tr',
  'zoho.com',
  'zoho.in',
  'zohomail.com',
  'rediffmail.com',
  'indiatimes.com',
  'sify.com',
  'lycos.com',
  'hushmail.com',
  'qq.com',
  'naver.com',
  'daum.net',
  'hanmail.net',
  'seznam.cz',
  'web.de',
  'mail.ru',
  'bk.ru',
  'list.ru',
  'inbox.ru',
]);

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));

const getEmailDomain = (email) => normalizeEmail(email).split('@')[1] || '';

const isBusinessEmail = (email) => {
  if (!isValidEmail(email)) return false;
  const domain = getEmailDomain(email);
  return Boolean(domain) && !FREE_EMAIL_DOMAINS.has(domain);
};

module.exports = {
  FREE_EMAIL_DOMAINS,
  normalizeEmail,
  isValidEmail,
  getEmailDomain,
  isBusinessEmail,
};

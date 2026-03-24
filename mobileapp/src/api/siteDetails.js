import api from './config';

export const getSiteDetails = async () => {
  const { data } = await api.get('/site-details');
  const result = data?.data || data;
  // API returns array or single object
  const detail = Array.isArray(result) ? result[0] : result;
  return detail || null;
};

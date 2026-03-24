const pickPrimary = (rows = [], primaryKey = "is_primary") => {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows.find((row) => Boolean(row?.[primaryKey])) || rows[0] || null;
};

const toText = (value) => String(value || "").trim();

export const resolveSiteDetails = (siteProfile = null, fallbackName = "") => {
  const primaryEmail = pickPrimary(siteProfile?.emails);
  const primaryPhone = pickPrimary(siteProfile?.phones);
  const primaryAddress = pickPrimary(siteProfile?.addresses);

  const address = primaryAddress
    ? [
        primaryAddress.address_line_1,
        primaryAddress.address_line_2,
        primaryAddress.city,
        primaryAddress.state,
        primaryAddress.country,
        primaryAddress.postal_code,
      ]
        .map(toText)
        .filter(Boolean)
        .join(", ")
    : "";

  return {
    name: toText(siteProfile?.brand_name) || toText(fallbackName),
    email: toText(primaryEmail?.email_address),
    phone: toText(primaryPhone?.phone_number),
    address,
    primaryAddress: primaryAddress || null,
    primaryEmail: primaryEmail || null,
    primaryPhone: primaryPhone || null,
  };
};

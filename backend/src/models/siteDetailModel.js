const db = require('../config/database');

const mapDetailRow = (row) => ({
  site_detail_id: row.site_detail_id,
  brand_name: row.brand_name,
  logo_url: row.logo_url,
  mascot_url: row.mascot_url,
  google_plus_url: row.google_plus_url,
  linkedin_url: row.linkedin_url,
  twitter_url: row.twitter_url,
  youtube_url: row.youtube_url,
  status: row.status,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const getEmailsBySiteDetailId = async (tx, siteDetailId) => {
  const { rows } = await tx.query(
    `SELECT
       site_detail_email_id,
       site_detail_id,
       email_address,
       label,
       is_primary,
       status,
       created_at,
       updated_at
     FROM site_detail_emails
     WHERE site_detail_id = $1
     ORDER BY site_detail_email_id ASC`,
    [siteDetailId]
  );
  return rows;
};

const getPhonesBySiteDetailId = async (tx, siteDetailId) => {
  const { rows } = await tx.query(
    `SELECT
       site_detail_phone_id,
       site_detail_id,
       phone_number,
       label,
       is_primary,
       status,
       created_at,
       updated_at
     FROM site_detail_phones
     WHERE site_detail_id = $1
     ORDER BY site_detail_phone_id ASC`,
    [siteDetailId]
  );
  return rows;
};

const getAddressesBySiteDetailId = async (tx, siteDetailId) => {
  const { rows } = await tx.query(
    `SELECT
       site_detail_address_id,
       site_detail_id,
       label,
       address_line_1,
       address_line_2,
       city,
       state,
       country,
       postal_code,
       is_primary,
       status,
       created_at,
       updated_at
     FROM site_detail_addresses
     WHERE site_detail_id = $1
     ORDER BY site_detail_address_id ASC`,
    [siteDetailId]
  );
  return rows;
};

const buildHydratedDetail = async (tx, detailRow) => {
  if (!detailRow) return null;
  const base = mapDetailRow(detailRow);
  const emails = await getEmailsBySiteDetailId(tx, detailRow.site_detail_id);
  const phones = await getPhonesBySiteDetailId(tx, detailRow.site_detail_id);
  const addresses = await getAddressesBySiteDetailId(tx, detailRow.site_detail_id);
  return {
    ...base,
    emails,
    phones,
    addresses,
  };
};

const replaceEmails = async (tx, siteDetailId, emails = []) => {
  await tx.query('DELETE FROM site_detail_emails WHERE site_detail_id = $1', [siteDetailId]);
  for (const email of emails) {
    await tx.query(
      `INSERT INTO site_detail_emails
        (site_detail_id, email_address, label, is_primary, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [siteDetailId, email.email_address, email.label, email.is_primary, email.status]
    );
  }
};

const replacePhones = async (tx, siteDetailId, phones = []) => {
  await tx.query('DELETE FROM site_detail_phones WHERE site_detail_id = $1', [siteDetailId]);
  for (const phone of phones) {
    await tx.query(
      `INSERT INTO site_detail_phones
        (site_detail_id, phone_number, label, is_primary, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [siteDetailId, phone.phone_number, phone.label, phone.is_primary, phone.status]
    );
  }
};

const replaceAddresses = async (tx, siteDetailId, addresses = []) => {
  await tx.query('DELETE FROM site_detail_addresses WHERE site_detail_id = $1', [siteDetailId]);
  for (const address of addresses) {
    await tx.query(
      `INSERT INTO site_detail_addresses
        (
          site_detail_id,
          label,
          address_line_1,
          address_line_2,
          city,
          state,
          country,
          postal_code,
          is_primary,
          status
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        siteDetailId,
        address.label,
        address.address_line_1,
        address.address_line_2,
        address.city,
        address.state,
        address.country,
        address.postal_code,
        address.is_primary,
        address.status,
      ]
    );
  }
};

const findAll = async () => {
  return db.withTransaction(async (tx) => {
    const { rows } = await tx.query(
      `SELECT *
       FROM site_details
       ORDER BY site_detail_id DESC`
    );
    const hydrated = [];
    for (const row of rows) {
      hydrated.push(await buildHydratedDetail(tx, row));
    }
    return hydrated;
  });
};

const findById = async (siteDetailId) => {
  return db.withTransaction(async (tx) => {
    const { rows } = await tx.query(
      `SELECT *
       FROM site_details
       WHERE site_detail_id = $1
       LIMIT 1`,
      [siteDetailId]
    );
    return buildHydratedDetail(tx, rows[0] || null);
  });
};

const createSiteDetail = async (payload) => {
  return db.withTransaction(async (tx) => {
    const inserted = await tx.query(
      `INSERT INTO site_details
        (
          brand_name,
          logo_url,
          mascot_url,
          google_plus_url,
          linkedin_url,
          twitter_url,
          youtube_url,
          status
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        payload.brand_name,
        payload.logo_url,
        payload.mascot_url,
        payload.google_plus_url,
        payload.linkedin_url,
        payload.twitter_url,
        payload.youtube_url,
        payload.status,
      ]
    );

    const created = inserted.rows[0];
    await replaceEmails(tx, created.site_detail_id, payload.emails || []);
    await replacePhones(tx, created.site_detail_id, payload.phones || []);
    await replaceAddresses(tx, created.site_detail_id, payload.addresses || []);

    return buildHydratedDetail(tx, created);
  });
};

const updateById = async (siteDetailId, payload, { partial = false } = {}) => {
  return db.withTransaction(async (tx) => {
    const existingResult = await tx.query(
      `SELECT *
       FROM site_details
       WHERE site_detail_id = $1
       LIMIT 1`,
      [siteDetailId]
    );
    const existing = existingResult.rows[0];
    if (!existing) return null;

    const fields = [];
    const values = [];
    let idx = 1;
    const allowed = [
      'brand_name',
      'logo_url',
      'mascot_url',
      'google_plus_url',
      'linkedin_url',
      'twitter_url',
      'youtube_url',
      'status',
    ];

    for (const key of allowed) {
      if (payload[key] !== undefined) {
        fields.push(`${key} = $${idx}`);
        values.push(payload[key]);
        idx += 1;
      }
    }

    const hasArrayPayload =
      payload.emails !== undefined || payload.phones !== undefined || payload.addresses !== undefined;

    if (!fields.length && !hasArrayPayload && partial) {
      return null;
    }

    let updatedRow = existing;
    if (fields.length) {
      values.push(siteDetailId);
      const updatedResult = await tx.query(
        `UPDATE site_details
         SET ${fields.join(', ')},
             updated_at = NOW()
         WHERE site_detail_id = $${idx}
         RETURNING *`,
        values
      );
      updatedRow = updatedResult.rows[0];
    }

    if (payload.emails !== undefined) {
      await replaceEmails(tx, siteDetailId, payload.emails || []);
    } else if (!partial) {
      await replaceEmails(tx, siteDetailId, []);
    }

    if (payload.phones !== undefined) {
      await replacePhones(tx, siteDetailId, payload.phones || []);
    } else if (!partial) {
      await replacePhones(tx, siteDetailId, []);
    }

    if (payload.addresses !== undefined) {
      await replaceAddresses(tx, siteDetailId, payload.addresses || []);
    } else if (!partial) {
      await replaceAddresses(tx, siteDetailId, []);
    }

    return buildHydratedDetail(tx, updatedRow);
  });
};

module.exports = {
  findAll,
  findById,
  createSiteDetail,
  updateById,
};

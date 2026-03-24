-- Create a new owner account with organization, owner membership, and active subscription.
-- Safe for PostgreSQL. Run as a single script.
--
-- Usage:
-- 1) Update values in the "INPUTS" section.
-- 2) Execute the script.
-- 3) It returns created user_id and organization_id.

BEGIN;

DO $$
DECLARE
  -- INPUTS
  v_email           text := 'newowner@yourcompany.com';
  v_owner_name      text := 'New Owner';
  v_password_hash   text := '$2b$10$replace_with_real_bcrypt_hash';
  v_mobile          text := '+919999999999';
  v_org_key         text := 'yourcompany_org_001';
  v_org_name        text := 'Your Company';
  v_subdomain       text := 'yourcompany';
  v_custom_domain   text := 'yourcompany.com';

  -- Defaults
  v_owner_role_id   int  := 1;
  v_default_plan_id int  := 1;

  -- Internal
  v_user_id         bigint;
  v_org_id          bigint;
  v_plan_interval   int;
  v_plan_max_users  int;
  v_plan_storage_mb int;
BEGIN
  -- Basic duplicate protection
  IF EXISTS (SELECT 1 FROM users WHERE lower(email) = lower(v_email)) THEN
    RAISE EXCEPTION 'Email already exists: %', v_email;
  END IF;

  IF EXISTS (SELECT 1 FROM organizations WHERE lower(org_key) = lower(v_org_key)) THEN
    RAISE EXCEPTION 'org_key already exists: %', v_org_key;
  END IF;

  IF EXISTS (SELECT 1 FROM organizations WHERE lower(subdomain) = lower(v_subdomain)) THEN
    RAISE EXCEPTION 'subdomain already exists: %', v_subdomain;
  END IF;

  IF EXISTS (SELECT 1 FROM organizations WHERE lower(custom_domain) = lower(v_custom_domain)) THEN
    RAISE EXCEPTION 'custom_domain already exists: %', v_custom_domain;
  END IF;

  -- Validate role
  IF NOT EXISTS (SELECT 1 FROM roles WHERE role_id = v_owner_role_id) THEN
    RAISE EXCEPTION 'Owner role_id not found: %', v_owner_role_id;
  END IF;

  -- Validate plan and load subscription defaults
  SELECT interval_days, max_users, max_storage_mb
    INTO v_plan_interval, v_plan_max_users, v_plan_storage_mb
  FROM plans
  WHERE plan_id = v_default_plan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Default plan_id not found: %', v_default_plan_id;
  END IF;

  IF COALESCE(v_plan_interval, 0) <= 0 THEN
    RAISE EXCEPTION 'plan.interval_days must be > 0 for plan_id=%', v_default_plan_id;
  END IF;

  -- 1) Create owner user
  INSERT INTO users (
    email,
    name,
    password_hash,
    mobile,
    is_platform_admin,
    is_global_member,
    status,
    created_at,
    updated_at
  )
  VALUES (
    v_email,
    v_owner_name,
    v_password_hash,
    v_mobile,
    TRUE,
    FALSE,
    'active',
    NOW(),
    NOW()
  )
  RETURNING user_id INTO v_user_id;

  -- 2) Create organization
  INSERT INTO organizations (
    org_key,
    name,
    subdomain,
    custom_domain,
    owner_id,
    language_id,
    timezone_id,
    storage_used_mb,
    status,
    created_at,
    updated_at
  )
  VALUES (
    v_org_key,
    v_org_name,
    v_subdomain,
    v_custom_domain,
    v_user_id,
    1,
    1,
    0,
    'active',
    NOW(),
    NOW()
  )
  RETURNING organization_id INTO v_org_id;

  -- 3) Add owner as organization member
  INSERT INTO organization_members (
    organization_id,
    user_id,
    role_id,
    status,
    created_at,
    updated_at
  )
  VALUES (
    v_org_id,
    v_user_id,
    v_owner_role_id,
    'active',
    NOW(),
    NOW()
  );

  -- 4) Create active subscription from selected plan
  INSERT INTO subscriptions (
    organization_id,
    plan_id,
    status,
    start_date,
    end_date,
    max_users,
    max_storage_mb,
    created_at,
    updated_at
  )
  VALUES (
    v_org_id,
    v_default_plan_id,
    'active',
    CURRENT_DATE,
    CURRENT_DATE + (v_plan_interval * INTERVAL '1 day'),
    v_plan_max_users,
    v_plan_storage_mb,
    NOW(),
    NOW()
  );

  RAISE NOTICE 'Owner created successfully. user_id=%, organization_id=%', v_user_id, v_org_id;
END $$;

COMMIT;

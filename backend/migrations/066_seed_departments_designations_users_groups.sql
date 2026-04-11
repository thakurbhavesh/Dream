-- Migration 066: Full seed — departments, designations, assign users, create groups
-- Organization: 1 (Teamchatx)
-- Password for all new users: Bhavesh@1234
-- Hash: $2b$10$Q//e3Q5IHoUnSkH5gmCKE.4TM9QGk.R2njEBEjmfK.ycTAvBgr1Cm

-- ─── 1. DEPARTMENTS ────────────────────────────────────────

INSERT INTO departments (name, organization_id, status) VALUES
  ('Engineering', 1, 'active'),
  ('Design', 1, 'active'),
  ('Marketing', 1, 'active'),
  ('Sales', 1, 'active'),
  ('HR', 1, 'active'),
  ('Product', 1, 'active'),
  ('Finance', 1, 'active'),
  ('Operations', 1, 'active')
ON CONFLICT (name, organization_id) DO UPDATE SET status = 'active';

-- ─── 2. DESIGNATIONS ──────────────────────────────────────

-- Designations need department_id for unique constraint
-- Use Engineering (dept 1) as default, will be correct for most
INSERT INTO designations (name, organization_id, department_id, status)
SELECT v.name, 1, (SELECT department_id FROM departments WHERE name = 'Engineering' AND organization_id = 1 LIMIT 1), 'active'
FROM (VALUES ('Software Engineer'),('Senior Developer'),('UI/UX Designer'),('Product Manager'),('Marketing Manager'),('HR Manager'),('Sales Executive'),('Team Lead'),('DevOps Engineer'),('QA Engineer'),('Business Analyst'),('Finance Manager'),('Operations Head'),('Intern'),('CTO')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM designations d WHERE d.name = v.name AND d.organization_id = 1);

-- ─── 3. MORE USERS ─────────────────────────────────────────

INSERT INTO users (email, name, mobile, password_hash, status, email_verified_at) VALUES
  ('sanjay.mishra@aabhyasa.com', 'Sanjay Mishra', '+919800000001', '$2b$10$Q//e3Q5IHoUnSkH5gmCKE.4TM9QGk.R2njEBEjmfK.ycTAvBgr1Cm', 'active', NOW()),
  ('pooja.shah@aabhyasa.com', 'Pooja Shah', '+919800000002', '$2b$10$Q//e3Q5IHoUnSkH5gmCKE.4TM9QGk.R2njEBEjmfK.ycTAvBgr1Cm', 'active', NOW()),
  ('karan.thakur@aabhyasa.com', 'Karan Thakur', '+919800000003', '$2b$10$Q//e3Q5IHoUnSkH5gmCKE.4TM9QGk.R2njEBEjmfK.ycTAvBgr1Cm', 'active', NOW()),
  ('meera.iyer@aabhyasa.com', 'Meera Iyer', '+919800000004', '$2b$10$Q//e3Q5IHoUnSkH5gmCKE.4TM9QGk.R2njEBEjmfK.ycTAvBgr1Cm', 'active', NOW()),
  ('rajesh.pandey@aabhyasa.com', 'Rajesh Pandey', '+919800000005', '$2b$10$Q//e3Q5IHoUnSkH5gmCKE.4TM9QGk.R2njEBEjmfK.ycTAvBgr1Cm', 'active', NOW()),
  ('nisha.agarwal@aabhyasa.com', 'Nisha Agarwal', '+919800000006', '$2b$10$Q//e3Q5IHoUnSkH5gmCKE.4TM9QGk.R2njEBEjmfK.ycTAvBgr1Cm', 'active', NOW()),
  ('dev.chauhan@aabhyasa.com', 'Dev Chauhan', '+919800000007', '$2b$10$Q//e3Q5IHoUnSkH5gmCKE.4TM9QGk.R2njEBEjmfK.ycTAvBgr1Cm', 'active', NOW())
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'active';

-- Add new users to org 1
INSERT INTO organization_members (organization_id, user_id, role_id, status)
SELECT 1, u.user_id, 4, 'active'
FROM users u WHERE u.email IN (
  'sanjay.mishra@aabhyasa.com','pooja.shah@aabhyasa.com','karan.thakur@aabhyasa.com',
  'meera.iyer@aabhyasa.com','rajesh.pandey@aabhyasa.com','nisha.agarwal@aabhyasa.com','dev.chauhan@aabhyasa.com'
) ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active';

-- ─── 4. ASSIGN DEPARTMENTS + DESIGNATIONS TO ALL USERS ─────

-- Engineering team
UPDATE organization_members SET
  department_id = (SELECT department_id FROM departments WHERE name = 'Engineering' AND organization_id = 1 LIMIT 1),
  designation_id = (SELECT designation_id FROM designations WHERE name = 'Senior Developer' AND organization_id = 1 LIMIT 1)
WHERE user_id = (SELECT user_id FROM users WHERE email = 'rahul.sharma@aabhyasa.com') AND organization_id = 1;

UPDATE organization_members SET
  department_id = (SELECT department_id FROM departments WHERE name = 'Engineering' AND organization_id = 1 LIMIT 1),
  designation_id = (SELECT designation_id FROM designations WHERE name = 'Software Engineer' AND organization_id = 1 LIMIT 1)
WHERE user_id = (SELECT user_id FROM users WHERE email = 'amit.patel@aabhyasa.com') AND organization_id = 1;

UPDATE organization_members SET
  department_id = (SELECT department_id FROM departments WHERE name = 'Engineering' AND organization_id = 1 LIMIT 1),
  designation_id = (SELECT designation_id FROM designations WHERE name = 'DevOps Engineer' AND organization_id = 1 LIMIT 1)
WHERE user_id = (SELECT user_id FROM users WHERE email = 'rohan.kumar@aabhyasa.com') AND organization_id = 1;

UPDATE organization_members SET
  department_id = (SELECT department_id FROM departments WHERE name = 'Engineering' AND organization_id = 1 LIMIT 1),
  designation_id = (SELECT designation_id FROM designations WHERE name = 'QA Engineer' AND organization_id = 1 LIMIT 1)
WHERE user_id = (SELECT user_id FROM users WHERE email = 'dev.chauhan@aabhyasa.com') AND organization_id = 1;

-- Design team
UPDATE organization_members SET
  department_id = (SELECT department_id FROM departments WHERE name = 'Design' AND organization_id = 1 LIMIT 1),
  designation_id = (SELECT designation_id FROM designations WHERE name = 'UI/UX Designer' AND organization_id = 1 LIMIT 1)
WHERE user_id = (SELECT user_id FROM users WHERE email = 'priya.verma@aabhyasa.com') AND organization_id = 1;

UPDATE organization_members SET
  department_id = (SELECT department_id FROM departments WHERE name = 'Design' AND organization_id = 1 LIMIT 1),
  designation_id = (SELECT designation_id FROM designations WHERE name = 'UI/UX Designer' AND organization_id = 1 LIMIT 1)
WHERE user_id = (SELECT user_id FROM users WHERE email = 'meera.iyer@aabhyasa.com') AND organization_id = 1;

-- Product team
UPDATE organization_members SET
  department_id = (SELECT department_id FROM departments WHERE name = 'Product' AND organization_id = 1 LIMIT 1),
  designation_id = (SELECT designation_id FROM designations WHERE name = 'Product Manager' AND organization_id = 1 LIMIT 1)
WHERE user_id = (SELECT user_id FROM users WHERE email = 'neha.gupta@aabhyasa.com') AND organization_id = 1;

UPDATE organization_members SET
  department_id = (SELECT department_id FROM departments WHERE name = 'Product' AND organization_id = 1 LIMIT 1),
  designation_id = (SELECT designation_id FROM designations WHERE name = 'Business Analyst' AND organization_id = 1 LIMIT 1)
WHERE user_id = (SELECT user_id FROM users WHERE email = 'kavita.joshi@aabhyasa.com') AND organization_id = 1;

-- Marketing team
UPDATE organization_members SET
  department_id = (SELECT department_id FROM departments WHERE name = 'Marketing' AND organization_id = 1 LIMIT 1),
  designation_id = (SELECT designation_id FROM designations WHERE name = 'Marketing Manager' AND organization_id = 1 LIMIT 1)
WHERE user_id = (SELECT user_id FROM users WHERE email = 'ananya.reddy@aabhyasa.com') AND organization_id = 1;

UPDATE organization_members SET
  department_id = (SELECT department_id FROM departments WHERE name = 'Marketing' AND organization_id = 1 LIMIT 1),
  designation_id = (SELECT designation_id FROM designations WHERE name = 'Sales Executive' AND organization_id = 1 LIMIT 1)
WHERE user_id = (SELECT user_id FROM users WHERE email = 'nisha.agarwal@aabhyasa.com') AND organization_id = 1;

-- HR
UPDATE organization_members SET
  department_id = (SELECT department_id FROM departments WHERE name = 'HR' AND organization_id = 1 LIMIT 1),
  designation_id = (SELECT designation_id FROM designations WHERE name = 'HR Manager' AND organization_id = 1 LIMIT 1)
WHERE user_id = (SELECT user_id FROM users WHERE email = 'vikram.singh@aabhyasa.com') AND organization_id = 1;

-- Sales
UPDATE organization_members SET
  department_id = (SELECT department_id FROM departments WHERE name = 'Sales' AND organization_id = 1 LIMIT 1),
  designation_id = (SELECT designation_id FROM designations WHERE name = 'Team Lead' AND organization_id = 1 LIMIT 1)
WHERE user_id = (SELECT user_id FROM users WHERE email = 'arjun.mehta@aabhyasa.com') AND organization_id = 1;

-- Finance
UPDATE organization_members SET
  department_id = (SELECT department_id FROM departments WHERE name = 'Finance' AND organization_id = 1 LIMIT 1),
  designation_id = (SELECT designation_id FROM designations WHERE name = 'Finance Manager' AND organization_id = 1 LIMIT 1)
WHERE user_id = (SELECT user_id FROM users WHERE email = 'deepika.nair@aabhyasa.com') AND organization_id = 1;

-- Operations
UPDATE organization_members SET
  department_id = (SELECT department_id FROM departments WHERE name = 'Operations' AND organization_id = 1 LIMIT 1),
  designation_id = (SELECT designation_id FROM designations WHERE name = 'Operations Head' AND organization_id = 1 LIMIT 1)
WHERE user_id = (SELECT user_id FROM users WHERE email = 'sanjay.mishra@aabhyasa.com') AND organization_id = 1;

-- Engineering extras
UPDATE organization_members SET
  department_id = (SELECT department_id FROM departments WHERE name = 'Engineering' AND organization_id = 1 LIMIT 1),
  designation_id = (SELECT designation_id FROM designations WHERE name = 'Software Engineer' AND organization_id = 1 LIMIT 1)
WHERE user_id = (SELECT user_id FROM users WHERE email = 'pooja.shah@aabhyasa.com') AND organization_id = 1;

UPDATE organization_members SET
  department_id = (SELECT department_id FROM departments WHERE name = 'Engineering' AND organization_id = 1 LIMIT 1),
  designation_id = (SELECT designation_id FROM designations WHERE name = 'Team Lead' AND organization_id = 1 LIMIT 1)
WHERE user_id = (SELECT user_id FROM users WHERE email = 'karan.thakur@aabhyasa.com') AND organization_id = 1;

UPDATE organization_members SET
  department_id = (SELECT department_id FROM departments WHERE name = 'Engineering' AND organization_id = 1 LIMIT 1),
  designation_id = (SELECT designation_id FROM designations WHERE name = 'Intern' AND organization_id = 1 LIMIT 1)
WHERE user_id = (SELECT user_id FROM users WHERE email = 'rajesh.pandey@aabhyasa.com') AND organization_id = 1;

-- Bhavesh = CTO, Engineering
UPDATE organization_members SET
  department_id = (SELECT department_id FROM departments WHERE name = 'Engineering' AND organization_id = 1 LIMIT 1),
  designation_id = (SELECT designation_id FROM designations WHERE name = 'CTO' AND organization_id = 1 LIMIT 1)
WHERE user_id = (SELECT user_id FROM users WHERE email = 'bhavesh.singh@aabhyasa.com') AND organization_id = 1;

-- ─── 5. CREATE GROUPS + ADD MEMBERS ────────────────────────

-- Engineering Group
INSERT INTO groups (group_name, group_description, organization_id, created_by, is_airtime, status)
SELECT 'Engineering', 'Engineering team discussions — code reviews, deployments, tech decisions', 1,
  (SELECT user_id FROM users WHERE email = 'bhavesh.singh@aabhyasa.com'), false, 'active'
WHERE NOT EXISTS (SELECT 1 FROM groups WHERE group_name = 'Engineering' AND organization_id = 1);

-- Product & Design Group
INSERT INTO groups (group_name, group_description, organization_id, created_by, is_airtime, status)
SELECT 'Product & Design', 'Product roadmap, design reviews, feature planning', 1,
  (SELECT user_id FROM users WHERE email = 'bhavesh.singh@aabhyasa.com'), false, 'active'
WHERE NOT EXISTS (SELECT 1 FROM groups WHERE group_name = 'Product & Design' AND organization_id = 1);

-- Company Announcements (Airtime)
INSERT INTO groups (group_name, group_description, organization_id, created_by, is_airtime, status)
SELECT 'Company Announcements', 'Official company updates — admins only can post', 1,
  (SELECT user_id FROM users WHERE email = 'bhavesh.singh@aabhyasa.com'), true, 'active'
WHERE NOT EXISTS (SELECT 1 FROM groups WHERE group_name = 'Company Announcements' AND organization_id = 1);

-- Marketing & Sales Group
INSERT INTO groups (group_name, group_description, organization_id, created_by, is_airtime, status)
SELECT 'Marketing & Sales', 'Campaigns, leads, sales pipeline discussions', 1,
  (SELECT user_id FROM users WHERE email = 'bhavesh.singh@aabhyasa.com'), false, 'active'
WHERE NOT EXISTS (SELECT 1 FROM groups WHERE group_name = 'Marketing & Sales' AND organization_id = 1);

-- Add members to Engineering group
INSERT INTO group_members (group_id, user_id, is_admin, organization_id, status)
SELECT g.group_id, u.user_id, u.email IN ('bhavesh.singh@aabhyasa.com','karan.thakur@aabhyasa.com'), 1, 'active'
FROM groups g, users u
WHERE g.group_name = 'Engineering' AND g.organization_id = 1
  AND u.email IN ('bhavesh.singh@aabhyasa.com','rahul.sharma@aabhyasa.com','amit.patel@aabhyasa.com','rohan.kumar@aabhyasa.com','pooja.shah@aabhyasa.com','karan.thakur@aabhyasa.com','dev.chauhan@aabhyasa.com','rajesh.pandey@aabhyasa.com')
ON CONFLICT (group_id, user_id) DO UPDATE SET status = 'active';

-- Add members to Product & Design group
INSERT INTO group_members (group_id, user_id, is_admin, organization_id, status)
SELECT g.group_id, u.user_id, u.email IN ('bhavesh.singh@aabhyasa.com','neha.gupta@aabhyasa.com'), 1, 'active'
FROM groups g, users u
WHERE g.group_name = 'Product & Design' AND g.organization_id = 1
  AND u.email IN ('bhavesh.singh@aabhyasa.com','neha.gupta@aabhyasa.com','priya.verma@aabhyasa.com','meera.iyer@aabhyasa.com','kavita.joshi@aabhyasa.com')
ON CONFLICT (group_id, user_id) DO UPDATE SET status = 'active';

-- Add ALL members to Company Announcements
INSERT INTO group_members (group_id, user_id, is_admin, organization_id, status)
SELECT g.group_id, u.user_id, u.email = 'bhavesh.singh@aabhyasa.com', 1, 'active'
FROM groups g, users u
WHERE g.group_name = 'Company Announcements' AND g.organization_id = 1
  AND u.email LIKE '%@aabhyasa.com'
ON CONFLICT (group_id, user_id) DO UPDATE SET status = 'active';

-- Add members to Marketing & Sales group
INSERT INTO group_members (group_id, user_id, is_admin, organization_id, status)
SELECT g.group_id, u.user_id, u.email IN ('bhavesh.singh@aabhyasa.com','ananya.reddy@aabhyasa.com'), 1, 'active'
FROM groups g, users u
WHERE g.group_name = 'Marketing & Sales' AND g.organization_id = 1
  AND u.email IN ('bhavesh.singh@aabhyasa.com','ananya.reddy@aabhyasa.com','nisha.agarwal@aabhyasa.com','arjun.mehta@aabhyasa.com','vikram.singh@aabhyasa.com')
ON CONFLICT (group_id, user_id) DO UPDATE SET status = 'active';

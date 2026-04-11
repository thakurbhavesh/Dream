-- Migration 065: Seed 10 test users
-- Password for all: Bhavesh@1234

-- Insert users
INSERT INTO users (email, name, mobile, password_hash, status, email_verified_at)
VALUES
  ('rahul.sharma@aabhyasa.com', 'Rahul Sharma', '+919876543210', '$2b$10$Q//e3Q5IHoUnSkH5gmCKE.4TM9QGk.R2njEBEjmfK.ycTAvBgr1Cm', 'active', NOW()),
  ('priya.verma@aabhyasa.com', 'Priya Verma', '+919876543211', '$2b$10$Q//e3Q5IHoUnSkH5gmCKE.4TM9QGk.R2njEBEjmfK.ycTAvBgr1Cm', 'active', NOW()),
  ('amit.patel@aabhyasa.com', 'Amit Patel', '+919876543212', '$2b$10$Q//e3Q5IHoUnSkH5gmCKE.4TM9QGk.R2njEBEjmfK.ycTAvBgr1Cm', 'active', NOW()),
  ('neha.gupta@aabhyasa.com', 'Neha Gupta', '+919876543213', '$2b$10$Q//e3Q5IHoUnSkH5gmCKE.4TM9QGk.R2njEBEjmfK.ycTAvBgr1Cm', 'active', NOW()),
  ('vikram.singh@aabhyasa.com', 'Vikram Singh', '+919876543214', '$2b$10$Q//e3Q5IHoUnSkH5gmCKE.4TM9QGk.R2njEBEjmfK.ycTAvBgr1Cm', 'active', NOW()),
  ('ananya.reddy@aabhyasa.com', 'Ananya Reddy', '+919876543215', '$2b$10$Q//e3Q5IHoUnSkH5gmCKE.4TM9QGk.R2njEBEjmfK.ycTAvBgr1Cm', 'active', NOW()),
  ('rohan.kumar@aabhyasa.com', 'Rohan Kumar', '+919876543216', '$2b$10$Q//e3Q5IHoUnSkH5gmCKE.4TM9QGk.R2njEBEjmfK.ycTAvBgr1Cm', 'active', NOW()),
  ('kavita.joshi@aabhyasa.com', 'Kavita Joshi', '+919876543217', '$2b$10$Q//e3Q5IHoUnSkH5gmCKE.4TM9QGk.R2njEBEjmfK.ycTAvBgr1Cm', 'active', NOW()),
  ('arjun.mehta@aabhyasa.com', 'Arjun Mehta', '+919876543218', '$2b$10$Q//e3Q5IHoUnSkH5gmCKE.4TM9QGk.R2njEBEjmfK.ycTAvBgr1Cm', 'active', NOW()),
  ('deepika.nair@aabhyasa.com', 'Deepika Nair', '+919876543219', '$2b$10$Q//e3Q5IHoUnSkH5gmCKE.4TM9QGk.R2njEBEjmfK.ycTAvBgr1Cm', 'active', NOW())
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'active';

-- Add to organization 1 as regular users (role_id = 4)
INSERT INTO organization_members (organization_id, user_id, role_id, status)
SELECT 1, u.user_id, 4, 'active'
FROM users u
WHERE u.email IN (
  'rahul.sharma@aabhyasa.com', 'priya.verma@aabhyasa.com', 'amit.patel@aabhyasa.com',
  'neha.gupta@aabhyasa.com', 'vikram.singh@aabhyasa.com', 'ananya.reddy@aabhyasa.com',
  'rohan.kumar@aabhyasa.com', 'kavita.joshi@aabhyasa.com', 'arjun.mehta@aabhyasa.com',
  'deepika.nair@aabhyasa.com'
)
ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active';

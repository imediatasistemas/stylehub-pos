-- Create initial admin user
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  'aaaa0000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'admin@sistema.com',
  crypt('admin123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Administrador"}',
  false,
  'authenticated'
);

-- Create admin profile
INSERT INTO public.profiles (
  user_id,
  name,
  role
) VALUES (
  'aaaa0000-0000-0000-0000-000000000000',
  'Administrador',
  'admin'::app_role
);
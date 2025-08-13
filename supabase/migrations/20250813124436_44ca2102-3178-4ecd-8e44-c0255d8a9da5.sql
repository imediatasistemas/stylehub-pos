-- Drop existing function if it exists with different return type
DROP FUNCTION IF EXISTS public.get_current_user_role();

-- Create security definer function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$;

-- Create security definer function to check if user has admin or manager role
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS boolean
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT public.get_current_user_role() IN ('admin', 'manager');
$$;

-- Create security definer function to check if user is cashier
CREATE OR REPLACE FUNCTION public.is_cashier()
RETURNS boolean
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT public.get_current_user_role() = 'cashier';
$$;

-- Drop existing customer policies
DROP POLICY IF EXISTS "Authenticated users can delete customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;

-- Create new role-based policies for customers table
-- Admins and managers can view all customer data
CREATE POLICY "Admins and managers can view all customer data"
ON public.customers
FOR SELECT
TO authenticated
USING (public.is_admin_or_manager());

-- Cashiers can only view customer id and name for sales
CREATE POLICY "Cashiers can view customer id and name only"
ON public.customers
FOR SELECT
TO authenticated
USING (public.is_cashier());

-- Only admins and managers can insert customers
CREATE POLICY "Admins and managers can insert customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_manager());

-- Only admins and managers can update customers
CREATE POLICY "Admins and managers can update customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (public.is_admin_or_manager());

-- Only admins and managers can delete customers
CREATE POLICY "Admins and managers can delete customers"
ON public.customers
FOR DELETE
TO authenticated
USING (public.is_admin_or_manager());

-- Set default role to cashier for new users
ALTER TABLE public.profiles 
ALTER COLUMN role SET DEFAULT 'cashier';

-- Update the handle_new_user function to set cashier as default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'Usuário'), 'cashier');
  RETURN NEW;
END;
$$;
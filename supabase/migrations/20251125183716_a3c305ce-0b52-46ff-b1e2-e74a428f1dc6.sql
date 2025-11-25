-- Create admin_keys table for API key-based admin authentication
CREATE TABLE IF NOT EXISTS public.admin_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  created_by TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.admin_keys ENABLE ROW LEVEL SECURITY;

-- Admin keys can only be managed through edge functions (no direct client access)
CREATE POLICY "No direct access to admin_keys"
ON public.admin_keys
FOR ALL
USING (false);

-- Create admin_audit table for logging admin actions
CREATE TABLE IF NOT EXISTS public.admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_key_id UUID REFERENCES public.admin_keys(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  before JSONB,
  after JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on audit table
ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;

-- Only allow reading audit logs (writing is done by edge functions)
CREATE POLICY "Admin audit logs are read-only"
ON public.admin_audit
FOR SELECT
USING (true);

-- Remove the old trigger that auto-assigns admin role to specific email
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
DROP FUNCTION IF EXISTS public.assign_admin_role();

-- Create updated function that only assigns user role to everyone
CREATE OR REPLACE FUNCTION public.assign_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Assign default user role to all new users
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-assign user role on user creation
CREATE TRIGGER on_auth_user_created_assign_user_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_user_role();

-- Insert initial admin key (this will be shown only once - store it securely!)
-- Key: admin_master_key_2024 (hashed with SHA-256)
-- Replace this with your own generated key after first login
INSERT INTO public.admin_keys (key_hash, label, created_by)
VALUES (
  encode(digest('admin_master_key_2024', 'sha256'), 'hex'),
  'Initial Master Key',
  'system'
) ON CONFLICT (key_hash) DO NOTHING;
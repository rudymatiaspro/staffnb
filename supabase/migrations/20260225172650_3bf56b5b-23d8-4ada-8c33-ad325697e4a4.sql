
-- Create role_permissions table for dynamic permission management
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  module text NOT NULL,
  can_read boolean NOT NULL DEFAULT true,
  can_create boolean NOT NULL DEFAULT false,
  can_update boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_reset boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, module)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Only god/admin/owner can view permissions
CREATE POLICY "Owner+ can view permissions"
  ON public.role_permissions FOR SELECT
  USING (is_owner());

-- Only god/admin can manage permissions
CREATE POLICY "God/admin can manage permissions"
  ON public.role_permissions FOR ALL
  USING (is_god_or_admin())
  WITH CHECK (is_god_or_admin());

-- Owner can update permissions (but not god/admin rows)
CREATE POLICY "Owner can update non-admin permissions"
  ON public.role_permissions FOR UPDATE
  USING (is_owner() AND role NOT IN ('god', 'admin'));

-- Trigger for updated_at
CREATE TRIGGER set_role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed default permissions for all roles × modules
-- Modules: tasks, stock, cakes, menu, haccp, incidents, orders, planning, chat, pointage, scores, objectives, reports, members
-- Roles: god, admin, owner, station, manager, chef, staff, sous_chef

INSERT INTO public.role_permissions (role, module, can_read, can_create, can_update, can_delete, can_reset) VALUES
-- GOD: full access everywhere
('god', 'tasks', true, true, true, true, true),
('god', 'stock', true, true, true, true, true),
('god', 'cakes', true, true, true, true, true),
('god', 'menu', true, true, true, true, true),
('god', 'haccp', true, true, true, true, true),
('god', 'incidents', true, true, true, true, true),
('god', 'orders', true, true, true, true, true),
('god', 'planning', true, true, true, true, true),
('god', 'chat', true, true, true, true, true),
('god', 'pointage', true, true, true, true, true),
('god', 'scores', true, true, true, true, true),
('god', 'objectives', true, true, true, true, true),
('god', 'reports', true, true, true, true, true),
('god', 'members', true, true, true, true, true),

-- ADMIN: full access everywhere
('admin', 'tasks', true, true, true, true, true),
('admin', 'stock', true, true, true, true, true),
('admin', 'cakes', true, true, true, true, true),
('admin', 'menu', true, true, true, true, true),
('admin', 'haccp', true, true, true, true, true),
('admin', 'incidents', true, true, true, true, true),
('admin', 'orders', true, true, true, true, true),
('admin', 'planning', true, true, true, true, true),
('admin', 'chat', true, true, true, true, true),
('admin', 'pointage', true, true, true, true, true),
('admin', 'scores', true, true, true, true, true),
('admin', 'objectives', true, true, true, true, true),
('admin', 'reports', true, true, true, true, true),
('admin', 'members', true, true, true, true, true),

-- OWNER: full access
('owner', 'tasks', true, true, true, true, true),
('owner', 'stock', true, true, true, true, true),
('owner', 'cakes', true, true, true, true, true),
('owner', 'menu', true, true, true, true, true),
('owner', 'haccp', true, true, true, true, true),
('owner', 'incidents', true, true, true, true, true),
('owner', 'orders', true, true, true, true, true),
('owner', 'planning', true, true, true, true, true),
('owner', 'chat', true, true, true, true, true),
('owner', 'pointage', true, true, true, true, true),
('owner', 'scores', true, true, true, true, true),
('owner', 'objectives', true, true, true, true, true),
('owner', 'reports', true, true, true, true, true),
('owner', 'members', true, true, true, true, true),

-- STATION: operational access + tasks/templates creation
('station', 'tasks', true, true, true, false, false),
('station', 'stock', true, false, false, false, false),
('station', 'cakes', true, true, false, false, false),
('station', 'menu', true, false, true, false, false),
('station', 'haccp', true, true, false, false, false),
('station', 'incidents', true, true, false, false, false),
('station', 'orders', true, false, false, false, false),
('station', 'planning', true, false, false, false, false),
('station', 'chat', true, true, false, false, false),
('station', 'pointage', true, true, true, false, false),
('station', 'scores', true, false, false, false, false),
('station', 'objectives', true, false, false, false, false),
('station', 'reports', false, false, false, false, false),
('station', 'members', false, false, false, false, false),

-- MANAGER: broad operational access
('manager', 'tasks', true, true, true, false, false),
('manager', 'stock', true, true, true, false, false),
('manager', 'cakes', true, true, true, false, false),
('manager', 'menu', true, true, true, true, false),
('manager', 'haccp', true, true, true, false, false),
('manager', 'incidents', true, true, true, false, false),
('manager', 'orders', true, true, true, false, false),
('manager', 'planning', true, true, true, false, false),
('manager', 'chat', true, true, true, true, false),
('manager', 'pointage', true, true, true, false, false),
('manager', 'scores', true, true, true, false, false),
('manager', 'objectives', true, true, true, false, false),
('manager', 'reports', true, true, false, false, false),
('manager', 'members', true, false, true, false, false),

-- CHEF: kitchen-focused
('chef', 'tasks', true, true, true, false, false),
('chef', 'stock', true, true, true, false, false),
('chef', 'cakes', true, true, false, false, false),
('chef', 'menu', true, true, true, false, false),
('chef', 'haccp', true, true, false, false, false),
('chef', 'incidents', true, true, false, false, false),
('chef', 'orders', true, true, true, false, false),
('chef', 'planning', true, false, false, false, false),
('chef', 'chat', true, true, false, false, false),
('chef', 'pointage', true, true, true, false, false),
('chef', 'scores', true, false, false, false, false),
('chef', 'objectives', true, false, false, false, false),
('chef', 'reports', false, false, false, false, false),
('chef', 'members', false, false, false, false, false),

-- STAFF: basic access
('staff', 'tasks', true, false, true, false, false),
('staff', 'stock', true, false, false, false, false),
('staff', 'cakes', true, true, false, false, false),
('staff', 'menu', true, false, false, false, false),
('staff', 'haccp', true, true, false, false, false),
('staff', 'incidents', true, true, false, false, false),
('staff', 'orders', false, false, false, false, false),
('staff', 'planning', true, false, false, false, false),
('staff', 'chat', true, true, false, false, false),
('staff', 'pointage', true, true, false, false, false),
('staff', 'scores', true, false, false, false, false),
('staff', 'objectives', true, false, false, false, false),
('staff', 'reports', false, false, false, false, false),
('staff', 'members', false, false, false, false, false),

-- SOUS_CHEF: similar to staff but slightly more
('sous_chef', 'tasks', true, true, true, false, false),
('sous_chef', 'stock', true, true, false, false, false),
('sous_chef', 'cakes', true, true, false, false, false),
('sous_chef', 'menu', true, false, false, false, false),
('sous_chef', 'haccp', true, true, false, false, false),
('sous_chef', 'incidents', true, true, false, false, false),
('sous_chef', 'orders', true, false, false, false, false),
('sous_chef', 'planning', true, false, false, false, false),
('sous_chef', 'chat', true, true, false, false, false),
('sous_chef', 'pointage', true, true, false, false, false),
('sous_chef', 'scores', true, false, false, false, false),
('sous_chef', 'objectives', true, false, false, false, false),
('sous_chef', 'reports', false, false, false, false, false),
('sous_chef', 'members', false, false, false, false, false);

-- Enhanced AdaKDS Station Management with Role-Based Access
-- Run this in Supabase SQL Editor

-- Create user roles enum if not exists
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'owner', 'staff');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create station types enum
DO $$ BEGIN
    CREATE TYPE station_type AS ENUM ('hot_kitchen', 'cold_prep', 'grill', 'bar', 'pizza', 'pasta', 'salad', 'dessert', 'drinks', 'expo');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enhanced stations table with audit fields and soft delete
CREATE TABLE IF NOT EXISTS kds_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(100) NOT NULL,
  type station_type DEFAULT 'hot_kitchen',
  location VARCHAR(200),
  capacity INTEGER DEFAULT 5,
  active_status BOOLEAN DEFAULT true,
  description TEXT,
  color VARCHAR(7) DEFAULT '#3B82F6',
  display_order INTEGER DEFAULT 0,
  categories TEXT[] DEFAULT '{}',
  
  -- Audit fields
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE NULL, -- Soft delete
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT uq_station_code_per_restaurant UNIQUE (restaurant_id, code),
  CONSTRAINT uq_station_name_per_restaurant UNIQUE (restaurant_id, name)
);

-- User profiles table for role management
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(200),
  role user_role NOT NULL DEFAULT 'staff',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT uq_user_email_per_restaurant UNIQUE (restaurant_id, email)
);

-- Enhanced orders table with role-based assignment
CREATE TABLE IF NOT EXISTS kds_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) NOT NULL UNIQUE,
  restaurant_id UUID NOT NULL,
  station_id UUID REFERENCES kds_stations(id),
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  priority VARCHAR(20) DEFAULT 'normal',
  customer_name VARCHAR(200) NOT NULL,
  customer_type VARCHAR(20) DEFAULT 'dine_in',
  customer_phone VARCHAR(50),
  customer_email VARCHAR(200),
  table_number VARCHAR(20),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  special_instructions TEXT,
  total_price DECIMAL(10,2) DEFAULT 0,
  estimated_prep_time INTEGER DEFAULT 10,
  
  -- Assignment tracking
  assigned_to UUID REFERENCES user_profiles(id),
  assigned_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  estimated_ready_time TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Audit
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stations_restaurant_active ON kds_stations(restaurant_id, active_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stations_display_order ON kds_stations(restaurant_id, display_order) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status ON kds_orders(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_station_status ON kds_orders(station_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_assigned ON kds_orders(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_restaurant_role ON user_profiles(restaurant_id, role, is_active);

-- Enable Row Level Security
ALTER TABLE kds_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kds_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for kds_stations
DROP POLICY IF EXISTS "Stations: Admin and Owner full access" ON kds_stations;
CREATE POLICY "Stations: Admin and Owner full access" ON kds_stations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.restaurant_id = kds_stations.restaurant_id
      AND user_profiles.role IN ('admin', 'owner')
      AND user_profiles.is_active = true
    )
  );

DROP POLICY IF EXISTS "Stations: Staff read-only" ON kds_stations;
CREATE POLICY "Stations: Staff read-only" ON kds_stations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.restaurant_id = kds_stations.restaurant_id
      AND user_profiles.role = 'staff'
      AND user_profiles.is_active = true
    )
  );

-- RLS Policies for kds_orders
DROP POLICY IF EXISTS "Orders: All roles can read" ON kds_orders;
CREATE POLICY "Orders: All roles can read" ON kds_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.restaurant_id = kds_orders.restaurant_id
      AND user_profiles.is_active = true
    )
  );

DROP POLICY IF EXISTS "Orders: Admin and Owner can create" ON kds_orders;
CREATE POLICY "Orders: Admin and Owner can create" ON kds_orders
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.restaurant_id = kds_orders.restaurant_id
      AND user_profiles.role IN ('admin', 'owner')
      AND user_profiles.is_active = true
    )
  );

DROP POLICY IF EXISTS "Orders: All roles can update status" ON kds_orders;
CREATE POLICY "Orders: All roles can update status" ON kds_orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.restaurant_id = kds_orders.restaurant_id
      AND user_profiles.is_active = true
    )
  );

-- RLS Policies for user_profiles
DROP POLICY IF EXISTS "User profiles: Users can read own profile" ON user_profiles;
CREATE POLICY "User profiles: Users can read own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "User profiles: Admin can read all in restaurant" ON user_profiles;
CREATE POLICY "User profiles: Admin can read all in restaurant" ON user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.restaurant_id = user_profiles.restaurant_id
      AND admin_profile.role = 'admin'
      AND admin_profile.is_active = true
    )
  );

-- Functions for soft delete and audit trails
CREATE OR REPLACE FUNCTION soft_delete_station(station_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role_check user_role;
BEGIN
    -- Check user role
    SELECT role INTO user_role_check
    FROM user_profiles
    WHERE id = user_id AND is_active = true;
    
    -- Only admin and owner can soft delete
    IF user_role_check NOT IN ('admin', 'owner') THEN
        RETURN FALSE;
    END IF;
    
    -- Perform soft delete
    UPDATE kds_stations
    SET deleted_at = NOW(), updated_by = user_id, updated_at = NOW()
    WHERE id = station_id AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION hard_delete_station(station_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role_check user_role;
BEGIN
    -- Check user role - only admin can hard delete
    SELECT role INTO user_role_check
    FROM user_profiles
    WHERE id = user_id AND is_active = true;
    
    IF user_role_check != 'admin' THEN
        RETURN FALSE;
    END IF;
    
    -- Perform hard delete
    DELETE FROM kds_stations WHERE id = station_id;
    
    RETURN FOUND;
END;
$$;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_stations_updated_at ON kds_stations;
CREATE TRIGGER update_stations_updated_at
    BEFORE UPDATE ON kds_stations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON kds_orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON kds_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sample data for testing
INSERT INTO user_profiles (id, restaurant_id, email, full_name, role)
VALUES 
    ('550e8400-e29b-41d4-a716-446655440000', 'c1cbea71-ece5-4d63-bb12-fe06b03d1140', 'admin@losteria.com', 'Admin User', 'admin'),
    ('550e8400-e29b-41d4-a716-446655440001', 'c1cbea71-ece5-4d63-bb12-fe06b03d1140', 'owner@losteria.com', 'Owner User', 'owner'),
    ('550e8400-e29b-41d4-a716-446655440002', 'c1cbea71-ece5-4d63-bb12-fe06b03d1140', 'staff@losteria.com', 'Staff User', 'staff')
ON CONFLICT (restaurant_id, email) DO NOTHING;

-- Update existing kds_stations if they exist
UPDATE kds_stations 
SET 
  restaurant_id = 'c1cbea71-ece5-4d63-bb12-fe06b03d1140'::UUID,
  type = 'hot_kitchen',
  capacity = 5,
  active_status = true,
  created_by = '550e8400-e29b-41d4-a716-446655440000'::UUID
WHERE restaurant_id::text = 'c1cbea71-ece5-4d63-bb12-fe06b03d1140';

-- Insert sample stations if none exist
INSERT INTO kds_stations (restaurant_id, name, code, type, location, capacity, color, display_order, categories, created_by)
VALUES 
    ('c1cbea71-ece5-4d63-bb12-fe06b03d1140', 'Hot Kitchen', 'hot_kitchen', 'hot_kitchen', 'Main Kitchen', 8, '#EF4444', 1, ARRAY['pizza', 'pasta', 'meat', 'hot_food'], '550e8400-e29b-41d4-a716-446655440000'),
    ('c1cbea71-ece5-4d63-bb12-fe06b03d1140', 'Cold Prep', 'cold_prep', 'cold_prep', 'Prep Area', 4, '#10B981', 2, ARRAY['salad', 'dessert', 'cold_appetizers'], '550e8400-e29b-41d4-a716-446655440000'),
    ('c1cbea71-ece5-4d63-bb12-fe06b03d1140', 'Grill Station', 'grill', 'grill', 'Grill Area', 6, '#F59E0B', 3, ARRAY['grilled_meat', 'grilled_fish', 'bbq'], '550e8400-e29b-41d4-a716-446655440000'),
    ('c1cbea71-ece5-4d63-bb12-fe06b03d1140', 'Bar', 'bar', 'bar', 'Bar Counter', 3, '#8B5CF6', 4, ARRAY['drinks', 'cocktails', 'wine', 'coffee'], '550e8400-e29b-41d4-a716-446655440000')
ON CONFLICT (restaurant_id, code) DO NOTHING;

COMMIT;
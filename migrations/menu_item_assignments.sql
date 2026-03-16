-- Menu Item Assignments Table
-- This table stores the assignments of menu items to kitchen stations

CREATE TABLE IF NOT EXISTS menu_item_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    station_id UUID NOT NULL,
    menu_item_id VARCHAR(255) NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(restaurant_id, station_id, menu_item_id),
    
    -- Foreign key to stations (if kds_stations table exists)
    FOREIGN KEY (station_id) REFERENCES kds_stations(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_menu_item_assignments_restaurant_station 
    ON menu_item_assignments(restaurant_id, station_id);

CREATE INDEX IF NOT EXISTS idx_menu_item_assignments_menu_item 
    ON menu_item_assignments(menu_item_id);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_menu_item_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_menu_item_assignments_updated_at
    BEFORE UPDATE ON menu_item_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_menu_item_assignments_updated_at();

-- Enable Row Level Security
ALTER TABLE menu_item_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access assignments for their restaurant
CREATE POLICY menu_item_assignments_restaurant_policy ON menu_item_assignments
    FOR ALL USING (
        restaurant_id IN (
            SELECT restaurant_id 
            FROM restaurant_users 
            WHERE user_id = auth.uid()
        )
    );

-- Insert some demo data for testing
INSERT INTO menu_item_assignments (restaurant_id, station_id, menu_item_id, assigned_by) VALUES
    (
        'c1cbea71-ece5-4d63-bb12-fe06b03d1140',
        (SELECT id FROM kds_stations WHERE code = 'HOT' AND restaurant_id = 'c1cbea71-ece5-4d63-bb12-fe06b03d1140' LIMIT 1),
        'item_pizza_margherita',
        'system'
    ),
    (
        'c1cbea71-ece5-4d63-bb12-fe06b03d1140',
        (SELECT id FROM kds_stations WHERE code = 'HOT' AND restaurant_id = 'c1cbea71-ece5-4d63-bb12-fe06b03d1140' LIMIT 1),
        'item_pasta_carbonara',
        'system'
    ),
    (
        'c1cbea71-ece5-4d63-bb12-fe06b03d1140',
        (SELECT id FROM kds_stations WHERE code = 'COLD' AND restaurant_id = 'c1cbea71-ece5-4d63-bb12-fe06b03d1140' LIMIT 1),
        'item_tiramisu',
        'system'
    ),
    (
        'c1cbea71-ece5-4d63-bb12-fe06b03d1140',
        (SELECT id FROM kds_stations WHERE code = 'BAR' AND restaurant_id = 'c1cbea71-ece5-4d63-bb12-fe06b03d1140' LIMIT 1),
        'item_aperol_spritz',
        'system'
    )
ON CONFLICT (restaurant_id, station_id, menu_item_id) DO NOTHING;
ALTER TABLE comments
ADD COLUMN parent_id uuid REFERENCES comments(id) ON DELETE CASCADE;
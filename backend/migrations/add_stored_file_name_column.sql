-- Migration: Add stored_file_name column to customer_documents table
-- This column stores the unique filename used for S3 or local storage

-- Add column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'customer_documents' 
        AND column_name = 'stored_file_name'
    ) THEN
        ALTER TABLE customer_documents 
        ADD COLUMN stored_file_name VARCHAR(255);
        
        -- Populate stored_file_name from file_path for existing records
        UPDATE customer_documents 
        SET stored_file_name = SUBSTRING(file_path FROM '[^/\\]+$')
        WHERE stored_file_name IS NULL;
        
        RAISE NOTICE 'Column stored_file_name added successfully';
    ELSE
        RAISE NOTICE 'Column stored_file_name already exists';
    END IF;
END $$;


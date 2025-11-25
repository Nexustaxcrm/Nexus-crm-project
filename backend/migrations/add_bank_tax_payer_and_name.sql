-- Migration: Add bank_tax_payer and bank_name columns to customer_tax_info table

DO $$
BEGIN
    -- Add bank_tax_payer column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customer_tax_info' AND column_name = 'bank_tax_payer'
    ) THEN
        ALTER TABLE customer_tax_info ADD COLUMN bank_tax_payer VARCHAR(50);
        RAISE NOTICE 'Column bank_tax_payer added to customer_tax_info table.';
    ELSE
        RAISE NOTICE 'Column bank_tax_payer already exists in customer_tax_info table.';
    END IF;

    -- Add bank_name column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customer_tax_info' AND column_name = 'bank_name'
    ) THEN
        ALTER TABLE customer_tax_info ADD COLUMN bank_name VARCHAR(255);
        RAISE NOTICE 'Column bank_name added to customer_tax_info table.';
    ELSE
        RAISE NOTICE 'Column bank_name already exists in customer_tax_info table.';
    END IF;
END $$;


-- Migration: Add customer_tax_info table for comprehensive tax filing information
-- This table stores all tax-related information needed for IRS tax filing

CREATE TABLE IF NOT EXISTS customer_tax_info (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tax_year VARCHAR(4) NOT NULL DEFAULT '2024',
    
    -- Personal Information
    ssn_itin VARCHAR(20),
    date_of_birth DATE,
    filing_status VARCHAR(50), -- 'single', 'married_jointly', 'married_separately', 'head_of_household', 'qualifying_widow'
    
    -- Spouse Information
    spouse_name VARCHAR(255),
    spouse_ssn_itin VARCHAR(20),
    spouse_date_of_birth DATE,
    
    -- Bank Information (for direct deposit)
    bank_account_number VARCHAR(50),
    bank_routing_number VARCHAR(20),
    bank_account_type VARCHAR(20), -- 'checking', 'savings'
    
    -- Income Information (stored as JSON for flexibility)
    w2_income JSONB, -- Array of W-2 forms
    income_1099 JSONB, -- Array of 1099 forms (NEC, MISC, INT, DIV, B, R, etc.)
    self_employment_income JSONB, -- Self-employment income details
    rental_income DECIMAL(12, 2),
    unemployment_compensation DECIMAL(12, 2),
    social_security_benefits DECIMAL(12, 2),
    other_income DECIMAL(12, 2),
    other_income_description TEXT,
    
    -- Deductions (stored as JSON for flexibility)
    itemized_deductions JSONB, -- Medical, SALT, mortgage interest, charitable, etc.
    standard_deduction BOOLEAN DEFAULT TRUE,
    
    -- Tax Credits (stored as JSON for flexibility)
    tax_credits JSONB, -- EITC, Child Tax Credit, Education Credits, etc.
    
    -- Dependents (stored as JSON array)
    dependents JSONB, -- Array of dependent information
    
    -- Prior Year Information
    prior_year_agi DECIMAL(12, 2),
    prior_year_tax_return_available BOOLEAN DEFAULT FALSE,
    
    -- Additional Information
    health_insurance_coverage VARCHAR(50), -- '1095-A', '1095-B', '1095-C', 'none'
    estimated_tax_payments DECIMAL(12, 2),
    foreign_accounts BOOLEAN DEFAULT FALSE,
    foreign_account_details TEXT,
    business_expenses JSONB, -- For self-employed
    home_office_deduction BOOLEAN DEFAULT FALSE,
    home_office_details TEXT,
    
    -- Filing Checklist (stored as JSON)
    filing_checklist JSONB, -- Track completion of required documents/information
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one tax info record per customer per tax year
    UNIQUE(customer_id, tax_year)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_tax_info_customer_id ON customer_tax_info(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_tax_info_tax_year ON customer_tax_info(tax_year);
CREATE INDEX IF NOT EXISTS idx_customer_tax_info_customer_year ON customer_tax_info(customer_id, tax_year);

-- Analyze table
ANALYZE customer_tax_info;


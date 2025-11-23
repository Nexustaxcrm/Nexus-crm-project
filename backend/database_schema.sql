-- Database Schema for Nexus CRM
-- Run this script to initialize your database tables

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'employee',
    locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create customer_actions table for audit trail (tracks all comments and status changes)
CREATE TABLE IF NOT EXISTS customer_actions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL, -- 'comment', 'status_change', 'assignment', 'update'
    old_value TEXT,
    new_value TEXT,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance (from database_indexes.sql)
CREATE INDEX IF NOT EXISTS idx_customers_assigned_to ON customers(assigned_to);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_archived ON customers(archived);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_status_archived ON customers(status, archived);
-- Composite index for assigned work queries (assigned_to + status + archived)
CREATE INDEX IF NOT EXISTS idx_customers_assigned_status ON customers(assigned_to, status, archived) WHERE assigned_to IS NOT NULL;
-- Index for customer user_id (for customer dashboard lookups)
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id) WHERE user_id IS NOT NULL;

-- Indexes for customer_actions table (for fast lookups)
CREATE INDEX IF NOT EXISTS idx_customer_actions_customer_id ON customer_actions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_actions_user_id ON customer_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_actions_created_at ON customer_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_actions_customer_created ON customer_actions(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_locked ON users(locked);

-- Analyze tables to update statistics
ANALYZE customers;
ANALYZE users;


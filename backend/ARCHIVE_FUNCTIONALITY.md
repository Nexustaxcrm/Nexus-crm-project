# Archive Functionality Documentation

## Overview
The system now properly handles archiving and restoring customers, ensuring archived customers are excluded from the "Assign Work" tab and only appear when explicitly requested.

## ✅ Implementation Details

### 1. Database Query Filtering
- **Default behavior**: All customer queries exclude archived customers by default
- **Archive filter**: Use `?archived_only=true` to get only archived customers
- **Include all**: Use `?include_archived=true` to get both archived and non-archived
- **Assign Work queries**: Automatically exclude archived customers

### 2. Bulk Upload Protection
- **All bulk uploads** (Excel, CSV, JSON) set `archived = FALSE` by default
- **New customers** are never archived during upload
- **Archived customers** can only be created via archive operation

### 3. Archive/Restore Operations
- **Archive**: Sets `archived = TRUE`, clears `assigned_to` (archived customers shouldn't be assigned)
- **Restore**: Sets `archived = FALSE`, restores customer to active status
- **Audit trail**: All archive/restore operations are tracked in `customer_actions` table

## 📊 API Endpoints

### Get Customers (with archive filtering)
```
GET /api/customers
GET /api/customers?assigned_to=123          # Excludes archived by default
GET /api/customers?archived_only=true       # Only archived customers
GET /api/customers?include_archived=true    # All customers (archived + non-archived)
```

### Update Customer (archive/restore)
```
PUT /api/customers/:id
Body: {
  "archived": true,   // Archive customer
  "archived": false   // Restore customer
}
```

## 🔄 Workflow

### Archiving 300k-500k Customers
1. Admin selects customers to archive
2. System sets `archived = TRUE` for selected customers
3. System clears `assigned_to` (archived customers are unassigned)
4. Customers disappear from "Assign Work" tab immediately
5. Customers appear only in Archive folder

### Uploading New Batch (500k customers)
1. Admin uploads Excel file with 500k customers
2. System sets `archived = FALSE` for all new customers
3. Only new customers appear in "Assign Work" tab
4. Archived customers remain in Archive folder (not visible in Assign Work)

### Restoring from Archive
1. Admin opens Archive folder
2. Admin selects customers to restore
3. System sets `archived = FALSE` for selected customers
4. Restored customers appear in "Assign Work" tab
5. Customers can be assigned to employees again

## ⚠️ Important Notes

### Query Behavior
- **Assign Work tab**: Always excludes archived customers (default behavior)
- **Archive folder**: Uses `?archived_only=true` to show only archived customers
- **Search/Filter**: By default excludes archived unless `include_archived=true`

### Bulk Operations
- **Bulk archive**: Can archive thousands of customers at once
- **Bulk restore**: Can restore thousands of customers at once
- **Bulk upload**: Never creates archived customers

### Performance
- **Indexed queries**: `archived` field is indexed for fast filtering
- **Composite index**: `(assigned_to, status, archived)` optimizes Assign Work queries
- **Efficient filtering**: Database-level filtering (not client-side)

## 🧪 Testing Scenarios

1. **Archive 300k customers** → Should disappear from Assign Work
2. **Upload 500k new customers** → Only new customers in Assign Work
3. **Restore 100k customers** → Should appear in Assign Work
4. **Query assigned work** → Should exclude all archived customers
5. **Query archive** → Should show only archived customers

## ✅ Production Checklist

- [x] GET endpoint excludes archived by default
- [x] Archive filter parameters implemented
- [x] Bulk uploads set archived=false
- [x] Update endpoint handles archive/restore
- [x] Archive operations clear assignment
- [x] Audit trail for archive/restore
- [x] Database indexes optimized
- [ ] Frontend updated to use archive API endpoints
- [ ] Bulk archive/restore endpoints (if needed)

The system now properly handles archiving and ensures archived customers are excluded from Assign Work!


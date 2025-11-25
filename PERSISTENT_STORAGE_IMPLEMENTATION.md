# Persistent File Storage Implementation

## Overview

The CRM now supports **AWS S3** for persistent file storage, ensuring that all uploaded documents survive server redeployments, restarts, and reconstructions.

## What Was Implemented

### 1. **AWS S3 Storage Integration**
   - Created `backend/utils/s3Storage.js` - S3 utility functions
   - Automatic detection: Uses S3 if configured, falls back to local storage
   - Backward compatible: Existing local files continue to work

### 2. **Updated File Upload**
   - Files are uploaded to S3 (if configured) or stored locally
   - Unique filenames generated for all uploads
   - Database stores S3 key or local file path

### 3. **Updated File Download**
   - Automatically detects S3 vs local storage
   - Downloads from S3 or serves from local filesystem
   - Seamless experience for users

### 4. **Updated File Deletion**
   - Deletes from S3 or local filesystem based on storage type
   - Handles errors gracefully

### 5. **Database Schema Update**
   - Added `stored_file_name` column to `customer_documents` table
   - Migration automatically runs on server startup

## Quick Start

### Option 1: Use AWS S3 (Recommended)

1. **Follow the setup guide**: See `backend/S3_SETUP_GUIDE.md`
2. **Add environment variables**:
   ```bash
   AWS_ACCESS_KEY_ID=your_key
   AWS_SECRET_ACCESS_KEY=your_secret
   AWS_REGION=us-east-1
   AWS_S3_BUCKET_NAME=your-bucket-name
   AWS_S3_PREFIX=customer-documents
   ```
3. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```
4. **Restart server** - Files will now be stored in S3!

### Option 2: Continue with Local Storage

- No changes needed - system works as before
- **Warning**: Local files may be lost during redeployments
- Consider using persistent volumes if on Railway/Render

## Features

✅ **Automatic Detection**: System automatically uses S3 if configured  
✅ **Backward Compatible**: Existing local files continue to work  
✅ **Seamless Migration**: No data loss during transition  
✅ **Error Handling**: Graceful fallback if S3 upload fails  
✅ **Cost Effective**: Pay only for storage used (~$0.26/month for 1,000 customers)  

## File Storage Flow

### Upload:
1. User uploads file → Stored in memory
2. If S3 configured → Upload to S3 → Store S3 key in database
3. If S3 not configured → Save to local disk → Store file path in database

### Download:
1. System checks file path format
2. If S3 key → Download from S3 → Stream to user
3. If local path → Serve from filesystem

### Delete:
1. System checks file path format
2. If S3 key → Delete from S3
3. If local path → Delete from filesystem
4. Remove database record

## Database Changes

### New Column:
- `stored_file_name` - Stores unique filename for S3 or local storage

### Migration:
- Automatically runs on server startup
- Adds column if missing
- Populates existing records

## Testing

1. **Test Upload**:
   - Upload a document through CRM
   - Check S3 bucket (if configured) or local `uploads/` folder
   - Verify file appears in customer dashboard

2. **Test Download**:
   - Click "View" or "Download" on uploaded document
   - Verify file opens correctly

3. **Test Persistence**:
   - Redeploy server
   - Verify documents still accessible

## Troubleshooting

### Files not uploading to S3:
- Check environment variables are set
- Verify AWS credentials are correct
- Check IAM permissions
- Review server logs for errors

### Files not downloading:
- Check if file path is S3 key format
- Verify S3 credentials
- Check IAM permissions include `s3:GetObject`

### Migration issues:
- Check server logs for migration errors
- Verify database connection
- Manually run migration SQL if needed

## Cost Estimation

For 1,000 customers with 5 documents each (avg 2MB):
- **Storage**: 10 GB × $0.023 = $0.23/month
- **Uploads**: 5,000 PUT × $0.005/1000 = $0.025
- **Downloads**: 10,000 GET × $0.0004/1000 = $0.004
- **Total**: ~$0.26/month

## Next Steps

1. **Set up AWS S3** (see `backend/S3_SETUP_GUIDE.md`)
2. **Add environment variables** to your deployment platform
3. **Test upload/download** functionality
4. **Monitor costs** in AWS Console

## Support

For detailed setup instructions, see:
- `backend/S3_SETUP_GUIDE.md` - Complete AWS S3 setup guide

For issues:
- Check server logs for detailed error messages
- Verify all environment variables are set
- Test S3 access using AWS CLI

---

**Note**: Without S3 configured, files are stored locally and may be lost during redeployments. S3 is strongly recommended for production use.


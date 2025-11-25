# AWS S3 Setup Guide for Persistent File Storage

This guide will help you set up AWS S3 for persistent file storage, ensuring that all uploaded documents survive server redeployments and reconstructions.

## Why S3?

- **Persistence**: Files stored in S3 survive server redeployments, restarts, and reconstructions
- **Scalability**: Handle unlimited file storage
- **Reliability**: 99.999999999% (11 9's) durability
- **Cost-effective**: Pay only for what you use
- **Backup**: Automatic redundancy across multiple availability zones

## Prerequisites

1. AWS Account (create one at https://aws.amazon.com/)
2. AWS S3 Bucket
3. AWS IAM User with S3 permissions

## Step 1: Create an S3 Bucket

1. Log in to AWS Console
2. Navigate to **S3** service
3. Click **"Create bucket"**
4. Configure:
   - **Bucket name**: `nexus-tax-filing-documents` (must be globally unique)
   - **Region**: Choose closest to your server (e.g., `us-east-1`)
   - **Block Public Access**: Keep enabled for security (files will be accessed via signed URLs)
   - **Versioning**: Optional but recommended
   - **Encryption**: Enable server-side encryption (recommended)
5. Click **"Create bucket"**

## Step 2: Create IAM User with S3 Permissions

1. Navigate to **IAM** service in AWS Console
2. Click **"Users"** → **"Create user"**
3. Enter username: `nexus-s3-user`
4. Select **"Programmatic access"** (Access key ID and secret access key)
5. Click **"Next: Permissions"**
6. Click **"Attach policies directly"**
7. Search and select: **"AmazonS3FullAccess"** (or create a custom policy with only necessary permissions)
8. Click **"Next"** → **"Create user"**
9. **IMPORTANT**: Copy and save:
   - **Access Key ID**
   - **Secret Access Key** (shown only once!)

## Step 3: Configure Environment Variables

Add these environment variables to your deployment platform (Railway, Render, Heroku, etc.):

```bash
AWS_ACCESS_KEY_ID=your_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=nexus-tax-filing-documents
AWS_S3_PREFIX=customer-documents  # Optional: folder prefix in S3
```

### For Railway:
1. Go to your project → **Variables** tab
2. Click **"New Variable"**
3. Add each variable above

### For Render:
1. Go to your service → **Environment** tab
2. Add each variable

### For Local Development:
Add to your `.env` file in the `backend` directory:
```env
AWS_ACCESS_KEY_ID=your_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=nexus-tax-filing-documents
AWS_S3_PREFIX=customer-documents
```

## Step 4: Install Dependencies

The required packages are already in `package.json`. Just run:

```bash
cd backend
npm install
```

This will install:
- `aws-sdk` - AWS SDK for Node.js
- `multer-s3` - Multer storage engine for S3 (optional, we use memory storage)

## Step 5: Verify Setup

1. Restart your server
2. Check server logs for:
   - `✅ S3 storage configured` (if S3 is properly configured)
   - `⚠️ S3 not configured, using local storage` (if S3 is not configured)

3. Upload a test document through the CRM
4. Check your S3 bucket - you should see the file in the `customer-documents/` folder

## How It Works

### Upload Flow:
1. User uploads file → Stored in memory
2. File uploaded to S3 → S3 key stored in database
3. File path format: `customer-documents/1234567890-filename.pdf`

### Download Flow:
1. System checks if file path is S3 key
2. If S3: Downloads from S3 and streams to user
3. If local: Serves from local filesystem (backward compatibility)

### Backward Compatibility:
- Existing local files continue to work
- New uploads go to S3 (if configured)
- System automatically detects storage type

## Security Best Practices

1. **Never commit AWS credentials to Git**
   - Always use environment variables
   - Add `.env` to `.gitignore`

2. **Use IAM Policy with Least Privilege**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject"
         ],
         "Resource": "arn:aws:s3:::nexus-tax-filing-documents/customer-documents/*"
       }
     ]
   }
   ```

3. **Enable S3 Bucket Encryption**:
   - Go to bucket → **Properties** → **Default encryption**
   - Enable **SSE-S3** or **SSE-KMS**

4. **Enable S3 Versioning** (optional but recommended):
   - Go to bucket → **Properties** → **Versioning**
   - Enable versioning for file recovery

## Cost Estimation

AWS S3 pricing (as of 2024):
- **Storage**: ~$0.023 per GB/month (Standard storage)
- **Requests**: 
  - PUT requests: $0.005 per 1,000 requests
  - GET requests: $0.0004 per 1,000 requests
- **Data Transfer**: First 100 GB/month free, then $0.09/GB

**Example**: 1,000 customers, 5 documents each (avg 2MB):
- Storage: 10 GB × $0.023 = **$0.23/month**
- Uploads: 5,000 PUT × $0.005/1000 = **$0.025**
- Downloads: 10,000 GET × $0.0004/1000 = **$0.004**
- **Total: ~$0.26/month** (very affordable!)

## Troubleshooting

### Files not uploading to S3:
1. Check environment variables are set correctly
2. Verify IAM user has S3 permissions
3. Check bucket name is correct
4. Verify region matches bucket region
5. Check server logs for error messages

### Files not downloading:
1. Check if file path in database is S3 key format
2. Verify S3 credentials are valid
3. Check IAM permissions include `s3:GetObject`

### Migration from Local to S3:
Existing local files will continue to work. To migrate:
1. Files are automatically uploaded to S3 when users re-upload
2. Or create a migration script to upload existing files to S3

## Alternative Options

If you prefer not to use AWS S3, consider:

1. **Google Cloud Storage** - Similar to S3
2. **Azure Blob Storage** - Microsoft's equivalent
3. **Cloudinary** - Image/document hosting service
4. **DigitalOcean Spaces** - S3-compatible storage
5. **Persistent Volumes** (Railway/Render) - Mounted storage that persists

## Support

If you encounter issues:
1. Check server logs for detailed error messages
2. Verify all environment variables are set
3. Test S3 access using AWS CLI:
   ```bash
   aws s3 ls s3://nexus-tax-filing-documents/customer-documents/
   ```

---

**Note**: Without S3 configured, files will be stored locally and may be lost during redeployments. S3 is strongly recommended for production use.


/**
 * AWS S3 Storage Utility
 * Provides persistent file storage that survives server redeployments
 */

const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configure AWS S3
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1'
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;
const S3_PREFIX = process.env.AWS_S3_PREFIX || 'customer-documents'; // Optional folder prefix

// Check if S3 is configured
const isS3Configured = () => {
    return !!(process.env.AWS_ACCESS_KEY_ID && 
             process.env.AWS_SECRET_ACCESS_KEY && 
             BUCKET_NAME);
};

/**
 * Upload file to S3
 * @param {Buffer|Stream} fileBuffer - File buffer or stream
 * @param {string} fileName - Original file name
 * @param {string} storedFileName - Unique stored file name
 * @returns {Promise<string>} S3 key (path) of uploaded file
 */
async function uploadToS3(fileBuffer, fileName, storedFileName) {
    if (!isS3Configured()) {
        throw new Error('S3 is not configured. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME');
    }

    const key = `${S3_PREFIX}/${storedFileName}`;
    const contentType = getContentType(fileName);

    const params = {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        // Make files publicly readable (or use signed URLs for private access)
        // ACL: 'private', // Use 'public-read' if you want public access
        Metadata: {
            'original-name': fileName
        }
    };

    try {
        const result = await s3.upload(params).promise();
        console.log(`✅ File uploaded to S3: ${result.Location}`);
        return key; // Return S3 key for storage in database
    } catch (error) {
        console.error('❌ Error uploading to S3:', error);
        throw error;
    }
}

/**
 * Download file from S3
 * @param {string} s3Key - S3 key (path) of the file
 * @returns {Promise<Buffer>} File buffer
 */
async function downloadFromS3(s3Key) {
    if (!isS3Configured()) {
        throw new Error('S3 is not configured');
    }

    const params = {
        Bucket: BUCKET_NAME,
        Key: s3Key
    };

    try {
        const result = await s3.getObject(params).promise();
        return result.Body;
    } catch (error) {
        if (error.code === 'NoSuchKey') {
            throw new Error('File not found in S3');
        }
        console.error('❌ Error downloading from S3:', error);
        throw error;
    }
}

/**
 * Get signed URL for temporary file access (for private files)
 * @param {string} s3Key - S3 key (path) of the file
 * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} Signed URL
 */
async function getSignedUrl(s3Key, expiresIn = 3600) {
    if (!isS3Configured()) {
        throw new Error('S3 is not configured');
    }

    const params = {
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Expires: expiresIn
    };

    try {
        return await s3.getSignedUrlPromise('getObject', params);
    } catch (error) {
        console.error('❌ Error generating signed URL:', error);
        throw error;
    }
}

/**
 * Delete file from S3
 * @param {string} s3Key - S3 key (path) of the file
 * @returns {Promise<void>}
 */
async function deleteFromS3(s3Key) {
    if (!isS3Configured()) {
        throw new Error('S3 is not configured');
    }

    const params = {
        Bucket: BUCKET_NAME,
        Key: s3Key
    };

    try {
        await s3.deleteObject(params).promise();
        console.log(`✅ File deleted from S3: ${s3Key}`);
    } catch (error) {
        console.error('❌ Error deleting from S3:', error);
        throw error;
    }
}

/**
 * Check if file exists in S3
 * @param {string} s3Key - S3 key (path) of the file
 * @returns {Promise<boolean>}
 */
async function fileExistsInS3(s3Key) {
    if (!isS3Configured()) {
        return false;
    }

    const params = {
        Bucket: BUCKET_NAME,
        Key: s3Key
    };

    try {
        await s3.headObject(params).promise();
        return true;
    } catch (error) {
        if (error.code === 'NotFound') {
            return false;
        }
        throw error;
    }
}

/**
 * Get content type based on file extension
 */
function getContentType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const contentTypes = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    return contentTypes[ext] || 'application/octet-stream';
}

/**
 * Check if a file path is an S3 key (starts with prefix)
 */
function isS3Key(filePath) {
    return typeof filePath === 'string' && 
           (filePath.startsWith(S3_PREFIX + '/') || 
            filePath.startsWith('s3://') ||
            !path.isAbsolute(filePath) && !filePath.includes(path.sep));
}

module.exports = {
    isS3Configured,
    uploadToS3,
    downloadFromS3,
    getSignedUrl,
    deleteFromS3,
    fileExistsInS3,
    isS3Key,
    getContentType
};


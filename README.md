# Nexus Tax Filing - CRM System

A comprehensive Customer Relationship Management system for tax filing services, built with Node.js, Express, PostgreSQL, and modern web technologies.

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Security](#security)
- [Support](#support)

## 🎯 Project Overview

Nexus Tax Filing CRM is a full-stack application designed to manage customer relationships, tax filing information, documents, and communications for a tax filing service. The system includes:

- **Backend API**: RESTful API built with Express.js and PostgreSQL
- **CRM Frontend**: Single-page application for managing customers, users, and tax information
- **Public Website**: Marketing website with contact forms and blog functionality

## ✨ Features

- **Customer Management**: Create, update, and manage customer records
- **Tax Information Management**: Comprehensive tax filing data collection
- **Document Management**: Upload and manage customer documents (with S3 support)
- **User Authentication**: Secure JWT-based authentication with OTP support
- **Email Integration**: Automatic email processing with attachment handling
- **Referral Tracking**: Track customer referrals
- **Blog Management**: Content management for blog posts
- **Audit Trail**: Complete action history for all customer interactions
- **Bulk Operations**: Excel import/export for customer data
- **Role-Based Access**: Admin and employee user roles

## 📁 Project Structure

```
Nexus-crm-project/
├── backend/                 # Backend API server
│   ├── routes/              # API route handlers
│   ├── services/            # Business logic services
│   ├── utils/               # Utility functions
│   ├── migrations/          # Database migrations
│   ├── middleware/          # Express middleware
│   ├── database_schema.sql  # Database schema
│   ├── server.js           # Main server file
│   └── package.json        # Backend dependencies
├── CRM/                     # CRM frontend application
│   ├── index.html          # Main CRM interface
│   ├── crm.js              # CRM JavaScript logic
│   └── index_files/        # Static assets
├── Website/                 # Public website
│   ├── index.html          # Homepage
│   ├── about.html          # About page
│   ├── contact.html        # Contact page
│   ├── blog.html           # Blog listing
│   └── assets/             # CSS, JS, images
├── railway.toml            # Railway deployment config
├── package.json            # Root package.json
└── README.md              # This file
```

## 🔧 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **PostgreSQL** (local or cloud instance)
- **Git**

Optional (for full functionality):
- **AWS Account** (for S3 file storage)
- **Gmail Account** (for email features)

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Nexus-crm-project
```

### 2. Install Dependencies

```bash
cd backend
npm install
```

### 3. Set Up Database

Create a PostgreSQL database:

```sql
CREATE DATABASE nexus_crm;
```

The application will automatically create tables on first startup using the schema in `backend/database_schema.sql`.

### 4. Configure Environment Variables

Copy the example environment file and configure it:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your actual values. See [Configuration](#configuration) section for details.

## ⚙️ Configuration

### Required Environment Variables

Create a `.env` file in the `backend/` directory with the following variables:

#### Database Configuration
```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=nexus_crm
DB_PASSWORD=your_password_here
DB_PORT=5432
```

#### Authentication
```env
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your_jwt_secret_here
```

### Optional Environment Variables

#### Server Configuration
```env
PORT=3000
ADMIN_PASSWORD=admin123  # Default admin password (change after first login)
```

#### Email Configuration (for email features)
```env
EMAIL_USER=nexustaxfiling@gmail.com
EMAIL_PASSWORD=your_gmail_app_password
# Alternative variable names:
# GMAIL_USER=nexustaxfiling@gmail.com
# GMAIL_APP_PASSWORD=your_gmail_app_password
```

See `backend/EMAIL_SETUP.md` for instructions on creating a Gmail App Password.

#### AWS S3 Configuration (for persistent file storage)
```env
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your_bucket_name
AWS_S3_PREFIX=customer-documents
```

See `backend/S3_SETUP_GUIDE.md` for detailed S3 setup instructions.

### Generate JWT Secret

To generate a secure JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🏃 Running the Application

### Development Mode

1. **Start the backend server:**

```bash
cd backend
node server.js
```

Or from the root directory:

```bash
npm start
```

2. **Access the application:**

- **Website**: http://localhost:3000
- **CRM**: http://localhost:3000/crm
- **API**: http://localhost:3000/api

### Default Admin Credentials

On first startup, the system automatically creates an admin user:

- **Username**: `admin`
- **Password**: `admin123` (or the value set in `ADMIN_PASSWORD`)

⚠️ **IMPORTANT**: Change the admin password immediately after first login!

## 🚢 Deployment

### Railway Deployment

This project is configured for deployment on Railway. See detailed instructions in:

- `CRM/RAILWAY_EXACT_STEPS.md` - Step-by-step Railway deployment guide
- `CRM/RAILWAY_TROUBLESHOOTING.md` - Common deployment issues

#### Quick Railway Setup:

1. **Root Directory**: Set to `.` (project root)
2. **Start Command**: `cd backend && node server.js`
3. **Build Command**: `cd backend && npm install --production`
4. **Environment Variables**: Set all required variables in Railway dashboard
5. **PostgreSQL**: Add PostgreSQL service in Railway (auto-configures DB variables)

### Environment Variables for Production

Ensure all environment variables are set in your deployment platform:

- Database variables (usually auto-set by Railway PostgreSQL)
- `JWT_SECRET` (generate a new one for production)
- `EMAIL_PASSWORD` (if using email features)
- AWS S3 variables (if using S3 storage)

## 📚 Documentation

### Setup Guides

- **Environment Setup**: `backend/SETUP_ENV.md`
- **Email Configuration**: `backend/EMAIL_SETUP.md`
- **S3 Storage Setup**: `backend/S3_SETUP_GUIDE.md`
- **Email Attachment Feature**: `backend/EMAIL_ATTACHMENT_FEATURE.md`

### Deployment Guides

- **Railway Deployment**: `CRM/RAILWAY_EXACT_STEPS.md`
- **Railway Troubleshooting**: `CRM/RAILWAY_TROUBLESHOOTING.md`
- **Railway Backend Deployment**: `CRM/RAILWAY_BACKEND_DEPLOYMENT.md`

### Feature Documentation

- **Archive Functionality**: `backend/ARCHIVE_FUNCTIONALITY.md`
- **Bulk Upload Optimization**: `backend/BULK_UPLOAD_OPTIMIZATION.md`
- **Performance Optimizations**: `PERFORMANCE_OPTIMIZATIONS.md`
- **Storage Analysis**: `CRM/STORAGE_ANALYSIS.md`

### Security Documentation

- **Security Assessment**: `SECURITY_ASSESSMENT.md`
- **Security Improvements**: `SECURITY_IMPROVEMENTS.md`
- **Backend Security**: `backend/SECURITY.md`
- **CRM Security Summary**: `CRM/SECURITY_SUMMARY.md`

## 🔒 Security

### Security Features

- JWT-based authentication
- Password hashing with bcrypt
- CSRF protection
- Rate limiting
- Input sanitization
- Helmet.js security headers
- CORS configuration
- SQL injection prevention

### Security Best Practices

1. **Never commit `.env` files** - They are already in `.gitignore`
2. **Use strong JWT secrets** - Generate with crypto.randomBytes
3. **Change default admin password** - Immediately after first login
4. **Use HTTPS in production** - Railway provides this automatically
5. **Keep dependencies updated** - Regularly run `npm audit`

See `backend/SECURITY.md` for detailed security information.

## 🛠️ Development

### API Endpoints

The backend provides RESTful API endpoints:

- `/api/auth/*` - Authentication (login, OTP, password change)
- `/api/customers/*` - Customer management
- `/api/users/*` - User management
- `/api/contact/*` - Contact form submissions
- `/api/referrals/*` - Referral tracking
- `/api/blog/*` - Blog post management

### Database Migrations

Database migrations are automatically run on server startup. Manual migrations are in `backend/migrations/`.

### Adding New Features

1. Create route handlers in `backend/routes/`
2. Add business logic in `backend/services/`
3. Update database schema if needed
4. Add frontend code in `CRM/` or `Website/`

## 🐛 Troubleshooting

### Common Issues

1. **Login fails with "Server error"**
   - Check that `JWT_SECRET` is set in environment variables
   - See `backend/SETUP_ENV.md`

2. **Database connection errors**
   - Verify database credentials in `.env`
   - Ensure PostgreSQL is running
   - Check database exists

3. **Email features not working**
   - Verify `EMAIL_PASSWORD` is set (Gmail App Password)
   - See `backend/EMAIL_SETUP.md`

4. **File uploads not persisting**
   - Configure AWS S3 for persistent storage
   - See `backend/S3_SETUP_GUIDE.md`

5. **Railway deployment issues**
   - Check `CRM/RAILWAY_TROUBLESHOOTING.md`
   - Verify Root Directory is set to `.`
   - Ensure all environment variables are set

## 📝 License

[Add your license information here]

## 👥 Support

For issues, questions, or contributions:

1. Check the documentation in the project
2. Review troubleshooting guides
3. Check Railway logs for deployment issues
4. Review server logs for runtime errors

## 🔄 Version History

- **v1.0.0** - Initial release
  - Customer management
  - Tax information tracking
  - Document management
  - Email integration
  - User authentication
  - Referral tracking
  - Blog management

---

**Built with ❤️ for Nexus Tax Filing**


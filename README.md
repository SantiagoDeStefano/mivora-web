# Mivora - Event Ticket Management Platform

A full-stack event management and ticketing platform built with **TypeScript**, **Node.js**, **Express**, **React**, and **PostgreSQL**. Features real-time chat, QR code scanning, and comprehensive event organization tools.

![Mivora High-Level Architecture](images/mivora-high-level-architecture.jpg)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Deployment](#deployment)
- [Development](#development)

---

## 🎯 Overview

**Mivora** is a comprehensive event management platform that enables:

- **Event Organizers** to create, manage, and publish events with detailed information
- **Attendees** to discover events, purchase tickets, and check in with QR codes
- **Real-time Communication** between event organizers and attendees via chat
- **Ticket Management** with automated email verification and QR code generation

Deployed in production at [mivora.vercel.app](https://mivora.vercel.app)

---

## 🛠️ Tech Stack

### Backend

- **Runtime**: Node.js 22 (Alpine)
- **Framework**: Express.js 5.1
- **Language**: TypeScript 5.9
- **Database**: PostgreSQL
- **Real-time**: Socket.io 4.8
- **File Storage**: AWS S3
- **Email Service**: AWS SES
- **Authentication**: JWT (with multiple token types)
- **Documentation**: Swagger UI

### Frontend

- **Framework**: React 19 + Vite 7
- **Language**: TypeScript 5.9
- **Styling**: Tailwind CSS 4.1
- **HTTP Client**: Axios
- **State Management**: React Context API
- **Data Fetching**: TanStack React Query
- **Forms**: React Hook Form + Yup validation
- **QR Code**: html5-qrcode, QR Scanner
- **Icons**: Lucide React

### DevOps & Tools

- **Containerization**: Docker (multi-stage builds)
- **Package Management**: npm, Docker Compose
- **Code Quality**: ESLint, Prettier
- **Build Tools**: TypeScript Compiler, tsc-alias

---

## ✨ Features

### User Management

- User registration and authentication via JWT
- Email verification with secure tokens
- Password reset functionality
- Role-based access control (Attendee / Organizer)
- User profile management

### Event Management

- Create and publish events (Draft → Published → Canceled)
- Event details: title, description, location, date/time, capacity, pricing
- Poster/media uploads to AWS S3
- Event search and filtering
- Event status tracking

### Ticket System

- Ticket booking with ticket status tracking (Booked → Checked In → Canceled)
- QR code generation for each ticket
- Automatic ticket cancellation
- Ticket refund management
- Real-time ticket counter updates

### Check-in & QR Codes

- QR code scanning for attendance verification
- Bulk check-in management with real-time socket updates
- Checked-in attendee count tracking per event

### Real-time Communication

- Live chat between event organizers and attendees
- Socket.io-powered real-time messaging
- Message persistence in database

### Media Management

- Image upload and storage on AWS S3
- Image processing with Sharp
- Temporary image directory for processing
- Support for event posters and user avatars

### Security

- JWT-based authentication (Access, Refresh, Email Verify, Forgot Password, QR Code tokens)
- Encrypted password security
- CORS configuration with allowed origins
- Request validation with express-validator
- Role-based authorization

---

## 📁 Project Structure

```
Mivora/
├── Backend/                      # Node.js/Express backend
│   ├── src/
│   │   ├── index.ts             # Application entry point
│   │   ├── constants/           # Configuration & enums
│   │   │   ├── config.ts        # Environment variables
│   │   │   ├── dir.ts           # Directory paths
│   │   │   ├── enums.ts         # Token types, statuses
│   │   │   ├── httpStatus.ts    # HTTP status codes
│   │   │   ├── limits.ts        # Rate limits, file sizes
│   │   │   └── messages.ts      # API messages
│   │   ├── controllers/         # Route handlers
│   │   │   ├── events.controllers.ts
│   │   │   ├── medias.controllers.ts
│   │   │   ├── tickets.controllers.ts
│   │   │   └── users.controllers.ts
│   │   ├── middlewares/         # Express middlewares
│   │   │   ├── errors.middlewares.ts
│   │   │   ├── events.middlewares.ts
│   │   │   ├── tickets.middlewares.ts
│   │   │   └── users.middlewares.ts
│   │   ├── models/              # Request/Response schemas
│   │   │   ├── Errors.ts
│   │   │   ├── requests/
│   │   │   └── schemas/
│   │   ├── routes/              # API route definitions
│   │   │   ├── events.routes.ts
│   │   │   ├── medias.routes.ts
│   │   │   ├── tickets.routes.ts
│   │   │   └── users.routes.ts
│   │   ├── services/            # Business logic
│   │   │   ├── database.services.ts
│   │   │   ├── events.services.ts
│   │   │   ├── medias.services.ts
│   │   │   ├── qrcode.services.ts
│   │   │   ├── tickets.services.ts
│   │   │   └── users.services.ts
│   │   ├── templates/           # Email templates
│   │   │   └── verify-email.html
│   │   ├── types/               # TypeScript type definitions
│   │   │   ├── common.d.ts
│   │   │   └── domain.ts        # Domain types (UserRole, EventStatus, etc)
│   │   ├── utils/               # Utility functions
│   │   │   ├── common.ts
│   │   │   ├── crypto.ts        # Encryption/decryption
│   │   │   ├── email.ts         # Email sending via AWS SES
│   │   │   ├── fake.ts          # Faker data generation
│   │   │   ├── file.ts          # File operations
│   │   │   ├── handlers.ts      # Error handlers
│   │   │   ├── jwt.ts           # JWT management
│   │   │   ├── s3.ts            # AWS S3 operations
│   │   │   ├── seed.ts          # Database seeding
│   │   │   ├── socket.ts        # Socket.io initialization
│   │   │   ├── uuid.ts          # UUID generation
│   │   │   └── validation.ts    # Input validation
│   │   └── uploads/             # Local file storage
│   │       └── images/temp/
│   ├── docker-compose.yml       # Docker services configuration
│   ├── Dockerfile               # Multi-stage Docker build
│   ├── eslint.config.mts        # ESLint configuration
│   ├── MivoraSwagger.yaml       # API documentation
│   ├── nodemon.json             # Development watch config
│   ├── package.json             # Dependencies & scripts
│   └── tsconfig.json            # TypeScript configuration
│
├── Frontend/                     # React/Vite frontend
│   ├── src/
│   │   ├── main.tsx            # React entry point
│   │   ├── App.tsx             # Root component
│   │   ├── apis/               # API integration
│   │   │   ├── events.api.ts
│   │   │   ├── index.ts
│   │   │   ├── tickets.api.ts
│   │   │   └── users.api.ts
│   │   ├── assets/             # Static assets
│   │   ├── components/         # Reusable React components
│   │   │   ├── Badge/
│   │   │   ├── Button/
│   │   │   ├── Card/
│   │   │   ├── ChatHeader/
│   │   │   ├── Container/
│   │   │   ├── Footer/
│   │   │   ├── Header/
│   │   │   ├── Input/
│   │   │   ├── Label/
│   │   │   ├── Logo/
│   │   │   ├── NavHeader/
│   │   │   ├── PageTransition/
│   │   │   ├── Popup/
│   │   │   ├── QRScanner/      # QR code scanning component
│   │   │   ├── RegisterHeader/
│   │   │   ├── SearchButton/
│   │   │   ├── Select/
│   │   │   ├── Toggle/
│   │   │   ├── TokenStyle/
│   │   │   └── VerifyEmailButton/
│   │   ├── constants/          # Frontend constants
│   │   │   ├── brand.ts
│   │   │   ├── brandLogo.tsx
│   │   │   ├── limits.ts
│   │   │   ├── messages.ts
│   │   │   └── path.ts
│   │   ├── contexts/           # React Context providers
│   │   │   └── app.context.tsx
│   │   ├── layouts/            # Layout components
│   │   │   ├── ChatLayout/
│   │   │   ├── MainLayout/
│   │   │   ├── RegisterLayout/
│   │   │   └── UserLayout/
│   │   ├── pages/              # Page components
│   │   │   ├── About/
│   │   │   ├── Chat/
│   │   │   ├── EventDetail/
│   │   │   ├── Home/
│   │   │   ├── MyTicketDetails/
│   │   │   ├── MyTickets/
│   │   │   ├── Organzier/ (Organizer dashboard)
│   │   │   ├── ScanTicket/
│   │   │   ├── SearchEvents/
│   │   │   └── Users/
│   │   ├── routes/             # Route configuration
│   │   ├── types/              # TypeScript type definitions
│   │   ├── utils/              # Utility functions
│   │   ├── App.css
│   │   └── index.css
│   ├── public/                 # Static public assets
│   ├── vercel.json             # Vercel deployment config
│   ├── eslint.config.js        # ESLint configuration
│   ├── tailwind.config.js      # Tailwind CSS configuration
│   ├── tsconfig.json           # TypeScript configuration
│   └── package.json            # Dependencies & scripts
│
└── README.md                   # This file
```

---

## 📋 Prerequisites

- **Node.js**: v22 or higher
- **npm**: v11 or higher
- **PostgreSQL**: v12+ (local or AWS RDS)
- **Docker**: (optional, for containerized deployment)
- **AWS Account**: For S3 and SES services

### Environment Variables Required

#### Backend (.env)

```env
# Server
PORT=4000
NODE_ENV=development

# Database
DATABASE_URL=postgres://user:password@host:port/database_name
PGHOST=localhost
PGPORT=5432
PGDATABASE=Mivora
PGUSER=postgres
PGPASSWORD=your_password

# JWT Secrets
JWT_SECRET_ACCESS_TOKEN=your_access_token_secret
JWT_SECRET_REFRESH_TOKEN=your_refresh_token_secret
JWT_SECRET_EMAIL_VERIFY_TOKEN=your_email_verify_secret
JWT_SECRET_FORGOT_PASSWORD_TOKEN=your_forgot_password_secret
JWT_SECRET_QRCODE_TOKEN=your_qrcode_secret

# Token Expiry
ACCESS_TOKEN_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d
EMAIL_VERIFY_TOKEN_EXPIRES_IN=7d
FORGOT_PASSWORD_TOKEN_EXPIRES_IN=7d

# Security
PASSWORD_SECRET=your_password_encryption_secret

# AWS
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=ap-southeast-1
S3_BUCKET_NAME=your_s3_bucket
SES_FROM_ADDRESS=noreply@yourdomain.com

# Client URLs
CLIENT_URL=http://localhost:5173
```

#### Frontend (.env)

```env
VITE_API_BASE_URL=http://localhost:4000/api/v1
VITE_SOCKET_URL=http://localhost:4000
```

---

## 💻 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/mivora.git
cd mivora
```

### 2. Backend Setup

```bash
cd Backend
npm install
```

### 3. Frontend Setup

```bash
cd Frontend
npm install
```

### 4. Database Setup

Create PostgreSQL database:

```sql
CREATE DATABASE Mivora;
```

Run migrations/seeding (if available):

```bash
cd Backend
npm run seed
```

---

## ⚙️ Configuration

### Backend Configuration

All configuration is loaded from environment variables in [src/constants/config.ts](Backend/src/constants/config.ts).

Key configurations:

- **Port**: Defaults to 4000
- **CORS Origins**: Configured for localhost and production domains
- **Database**: PostgreSQL connection string
- **JWT Tokens**: Multiple token types for different purposes
- **AWS Services**: S3 for file storage, SES for emails

### Frontend Configuration

- **Vite Dev Server**: Runs on `http://0.0.0.0:5173`
- **API Endpoints**: Configured via axios instance
- **Socket.io**: Real-time connection to backend

---

## 🚀 Running the Application

### Development Mode

#### Backend

```bash
cd Backend
npm run dev
```

Runs with Nodemon for auto-reload on file changes
Server: `http://localhost:4000`
API Docs: `http://localhost:4000/mivora/api-docs`

#### Frontend

```bash
cd Frontend
npm run dev
```

Runs with Vite dev server
App: `http://localhost:5173`

### Production Build

#### Backend

```bash
cd Backend
npm run build
npm start
```

#### Frontend

```bash
cd Frontend
npm run build
```

Builds optimized production bundle in `dist/`

---

## 📚 API Documentation

### Interactive API Documentation

Access Swagger UI at: `http://localhost:4000/mivora/api-docs`

### API Endpoints

#### Users (`/api/v1/users`)

- `POST /register` - User registration
- `POST /login` - User login
- `POST /logout` - User logout
- `POST /refresh` - Refresh access token
- `POST /verify-email` - Verify email with token
- `POST /forgot-password` - Request password reset
- `POST /reset-password` - Reset password with token
- `GET /me` - Get current user profile
- `GET /:id` - Get user by ID
- `PATCH /:id` - Update user profile

#### Events (`/api/v1/events`)

- `GET /` - List all published events
- `POST /` - Create event (organizer only)
- `GET /:id` - Get event details
- `PUT /:id` - Update event details (organizer only)
- `DELETE /:id` - Delete event (organizer only)
- `PATCH /:id/status` - Update event status
- `GET /:id/attendees` - Get event attendees list

#### Tickets (`/api/v1/tickets`)

- `POST /` - Book a ticket
- `GET /` - Get user's tickets
- `GET /:id` - Get ticket details
- `PATCH /:id/check-in` - Check in attendee via QR code
- `DELETE /:id` - Cancel ticket

#### Media (`/api/v1/medias`)

- `POST /` - Upload media file to S3
- `GET /:id` - Get media info
- `DELETE /:id` - Delete media file

---

## 🗄️ Database Schema

### Core Tables

**users**

- User authentication and profile information
- Roles: attendee, organizer
- Verification status tracking

**events**

- Event details created by organizers
- Status: draft, published, canceled
- Capacity and pricing information
- Poster URL for event image

**tickets**

- Ticket bookings with attendee and event references
- Status: booked, checked_in, canceled
- QR code token for scanning

**messages**

- Real-time chat messages between users
- Associated with events
- Timestamp tracking

**users_followers** (implied from project structure)

- Following relationships between users

---

## 🐳 Deployment

### Docker Deployment

#### Build and Run Locally

```bash
docker-compose up --build
```

This starts:

- Backend service on port 4000
- Mounts uploads volume for persistence

#### Push to Docker Registry

```bash
docker build -t your-registry/mivora-backend:latest .
docker push your-registry/mivora-backend:latest
```

#### Deploy to AWS EC2

1. Build push image to registry (ECR/Docker Hub)
2. SSH into EC2 instance
3. Update `docker-compose.yml` with image reference
4. Run: `docker-compose up -d`

### Frontend Deployment

Current deployment: [mivora.vercel.app](https://mivora.vercel.app)

#### Deploy to Vercel

```bash
cd Frontend
npm run build
# Push to GitHub and connect to Vercel
```

Environment variables on Vercel:

```
VITE_API_BASE_URL=https://api.yourdomain.com/api/v1
VITE_SOCKET_URL=https://api.yourdomain.com
```

---

## 👨‍💻 Development

### Code Quality

#### Linting

```bash
# Backend
cd Backend
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix issues

# Frontend
cd Frontend
npm run lint:fix
```

#### Formatting

```bash
# Backend
npm run prettier      # Check formatting
npm run prettier:fix  # Auto-format code

# Frontend
npm run prettier:fix
```

### TypeScript Compilation

```bash
# Backend
npm run build  # Compiles TypeScript and resolves aliases
```

### Database Seeding

Generate sample data:

```bash
cd Backend
npm run seed
```

---

## 🏗️ Project Notes

### Key Technologies

- **Real-time**: Socket.io for live chat and event updates
- **File Storage**: AWS S3 for scalable image storage
- **Email**: AWS SES for transactional emails
- **Authentication**: Multi-token JWT strategy for security
- **QR Codes**: Dynamic QR code generation for ticket verification

### Architecture Highlights

- **Separation of Concerns**: Controllers, Services, Middlewares clearly separated
- **Type Safety**: Full TypeScript throughout the codebase
- **API Documentation**: Swagger/OpenAPI specification
- **Error Handling**: Centralized error middleware with categorized HTTP status codes
- **Validation**: Request validation at middleware level

### Best Practices Followed

- Environment-based configuration
- JWT refresh token rotation
- Encrypted sensitive data
- CORS configuration for security
- Input validation and sanitization
- Proper HTTP status codes
- Structured error responses

---

## 📞 Support & Contribution

For issues, questions, or contributions, please refer to the project repository.

---

## 📄 License

ISC

---

**Last Updated**: March 2026

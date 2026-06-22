# Garbage Management System

A full-stack garbage pickup management project with a Node.js/Express backend, MongoDB storage, Redis-compatible caching, JWT cookie authentication, and a browser frontend served by the backend.

## Features

- Customer and admin signup/login
- Secure httpOnly cookie-based sessions
- Customer ticket creation with pickup coordinates, slot, and notes
- Customer ticket listing, detail view, note updates, and deletion
- Admin region/slot-based ticket listing
- Admin ticket note updates and ticket closure
- Region seeding for the configured service area
- Same-origin frontend, so the UI and API run from one server
- Redis support with in-memory fallback for local development

## Tech Stack

- Backend: Node.js, Express
- Database: MongoDB with Mongoose
- Cache: Redis, with local memory fallback
- Auth: JWT, bcrypt, signed httpOnly cookies
- Frontend: HTML, CSS, JavaScript

## Project Structure

```text
.
├── client/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── server/
│   ├── app.js
│   ├── database/
│   ├── redis/
│   ├── routes/
│   ├── scripts/
│   └── utils/
├── .env.example
├── package.json
└── README.md
```

## Requirements

- Node.js 18 or newer
- MongoDB running locally or a MongoDB Atlas URI
- Redis is optional for development, but recommended

## Setup

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env
```

Edit `.env` and replace the secret values with long random strings:

```env
COOKIE_SECRET=replace-with-a-long-random-cookie-secret
ACCESS_TOKEN_SECRET=replace-with-a-long-random-access-token-secret
REFRESH_TOKEN_SECRET=replace-with-a-long-random-refresh-token-secret
```

The default local database is:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/GMS
```

## Running With Docker Services

If you use Docker, start MongoDB and Redis:

```bash
docker run -d --name gms-mongo -p 27017:27017 mongo:7
docker run -d --name gms-redis -p 6379:6379 redis:7
```

If containers already exist:

```bash
docker start gms-mongo gms-redis
```

## Seed Regions

The backend also auto-seeds regions on startup, but you can seed manually:

```bash
npm run seed
```

## Start The App

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## Test Accounts

Create accounts from the signup screen.

For admin accounts, choose:

- Role: `admin`
- Region: `region1`, `region2`, `region3`, or `region4`
- Slot: `morning`, `afternoon`, or `evening`

Passwords must be at least 12 characters and include uppercase, lowercase, number, and special character.

Example:

```text
StrongPass123!
```

## API Overview

Health:

```http
GET /api/v1/health
```

Auth:

```http
POST /api/v1/auth/signup
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
POST /api/v1/auth/generate-token
```

Customer:

```http
GET    /api/v1/customer
PATCH  /api/v1/customer
GET    /api/v1/customer/ticket
POST   /api/v1/customer/ticket
GET    /api/v1/customer/ticket/:id
PATCH  /api/v1/customer/ticket/:id
DELETE /api/v1/customer/ticket/:id
```

Admin:

```http
GET   /api/v1/admin
PATCH /api/v1/admin
GET   /api/v1/admin/ticket
GET   /api/v1/admin/ticket/:id
PATCH /api/v1/admin/ticket/:id
PUT   /api/v1/admin/ticket/:id
```

## Important Notes

- Customer ticket actions are restricted to the ticket owner.
- Admin ticket actions are restricted to the admin's assigned region.
- Admin ticket list is also restricted by the admin's slot.
- In development, Redis is optional because the app falls back to memory cache.
- In production, use Redis and set `NODE_ENV=production` so cookies use stricter settings.
- The admin route summary uses the public OSRM route service. If that service fails, tickets still load.

## Useful Commands

```bash
npm start
npm run seed
npm run check
```

## Suggested Future Improvements

- Add automated tests with Jest or Node's built-in test runner
- Add map picker integration for exact pickup location selection
- Add image upload for garbage proof and collection proof
- Add ticket assignment history and status timeline
- Add admin analytics by region, slot, and ticket status
- Add rate limiting for auth endpoints
- Add Docker Compose for one-command local setup
- Add deployment configuration for Render, Railway, or VPS hosting

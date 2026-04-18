# Modern Shop — PHP + MySQL API

This folder is an alternative **REST API** that matches the React client’s `/api/*` contract, using **PHP**, **MySQL**, and **Google OAuth** (access token verified against Google’s userinfo endpoint).

## Prerequisites

- PHP **8.1+** with extensions: `pdo_mysql`, `json`, `openssl`
- MySQL **8** (or compatible MariaDB)

## 1. Create the database

```bash
mysql -u root -p < sql/schema.sql
```

## 2. Configure

```bash
copy config.sample.php config.php
```

Edit `config.php` (or set environment variables) so `db.*` points at your MySQL database and `jwt_secret` is a long random string.

## 3. Run the API

From this `php` directory:

```bash
php -S localhost:8080 router.php
```

Health check: `http://localhost:8080/api/health`

## 4. Point the React app at PHP

In the project root `.env`:

```env
VITE_API_URL=http://localhost:8080
```

Then start Vite (`npm run dev:client`) **without** the Node API, or add a second proxy target as needed.

## Google OAuth API

The frontend obtains a Google **access token** (Google Identity Services). The client sends it to `POST /api/auth/google` with JSON `{ "accessToken": "..." }`. The PHP API calls:

`https://www.googleapis.com/oauth2/v3/userinfo`

and creates or updates the user record (`google_sub`, `picture`, `email`, `name`) before returning a JWT — same flow as the Node server.

## Default seeded accounts

After importing `sql/schema.sql`:

| Role  | Email                 | Password           |
|-------|-----------------------|--------------------|
| admin | admin@modernshop.local | AdminChangeMe123! |
| user  | demo@modernshop.local  | DemoUser123!      |

Change passwords in production and rotate `jwt_secret`.

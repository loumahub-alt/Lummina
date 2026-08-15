# Lummina Law Firm Node API

Express API for the Lummina public website and authenticated admin portal.

## Stack

- Node.js and Express
- MongoDB through Mongoose
- Cloudinary through the official Node SDK
- Resend through the official Node SDK for consent-aware newsletter sends
- Signed, HTTP-only server-side sessions with MongoDB session storage
- Zod request validation, Helmet, CORS, and rate limiting

MongoDB is the only application database. The frontend API contract remains under /api.

## Source of truth

MongoDB is the runtime source of truth. The public API and admin CMS read and write MongoDB; no website content is imported into the Express application at request time.

`seed-data/content.js` is only a versioned bootstrap dataset used by the explicit `npm run setup` or `npm run seed` commands. It is not a fallback store and changing it does not overwrite production content until a seed command is deliberately run.

## Setup

    cp .env.example .env
    npm install
    npm run setup
    npm run dev

Set MONGODB_URI, MONGODB_DATABASE, SESSION_SECRET, and the optional LUMMINA_ADMIN_EMAIL/LUMMINA_ADMIN_PASSWORD before running setup. The setup command seeds the current bootstrap content, SEO records, contact/general/legal settings, and the admin account when credentials are supplied.

## Structure

- `src/` — Express application, routes, middleware, Mongoose models and services.
- `seed-data/` — explicit bootstrap content used only by the seed command.
- `test/` — Node smoke and contract checks.

## Cloudinary

Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET before using admin media uploads. CLOUDINARY_FOLDER defaults to lummina. Files are validated, uploaded to Cloudinary under images/ or documents/, and stored in MongoDB as metadata.

## Newsletter sending

Set `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and optionally `RESEND_FROM_NAME` before using the admin Newsletter sender. The sender address must belong to a verified Resend domain. Newsletter HTML and subject are stored in MongoDB; sending reads only subscribers whose status is `subscribed` and sends each address separately in Resend batches. Newsletter messages include a plain-text alternative, a personalized unsubscribe link, and RFC 8058 unsubscribe headers. The unsubscribe endpoint uses `APP_URL` and the production `SESSION_SECRET` to sign links.

## API groups

- /api/public/*: published content, consultation intake, newsletter signup, consent, and optional analytics events.
- /api/auth/*: session login, logout, current-user, and CSRF token.
- /api/admin/*: authenticated role/permission protected CMS, analytics, consultations, newsletter, settings, SEO, activity, users, and media.

## Verification

    npm test
    npm run start

The tests cover unauthenticated admin access and public validation. A real seed requires a reachable MongoDB service and a configured MONGODB_URI.

## Deploying the API to Vercel

Create a separate Vercel project for this `backend` directory. The project root must be `backend`; Vercel detects the default Express export from `src/app.js` and runs the application as one serverless function. No legacy `builds` configuration or rewrite is required. The existing Express routes remain under `/api`, so the health check is:

    https://YOUR-API-DOMAIN.vercel.app/api/health

Set the same production variables from `.env.example` in the Vercel project. At minimum, set `NODE_ENV=production`, `MONGODB_URI`, `MONGODB_DATABASE`, `SESSION_SECRET`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `SESSION_SECURE_COOKIE=true`, and `SESSION_SAME_SITE=none` when the frontend and API are on separate Vercel project domains. Add the Cloudinary variables for media uploads and the Resend variables for newsletter sending. The app automatically trusts Vercel's HTTPS proxy in production so secure session cookies can be issued.

The MongoDB connection is checked before requests and cached between warm Vercel invocations. This means `/api/health` also confirms that the deployed function can reach the configured database. MongoDB Atlas must allow the Vercel deployment to connect (use Atlas network access appropriate for your security policy), and the database user must have permission to read and write the application database.

Local development is unchanged:

    npm install
    npm run dev

Do not use `npm run setup` or `npm run seed` on every deployment. Run them deliberately against the intended database only when bootstrap data is required. Vercel Functions do not provide durable local disk storage; this API already sends uploaded media to Cloudinary, so no local upload directory is required. Vercel also limits request bodies, so large media should be uploaded directly to Cloudinary rather than through the API function.

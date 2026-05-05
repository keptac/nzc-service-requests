# SDA Service Request Tracker

A full-stack approval workflow application for Seventh-day Adventist Church service requests. It tracks requests from local church submission through pastor, conference, union, and destination church review with role-based visibility, comments, notifications, attachments, and audit logging.

## Stack

- Next.js 14 App Router
- React + TypeScript
- Prisma ORM
- PostgreSQL
- JWT cookie authentication with hashed passwords
- Vitest workflow and permission tests

The visual system uses Adventist identity guidance: Advent Sans style with Noto/system fallbacks, official base palette colors such as Forest `#355724`, Ming `#007f98`, and Denim `#2f557f`, clean spacing, high contrast, and restrained administrative layouts.

## Setup

Requires Node.js `>=18.17.0` and Docker for the local PostgreSQL database.

1. Install dependencies:

```bash
pnpm install
```

2. Create your environment file:

```bash
cp .env.example .env
```

Set `AUTH_SECRET` to a random value of at least 32 characters.

3. Start PostgreSQL on local port `55432`:

```bash
docker compose up -d postgres
```

If you use an existing PostgreSQL server instead, update `DATABASE_URL` in `.env`.

4. Create and seed the database:

```bash
pnpm run db:migrate
pnpm run db:seed
```

The seed importer reads real ZEUC church clerk data from ignored CSV files:

- `prisma/seed/ezc_church_clerks_full.csv`
- `prisma/seed/nzc_church_clerks_full.csv`

The first file imports East Zimbabwe Conference (`EZC`) and the second imports North Zimbabwe Conference (`NZC`) under Zimbabwe East Union Conference (`ZEUC`). The importer trims bad spacing, normalizes Zimbabwe phone numbers to `+263`, fixes simple email spacing problems, skips duplicate rows, creates one church per district/church name, and marks questionable imported users with `data_quality_status = "needs_review"`.

5. Start the app:

```bash
pnpm run dev
```

Open `http://localhost:3000`.

## Seed Accounts

Imported seed users use password `Password123!`.

- `super.admin@zeuc.local`
- `arcadia@ezc.adventist.org`
- `banket@nzc.adventist.org`
- `sibandab@nzc.adventist.org`

Many additional clerk, assistant clerk, district coordinator, and district pastor users are imported from the CSV rows. If a row has no usable email, the importer generates one as `firstname.lastname@seed.zeuc.local` and keeps the record marked for review when needed.

## Key Features

- Hierarchy management: unions, conferences, districts, local churches
- User and role management
- Configurable service request types
- Request creation with priority, date required, targets, notes, and attachments
- Workflow routing:
  - Same district: district pastor, destination church acceptance
  - Cross-district same conference: district pastor, conference, destination church acceptance
  - Cross-conference: district pastor, conference, union, destination church acceptance
- Approval actions: approve, decline, return for clarification, cancel, resubmit, manual escalation
- Destination church acceptance requires a minute number, which is used as the PDF board action number
- Required comments for decline and return
- Chat-style comments visible to authorized users
- Timeline progress tracker
- In-app notifications
- Twilio WhatsApp notifications and commands for approved numbers
- Audit logging
- Reports by status, hierarchy, declined requests, pending stage, and average approval time

## Security Notes

- Passwords are hashed with bcrypt.
- Auth uses an HTTP-only, same-site session cookie.
- Backend routes enforce role and scope checks.
- Users only see requests relevant to their assigned hierarchy unless they are Super Admin.
- Uploads are limited to PDF, Word, JPG, PNG, and WebP files up to 10 MB.
- WhatsApp delivery uses Twilio when `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_WHATSAPP_FROM` are set.
- Only users with approved WhatsApp numbers can use WhatsApp commands. Super Admins can approve a number from User Management with **Enable WhatsApp messaging**. Pastor roles are automatically enabled when a valid WhatsApp number is available.

## WhatsApp Setup

1. Set Twilio environment variables in `.env`.
2. Configure the Twilio WhatsApp inbound webhook to:

```text
POST {APP_URL}/api/whatsapp/twilio?token={WHATSAPP_WEBHOOK_TOKEN}
```

Supported inbound commands:

```text
HELP
STATUS <request-number>
APPROVE <request-number> [comment]
APPROVE <request-number> MINUTE <minute-number> [comment]
DECLINE <request-number> <comment>
RETURN <request-number> <comment>
REQUEST <type> | <title> | <description> | <target church> | <yyyy-mm-dd>
```

## Tests

```bash
npm run test
```

Tests cover workflow routing and role permissions.

## Production Notes

- Low-cost AWS Lightsail deployment files are in `deploy/aws`.
- The GitHub Actions workflow for CI/CD is `.github/workflows/deploy-aws.yml`.
- This app is dynamic Next.js, so the low-cost deployment runs the whole app on Lightsail behind Caddy instead of publishing a static frontend to S3.
- Use a managed PostgreSQL database and update `DATABASE_URL`.
- Set a strong `AUTH_SECRET`.
- Store uploads in object storage instead of local disk.
- Add CSRF protection if exposing mutating routes outside same-site browser flows.
- Replace seeded passwords immediately after provisioning.

## Brand References

- Official Adventist Identity Guideline System: `https://styleguide.adventist.io/`
- Color guidance: `https://styleguide.adventist.io/style/color`
- Advent Sans guidance: `https://styleguide.adventist.io/style/advent-sans`

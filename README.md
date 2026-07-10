# NQAS Accreditation Platform

**Hospital NABH — National Quality Assurance Standards (NQAS) Assessment & Accreditation System**
Built for: Oncology Hospital | Accrediting Body: District Health Board
Module in Scope: **NQAS — District Hospital (DH/NQAS-2020/00)**

---

## What This System Does

A purpose-built, single-hospital web application that digitises the NABH accreditation workflow:

- Assessors complete the **hospital's own department checklists** (digitised from the 14 client PDFs) via a guided wizard
- Each client checkpoint response is automatically mapped to the corresponding NQAS Measurable Element in the district toolkit (`DH-20_NQAS_Toolkit_28-June_2023.xlsx`)
- Client PDF checkpoints that have **no match** in the NQAS Excel are captured in the assessment but marked **N/A** — they do not contribute to the district NQAS score denominator
- The mapping is imported by Admin once via a JSON mapping file (template provided: `docs/nabh_mapping_template.json`)
- HOD reviews, approves, rejects, or sends back submissions
- A live dashboard tracks section/area/department scores against NQAS standards with quarter-over-quarter trends
- All actions — logins, score changes, approvals — are permanently audit-logged

---

## Assessment Data Flow

```
Assessor fills →  CLIENT PDF CHECKLISTS (14 department PDFs)
                          │
                          │  Admin-imported JSON mapping
                          ▼
                  NQAS DISTRICT TOOLKIT  (DH-20_NQAS_Toolkit_28-June_2023.xlsx)
                          │
              ┌───────────┴────────────┐
              │                        │
        MAPPED items              UNMAPPED items
        (score converted          (captured in assessment,
         via mapping formula)      marked N/A, excluded
                                   from NQAS denominator)
```

### Client PDF Checklist Structure
Each of the 14 department PDFs contains the hospital's own assessment checkpoints.
These are the forms the assessors fill out. After scoring, the system auto-maps each response to the NQAS grid.

### NQAS District Toolkit Structure (mapping target)
```
Module: NQAS
└── Department (e.g. Emergency, OPD, ICU, IPD ... 14 departments)
    └── Area of Concern (A–H)
        ├── A: Service Provision
        ├── B: Patient Rights
        ├── C: Inputs
        ├── D: Support Services
        ├── E: Clinical Services
        ├── F: Infection Control
        ├── G: Quality Management
        └── H: Outcome
        └── Standard (e.g. A1, A2, A3 ...)
            └── Measurable Element / ME (e.g. ME A1.1, ME A1.2 ...)
                ├── meDescription: "The facility provides General Medicine services"
                ├── checkpoint: "Availability of Emergency Medical Procedures"
                ├── maxScore: 2  (NQAS scale: 0 = non-compliant, 1 = partial, 2 = full)
                ├── assessmentMethod: SI/OB | RR | PI
                └── meansOfVerification: "Poisoning, Snake Bite, CVA ..."
```

Each department has ~370–380 MEs. Scored MEs carry a max score of 2. Some MEs have no checkpoint in the NQAS Excel (informational only) — these are N/A by default.

---

## Departments Covered

| # | NQAS Sheet | Client PDF |
|---|---|---|
| 1 | Emergency | `1.EMERGENCY-ONCO 2024.pdf` |
| 2 | OPD | `2.OPD-ONCO 2024.pdf` |
| 3 | Paed_Ward | `3.PAED WARD MUSKAN-ONCO 2024.pdf` |
| 4 | OT | `4.OT-ONCO 2024.pdf` |
| 5 | ICU | `5.ICU-ONCO 2024.pdf` |
| 6 | IPD | `6.IPD-ONCO 2024.pdf` |
| 7 | Blood Bank | `7.BLOOD BANK-ONCO 2024.pdf` |
| 8 | Lab | `8.LAB-ONCO 2024.pdf` |
| 9 | Radiology | `9.RADIOLOGY-ONCO 2024.pdf` |
| 10 | Pharmacy | `10.PHARMACY-ONCO 2024.pdf` |
| 11 | Auxillary services | `11.AUXILLARY SERVICES-ONCO 2024.pdf` |
| 12 | Mortuary | `12.MORTUARY-ONCO 2024.pdf` |
| 13 | Admin | `13.ADMIN-ONCO 2024.pdf` |
| 14 | Paed_OPD | `14.PAED OPD MUSKAN-ONCO 2024.pdf` |

---

## Tech Stack

### Monorepo Layout

```
nabh-platform/
├── apps/
│   ├── web/                  # Next.js 15 — frontend
│   └── api/                  # NestJS 11 — REST + WebSocket backend
├── packages/
│   ├── shared/               # Shared TypeScript types, enums, Zod schemas
│   └── database/             # Prisma schema + seed scripts
├── docs/                     # NQAS toolkit, client PDFs, mapping templates
├── nginx/
│   └── nginx.conf
├── .env.example
└── pnpm-workspace.yaml
```

### Frontend — `apps/web`

| Concern | Library | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| Components | Shadcn/UI + Radix UI | latest |
| Animations | Motion (`motion/react`) | 12.x |
| Server State | TanStack Query | 5.x |
| Client State | Zustand | 5.x |
| Forms | React Hook Form + Zod | 7.x / 3.x |
| Charts | Recharts + Nivo | 2.x / 0.87 |
| Tables | TanStack Table | 8.x |
| PDF Viewer | react-pdf | 9.x |
| Export | xlsx + jsPDF | latest |
| Real-time | socket.io-client | 4.x |
| Icons | Lucide React | latest |

### Backend — `apps/api`

| Concern | Library | Version |
|---|---|---|
| Framework | NestJS | 11.x |
| Language | TypeScript | 5.x |
| ORM | Prisma | 7.x |
| Auth | Passport.js + JWT | latest |
| Validation | class-validator + class-transformer | latest |
| Real-time | Socket.io (NestJS Gateway) | 4.x |
| Email | Nodemailer + Gmail SMTP | latest |
| Queue | BullMQ + Redis | 5.x |
| File Upload | Multer | latest |
| Excel Parser | xlsx (SheetJS) | latest |
| Logging | Winston | latest |
| Rate Limiting | @nestjs/throttler | latest |
| API Docs | @nestjs/swagger | latest |

### Infrastructure

| Component | Technology |
|---|---|
| Database | PostgreSQL 16 |
| Cache / Queue Broker | Redis 7 |
| File Storage | MinIO (S3-compatible, self-hosted) |
| Reverse Proxy | nginx |
| Process Manager | PM2 |

---

## User Roles & Permissions

| Permission | Admin | HOD | Assessor |
|---|---|---|---|
| Manage users | ✓ | — | — |
| Manage hospital settings / logo | ✓ | — | — |
| Import mapping file | ✓ | — | — |
| View all assessments | ✓ | ✓ | own only |
| Create assessment | ✓ | — | ✓ |
| Edit in-progress assessment | ✓ | — | ✓ (own) |
| Submit assessment | ✓ | — | ✓ |
| Approve / Reject / Send Back | ✓ | ✓ | — |
| View dashboard | ✓ | ✓ | ✓ |
| Export reports | ✓ | ✓ | — |
| View audit logs | ✓ | — | — |

---

## Assessment Lifecycle / State Machine

### Pre-Assessment Capture
Before starting the checklist wizard, the system captures:
- Assessment period (start date — end date)
- Quarter (Q1/Q2/Q3/Q4)
- Type (Internal / External)
- Assessor name(s)
- Assessee name(s)
- Department(s) in scope
- Assessment date/time

### Workflow States

```
                  ┌──────────┐
                  │  DRAFT   │  ← Pre-assessment form filled, not yet started
                  └────┬─────┘
                       │ Begin Checklist
                  ┌────▼──────────────────────────────────────────┐
                  │              IN_PROGRESS                       │
                  │  Assessor fills CLIENT PDF checklist wizard    │
                  │  Section by section, auto-saved every 30s     │
                  │  Can exit mid-way and resume any time         │
                  │  System auto-maps each response → NQAS ME     │
                  │  Unmapped client items → marked N/A           │
                  └────┬──────────────────────────────────────────┘
                       │ Submit (all sections complete)
                  ┌────▼──────┐
                  │ SUBMITTED │  ← Assessor locked out, HOD review queue
                  └────┬──────┘
          ┌────────────┼─────────────┐
          │            │             │
     ┌────▼───┐  ┌─────▼────┐  ┌────▼──────┐
     │APPROVED│  │ REJECTED │  │ SENT_BACK │
     │(final) │  │(closed)  │  │(revision) │
     └────────┘  └──────────┘  └────┬──────┘
                                     │ Assessor edits & resubmits
                                     └──► IN_PROGRESS (again)
```

### State Transition Rules
| Transition | Actor | Notification Sent To |
|---|---|---|
| DRAFT → IN_PROGRESS | Assessor | — |
| IN_PROGRESS → SUBMITTED | Assessor | HOD + Admin |
| SUBMITTED → APPROVED | HOD / Admin | Assessor |
| SUBMITTED → REJECTED | HOD / Admin | Assessor |
| SUBMITTED → SENT_BACK | HOD / Admin | Assessor |
| SENT_BACK → IN_PROGRESS | Assessor | — |
| IN_PROGRESS → SUBMITTED (re-submission) | Assessor | HOD + Admin |

Every state transition:
- Creates an **immutable audit record** (who, when, previous state, new state, remarks)
- Pushes **in-app notification** (Socket.io) instantly
- Queues an **email notification** (BullMQ → Gmail SMTP, non-blocking)
- Approved assessments are **permanently read-only**

---

## Prerequisites

- **Node.js** >= 22.x — https://nodejs.org/en/download
- **pnpm** >= 9.x — `npm install -g pnpm`
- **PostgreSQL 16** — native install (see setup below)
- **Redis** — native install via Memurai on Windows (see setup below)
- **MinIO** — Windows binary (see setup below)
- **Git**

---

## Environment Variables

Copy `.env.example` to `.env` in the repo root. Fill in all values before running.

```bash
cp .env.example .env
```

### `.env.example`

```env
# ── PostgreSQL ─────────────────────────────────────────────
DATABASE_URL=postgresql://nabh_user:nabh_pass@localhost:5432/nabh_db

# ── Redis ──────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── MinIO (file storage) ───────────────────────────────────
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=nabh-docs

# ── JWT ────────────────────────────────────────────────────
JWT_ACCESS_SECRET=change_me_access_secret_32chars_min
JWT_REFRESH_SECRET=change_me_refresh_secret_32chars_min
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ── Email (Gmail SMTP) ─────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_gmail_app_password       # Gmail App Password (not account password)
MAIL_FROM="NQAS Platform <your_gmail@gmail.com>"

# ── App ────────────────────────────────────────────────────
NODE_ENV=development
API_PORT=4000
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=http://localhost:4000

# ── Admin seed ─────────────────────────────────────────────
SEED_ADMIN_EMAIL=admin@hospital.com
SEED_ADMIN_PASSWORD=Admin@1234!
```

> **Gmail App Password setup:** Google Account → Security → 2-Step Verification → App Passwords → Generate for "Mail".

---

## Development Setup

### 1. Clone & Install

```bash
git clone <repo-url> nabh-platform
cd nabh-platform
pnpm install
```

### 2. Install & Start Infrastructure (Postgres, Redis, MinIO)

#### PostgreSQL 16

**Windows (winget):**
```powershell
winget install PostgreSQL.PostgreSQL.16
```
After install, open **pgAdmin 4** (installed automatically) or use psql to create the database and user:
```sql
-- Run in psql as postgres superuser
CREATE USER nabh_user WITH PASSWORD 'nabh_pass';
CREATE DATABASE nabh_db OWNER nabh_user;
GRANT ALL PRIVILEGES ON DATABASE nabh_db TO nabh_user;
```

Verify: `psql -U nabh_user -d nabh_db -c "SELECT version();"`

**Ubuntu/Debian:**
```bash
sudo apt install postgresql-16 postgresql-client-16
sudo -u postgres psql -c "CREATE USER nabh_user WITH PASSWORD 'nabh_pass';"
sudo -u postgres psql -c "CREATE DATABASE nabh_db OWNER nabh_user;"
```

#### Redis

**Windows — Memurai (Redis-compatible Windows native service):**
```powershell
# Download from https://www.memurai.com/get-memurai
# Install → runs as Windows Service automatically
# Verify:
redis-cli ping   # → PONG
```

**Ubuntu/Debian:**
```bash
sudo apt install redis-server
sudo systemctl enable --now redis-server
redis-cli ping   # → PONG
```

#### MinIO (S3-compatible file storage)

**Windows:**
```powershell
# Download the MinIO binary from https://min.io/download#/windows
# Place minio.exe in a folder, e.g. C:\minio\
mkdir C:\minio\data

# Start MinIO (run in a terminal — keep it open, or create a Windows service):
$env:MINIO_ROOT_USER="minioadmin"
$env:MINIO_ROOT_PASSWORD="minioadmin"
C:\minio\minio.exe server C:\minio\data --console-address ":9001"
```

**Ubuntu/Debian:**
```bash
wget https://dl.min.io/server/minio/release/linux-amd64/minio -O /usr/local/bin/minio
chmod +x /usr/local/bin/minio
mkdir -p /opt/minio/data

# Create systemd service for auto-start:
sudo tee /etc/systemd/system/minio.service > /dev/null <<EOF
[Unit]
Description=MinIO
After=network.target

[Service]
User=$USER
Environment=MINIO_ROOT_USER=minioadmin
Environment=MINIO_ROOT_PASSWORD=minioadmin
ExecStart=/usr/local/bin/minio server /opt/minio/data --console-address ":9001"
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable --now minio
```

Access MinIO console: http://localhost:9001 (user: `minioadmin`, pass: `minioadmin`)

### 3. Database Setup

```bash
# Generate Prisma client
pnpm --filter @nabh/database db:generate

# Run migrations (creates all tables)
pnpm --filter @nabh/database db:migrate

# Seed: NQAS checklist from Excel + admin user
pnpm --filter @nabh/database db:seed
```

The seed script (`packages/database/seed/index.ts`) reads `docs/DH-20_NQAS_Toolkit_28-June_2023.xlsx` and inserts all:
- 14 Departments
- 8 Areas of Concern (A–H) per department
- All Standards (A1, A2 ... H1, H2 ...)
- All Measurable Elements with checkpoints, max scores, and assessment methods

Seed also creates the default Admin user from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env`.

### 4. Run Development Servers

**Option A — All at once (recommended):**
```bash
pnpm dev
# Starts both web (port 3000) and api (port 4000) concurrently
```

**Option B — Separately:**
```bash
# Terminal 1 — API
pnpm --filter @nabh/api dev

# Terminal 2 — Frontend
pnpm --filter @nabh/web dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:4000 |
| Swagger Docs | http://localhost:4000/api/docs |
| MinIO Console | http://localhost:9001 |

### 5. Useful Development Commands

```bash
# Open Prisma Studio (visual DB browser)
pnpm --filter @nabh/database db:studio

# Reset DB and re-seed (destructive — dev only)
pnpm --filter @nabh/database db:reset

# Type-check all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Run all tests
pnpm test
```

---

## Uploading the Mapping File (Admin — One-Time Setup)

The mapping file is a **one-time import** done by Admin during initial system setup. It persists permanently and is reused for all future assessments across all quarters.

1. Share `docs/nabh_mapping_template.json` with the client — they fill in each `client*` field
2. Client returns the completed JSON
3. Admin logs in → **Settings → Checklist Mappings → Import Mapping File**
4. Upload — system validates all ME references against the seeded NQAS data
5. All future assessments automatically use this mapping to calculate NQAS district scores from client checkpoint responses
6. Client checkpoints with no NQAS match are permanently marked **N/A** and excluded from the district score denominator
7. **Re-import behaviour (upsert-safe):** If the mapping file is imported again later with updates — new mappings are inserted, existing mappings are updated only if changed, and no existing assessment data is altered. Previously assessed checkpoints retain their original mapping at the time of assessment.

---

## Production Deployment

### Server Requirements (Minimum)

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disk | 40 GB SSD | 80 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### 1. Install Prerequisites on Server

```bash
# Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# pnpm
npm install -g pnpm pm2

# PostgreSQL 16
sudo apt install -y postgresql-16 postgresql-client-16

# Redis
sudo apt install -y redis-server
sudo systemctl enable --now redis-server

# MinIO
wget https://dl.min.io/server/minio/release/linux-amd64/minio -O /usr/local/bin/minio
chmod +x /usr/local/bin/minio
mkdir -p /opt/minio/data

# Create MinIO systemd service
sudo tee /etc/systemd/system/minio.service > /dev/null <<EOF
[Unit]
Description=MinIO
After=network.target

[Service]
User=ubuntu
Environment=MINIO_ROOT_USER=minioadmin
Environment=MINIO_ROOT_PASSWORD=CHANGE_THIS_IN_PRODUCTION
ExecStart=/usr/local/bin/minio server /opt/minio/data --console-address ":9001"
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable --now minio

# nginx + certbot
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 2. Create Database

```bash
sudo -u postgres psql -c "CREATE USER nabh_user WITH PASSWORD 'STRONG_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE nabh_db OWNER nabh_user;"
```

### 3. Clone & Configure

```bash
git clone <repo-url> /opt/nabh-platform
cd /opt/nabh-platform

cp .env.example .env.production
nano .env.production
```

Production `.env.production` changes:
```env
NODE_ENV=production
DATABASE_URL=postgresql://nabh_user:STRONG_PASSWORD@localhost:5432/nabh_db
NEXT_PUBLIC_API_URL=https://your-domain.com/api
NEXT_PUBLIC_WS_URL=https://your-domain.com
JWT_ACCESS_SECRET=<64-char random string>
JWT_REFRESH_SECRET=<64-char random string>
```

Generate strong secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Build & Start with PM2

```bash
cd /opt/nabh-platform
pnpm install

# Run migrations + seed (first deploy only)
pnpm --filter @nabh/database db:migrate:deploy
pnpm --filter @nabh/database db:seed

# Build all apps
pnpm build

# Start API
pm2 start apps/api/dist/main.js --name nabh-api --env production

# Start frontend (Next.js standalone)
pm2 start pnpm --name nabh-web -- --filter @nabh/web start

# Persist PM2 list across reboots
pm2 save
pm2 startup
```

### 5. Configure nginx as Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/nabh
```

```nginx
server {
    server_name your-domain.com www.your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # API + WebSocket
    location /api/ {
        proxy_pass http://localhost:4000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.io WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:4000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/nabh /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. SSL Certificate (HTTPS)

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
# Auto-renew is configured by certbot
```

### 7. Verify Deployment

```bash
# Check PM2 processes
pm2 status

# Tail logs
pm2 logs nabh-api --lines 50
pm2 logs nabh-web --lines 50
```

---

## Database Backups

```bash
# Manual backup
pg_dump -U nabh_user nabh_db > backup_$(date +%Y%m%d).sql

# Restore
psql -U nabh_user nabh_db < backup_20260327.sql

# Automated daily backup (add to crontab)
# crontab -e
0 2 * * * pg_dump -U nabh_user nabh_db > /opt/backups/nabh_$(date +\%Y\%m\%d).sql
```

---

## Zero-Downtime Redeploy

```bash
cd /opt/nabh-platform
git pull origin main
pnpm install
pnpm build
pnpm --filter @nabh/database db:migrate:deploy
pm2 reload nabh-api
pm2 reload nabh-web
```

---

## Security Checklist (Pre-Launch)

- [ ] All `.env.production` secrets are unique and not committed to git
- [ ] `.env*` is in `.gitignore`
- [ ] Strong JWT secrets (64+ chars)
- [ ] HTTPS enforced (certbot SSL live)
- [ ] nginx rate limiting configured
- [ ] MinIO not exposed publicly (bind to 127.0.0.1 or firewall port 9000/9001)
- [ ] PostgreSQL not exposed on public port (listen_addresses = 'localhost' in pg_hba.conf)
- [ ] Redis password set in production (requirepass in redis.conf)
- [ ] Gmail App Password (not Google account password) used
- [ ] Admin seed password changed after first login

---

## Folder Conventions

```
apps/api/src/
├── modules/
│   ├── auth/             # Login, logout, JWT, forgot password
│   ├── users/            # CRUD, RBAC, profile management
│   ├── hospital/         # Settings, logo upload
│   ├── checklists/       # NQAS departments, MEs, checkpoints (seeded)
│   ├── client-docs/      # Client PDF storage + metadata
│   ├── mappings/         # Import & manage JSON mapping file
│   ├── assessments/      # Create, auto-save, submit, state machine
│   ├── approvals/        # HOD approve/reject/sendback
│   ├── scores/           # Score aggregation engine
│   ├── dashboard/        # Trend data, quarterly comparison
│   ├── notifications/    # In-app (Socket.io) + email (BullMQ)
│   ├── exports/          # Excel + PDF report generation
│   └── audit/            # Immutable access + action logs
├── common/
│   ├── guards/           # JwtAuthGuard, RolesGuard
│   ├── decorators/       # @Roles(), @CurrentUser()
│   ├── interceptors/     # AuditInterceptor, TransformInterceptor
│   └── filters/          # GlobalExceptionFilter
└── main.ts

apps/web/src/
├── app/
│   ├── (auth)/           # Login, forgot-password, reset-password
│   ├── (dashboard)/      # Main app layout, dashboard home
│   ├── assessments/      # Wizard + assessment management
│   ├── approvals/        # HOD review queue
│   ├── reports/          # Score reports, exports
│   ├── settings/         # Hospital settings, users, mappings
│   └── profile/          # Edit profile, change password
├── components/
│   ├── ui/               # Shadcn base components
│   ├── wizard/           # Assessment wizard engine
│   ├── charts/           # Score charts (Recharts/Nivo wrappers)
│   └── notifications/    # In-app notification panel
├── hooks/                # Custom React hooks
├── stores/               # Zustand stores
└── lib/                  # API client, utilities, constants
```

---

## Support & Contact

Project: NQAS Accreditation Platform
Version: 1.0.0
Toolkit Reference: DH/NQAS-2020, Revision-00 (June 2023)
"# qps-kimio" 

# 🕷️ SpiderFlow — Cloud Web Scraping SaaS Platform

> **Open for contributors!** I'm actively building this and looking for devs to collaborate. See [How to Contribute](#-how-to-contribute) below.

---

## 🧠 What is SpiderFlow?

SpiderFlow is a **serverless, cloud-native web scraping platform** built as a SaaS product. Instead of managing servers, proxies, or headless browsers yourself — you log in, create a **Room** for your target website, configure your scraping rules, and hit Run.

The platform handles everything else: spinning up cloud workers, rendering JavaScript-heavy pages, rotating IPs via external APIs, exporting your data, and even pushing it directly to your MongoDB database.

---

## ❌ The Problem

Web scraping at scale is genuinely hard:

- **Infrastructure** — You need servers, Docker, queues, and auto-scaling just to start
- **JavaScript rendering** — Most modern sites require a real browser to load content
- **Anti-bot protection** — Cloudflare, CAPTCHAs, IP bans kill naive scrapers instantly
- **Data management** — Getting scraped data into a usable format and storage is messy
- **No good middle ground** — Either you DIY everything or pay $$$ for enterprise tools

---

## ✅ The Solution

SpiderFlow gives teams a **dashboard-driven scraping platform** with:

- 🏠 **Room-based architecture** — 1 Room = 1 target website, fully isolated
- ⚡ **One-click job execution** — Run scraping jobs from inside the room
- 🧩 **Multiple scraping methods** — CSS selectors OR custom Python/JS code
- 🌐 **Provider flexibility** — Internal engine, ScrapingBee, ScraperAPI, or BrightData
- 📦 **Data export** — Download CSV/JSON or push directly to your own MongoDB
- ⏰ **Scheduling** — Set cron-based recurring scrapes (Starter plan+)
- 📊 **Live job monitoring** — Real-time logs streamed to the dashboard

---

## 🏗️ Architecture

```
User Dashboard (Next.js)
        │
        ▼
API Gateway (AWS) ── Cognito Auth
        │
   Lambda Functions
   ├── /rooms     → Room CRUD
   ├── /jobs      → Job trigger + status
   ├── /users     → Plan + usage tracking
   └── /billing   → Razorpay payments
        │
        ▼
   SQS Job Queue
        │
        ▼
ECS Fargate Worker (Docker)
   ├── Scrapy + Playwright (internal engine)
   ├── ScrapingBee / ScraperAPI / BrightData (external)
   └── Custom Code Runner (Python / JS subprocess)
        │
   ┌────┴────┐
   S3        MongoDB
(results)  (user's own DB)
```

**Full AWS serverless stack:**
- Frontend: Next.js 16 → S3 + CloudFront
- Backend: Python Lambda functions
- Database: DynamoDB (Rooms, Jobs, Users)
- Workers: ECS Fargate (Docker containers)
- Queue: SQS (job dispatch)
- Auth: Cognito
- Security: KMS encryption, WAF, DLQ

---

## 🗂️ Project Structure

```
SpiderFlow/
├── frontend/          # Next.js 16 + Tailwind CSS
│   └── src/app/
│       ├── dashboard/
│       │   ├── rooms/         # Room management pages
│       │   │   └── [roomId]/  # Room overview + setup + jobs
│       │   └── billing/       # Razorpay plans
│       └── auth/              # Cognito login/signup
├── backend/
│   └── functions/
│       ├── rooms/     # Room CRUD Lambda
│       ├── jobs/      # Job trigger Lambda
│       ├── users/     # User profile + plan Lambda
│       └── billing/   # Razorpay Lambda
├── worker/
│   ├── consumer.py              # SQS polling + job execution
│   ├── scraping_providers.py    # ScrapingBee / ScraperAPI / BrightData
│   └── spiderflow/spiders/      # Scrapy + Playwright spider
└── infra/
    └── stacks/        # AWS CDK (Python)
        ├── storage_stack.py
        ├── api_stack.py
        ├── worker_stack.py
        ├── queue_stack.py
        ├── scheduler_stack.py
        └── waf_stack.py
```

---

## 💳 Pricing Plans

| Plan | Rooms | Jobs/mo | Pages/mo | Custom Code | MongoDB | Price |
|------|-------|---------|----------|-------------|---------|-------|
| Free Trial | 1 | 10 | 500 | ❌ | ❌ | ₹0 / 7 days |
| Starter | 5 | 100 | 5,000 | ❌ | ✅ | ₹999/mo |
| Pro | 20 | 1,000 | 50,000 | ✅ | ✅ | ₹2,999/mo |
| Enterprise | ∞ | ∞ | ∞ | ✅ | ✅ | ₹9,999/mo |

---

## 🚧 Current Status

The project is **under active development**. Here's what's done and what needs work:

### ✅ Done
- Room-based architecture (DynamoDB schema, API routes)
- Cognito authentication + JWT protection
- Scrapy + Playwright worker (ECS Fargate)
- SQS job queue + Dead Letter Queue
- DLQ CloudWatch alarms
- EventBridge daily scheduler
- CSV/JSON export via S3 pre-signed URLs
- AWS WAF on CloudFront + API Gateway
- KMS encryption for API keys + MongoDB URIs
- Trial system + plan limit enforcement
- Razorpay billing integration (backend)
- CI/CD via GitHub Actions

### 🔶 In Progress / Needs Help
- **Frontend CI/CD build fix** — `generateStaticParams()` needed for dynamic routes
- **Proxy cycling** — Frontend supports it, Scrapy middleware needs completion
- **MongoDB push** — Backend plumbing exists, pymongo logic needs implementation
- **Job live logs** — DynamoDB streaming to frontend needs testing
- **Custom code sandbox** — subprocess runner works, needs security hardening
- **Razorpay frontend** — Checkout popup UI needs wiring to backend

---

## 🤝 How to Contribute

This is an open collaboration — all skill levels welcome. Here's how to jump in:

### 1. Pick an area you're comfortable with

| Area | Skills Needed |
|------|--------------|
| Frontend fixes | Next.js, TypeScript, Tailwind |
| Backend Lambda | Python, boto3, DynamoDB |
| Worker/Scraping | Scrapy, Playwright, Python |
| Infrastructure | AWS CDK, Python |
| Testing | Pytest, Jest |

### 2. Fork and clone

```bash
git clone https://github.com/DEV-GHILDIYAL/SpiderFlow.git
cd SpiderFlow
```

### 3. Frontend setup

```bash
cd frontend
npm install
cp .env.local.example .env.local  # fill in your values
npm run dev
```

### 4. Backend setup

```bash
cd infra
pip install -r requirements.txt
```

### 5. Open an issue or PR

- Check existing issues for tasks
- Comment on an issue before starting work
- Keep PRs focused — one fix/feature per PR

---

## ⚙️ Environment Variables

### Frontend (`.env.local`)
```
NEXT_PUBLIC_API_URL=https://your-api-gateway-url
NEXT_PUBLIC_USER_POOL_ID=your-cognito-pool-id
NEXT_PUBLIC_USER_POOL_CLIENT_ID=your-cognito-client-id
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxx
```

### Backend (Lambda env / AWS Secrets Manager)
```
ROOMS_TABLE=SpiderFlowRooms
JOBS_TABLE=SpiderFlowJobs
USERS_TABLE=SpiderFlowUsers
DATA_BUCKET=your-s3-bucket
JOB_QUEUE_URL=your-sqs-url
KMS_KEY_ID=your-kms-key
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=your-secret
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS v4 |
| Auth | AWS Cognito + Amplify |
| Backend | Python 3.12, AWS Lambda |
| Database | Amazon DynamoDB |
| Storage | Amazon S3 |
| Queue | Amazon SQS |
| Worker | ECS Fargate, Docker, Scrapy, Playwright |
| IaC | AWS CDK (Python) |
| Payments | Razorpay |
| Scraping APIs | ScrapingBee, ScraperAPI, BrightData |
| Security | AWS WAF, KMS, Cognito JWT |

---

## 📬 Contact

Built by [@DEV-GHILDIYAL](https://github.com/DEV-GHILDIYAL)

Found a bug? Open an issue. Want to contribute? Fork it and send a PR. Have questions? Open a discussion.

---

*SpiderFlow — Extract data at scale, without the infrastructure headache.*
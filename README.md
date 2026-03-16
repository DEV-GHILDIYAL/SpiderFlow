# SpiderFlow – Cloud Web Scraping Platform

A distributed, serverless web scraping platform built on AWS. Configure scrapers through a beautiful dashboard, run jobs at scale with ECS Fargate workers, and export structured data — all powered by Scrapy, Playwright, and AWS serverless infrastructure.

## Architecture

```
                    ┌──────────────┐
          HTTPS     │  CloudFront  │     Static Assets
  User ──────────── │  + S3 Front  │ ◄── Next.js Build
                    └──────────────┘
                           │
                    API Requests
                           │
                    ┌──────────────┐
                    │ API Gateway  │
                    │  + Cognito   │
                    └──────┬───────┘
                           │
               ┌───────────┼────────────┐
               │           │            │
        ┌──────┴───┐ ┌─────┴────┐ ┌─────┴─────┐
        │ Sessions │ │   Jobs   │ │ Dashboard │
        │  Lambda  │ │  Lambda  │ │  Lambda   │
        └────┬─────┘ └────┬─────┘ └─────┬─────┘
             │            │              │
        ┌────┴────────────┴──────────────┴────┐
        │             DynamoDB                 │
        │   Sessions Table  │  Jobs Table      │
        └──────────────────┬───────────────────┘
                           │
                    ┌──────┴───────┐
                    │  SQS Queue   │
                    └──────┬───────┘
                           │
                    ┌──────┴───────┐
                    │ ECS Fargate  │
                    │   Worker     │
                    │ Scrapy +     │──── Internet
                    │ Playwright   │
                    └──────┬───────┘
                           │
                    ┌──────┴───────┐
                    │   S3 Data    │
                    │   Bucket     │
                    └──────────────┘
```

## Project Structure

```
SpiderFlow/
├── frontend/          # Next.js web application (TypeScript + Tailwind CSS)
│   └── src/
│       ├── app/       # App Router pages (dashboard, auth, sessions, jobs)
│       ├── components/# Reusable UI components (Sidebar)
│       ├── context/   # React contexts (AuthContext)
│       └── lib/       # API client, Amplify config
│
├── backend/           # Python Lambda functions
│   ├── functions/
│   │   ├── sessions/  # CRUD for scraping sessions
│   │   ├── jobs/      # Job triggering via SQS
│   │   ├── dashboard/ # Aggregated metrics
│   │   └── export/    # Presigned S3 download URLs
│   └── layers/
│       └── shared/    # Shared utilities (response builder, auth helpers)
│
├── worker/            # Scrapy + Playwright scraping engine
│   ├── Dockerfile
│   ├── consumer.py    # SQS consumer (long-polling)
│   └── spiderflow/
│       ├── spiders/   # GenericSpider (configurable via session params)
│       ├── pipelines.py  # S3Pipeline, JobStatusPipeline
│       └── settings.py   # Scrapy + Playwright configuration
│
├── infra/             # AWS CDK (Python) infrastructure
│   ├── app.py         # CDK app entry point
│   └── stacks/
│       ├── cognito_stack.py   # User Pool + App Client
│       ├── storage_stack.py   # DynamoDB + S3
│       ├── queue_stack.py     # SQS + DLQ
│       ├── api_stack.py       # API Gateway + Lambdas
│       └── worker_stack.py    # ECS Fargate + VPC
│
└── .github/workflows/ # CI/CD pipeline
```

## Tech Stack

| Layer          | Technology                                  |
|----------------|---------------------------------------------|
| Frontend       | Next.js, TypeScript, Tailwind CSS           |
| Authentication | AWS Cognito + Amplify                       |
| API            | API Gateway + Lambda (Python 3.12)          |
| Database       | DynamoDB (pay-per-request)                  |
| Queue          | SQS with Dead Letter Queue                  |
| Worker         | ECS Fargate, Scrapy, Playwright, Chromium   |
| Storage        | S3 (with lifecycle policies)                |
| Infrastructure | AWS CDK (Python)                            |
| CI/CD          | GitHub Actions                              |

## Getting Started

### Prerequisites

- Node.js >= 20
- Python >= 3.12
- AWS CLI configured (`~/.aws/credentials`)
- Docker (for worker builds)

### Frontend

```bash
cd frontend
cp .env.local.example .env.local
# Edit .env.local with your Cognito and API values
npm install
npm run dev
```

### Infrastructure

```bash
cd infra
pip install -r requirements.txt
cdk synth --all      # Validate
cdk deploy --all     # Deploy to AWS
```

### Worker (Local Testing)

```bash
cd worker
pip install -r requirements.txt
# Set environment variables: JOB_QUEUE_URL, DATA_BUCKET, JOBS_TABLE
python -m consumer
```

## Environment Variables

### Frontend (`.env.local`)

| Variable                         | Description                    |
|----------------------------------|--------------------------------|
| `NEXT_PUBLIC_USER_POOL_ID`       | Cognito User Pool ID           |
| `NEXT_PUBLIC_USER_POOL_CLIENT_ID`| Cognito App Client ID          |
| `NEXT_PUBLIC_API_URL`            | API Gateway endpoint URL       |

### Worker / Lambda (set via CDK)

| Variable         | Description                  |
|------------------|------------------------------|
| `SESSIONS_TABLE` | DynamoDB sessions table name |
| `JOBS_TABLE`     | DynamoDB jobs table name     |
| `DATA_BUCKET`    | S3 data bucket name          |
| `JOB_QUEUE_URL`  | SQS job queue URL            |

## License

MIT
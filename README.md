# AI Notes for Psychotherapists

A web application for psychotherapists to record therapy sessions, automatically transcribe them, and generate AI-powered insights and summaries.

> **Note:** This project was originally developed by the [MyPraxis](https://mypraxis.ai) team. While the team has moved on to other projects, we're releasing this codebase to the open source community in hopes that others may find it useful, learn from it, or continue its development. We believe this tool has the potential to help psychotherapists and their clients, and we'd love to see it grow in the hands of the community.

## Features

- **Session Recording** - Record therapy sessions directly in the browser with pause/resume support
- **Automatic Transcription** - Convert audio to text using AssemblyAI or Yandex SpeechKit
- **AI-Generated Artifacts** - Automatically generate:
  - Session summaries (for therapist and client)
  - Client prep notes for upcoming sessions
  - Case conceptualization documents
  - Client biographical summaries
- **Client Management** - Organize clients with profiles, contact info, and session history
- **Therapist Profiles** - Configure therapeutic approaches (CBT, EMDR, DBT, IFS, and more)
- **Multi-language Support** - Interface available in English and Russian
- **Privacy-First** - All data stays in your own Supabase instance

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 (App Router), TypeScript, React 19 |
| UI | Shadcn UI, Tailwind CSS, Radix UI |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| AI | OpenAI GPT / Google Gemini via LangChain |
| Transcription | AssemblyAI, Yandex SpeechKit |
| Queue | AWS SQS |
| Storage | AWS S3 |
| Monorepo | Turborepo + pnpm |

## Project Structure

```
apps/
├── web/          # Next.js web application
├── bg/           # Background worker (transcription, AI processing)
├── e2e/          # End-to-end tests (Playwright)
└── dev-tool/     # Development utilities

packages/
├── ui/           # Shared UI components
├── supabase/     # Database types and utilities
├── features/     # Feature modules (auth, accounts, etc.)
├── billing/      # Payment integration
├── i18n/         # Internationalization
└── ...           # Other shared packages
```

## Prerequisites

- Node.js 18.18.0 or higher
- pnpm 9.x
- Docker (for local Supabase)
- Accounts for external services:
  - [Supabase](https://supabase.com) (database, auth, storage)
  - [AWS](https://aws.amazon.com) (S3, SQS)
  - [OpenAI](https://openai.com) or [Google AI](https://ai.google.dev) (AI generation)
  - [AssemblyAI](https://assemblyai.com) (transcription)

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/MyPraxisAI/mypraxis-webapp.git
cd mypraxis-webapp
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

```bash
# Copy example env files
cp apps/web/.env.example apps/web/.env.local
cp apps/bg/.env.example apps/bg/.env.local

# Edit the files with your credentials
```

### 4. Start local Supabase

```bash
pnpm supabase:web:start
```

### 5. Run database migrations

```bash
pnpm db:migrate
```

### 6. Generate TypeScript types

```bash
pnpm supabase:web:typegen
```

### 7. Start development server

```bash
pnpm dev
```

The app will be available at `http://localhost:3000`

## Environment Variables

### Web Application (`apps/web/.env.local`)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Providers
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...

# AWS (for background tasks queue)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
BACKGROUND_TASKS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/...

# Optional: HTTP Basic Auth for staging
ENABLE_BASIC_AUTH=false
BASIC_AUTH_USERNAME=
BASIC_AUTH_PASSWORD=
```

### Background Worker (`apps/bg/.env.local`)

```bash
# Supabase
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Providers
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/...
S3_BUCKET_NAME=your-recordings-bucket

# Transcription
ASSEMBLYAI_API_KEY=...
```

## Available Scripts

```bash
# Development
pnpm dev              # Start all apps in development mode
pnpm webdev           # Start only web app
pnpm bgdev            # Start background worker with Docker

# Database
pnpm db:reset         # Reset local database
pnpm db:migrate       # Run migrations
pnpm db:test          # Run database tests
pnpm supabase:web:typegen  # Generate TypeScript types

# Code Quality
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix linting issues
pnpm typecheck        # Run TypeScript checks
pnpm format           # Check formatting
pnpm format:fix       # Fix formatting

# Production
pnpm build            # Build all apps
pnpm prod:db:deploy   # Deploy database to production
pnpm prod:bg:deploy   # Deploy background worker
```

## Architecture

### Data Flow

1. **Recording**: User records audio in browser -> chunks uploaded to S3
2. **Transcription**: Background worker picks up job from SQS -> sends to transcription service -> saves transcript to database
3. **AI Processing**: After transcription, worker generates artifacts using LLM -> saves to database
4. **Display**: Web app fetches and displays transcripts and artifacts

### Database Schema

Key tables:
- `therapists` - Therapist profiles linked to accounts
- `clients` - Client records belonging to therapists
- `sessions` - Therapy sessions with transcripts and notes
- `recordings` - Audio recording metadata and status
- `transcripts` - Transcribed text with speaker segments
- `artifacts` - AI-generated content (summaries, notes, etc.)

All tables use Row Level Security (RLS) to ensure data isolation.

## Deployment

### Web Application

Deploy to Vercel:

```bash
vercel --prod
```

Or use any Node.js hosting platform that supports Next.js.

### Background Worker

The background worker can be deployed to:
- AWS ECS (Terraform configs included in `apps/bg/terraform/`)
- Any Docker-compatible hosting

### Database

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Link your local project:
   ```bash
   supabase link --project-ref your-project-ref
   ```
3. Deploy migrations:
   ```bash
   pnpm prod:db:deploy
   ```

## Contributing

Contributions are welcome! This project is looking for new maintainers and contributors who are passionate about building tools for mental health professionals.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Ideas for Future Development

- Mobile app (React Native)
- Real-time transcription during sessions
- Integration with calendar apps
- HIPAA compliance documentation
- More AI-powered insights and analytics
- Support for additional languages

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Credits

Originally created by the [MyPraxis](https://mypraxis.ai) team.

## Acknowledgments

- Built with [Supabase](https://supabase.com)
- UI components from [Shadcn UI](https://ui.shadcn.com)
- Transcription powered by [AssemblyAI](https://assemblyai.com)

---
name: klient-codebase
description: Use this skill when working on the Klient codebase - covers project structure, tech stack, build/run commands, folder layout, and development conventions. Essential for any development task.
---

# Klient Codebase Structure

## Project Overview

Klient is a **local-first Electron desktop application** for Hungarian freelancers and small agencies. It combines project management, time tracking, client management, and financial tools with deep integrations into Hungarian business services (Billingo invoicing, NAV tax compliance).

**Current Version:** 1.0.5
**Target Platform:** Windows (primary), macOS and Linux (planned)
**Language:** Hungarian

---

## Tech Stack

### Core
- **Desktop Runtime:** Electron 41.0
- **Frontend Framework:** React 19.2 + TypeScript 5.9
- **Build Tool:** Vite 7.3
- **Package Manager:** npm

### UI & Styling
- **CSS Framework:** Tailwind CSS 4.2
- **Icons:** Lucide React 0.577
- **Rich Text Editor:** Tiptap 3.20

### Database
- **Local:** SQL.js 1.14 (SQLite in WebAssembly)
- **Cloud:** Supabase PostgreSQL (subscriptions only)

### State Management
- **Global State:** Zustand 5.0
- **Context:** React Context (auth, subscription, theme)
- **Routing:** React Router DOM 7.13

### Cloud Services
- **Auth & Backend:** Supabase 2.83
- **Payments:** Stripe (currently test mode)
- **Invoicing:** Billingo API v3
- **AI:** OpenAI API, Deepgram API (via Supabase Edge Functions)

---

## Project Structure

```
klient/
├── src/                          # React application source
│   ├── App.tsx                   # Main app component with routing
│   ├── main.tsx                  # React entry point
│   ├── index.css                 # Tailwind CSS styles
│   ├── pages/                    # Page components
│   │   ├── Dashboard.tsx         # Main dashboard
│   │   ├── Clients.tsx           # Client list
│   │   ├── ClientDetail.tsx      # Client detail view
│   │   ├── Projects.tsx          # Project list
│   │   ├── ProjectDetail.tsx     # Project detail view
│   │   ├── Calendar.tsx          # Calendar view
│   │   ├── Files.tsx             # File explorer
│   │   ├── Finances.tsx          # Financial tracking
│   │   ├── Settings.tsx          # User settings
│   │   ├── Onboarding.tsx        # Onboarding flow
│   │   ├── Recordings.tsx        # Audio recordings
│   │   ├── Notes.tsx             # Notes page
│   │   └── Shortcuts.tsx         # File shortcuts
│   ├── components/               # Reusable components
│   │   ├── Layout.tsx            # Main layout wrapper
│   │   ├── Sidebar.tsx           # Navigation sidebar
│   │   ├── TitleBar.tsx          # Custom title bar
│   │   ├── Paywall.tsx           # Subscription paywall
│   │   ├── TrialBanner.tsx       # Trial expiration banner
│   │   ├── UpdateBanner.tsx      # App update notification
│   │   ├── PomodoroTimer.tsx     # Pomodoro timer
│   │   ├── NotesPanel.tsx        # Notes editor panel
│   │   └── [modals]              # Various modal components
│   ├── contexts/                 # React contexts
│   │   ├── AuthContext.tsx       # Supabase auth
│   │   ├── SubscriptionContext.tsx # Stripe subscription
│   │   └── ThemeContext.tsx      # Dark/light theme
│   └── utils/                    # Utility functions
│
├── electron/                     # Electron main process
│   ├── main.ts                   # Main process entry point
│   ├── database.ts               # SQLite database management
│   ├── db-helpers.ts             # Database helper functions
│   ├── ipc.ts                    # IPC handlers
│   ├── preload.ts                # Preload script (contextBridge)
│   ├── supabase.ts               # Supabase client (Node.js)
│   ├── pdf-generator.ts          # Contract PDF generation
│   └── contract-templates.ts     # Contract templates
│
├── supabase/                     # Supabase Edge Functions
│   ├── functions/
│   │   ├── create-checkout/      # Stripe checkout creation
│   │   ├── stripe-webhook/       # Stripe webhook handler
│   │   ├── manage-subscription/  # Subscription management
│   │   ├── transcribe/           # Deepgram audio transcription
│   │   ├── summarize/            # OpenAI summarization
│   │   ├── invoice-extract/      # OpenAI invoice extraction
│   │   └── get-deepgram-key/     # Deepgram API key retrieval
│   ├── subscriptions.sql         # Subscriptions table schema
│   └── subscription-functions.sql # Database functions
│
├── assets/                       # Application assets
│   ├── icon.ico                  # Windows icon
│   ├── icon.png                  # Linux icon
│   └── icon.icns                 # macOS icon
│
├── klient.work/                  # Landing page (Next.js)
│   └── [landing page source]
│
├── build/                        # Build artifacts
├── dist-react/                   # Built React app
├── dist-electron/                # Built Electron main process
├── release/                      # Packaged installers
│
├── package.json                  # Project dependencies
├── tsconfig.json                 # TypeScript config (React)
├── tsconfig.electron.json        # TypeScript config (Electron)
├── vite.config.ts                # Vite config
├── .env                          # Environment variables (LOCAL ONLY)
└── README.md                     # Project readme
```

---

## How to Build & Run

### Prerequisites
- Node.js 18+ (with npm)
- Git

### Setup

```bash
# Clone repository
git clone https://github.com/christopherkondora/klient-app.git
cd klient

# Install dependencies
npm install
```

### Development

```bash
# Run React dev server + Electron
npm run dev

# This runs two processes in parallel:
# 1. React dev server (Vite) on http://localhost:5173
# 2. Electron window (waits for Vite, then launches)
```

### Building

```bash
# Build React app + Electron main process
npm run build

# Package for distribution (Windows NSIS installer)
npm run dist

# Output: release/Klient Setup 1.0.5.exe
```

### Testing

**Currently:** No automated tests (unit or E2E)

**Recommendation:** Add Vitest for unit tests, Playwright for E2E tests

---

## Local Database Schema

**Database File:** `%APPDATA%/klient/klient.db` (Windows)

**Tables:**
1. **clients** - Customer contacts
2. **projects** - Projects linked to clients
3. **calendar_events** - Deadlines and meetings
4. **notes** - Rich text notes (Tiptap JSON)
5. **recordings** - Audio recordings + transcripts
6. **time_entries** - Time tracking per project
7. **expenses** - Expense tracking
8. **revenues** - Manual revenue tracking
9. **shortcuts** - User-defined folder shortcuts
10. **contracts** - Generated contract PDFs

**Migrations:** Handled in `electron/database.ts` → `runMigrations()`

---

## Environment Variables

**Local (.env) - NOT committed to Git:**
```bash
SUPABASE_URL=https://arbhhltbjovuxwvfcnni.supabase.co
SUPABASE_ANON_KEY=sb_publishable_...
OPENAI_API_KEY=sk-proj-...
DEEPGRAM_API_KEY=...
```

**Supabase Secrets (stored in Supabase Dashboard):**
- `STRIPE_SECRET_KEY` (currently test: `sk_test_...`)
- `STRIPE_WEBHOOK_SECRET`
- `BILLINGO_API_KEY`
- `OPENAI_API_KEY`
- `DEEPGRAM_API_KEY`

---

## Development Conventions

### TypeScript
- **Strict mode enabled**
- Avoid `any` types
- Use interfaces for props, types for unions

### React
- **Functional components only** (no class components)
- Use hooks (useState, useEffect, useContext)
- Custom hooks in `src/utils/`

### Styling
- **Tailwind utility classes** (no CSS modules or styled-components)
- Custom colors defined in Tailwind config:
  - `ink` (dark blue-black background)
  - `teal` (primary accent color)
  - `cream` (light text)
  - `steel` (medium gray)
  - `ash` (lighter gray)

### File Naming
- Components: PascalCase (e.g., `ClientDetail.tsx`)
- Utilities: camelCase (e.g., `formatDate.ts`)
- Pages: PascalCase (e.g., `Dashboard.tsx`)

### Git Workflow
- **Main branch:** `main`
- **Feature branches:** `feature/stripe-production`, `fix/database-migration`
- **Commit messages:** Conventional Commits style (`feat:`, `fix:`, `chore:`)

---

## Common Commands

```bash
# Start development
npm run dev

# Build production
npm run build

# Package installer
npm run dist

# Deploy Supabase Edge Functions
cd supabase
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook
```

---

## Key Files to Know

### Electron
- **`electron/main.ts`** - Main process entry, window creation, SQLite initialization
- **`electron/ipc.ts`** - All IPC handlers (database CRUD, file operations)
- **`electron/database.ts`** - SQLite schema, migrations, save/load logic

### React
- **`src/App.tsx`** - Routing, auth guards, paywall logic
- **`src/contexts/AuthContext.tsx`** - Supabase auth state
- **`src/contexts/SubscriptionContext.tsx`** - Stripe subscription state, payment flow

### Supabase
- **`supabase/functions/stripe-webhook/index.ts`** - Handles Stripe webhooks, creates Billingo invoices
- **`supabase/functions/create-checkout/index.ts`** - Creates Stripe checkout sessions

---

## Important Notes

1. **Local-First Architecture:** Most data lives in SQLite on user's machine, NOT in the cloud. Only auth + subscriptions are in Supabase.

2. **IPC Communication:** React communicates with Electron via `window.electron.*` (defined in `electron/preload.ts`)

3. **Auto-Save:** SQLite changes are auto-saved to disk after each operation via `saveDb()`

4. **Test Mode:** Both Stripe and Billingo are currently in test mode. See `billingo-integration` and `stripe-integration` skills for production readiness checklists.

5. **Hungarian Only:** All UI strings are currently hardcoded in Hungarian. No i18n library yet.

6. **Windows-Focused:** NSIS installer, icon embedding tested on Windows only. macOS and Linux builds exist in config but not tested.

---

## Troubleshooting

### Database not found
- Check `%APPDATA%/klient/` directory exists
- SQLite file is created automatically on first run

### Supabase connection error
- Verify `.env` file exists and has correct `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- Check network connection

### Build fails
- Run `npm install` to ensure all dependencies are installed
- Clear `dist-react` and `dist-electron` folders and rebuild

### Electron window doesn't open
- Check React dev server is running on port 5173
- Check console for errors in terminal

---

## Next Steps for Development

See architecture document ([KLIAA-5](/KLIAA/issues/KLIAA-5)) for technical debt analysis and roadmap.

**Immediate priorities:**
1. Move Stripe to production ([KLIAA-4](/KLIAA/issues/KLIAA-4))
2. Move Billingo to production ([KLIAA-3](/KLIAA/issues/KLIAA-3))
3. Add error monitoring (Sentry)
4. Add data backup/export functionality

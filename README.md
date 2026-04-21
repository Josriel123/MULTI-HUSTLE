# 💸 Multi-Hustle Tax Dashboard

> A full-stack financial dashboard built for gig workers and multi-income earners — tracking freelance, delivery, and student finances with real-time tax optimization.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4-38bdf8?logo=tailwindcss)
![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF?logo=clerk)
![Plaid](https://img.shields.io/badge/Banking-Plaid-00D64F)

---

## 🧠 Overview

The **Multi-Hustle Tax Dashboard** is a SaaS-style financial tool designed for people juggling multiple income streams — freelance development, gig delivery work, investments, and student finances. It connects to real bank accounts via Plaid, automatically categorizes transactions, and calculates your true "safe-to-spend" net income after estimated tax liability.

Built with the modern full-stack: **Next.js App Router**, **Prisma ORM**, **PostgreSQL**, and **Clerk authentication**.

---

## ✨ Features

- **📊 Real-Time Dashboard** — Visualizes gross income, true net income, and estimated tax liability with an animated area chart
- **🏦 Plaid Bank Integration** — Connect live bank/gig accounts to sync transactions automatically
- **🧾 Tax Deduction Tracker** — Log freelance hardware purchases, home office deductions, and mileage
- **🎓 Student Finance Module** — Supports Form 1098-T (tuition) and Form 1098-E (student loan interest)
- **🏠 Home Office Deduction Calculator** — Square footage-based deduction estimation
- **📤 CPA Export** — Generate printer-friendly tax organizer reports
- **🔐 Auth via Clerk** — Secure, session-based authentication with user profiles

---

## 🛠️ Tech Stack

| Layer       | Technology                              |
|-------------|------------------------------------------|
| Framework   | Next.js 16 (App Router)                  |
| Language    | TypeScript 5                             |
| Styling     | Tailwind CSS 4                           |
| Database    | PostgreSQL (via Neon) + SQLite (dev)     |
| ORM         | Prisma 5                                 |
| Auth        | Clerk                                    |
| Banking API | Plaid                                    |
| Charts      | Recharts                                 |
| Icons       | Lucide React                             |

---

## 🗂️ Project Structure

```
src/
├── app/
│   ├── page.tsx          # Main dashboard (overview)
│   ├── deductions/       # Tax deduction logger
│   ├── student/          # 1098-T & 1098-E forms
│   ├── office/           # Home office deduction calculator
│   ├── export/           # CPA report exporter
│   └── api/              # API routes (dashboard, Plaid, transactions)
├── components/           # Shared UI components (PlaidLinkButton, etc.)
└── lib/                  # Prisma client, utilities
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A [Neon](https://neon.tech) or PostgreSQL database
- A [Plaid](https://plaid.com/docs/quickstart/) developer account (Sandbox)
- A [Clerk](https://clerk.com) application

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/tax-dashboard.git
cd tax-dashboard
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the root:

```env
# Database
DATABASE_URL="postgresql://..."

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Plaid
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_sandbox_secret
PLAID_ENV=sandbox
```

### 4. Set Up the Database

```bash
npx prisma generate
npx prisma db push
```

Optionally seed the database with demo data:

```bash
npx ts-node prisma/seed.ts
```

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## 📸 Pages & Modules

| Route         | Description                                           |
|---------------|-------------------------------------------------------|
| `/`           | Main dashboard — income overview, chart, gig breakdown |
| `/deductions` | Log freelance hardware & delivery mileage             |
| `/student`    | Enter Form 1098-T / 1098-E data                       |
| `/office`     | Home office deduction calculator                      |
| `/export`     | Download/print CPA-ready tax organizer                |

---

## 🗄️ Database Schema

Key models in `prisma/schema.prisma`:

- **`User`** — Core user linked to all financial data
- **`IncomeSource`** — Tagged income streams (Freelance, Delivery, Other)
- **`Transaction`** — Income/expense entries with `taxDeductible` flag
- **`PlaidConnection`** — Stores secure Plaid access tokens
- **`Form1098T`** / **`Form1098E`** — Student tax form data
- **`HomeOfficeDeduction`** — Square footage and rent/utility inputs

---

## 📦 Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Create production build
npm run start    # Run production server
npm run lint     # Lint with ESLint
```

---

## 🔮 Roadmap

- [ ] Uber/DoorDash API integration for automatic mileage sync
- [ ] Quarterly estimated tax reminder notifications
- [ ] AI-powered deduction suggestions
- [ ] Multi-year tax history comparisons
- [ ] Mobile-responsive layout improvements

---

## 📄 License

This project is for educational and portfolio purposes.

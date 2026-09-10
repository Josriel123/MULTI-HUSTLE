import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Seeds demo data for ONE user.
 *
 * Run with:
 *   SEED_USER_ID=user_xxxxx npx tsx prisma/seed.ts
 *
 * Get your Clerk id from the Clerk dashboard, or from `auth()` in any route.
 *
 * Two things the previous version got wrong:
 *
 * 1. It created its user with an auto-generated cuid. Every query in the app
 *    filters on the Clerk id from `auth()`, and a cuid can never match one — so
 *    the seeded rows were invisible to any signed-in user.
 *
 * 2. It called `deleteMany()` with no filter on User, IncomeSource and
 *    Transaction, wiping every user in the database rather than just the demo
 *    account. Deletes here are scoped to SEED_USER_ID.
 */

const TAX_YEAR = new Date().getFullYear()

async function main() {
  const userId = process.env.SEED_USER_ID

  if (!userId) {
    console.error(
      'SEED_USER_ID is required.\n\n' +
        '  SEED_USER_ID=user_xxxxx npx tsx prisma/seed.ts\n\n' +
        'This is your Clerk user id (starts with "user_"). Seeding under any\n' +
        'other id creates rows the app can never read.'
    )
    process.exit(1)
  }

  if (!userId.startsWith('user_')) {
    console.error(
      `SEED_USER_ID="${userId}" does not look like a Clerk id (expected "user_..."). ` +
        'Refusing to seed unreadable data.'
    )
    process.exit(1)
  }

  console.log(`Seeding demo data for ${userId} (tax year ${TAX_YEAR})...`)

  // Scoped to this user only.
  await prisma.transaction.deleteMany({ where: { userId } })
  await prisma.incomeSource.deleteMany({ where: { userId } })

  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      name: 'Demo User',
      email: `${userId}@placeholder.local`,
    },
  })

  const freelance = await prisma.incomeSource.create({
    data: { name: 'Freelance Dev Income', type: 'Freelance', userId },
  })
  const delivery = await prisma.incomeSource.create({
    data: { name: 'Delivery Gig Income', type: 'Delivery', userId },
  })
  const trading = await prisma.incomeSource.create({
    data: { name: 'Trading & Investments', type: 'Other', userId },
  })

  // Dates land inside the current tax year so year-scoped queries pick them up.
  // The old fixtures were dated 2023 and were filtered out everywhere.
  const day = (month: number, dayOfMonth: number) =>
    new Date(Date.UTC(TAX_YEAR, month - 1, dayOfMonth))

  await prisma.transaction.createMany({
    data: [
      {
        amount: 18400,
        type: 'Income',
        date: day(5, 1),
        description: 'Contract Work',
        userId,
        incomeSourceId: freelance.id,
      },
      {
        amount: 2200,
        type: 'Expense',
        date: day(5, 5),
        description: 'Hardware written off',
        taxDeductible: true,
        userId,
        incomeSourceId: freelance.id,
      },
      {
        amount: 5650,
        type: 'Income',
        date: day(6, 1),
        description: 'Uber payouts',
        userId,
        incomeSourceId: delivery.id,
      },
      {
        amount: 11950,
        type: 'Income',
        date: day(7, 1),
        description: 'Stock Sales',
        userId,
        incomeSourceId: trading.id,
      },
    ],
  })

  const totals = await prisma.transaction.groupBy({
    by: ['type'],
    where: { userId },
    _sum: { amount: true },
  })
  totals.forEach((t) => console.log(`  ${t.type}: ${t._sum.amount}`))
  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

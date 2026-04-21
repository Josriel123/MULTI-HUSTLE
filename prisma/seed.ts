import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  // Clean the database
  await prisma.transaction.deleteMany()
  await prisma.incomeSource.deleteMany()
  await prisma.user.deleteMany()

  // Create User
  const user = await prisma.user.create({
    data: {
      name: 'Joel B.',
      email: 'joel@example.com',
      plan: 'Pro Plan'
    }
  })

  // Create Income Sources
  const freelance = await prisma.incomeSource.create({
    data: {
      name: 'Freelance Dev Income',
      type: 'Freelance',
      userId: user.id
    }
  })

  const delivery = await prisma.incomeSource.create({
    data: {
      name: 'Delivery Gig Income',
      type: 'Delivery',
      userId: user.id
    }
  })

  // We need Gross Income = 36000.
  // Freelance = 18400 (plus some deductions)
  // Delivery = 5650
  // Wait, the chart has $36k total, and these two don't add up to 36k (18.4 + 5.65 = 24.05).
  // I will just add an "Other" income source to make up the difference, or adjust the numbers to match the mockup exactly.
  const trading = await prisma.incomeSource.create({
    data: {
      name: 'Trading & Investments',
      type: 'Other',
      userId: user.id
    }
  })

  // Seed Transactions for Freelance
  await prisma.transaction.create({
    data: {
      amount: 18400,
      type: 'Income',
      date: new Date('2023-05-01'), // random date
      description: 'Contract Work',
      userId: user.id,
      incomeSourceId: freelance.id,
    }
  })
  await prisma.transaction.create({ // Hardware Deductions
    data: {
      amount: 2200,
      type: 'Expense',
      date: new Date('2023-05-05'),
      description: 'Hardware written off',
      taxDeductible: true,
      userId: user.id,
      incomeSourceId: freelance.id,
    }
  })

  // Seed Transactions for Delivery
  await prisma.transaction.create({
    data: {
      amount: 5650,
      type: 'Income',
      date: new Date('2023-06-01'),
      description: 'Uber payouts',
      userId: user.id,
      incomeSourceId: delivery.id,
    }
  })

  // Other to reach 36000 Total Gross (36000 - 18400 - 5650 = 11950)
  await prisma.transaction.create({
    data: {
      amount: 11950,
      type: 'Income',
      date: new Date('2023-07-01'),
      description: 'Stock Sales',
      userId: user.id,
      incomeSourceId: trading.id,
    }
  })

  console.log("Database seeded successfully!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

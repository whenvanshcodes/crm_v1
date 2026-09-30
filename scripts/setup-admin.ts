import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import * as readline from 'readline'

const db = new PrismaClient()

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close()
      resolve(ans.trim())
    })
  )
}

async function setupAdmin() {
  const existingAdmin = await db.user.findFirst({
    where: { role: 'SUPER_ADMIN' }
  })

  if (existingAdmin) {
    console.log('Super Admin already exists.')
    console.log(`Active Admin Email: ${existingAdmin.email}`)
    return
  }

  console.log('--- Setup Super Admin ---')
  const name =
    process.env.ADMIN_NAME ||
    (await askQuestion('Enter Admin Name (e.g. Platform Admin): ')) ||
    'Platform Admin'
  const email =
    process.env.ADMIN_EMAIL ||
    (await askQuestion('Enter Admin Email: ')) ||
    'admin@parlour.local'
  const password =
    process.env.ADMIN_PASSWORD ||
    (await askQuestion('Enter Admin Password: ')) ||
    'AdminPass123!'

  if (!email || !password) {
    console.error('Email and password are required.')
    process.exit(1)
  }

  const passwordHash = await hash(password, 12)

  const admin = await db.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE'
    }
  })

  console.log(`✓ Super Admin created successfully: ${admin.email}`)
}

setupAdmin()
  .catch((err) => {
    console.error('Failed to setup admin:', err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())

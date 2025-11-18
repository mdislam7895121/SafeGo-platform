import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verifyUsers() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        endsWith: "@demo.com"
      }
    },
    select: {
      email: true,
      role: true,
      countryCode: true,
    },
    orderBy: [
      { role: 'asc' },
      { countryCode: 'asc' }
    ]
  });

  console.log("\n📋 DEMO ACCOUNTS FOR TESTING\n");
  console.log("┌─────────────┬─────────┬─────────────────────────┬──────────┐");
  console.log("│ Role        │ Country │ Email                   │ Password │");
  console.log("├─────────────┼─────────┼─────────────────────────┼──────────┤");
  
  users.forEach(user => {
    console.log(`│ ${user.role.padEnd(11)} │ ${user.countryCode.padEnd(7)} │ ${user.email.padEnd(23)} │ demo123  │`);
  });
  
  console.log("└─────────────┴─────────┴─────────────────────────┴──────────┘\n");
}

verifyUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

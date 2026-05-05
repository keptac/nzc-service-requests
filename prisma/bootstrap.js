const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const roles = [
  "Super Admin",
  "Union President",
  "Union Secretary",
  "Union Admin",
  "Conference President",
  "Conference Secretary",
  "Conference Admin",
  "Conference Pastor",
  "District Coordinator",
  "District Pastor",
  "Church Clerk",
  "Assistant Church Clerk",
  "Church Elder"
];

const requestTypes = ["Music Group", "Preaching Assignment", "Training", "Other"];

function isPlaceholder(value) {
  return !value || value.includes("replace-with") || value.endsWith("@example.org");
}

async function main() {
  for (const name of roles) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, description: `${name} role` }
    });
  }

  for (const name of requestTypes) {
    await prisma.serviceRequestType.upsert({
      where: { name },
      update: { active: true },
      create: { name, active: true }
    });
  }

  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const adminName = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "System Administrator";

  if (!adminEmail || !adminPassword) {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      throw new Error(
        "No users exist. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD for the first production deploy."
      );
    }
    console.log("Bootstrap admin not configured; set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD if needed.");
    return;
  }

  if (isPlaceholder(adminEmail) || isPlaceholder(adminPassword)) {
    throw new Error("Replace BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD before deploying.");
  }

  if (adminPassword.length < 8) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters.");
  }

  const role = await prisma.role.findUniqueOrThrow({ where: { name: "Super Admin" } });
  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (existingUser) {
    await prisma.user.update({
      where: { email: adminEmail },
      data: {
        name: adminName,
        roleId: role.id,
        active: true
      }
    });
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        roleId: role.id,
        active: true,
        name: adminName
      }
    });
  }

  console.log(`Bootstrap admin ready: ${adminEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

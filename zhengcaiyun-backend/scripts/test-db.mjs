import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting DB verification...');

    // 1. Create User
    const email = `test_${Date.now()}@example.com`;
    console.log(`Creating user: ${email}`);

    const user = await prisma.user.create({
        data: {
            email,
            password: 'hashed_password_123',
            name: 'Test User',
            companyName: 'Test Company Ltd',
            creditCode: '91330100MA27XXXXXX',
            phone: '13800138000'
        }
    });
    console.log('User created:', user.id);

    // 2. Create License
    const licenseKey = `TEST-${Date.now()}`;
    console.log(`Creating license: ${licenseKey}`);

    const license = await prisma.license.create({
        data: {
            key: licenseKey,
            companyName: user.companyName,
            plan: 'professional',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            userId: user.id,
            status: 'active'
        }
    });
    console.log('License created:', license.key);

    // 3. Verify License
    const foundLicense = await prisma.license.findUnique({
        where: { key: licenseKey },
        include: { user: true }
    });

    if (foundLicense && foundLicense.user.email === email) {
        console.log('✅ Verification SUCCESS: License linked to User correctly.');
    } else {
        console.error('❌ Verification FAILED: License not found or not linked.');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

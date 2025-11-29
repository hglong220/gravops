import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

function generateNewKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const segments = 5;
    const segmentLength = 4;
    let parts = [];
    for (let i = 0; i < segments; i++) {
        let segment = '';
        const bytes = randomBytes(segmentLength);
        for (let j = 0; j < segmentLength; j++) {
            segment += chars[bytes[j] % chars.length];
        }
        parts.push(segment);
    }
    return parts.join('-');
}

async function main() {
    console.log('Starting license key migration...');
    const licenses = await prisma.license.findMany();

    for (const license of licenses) {
        // Check if key is already in new format (approximate check: 24 chars and 4 dashes)
        if (license.key.length === 24 && license.key.split('-').length === 5) {
            continue;
        }

        const newKey = generateNewKey();
        await prisma.license.update({
            where: { id: license.id },
            data: { key: newKey }
        });
        console.log(`Updated license ${license.id}: ${license.key} -> ${newKey}`);
    }
    console.log('Migration complete.');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());

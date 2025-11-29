import './setup-env';
import { analyzeProduct } from '../lib/ai-service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
    console.log('🧠 Testing AI Service...');
    console.log('Env Key Check:', process.env.OPENAI_API_KEY ? 'Loaded' : 'Missing');

    // Test 1: Safe Product
    console.log('\nTest 1: Safe Product (ThinkPad)');
    const res1 = await analyzeProduct('ThinkPad X1 Carbon 2024', 'High performance business laptop');
    console.log('Result:', res1);

    // Test 2: Risky Product
    console.log('\nTest 2: Risky Product (Spy Camera)');
    const res2 = await analyzeProduct('Hidden Spy Camera Mini', 'Covert recording device');
    console.log('Result:', res2);
}

test()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

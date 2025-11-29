import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import OpenAI from 'openai';

puppeteer.use(StealthPlugin());

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthUser(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { url, region } = await request.json();
        if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 });

        // 1. Crawl the page
        console.log(`[Rule Crawler] Crawling: ${url}`);
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Extract text (Heuristic for ZCY help pages)
        const textContent = await page.evaluate(() => {
            // Try common content selectors
            const content = document.querySelector('.article-content, .help-detail, .notice-content, .main-content')
                || document.body;
            return content.innerText;
        });

        await browser.close();

        if (!textContent || textContent.length < 50) {
            return NextResponse.json({ error: 'Failed to extract content or content too short' }, { status: 400 });
        }

        // 2. AI Extract Rules
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "You are a compliance rule extractor. Extract key prohibited items, forbidden words, and mandatory requirements from the text. Return a list of clear, concise rules."
                },
                {
                    role: "user",
                    content: `Text:\n${textContent.substring(0, 8000)}` // Limit context
                }
            ]
        });

        const extractedRulesText = completion.choices[0].message.content || '';
        const rules = extractedRulesText.split('\n').filter(line => line.trim().length > 0);

        // 3. Save to DB
        const savedRules = [];
        for (const ruleContent of rules) {
            const cleanContent = ruleContent.replace(/^[-*•\d.]+\s*/, '').trim(); // Remove bullets
            if (cleanContent) {
                const rule = await prisma.complianceRule.create({
                    data: {
                        content: cleanContent,
                        region: region || 'Global',
                        isEnabled: true
                    }
                });
                savedRules.push(rule);
            }
        }

        return NextResponse.json({ success: true, count: savedRules.length, rules: savedRules });

    } catch (error) {
        console.error('[Rule Crawler] Error:', error);
        return NextResponse.json({ error: 'Crawler failed: ' + (error as Error).message }, { status: 500 });
    }
}
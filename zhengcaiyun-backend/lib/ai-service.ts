import OpenAI from 'openai';
import axios from 'axios';
import { prisma } from './prisma';
import { getAIConfig, AIProviderConfig } from './ai-config';

export interface AIAnalysisResult {
  category: string;
  riskLevel: 'low' | 'medium' | 'high';
  reasoning: string;
  suggestedAction: 'direct_upload' | 'trojan_strategy' | 'manual_review';
  safeName?: string;
  confidence: number;
}

// --- Core Failover Logic ---

async function executeWithFailover<T>(
  operation: (provider: AIProviderConfig, apiKey: string) => Promise<T>
): Promise<T> {
  const config = getAIConfig();
  const providers = config.providers
    .filter(p => p.enabled && p.apiKeyPool.length > 0)
    .sort((a, b) => a.priority - b.priority);

  if (providers.length === 0) {
    throw new Error('No enabled AI providers with valid API keys found.');
  }

  let lastError: any = null;

  for (const provider of providers) {
    // Retry logic for the SAME provider (e.g. different keys or transient network issues)
    // For simplicity, we try one random key per provider per attempt in the failover chain.
    // In a more advanced version, we could retry multiple keys for the same provider.

    const apiKey = provider.apiKeyPool[Math.floor(Math.random() * provider.apiKeyPool.length)];
    console.log(`[AI Service] Attempting with Provider: ${provider.name} (${provider.provider})`);

    try {
      return await operation(provider, apiKey);
    } catch (error: any) {
      console.warn(`[AI Service] Provider ${provider.name} failed:`, error.message);
      lastError = error;
      // Continue to next provider
    }
  }

  throw lastError || new Error('All AI providers failed.');
}

// --- Provider Adapters ---

async function callOpenAICompatible(
  provider: AIProviderConfig,
  apiKey: string,
  messages: any[],
  temperature: number,
  maxTokens: number,
  jsonMode: boolean = true
): Promise<any> {
  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: provider.baseUrl,
    dangerouslyAllowBrowser: true
  });

  const completion = await client.chat.completions.create({
    model: provider.model,
    messages: messages,
    response_format: jsonMode ? { type: "json_object" } : undefined,
    temperature: temperature,
    max_tokens: maxTokens
  });

  const content = completion.choices[0].message.content;
  if (!content) throw new Error('Empty response from AI provider');
  return JSON.parse(content);
}

async function callGemini(
  provider: AIProviderConfig,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string | any[],
  temperature: number,
  maxTokens: number
): Promise<any> {
  // Gemini REST API Adapter
  // Docs: https://ai.google.dev/tutorials/rest_quickstart
  const url = `${provider.baseUrl}/models/${provider.model}:generateContent?key=${apiKey}`;

  let contents = [];
  if (typeof userPrompt === 'string') {
    contents.push({ role: 'user', parts: [{ text: systemPrompt + "\n\n" + userPrompt }] });
  } else {
    // Handle multimodal (image) input for Gemini
    // userPrompt is expected to be the OpenAI-style content array
    const parts = [];
    parts.push({ text: systemPrompt }); // System prompt as text part

    for (const item of userPrompt as any[]) {
      if (item.type === 'text') {
        parts.push({ text: item.text });
      } else if (item.type === 'image_url') {
        // Extract base64 from data URL
        const base64Data = item.image_url.url.split(',')[1];
        parts.push({
          inline_data: {
            mime_type: "image/jpeg",
            data: base64Data
          }
        });
      }
    }
    contents.push({ role: 'user', parts });
  }

  const response = await axios.post(url, {
    contents: contents,
    generationConfig: {
      temperature: temperature,
      maxOutputTokens: maxTokens,
      responseMimeType: "application/json"
    }
  });

  if (response.data.candidates && response.data.candidates.length > 0) {
    const text = response.data.candidates[0].content.parts[0].text;
    return JSON.parse(text);
  }

  throw new Error('Empty response from Gemini');
}

// --- Public Methods ---

export async function analyzeProduct(productName: string, description?: string, region: string = 'Global'): Promise<AIAnalysisResult> {
  console.log(`[AI Service] Analyzing Text: ${productName}, Region: ${region}`);

  try {
    const rules = await prisma.complianceRule.findMany({
      where: {
        region: { in: ['Global', region] },
        isEnabled: true
      }
    });
    const ruleText = rules.map(r => `- ${r.content}`).join('\n');
    const config = getAIConfig();

    const systemPrompt = `You are an expert compliance officer for the "Zhengcaiyun" (政采云) procurement platform in region: ${region}.
                    CRITICAL REGIONAL RULES TO ENFORCE:
                    ${ruleText}

                    Analyze the product for:
                    1. Best matching category (must be a leaf category).
                    2. Risk level (High: weapons, spy gear, VPNs, extreme luxury OR Violates Regional Rules; Medium: medical devices without certs; Low: standard office supplies).
                    3. Suggested action:
                       - 'direct_upload': Safe products.
                       - 'trojan_strategy': High risk or sensitive keywords that might trigger auto-rejection but are technically legal.
                       - 'manual_review': Illegal, prohibited by regional rules, or highly questionable items.
                    4. If 'trojan_strategy', provide a 'safeName' (e.g. "Office Supplies Kit", "Computer Accessories") that is generic and safe.
                    
                    Return JSON.`;

    const userPrompt = `Product Name: ${productName}\nDescription: ${description || 'N/A'}`;

    return await executeWithFailover(async (provider, apiKey) => {
      if (provider.provider === 'gemini') {
        return await callGemini(provider, apiKey, systemPrompt, userPrompt, config.globalSettings.temperature, config.globalSettings.maxTokens);
      } else {
        // OpenAI, DeepSeek, Qwen
        const messages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ];
        return await callOpenAICompatible(provider, apiKey, messages, config.globalSettings.temperature, config.globalSettings.maxTokens);
      }
    });

  } catch (error) {
    console.error('[AI Service] Text Analysis Error:', error);
    return {
      category: 'Unknown',
      riskLevel: 'medium',
      reasoning: 'AI Service Error: ' + (error as Error).message,
      suggestedAction: 'manual_review',
      confidence: 0
    };
  }
}

export async function analyzeScreenshot(base64Image: string, contextText?: string): Promise<AIAnalysisResult> {
  console.log(`[AI Service] Analyzing Screenshot...`);

  try {
    const config = getAIConfig();
    const imageUrl = base64Image.startsWith('data:image') ? base64Image : `data:image/jpeg;base64,${base64Image}`;

    const systemPrompt = `You are an AI assistant for e-commerce product uploading.
                    Analyze the provided product detail page screenshot.
                    Identify the product category, potential risks (brand infringement, prohibited items), and suggest an upload strategy.
                    
                    Output JSON format:
                    {
                        "category": "Category/SubCategory/LeafCategory",
                        "riskLevel": "low" | "medium" | "high",
                        "reasoning": "Explanation...",
                        "suggestedAction": "direct_upload" | "trojan_strategy" | "manual_review",
                        "confidence": 0.0 to 1.0
                    }`;

    return await executeWithFailover(async (provider, apiKey) => {
      if (provider.provider === 'gemini') {
        // Construct multimodal input for Gemini
        const userContent = [
          { type: "text", text: contextText ? `Context: ${contextText}` : "Analyze this product page." },
          { type: "image_url", image_url: { url: imageUrl } }
        ];
        return await callGemini(provider, apiKey, systemPrompt, userContent, config.globalSettings.temperature, config.globalSettings.maxTokens);
      } else {
        // OpenAI, DeepSeek, Qwen
        const messages = [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: contextText ? `Context: ${contextText}` : "Analyze this product page." },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
            ]
          }
        ];
        return await callOpenAICompatible(provider, apiKey, messages, config.globalSettings.temperature, config.globalSettings.maxTokens);
      }
    });

  } catch (error) {
    console.error('[AI Service] Visual Analysis Error:', error);
    throw error;
  }
}

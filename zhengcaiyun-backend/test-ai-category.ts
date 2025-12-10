// 测试AI类目匹配
import 'dotenv/config'
import { matchCategoryWithAI } from './lib/ai-category-match'

async function main() {
    console.log('API Key:', process.env.OPENAI_API_KEY?.substring(0, 20) + '...')

    const testCases = [
        '【得力33725】得力120*90cm支架白板白板写字板',
        '【得力33888】得力会计凭证自动装订机财务装订机',
        'HP惠普M1136打印机黑白激光一体机'
    ]

    for (const title of testCases) {
        console.log('\n---')
        console.log('商品:', title)

        try {
            const result = await matchCategoryWithAI(title)
            console.log('类目:', result.path.join(' > '))
            console.log('置信度:', result.confidence)
            console.log('理由:', result.reason)
        } catch (e) {
            console.error('错误:', e)
        }
    }
}

main()

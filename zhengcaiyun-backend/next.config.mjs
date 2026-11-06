/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverActions: {
            bodySizeLimit: '2mb',
        },
        // puppeteer-extra-plugin-stealth 用了 webpack 无法静态分析的动态 require，
        // 不加这行生产构建会在 app/api/rules/crawl/route.ts 处失败
        serverComponentsExternalPackages: [
            'puppeteer',
            'puppeteer-core',
            'puppeteer-extra',
            'puppeteer-extra-plugin',
            'puppeteer-extra-plugin-stealth',
        ],
    },
    async headers() {
        return [
            {
                source: "/api/:path*",
                headers: [
                    { key: "Access-Control-Allow-Credentials", value: "true" },
                    { key: "Access-Control-Allow-Origin", value: "*" },
                    { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT" },
                    { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
                ]
            }
        ]
    }
}

export default nextConfig

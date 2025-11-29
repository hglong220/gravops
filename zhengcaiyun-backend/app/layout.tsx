import type { Metadata } from "next";
import "./globals.css";


export const metadata: Metadata = {
    title: "政采云智能助手 API",
    description: "政采云智能上传系统后端服务",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="zh-CN">
            <body className="flex flex-col min-h-screen">
                {children}

            </body>
        </html>
    );
}

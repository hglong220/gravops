'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col">
                <div className="h-16 flex items-center px-6 border-b border-gray-100">
                    <h1 className="text-xl font-bold tracking-tight text-gray-900">Gravops Admin</h1>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-1">
                    <NavLink href="/admin" icon="📊">仪表盘</NavLink>
                    <NavLink href="/admin/users" icon="👥">用户管理</NavLink>
                    <NavLink href="/admin/licenses" icon="🔑">授权管理</NavLink>
                    <NavLink href="/admin/finance" icon="💰">财务报表</NavLink>
                    <NavLink href="/admin/downloads" icon="🚀">软件发布</NavLink>
                    <NavLink href="/admin/ai" icon="🤖">AI 配置</NavLink>
                    <NavLink href="/admin/tasks" icon="📋">任务监控</NavLink>
                    <NavLink href="/admin/system" icon="🖥️">系统监控</NavLink>
                    <NavLink href="/admin/field-rules" icon="📝">字段规则</NavLink>
                </nav>

                {/* Admin Profile */}
                <div className="p-4 border-t border-gray-100">
                    <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50">
                        <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-xs font-bold text-white">
                            AD
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">Super Admin</p>
                            <p className="text-xs text-gray-500 truncate">admin@gravops.com</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <div className="p-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}

function NavLink({ href, icon, children }: { href: string; icon: string; children: React.ReactNode }) {
    const pathname = usePathname();
    const isActive = pathname === href;

    return (
        <Link
            href={href}
            className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all ${isActive
                ? 'bg-black text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
        >
            <span className="mr-3 text-lg">{icon}</span>
            {children}
        </Link>
    );
}

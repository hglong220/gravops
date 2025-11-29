'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

interface SearchResult {
    id: string;
    title: string;
    url: string;
}

interface ProductGroup {
    id: string;
    name: string; // The product name inferred from user input
    items: SearchResult[];
    isExpanded: boolean;
}

export default function DashboardChatPage() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: '您好！我是政采云智能助手。请告诉我您需要上架什么商品？\n\n您可以直接输入商品名称，或者粘贴清单（支持 Word、Excel、PDF、图片等格式）。\n我会自动提取商品名称和数量，为您匹配最合适的商品。',
            timestamp: Date.now()
        }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // Sidebar State
    const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isUploading, setIsUploading] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        const validTypes = [
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/pdf'
        ];
        const isImage = file.type.startsWith('image/');
        const isValidType = validTypes.includes(file.type) || isImage;

        // Fallback check for extensions if mime type is missing or generic
        const validExtensions = ['.doc', '.docx', '.xls', '.xlsx', '.pdf'];
        const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

        if (!isValidType && !hasValidExtension && !isImage) {
            alert('不支持的文件格式。仅支持 Word、Excel、PDF 和图片文件。');
            e.target.value = ''; // Reset input
            return;
        }

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: `📄 上传了文件：${file.name}`,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, userMsg]);
        setIsTyping(true);

        setTimeout(() => {
            setIsTyping(false);
            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `收到文件 **${file.name}**。正在解析文件内容...`,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, aiMsg]);

            setTimeout(() => {
                const groups = generateMockGroups();
                setProductGroups(groups);
                setSelectedIds(new Set());

                const totalItems = groups.reduce((acc, g) => acc + g.items.length, 0);
                const searchMsg: Message = {
                    id: (Date.now() + 2).toString(),
                    role: 'assistant',
                    content: `✅ 解析成功！\n\n从文件中识别到 ${groups.length} 个商品，共找到 ${totalItems} 个相关链接。\n请在右侧列表核对并勾选您需要的商品链接。`,
                    timestamp: Date.now()
                };
                setMessages(prev => [...prev, searchMsg]);
            }, 1500);
        }, 1000);

        e.target.value = '';
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const generateMockGroups = (): ProductGroup[] => {
        return [
            {
                id: 'g1',
                name: '联想ThinkPad X1 Carbon 2024款',
                isExpanded: false,
                items: [
                    { id: 'p1_1', title: '[政采云] 联想ThinkPad X1 Carbon Gen12 酷睿Ultra7 32G+1T 2.8K屏', url: 'https://www.zcygov.cn/product/detail?id=10001' },
                    { id: 'p1_2', title: '[政采云] 联想ThinkPad X1 Carbon 2024 AI全互联旗舰本', url: 'https://www.zcygov.cn/product/detail?id=10002' },
                    { id: 'p1_3', title: '[政采云] 联想ThinkPad X1 Carbon 黑色 商务办公本', url: 'https://www.zcygov.cn/product/detail?id=10003' },
                ]
            },
            {
                id: 'g2',
                name: '罗技 MX Master 3S 鼠标',
                isExpanded: false,
                items: [
                    { id: 'p2_1', title: '[政采云] 罗技(Logitech) MX Master 3S 无线蓝牙鼠标', url: 'https://www.zcygov.cn/product/detail?id=20001' },
                    { id: 'p2_2', title: '[政采云] 罗技 MX Master 3S 商务灰 静音升级版', url: 'https://www.zcygov.cn/product/detail?id=20002' },
                ]
            },
            {
                id: 'g3',
                name: '戴尔 U2723QE 显示器',
                isExpanded: false,
                items: [
                    { id: 'p3_1', title: '[政采云] 戴尔(DELL) U2723QE 27英寸 4K超高清 IPS Black屏', url: 'https://www.zcygov.cn/product/detail?id=30001' },
                    { id: 'p3_2', title: '[政采云] 戴尔 U2723QX 4K Type-C 90W反向充电', url: 'https://www.zcygov.cn/product/detail?id=30002' },
                    { id: 'p3_3', title: '[政采云] 戴尔 U系列 U2723QE 显示器支架套装', url: 'https://www.zcygov.cn/product/detail?id=30003' },
                    { id: 'p3_4', title: '[政采云] 戴尔 27英寸 4K 设计师绘图显示器', url: 'https://www.zcygov.cn/product/detail?id=30004' },
                ]
            }
        ];
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        // Mock AI Response Logic
        setTimeout(() => {
            setIsTyping(false);

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `收到。已为您提取到关键商品信息，正在政采云为您搜索匹配的商品链接...`,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, aiMsg]);

            // Simulate Search Delay & Show Sidebar
            setTimeout(() => {
                const groups = generateMockGroups();
                setProductGroups(groups);
                setSelectedIds(new Set()); // Reset selection

                const totalItems = groups.reduce((acc, g) => acc + g.items.length, 0);
                const searchMsg: Message = {
                    id: (Date.now() + 2).toString(),
                    role: 'assistant',
                    content: `🔍 搜索完成！\n\n共识别到 ${groups.length} 个商品，找到 ${totalItems} 个相关链接。\n请在右侧列表核对并勾选您需要的商品链接。`,
                    timestamp: Date.now()
                };
                setMessages(prev => [...prev, searchMsg]);
            }, 1000);

        }, 1500);
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleSelectAll = () => {
        // If all *primary* items (first item of each group) are selected, deselect all.
        // Otherwise, select the first item of every group.
        const primaryIds = productGroups.map(g => g.items[0]?.id).filter(Boolean);
        const allPrimarySelected = primaryIds.every(id => selectedIds.has(id));

        if (allPrimarySelected) {
            setSelectedIds(new Set());
        } else {
            // Select only the first item of each group (Smart Select)
            setSelectedIds(new Set(primaryIds));
        }
    };

    const handleBatchDelete = () => {
        setProductGroups(prev => prev.map(group => ({
            ...group,
            items: group.items.filter(item => !selectedIds.has(item.id))
        })).filter(group => group.items.length > 0));
        setSelectedIds(new Set());
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setProductGroups(prev => prev.map(group => ({
            ...group,
            items: group.items.filter(item => item.id !== id)
        })).filter(group => group.items.length > 0));

        setSelectedIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
        });
    };

    const toggleGroupExpand = (groupId: string) => {
        setProductGroups(prev => prev.map(g =>
            g.id === groupId ? { ...g, isExpanded: !g.isExpanded } : g
        ));
    };

    const handleConfirmUpload = () => {
        if (selectedIds.size === 0) return;

        setIsUploading(true);

        setTimeout(() => {
            setIsUploading(false);
            setProductGroups([]);
            setSelectedIds(new Set());

            const confirmMsg: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: `✅ **操作成功！**\n\n您选中的 ${selectedIds.size} 个商品已加入上传队列。\n系统正在后台自动处理，您可以继续发送新的清单。`,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, confirmMsg]);
        }, 1500);
    };

    const totalItemsCount = productGroups.reduce((acc, g) => acc + g.items.length, 0);

    return (
        <div className="flex h-full gap-[30px]">
            {/* Left: Chat Area */}
            <div className="flex-1 flex flex-col w-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Header */}
                <div className="h-16 border-b border-gray-100 flex items-center px-6 justify-center bg-white z-10">
                    <div className="flex items-center gap-2">
                        <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                        </svg>
                        <h1 className="text-gray-900 text-base font-medium">智能选品助手</h1>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 ${msg.role === 'user'
                                ? 'bg-black text-white rounded-tr-none'
                                : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none shadow-sm'
                                }`}>
                                <div className="markdown-body text-sm leading-relaxed" dangerouslySetInnerHTML={{
                                    __html: msg.content.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                }} />
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none px-5 py-4 flex items-center gap-2 shadow-sm">
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></span>
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-6 bg-white border-t border-gray-100">
                    <div className="relative">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute left-2 top-2 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="上传文件 (支持 Word/Excel/PDF/图片)"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 6.375L8.965 16.91a1.5 1.5 0 01-2.121-2.121l9.962-9.962" />
                            </svg>
                        </button>
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="请输入商品名称，或粘贴清单..."
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 resize-none h-[52px] max-h-32 transition-all"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim()}
                            className="absolute right-2 top-2 p-2 bg-black text-white rounded-lg hover:opacity-80 transition disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                            </svg>
                        </button>
                    </div>
                    <p className="text-center text-xs text-gray-400 mt-3">
                        按 Enter 发送，Shift + Enter 换行
                    </p>
                </div>
            </div>

            {/* Right: Search Results Sidebar */}
            <div className="w-[600px] bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col transition-all duration-500 transform translate-x-0 opacity-100 overflow-hidden">
                {/* Sidebar Header */}
                <div className="h-16 border-b border-gray-100 flex items-center px-6 justify-center bg-white">
                    <h2 className="text-gray-900 text-base font-medium">
                        商品信息预览窗
                    </h2>
                </div>

                {/* Content Area */}
                {productGroups.length === 0 ? (
                    // Empty State
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400 bg-gray-50/50">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                            </svg>
                        </div>
                        <p className="text-sm">
                            暂无搜索结果<br />
                            请在左侧发送商品清单
                        </p>
                        <button
                            onClick={() => setProductGroups(generateMockGroups())}
                            className="mt-4 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                        >
                            生成测试数据
                        </button>
                    </div>
                ) : (
                    // Results List (Grouped)
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-gray-50/50">
                        {productGroups.map((group) => (
                            <div key={group.id} className="bg-white border border-gray-100 rounded-lg overflow-hidden hover:border-gray-300 transition-colors">
                                {/* First Item (Always Visible) */}
                                {group.items.length > 0 && (
                                    <div
                                        className={`relative p-2 cursor-pointer transition-colors ${selectedIds.has(group.items[0].id)
                                            ? 'bg-blue-50/50'
                                            : 'hover:bg-gray-50'
                                            }`}
                                        onClick={() => toggleSelection(group.items[0].id)}
                                    >
                                        <div className="flex items-center gap-2">
                                            {/* Checkbox */}
                                            <div className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedIds.has(group.items[0].id)
                                                ? 'bg-blue-600 border-blue-600 text-white'
                                                : 'border-gray-300 bg-white'
                                                }`}>
                                                {selectedIds.has(group.items[0].id) && (
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs text-gray-700 leading-tight break-words">
                                                    {group.items[0].title}
                                                    <a
                                                        href={group.items[0].url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center text-blue-400 hover:text-blue-600 ml-1 align-text-bottom"
                                                        onClick={(e) => e.stopPropagation()}
                                                        title="在新窗口打开"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                                            <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z" />
                                                            <path d="M11.603 7.96a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 105.656 5.656l3-3a4 4 0 00-.225-5.865z" />
                                                        </svg>
                                                    </a>
                                                </div>
                                            </div>

                                            {/* Delete */}
                                            <button
                                                onClick={(e) => handleDelete(group.items[0].id, e)}
                                                className="flex-shrink-0 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                title="删除"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Expanded Items */}
                                {group.isExpanded && group.items.slice(1).map((item) => (
                                    <div
                                        key={item.id}
                                        className={`relative p-2 cursor-pointer transition-colors border-t border-gray-50 ${selectedIds.has(item.id)
                                            ? 'bg-blue-50/50'
                                            : 'hover:bg-gray-50'
                                            }`}
                                        onClick={() => toggleSelection(item.id)}
                                    >
                                        <div className="flex items-center gap-2 pl-6"> {/* Indent */}
                                            {/* Checkbox */}
                                            <div className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedIds.has(item.id)
                                                ? 'bg-blue-600 border-blue-600 text-white'
                                                : 'border-gray-300 bg-white'
                                                }`}>
                                                {selectedIds.has(item.id) && (
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs text-gray-600 leading-tight break-words">
                                                    {item.title}
                                                    <a
                                                        href={item.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center text-blue-400 hover:text-blue-600 ml-1 align-text-bottom"
                                                        onClick={(e) => e.stopPropagation()}
                                                        title="在新窗口打开"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                                            <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z" />
                                                            <path d="M11.603 7.96a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 105.656 5.656l3-3a4 4 0 00-.225-5.865z" />
                                                        </svg>
                                                    </a>
                                                </div>
                                            </div>

                                            {/* Delete */}
                                            <button
                                                onClick={(e) => handleDelete(item.id, e)}
                                                className="flex-shrink-0 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                title="删除"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* Toggle Button (Icon Only) */}
                                {group.items.length > 1 && (
                                    <div
                                        onClick={() => toggleGroupExpand(group.id)}
                                        className="h-4 flex items-center justify-center bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                                        title={group.isExpanded ? "收起" : `展开更多 (${group.items.length - 1})`}
                                    >
                                        {group.isExpanded ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400">
                                                <path fillRule="evenodd" d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832 6.29 12.77a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z" clipRule="evenodd" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400">
                                                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Footer Actions */}
                <div className="p-6 border-t border-gray-100 bg-white space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 hover:text-gray-900 select-none">
                            <input
                                type="checkbox"
                                checked={productGroups.length > 0 && selectedIds.size > 0 && selectedIds.size >= productGroups.length}
                                onChange={handleSelectAll}
                                disabled={productGroups.length === 0}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            全选 (默认选中首项)
                        </label>

                        <div className="flex items-center gap-3">
                            {selectedIds.size > 0 && (
                                <button
                                    onClick={handleBatchDelete}
                                    className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1 bg-red-50 px-2 py-1 rounded-md hover:bg-red-100 transition-colors"
                                >
                                    删除选中 ({selectedIds.size})
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    setProductGroups([]);
                                    setSelectedIds(new Set());
                                }}
                                disabled={productGroups.length === 0}
                                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                清空
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={handleConfirmUpload}
                        disabled={selectedIds.size === 0 || isUploading}
                        className="w-1/2 mx-auto block bg-blue-500 text-white py-3 rounded-xl font-medium tracking-widest shadow-lg shadow-blue-100 hover:shadow-xl hover:bg-blue-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {isUploading ? '🚀 处理中...' : `确认上传 (${selectedIds.size})`}
                    </button>
                </div>
            </div>
        </div>
    );
}

'use client';

import { useEffect, useState } from 'react';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

export default function AuthModal({ isOpen, onClose, children }: AuthModalProps) {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setShow(true);
            document.body.style.overflow = 'hidden'; // Prevent scrolling
        } else {
            const timer = setTimeout(() => setShow(false), 300); // Wait for animation
            document.body.style.overflow = 'unset';
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!show && !isOpen) return null;

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-white/60 backdrop-blur-md transition-all duration-300"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className={`relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 transform transition-all duration-300 max-h-[90vh] overflow-y-auto ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}>
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                {children}
            </div>
        </div>
    );
}

export function normalizeChinaPhone(input: string): string {
    const digits = String(input ?? '').replace(/\D/g, '');
    if (digits.startsWith('86') && digits.length === 13) return digits.slice(2);
    return digits;
}

export function isValidChinaPhone(input: string): boolean {
    return /^1\d{10}$/.test(normalizeChinaPhone(input));
}


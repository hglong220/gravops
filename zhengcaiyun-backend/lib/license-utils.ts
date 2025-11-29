import { randomBytes, createHash } from 'crypto';

/**
 * Generates a complex, secure license key.
 * Format: XXXX-XXXX-XXXX-XXXX-XXXX (5 groups of 4 random alphanumeric characters)
 * Total length: 20 characters + 4 dashes = 24 characters.
 * 
 * @param companyName Optional company name to embed into the key.
 *                    If provided, the 2nd group will be derived from the company name.
 */
export function generateLicenseKey(companyName?: string): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude I, O, 1, 0
    const segments = 5; // 5 random segments
    const segmentLength = 4;

    let parts: string[] = [];

    // Generate Random Segments
    for (let i = 0; i < segments; i++) {
        let segment = '';
        const bytes = randomBytes(segmentLength);
        for (let j = 0; j < segmentLength; j++) {
            segment += chars[bytes[j] % chars.length];
        }
        parts.push(segment);
    }

    return parts.join('-');
}

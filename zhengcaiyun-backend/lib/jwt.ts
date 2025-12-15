export function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Missing JWT_SECRET in production');
        }
        return 'dev-jwt-secret';
    }
    return secret;
}


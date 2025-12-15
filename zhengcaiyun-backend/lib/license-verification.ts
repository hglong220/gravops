import { prisma } from '@/lib/prisma';
import type { Device, License } from '@prisma/client';

export interface VerifyLicenseInput {
    licenseKey: string;
    companyName: string;
    deviceId?: string;
}

export class LicenseVerificationError extends Error {
    status: number;
    code?: string;
    details?: Record<string, any>;

    constructor(message: string, status: number, code?: string, details?: Record<string, any>) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

export type LicenseWithDevices = License & { devices: Device[] };

function normalizeCompanyName(name: string): string {
    return name
        .replace(/[\s.\-—_'"“”‘’·•、,，。()（）【】[\]<>《》]/g, '')
        .toLowerCase();
}

async function ensureLicenseLinkedToUser(license: License): Promise<string | null> {
    if (license.userId) return license.userId;
    if (!license.orderId) return null;

    const order = await prisma.order.findUnique({
        where: { id: license.orderId },
        select: { userId: true }
    });

    if (!order?.userId) return null;

    await prisma.license.update({
        where: { id: license.id },
        data: { userId: order.userId }
    });

    return order.userId;
}

export async function verifyLicenseOrThrow(input: VerifyLicenseInput): Promise<LicenseWithDevices> {
    const { licenseKey, companyName, deviceId } = input;

    if (!licenseKey || !companyName) {
        throw new LicenseVerificationError('缺少必要参数', 400);
    }

    const license = await prisma.license.findUnique({
        where: { key: licenseKey },
        include: { devices: true }
    });

    if (!license) {
        throw new LicenseVerificationError('无效的授权码，请先购买', 401, 'INVALID_LICENSE', {
            requirePurchase: true,
            purchaseUrl: '/pricing'
        });
    }

    if (new Date() > license.expiresAt) {
        throw new LicenseVerificationError('授权已过期', 401, 'LICENSE_EXPIRED', {
            expiresAt: license.expiresAt.getTime(),
            renewUrl: '/pricing'
        });
    }

    if (license.status !== 'active') {
        throw new LicenseVerificationError(`授权状态异常: ${license.status}`, 403, 'LICENSE_INACTIVE');
    }

    const normalizedDbName = normalizeCompanyName(license.companyName);
    const normalizedInputName = normalizeCompanyName(companyName);

    const isMatch =
        normalizedDbName.includes(normalizedInputName) ||
        normalizedInputName.includes(normalizedDbName) ||
        normalizedDbName === normalizedInputName;

    if (!isMatch) {
        throw new LicenseVerificationError('授权验证失败：公司信息不匹配', 403, 'COMPANY_MISMATCH', {
            boundCompanyName: license.companyName
        });
    }

    // 尽量把 License 绑定到 userId（用于后续数据归属），不要求前端额外操作
    await ensureLicenseLinkedToUser(license);

    if (deviceId) {
        const existingDevice = license.devices.find(d => d.fingerprint === deviceId);

        if (!existingDevice) {
            if (license.devices.length >= license.maxDevices) {
                throw new LicenseVerificationError('超过最大设备数限制', 403, 'DEVICE_LIMIT', {
                    currentDevices: license.devices.length,
                    maxDevices: license.maxDevices
                });
            }

            await prisma.device.create({
                data: {
                    licenseId: license.id,
                    fingerprint: deviceId,
                    lastSeen: new Date()
                }
            });
        } else {
            await prisma.device.update({
                where: { id: existingDevice.id },
                data: { lastSeen: new Date() }
            });
        }
    }

    const updatedLicense = await prisma.license.findUnique({
        where: { id: license.id },
        include: { devices: true }
    });

    if (!updatedLicense) {
        throw new LicenseVerificationError('服务器错误', 500, 'LICENSE_FETCH_FAILED');
    }

    return updatedLicense;
}


export interface PermissionData {
    protocolId: string;
    protocolName: string;
    bidId: string;
    bidName: string;
    electronicMarketId?: string;
    electronicMarketName?: string;
}

export class PermissionExtractor {
    /**
     * Extract permissions from the "Sales Information" section of the DOM.
     * This is a fallback if the API interception fails.
     */
    static extractFromDOM(): PermissionData[] {
        const permissions: PermissionData[] = [];

        // Look for the "Bid Item Name" text
        // Example: "标项名称： 办公设备"
        const bidItemElements = document.querySelectorAll('div, span, p, label');

        for (const el of Array.from(bidItemElements)) {
            if (el.textContent?.includes('标项名称')) {
                const text = el.textContent.trim();
                // Extract the value after the colon
                const match = text.match(/标项名称[:：]\s*(.+)/);
                if (match && match[1]) {
                    permissions.push({
                        protocolId: 'unknown', // Cannot get ID from text easily
                        protocolName: 'unknown',
                        bidId: 'unknown',
                        bidName: match[1].trim()
                    });
                }
            }
        }

        return permissions;
    }

    /**
     * Parse the intercepted API response to extract permissions.
     * @param response The JSON response from the ZCY API.
     */
    static parseApiResponse(response: any): PermissionData[] {
        const permissions: PermissionData[] = [];

        try {
            // Common ZCY API structure for protocols/bids
            // Adjust this based on actual API response structure
            if (response && response.data) {
                const data = Array.isArray(response.data) ? response.data : [response.data];

                for (const item of data) {
                    // Structure 1: Direct list of protocols
                    if (item.protocolId || item.bidId) {
                        permissions.push({
                            protocolId: item.protocolId || '',
                            protocolName: item.protocolName || '',
                            bidId: item.bidId || '',
                            bidName: item.bidName || '',
                            electronicMarketId: item.electronicMarketId,
                            electronicMarketName: item.electronicMarketName
                        });
                    }

                    // Structure 2: Nested in 'agreement' or similar
                    if (item.agreementList && Array.isArray(item.agreementList)) {
                        for (const agreement of item.agreementList) {
                            permissions.push({
                                protocolId: agreement.protocolId || '',
                                protocolName: agreement.protocolName || '',
                                bidId: agreement.bidId || '',
                                bidName: agreement.bidName || '',
                                electronicMarketId: item.electronicMarketId,
                                electronicMarketName: item.electronicMarketName
                            });
                        }
                    }
                }
            }
        } catch (e) {
            console.error('[PermissionExtractor] Failed to parse API response:', e);
        }

        return permissions;
    }
}

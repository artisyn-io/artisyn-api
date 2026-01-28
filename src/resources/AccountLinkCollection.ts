import { JsonResource } from ".";

/**
 * AccountLinkCollection
 */
export default class extends JsonResource {
    /**
     * Build the response object
     * @returns this
     */
    data () {
        const data = this.resource;
        if (Array.isArray(data)) {
            return data.map(item => {
                if (typeof item === 'object' && item !== null) {
                    const sanitized = { ...item };
                    sanitized.accessToken = sanitized.accessToken ? '***' : undefined;
                    sanitized.refreshToken = sanitized.refreshToken ? '***' : undefined;
                    return sanitized;
                }
                return item;
            });
        }
        return data;
    }
}

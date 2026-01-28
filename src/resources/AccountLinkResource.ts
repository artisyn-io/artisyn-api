import { JsonResource } from ".";

/**
 * AccountLinkResource
 */
export default class extends JsonResource {
    /**
     * Build the response object
     * @returns this
     */
    data () {
        const data = this.resource;
        // Sanitize sensitive tokens
        if (typeof data === 'object' && data !== null) {
            const sanitized = { ...data };
            sanitized.accessToken = sanitized.accessToken ? '***' : undefined;
            sanitized.refreshToken = sanitized.refreshToken ? '***' : undefined;
            return sanitized;
        }
        return data;
    }
}

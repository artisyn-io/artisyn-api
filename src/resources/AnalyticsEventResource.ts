import { JsonResource } from ".";

/**
 * AnalyticsEventResource
 * Single analytics event response wrapper
 */
export default class extends JsonResource {
    /**
     * Build the response object
     * @returns this
     */
    data () {
        return this.resource
    }
}

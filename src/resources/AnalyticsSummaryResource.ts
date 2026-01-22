import { JsonResource } from ".";

/**
 * AnalyticsSummaryResource
 * Analytics summary/dashboard response wrapper
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

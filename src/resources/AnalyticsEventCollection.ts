import { JsonResource, Resource } from ".";

import AnalyticsEventResource from "./AnalyticsEventResource";

/**
 * AnalyticsEventCollection
 * Collection of analytics events with pagination
 */
export default class extends JsonResource {
    /**
     * Build the response object
     * @returns this
     */
    data () {
        const data = Array.isArray(this.resource) ? this.resource : this.resource.data

        return {
            data: data.map(
                (e: Resource) => new AnalyticsEventResource(this.request, this.response, e).data()
            )
        }
    }
}

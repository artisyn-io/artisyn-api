import { JsonResource } from ".";

/**
 * MediaResource
 */
export default class extends JsonResource {
    /**
     * Build the response object
     * @returns this
     */
    data() {
        return this.resource
    }
}

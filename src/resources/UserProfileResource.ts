import { JsonResource } from ".";

/**
 * UserProfileResource
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

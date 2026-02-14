import { JsonResource, Resource } from ".";

import CategoryResource from "./CategoryResource";

/**
 * Admin/CategoryCollection
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
                (e: Resource) => new CategoryResource(this.request, this.response, e).data()
            )
        }
    }
}

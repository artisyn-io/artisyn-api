import { JsonResource, Resource } from ".";

import CuratorResource from "./CuratorResource";

/**
 * CuratorCollection
 * 
 * Formats a collection of Curators for API responses with pagination.
 * Extends the existing JsonResource pattern used across the codebase.
 */
export default class extends JsonResource {
    /**
     * Transform the collection into an array for the response
     * @returns Array of formatted curator data
     */
    data () {
        const data = Array.isArray(this.resource) ? this.resource : this.resource.data;

        return {
            data: data.map(
                (e: Resource) => new CuratorResource(this.request, this.response, e).data()
            )
        };
    }
}

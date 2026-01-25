import { JsonResource, ApiResource, Resource } from "."; 

import ArtisanResource from "./ArtisanResource";

/**
 * ArtisanCollection
 * 
 * Formats a collection of Artisans (Listings) for API responses with pagination.
 * Extends the existing JsonResource pattern used across the codebase.
 */
export default class extends JsonResource {
    /**
     * Transform the collection into an array for the response
     * @returns Array of formatted artisan data
     */
    data () {
        const data = Array.isArray(this.resource) ? this.resource : this.resource.data

        return {
            data: data.map(
                (e: Resource) => ApiResource(new ArtisanResource(this.request, this.response, e)).data()
            )
        }
    }
}

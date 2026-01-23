import { ApiResource, JsonResource, Resource } from ".";
import ArtisanResource from "./ArtisanResource";

/**
 * ArtisanCollection - Transforms a list of Artisan (Listing) models for API responses.
 * Handles pagination metadata automatically via the parent JsonResource logic if present.
 */
export default class ArtisanCollection extends JsonResource {
    /**
     * Build the response object
     * @returns this
     */
    data() {
        // Handle both raw arrays and paginated results (objects with a 'data' property)
        const data = Array.isArray(this.resource) ? this.resource : (this.resource.data || []);

        return {
            data: data.map(
                (e: Resource) => ApiResource(new ArtisanResource(this.request, this.response, e)).data()
            ),
            // Pagination is handled by the base JsonResource, which checks for this.resource.pagination
            // or merges pagination if passed in the constructor.
        };
    }
}

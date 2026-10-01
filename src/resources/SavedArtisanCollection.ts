import { JsonResource, Resource } from "./index";
import SavedArtisanResource from "./SavedArtisanResource";

/**
 * SavedArtisanCollection
 * 
 * Formats a collection of SavedArtisan records for API responses with pagination.
 * Extends the existing JsonResource pattern used across the codebase.
 */
export default class SavedArtisanCollection extends JsonResource {
    /**
     * Transform the collection into an array for the response
     * @returns Array of formatted saved artisan records
     */
    data() {
        const data = Array.isArray(this.resource) ? this.resource : this.resource.data;

        return {
            data: (data || []).map(
                (e: Resource) => new SavedArtisanResource(this.request, this.response, e).data()
            ),
        };
    }
}

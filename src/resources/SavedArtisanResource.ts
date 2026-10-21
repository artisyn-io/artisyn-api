import { JsonResource } from "./index";
import ArtisanResource from "./ArtisanResource";

/**
 * SavedArtisanResource
 * 
 * Formats a single SavedArtisan record for API responses.
 * Extends the existing JsonResource pattern used across the codebase.
 */
export default class SavedArtisanResource extends JsonResource {
    /**
     * Transform the resource into an object for the response
     * @returns Formatted saved artisan data
     */
    data() {
        return {
            id: this.id,
            userId: this.userId,
            artisanId: this.artisanId,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            // Include nested artisan card data if loaded
            artisan: this.artisan
                ? new ArtisanResource(this.request, this.response, this.artisan).data()
                : undefined,
        };
    }
}

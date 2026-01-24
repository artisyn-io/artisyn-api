import { JsonResource } from ".";

/**
 * ArtisanResource
 * 
 * Formats a single Artisan (Listing) for API responses.
 * Extends the existing JsonResource pattern used across the codebase.
 */
export default class extends JsonResource {
    /**
     * Transform the resource into an array/object for the response
     * @returns Formatted artisan data
     */
    data() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            phone: this.phone,
            email: this.email,
            website: this.website,
            address: this.address,
            images: this.images,
            priceType: this.priceType,
            fixedPrice: this.fixedPrice,
            minPrice: this.minPrice,
            maxPrice: this.maxPrice,
            isActive: this.isActive,
            isVerified: this.isVerified,
            categoryId: this.categoryId,
            subcategoryId: this.subcategoryId,
            curatorId: this.curatorId,
            locationId: this.locationId,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            // Include related entities if loaded
            category: this.category,
            subcategory: this.subcategory,
            location: this.location,
            // Format curator to exclude sensitive data
            curator: this.curator ? {
                id: this.curator.id,
                email: this.curator.email,
                firstName: this.curator.firstName,
                lastName: this.curator.lastName,
                role: this.curator.role,
                avatar: this.curator.avatar,
                bio: this.curator.bio,
            } : undefined,
        };
    }
}

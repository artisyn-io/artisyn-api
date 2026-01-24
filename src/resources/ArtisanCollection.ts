import { JsonResource } from ".";

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
    data() {
        // Map through the artisan data and format each one
        return this.resource.data.map((artisan: any) => ({
            id: artisan.id,
            name: artisan.name,
            description: artisan.description,
            phone: artisan.phone,
            email: artisan.email,
            website: artisan.website,
            address: artisan.address,
            images: artisan.images,
            priceType: artisan.priceType,
            fixedPrice: artisan.fixedPrice,
            minPrice: artisan.minPrice,
            maxPrice: artisan.maxPrice,
            isActive: artisan.isActive,
            isVerified: artisan.isVerified,
            categoryId: artisan.categoryId,
            subcategoryId: artisan.subcategoryId,
            curatorId: artisan.curatorId,
            locationId: artisan.locationId,
            createdAt: artisan.createdAt,
            updatedAt: artisan.updatedAt,
            // Include related entities if loaded
            category: artisan.category,
            subcategory: artisan.subcategory,
            location: artisan.location,
            // Format curator to exclude sensitive data
            curator: artisan.curator ? {
                id: artisan.curator.id,
                email: artisan.curator.email,
                firstName: artisan.curator.firstName,
                lastName: artisan.curator.lastName,
                role: artisan.curator.role,
                avatar: artisan.curator.avatar,
                bio: artisan.curator.bio,
            } : undefined,
        }));
    }
}

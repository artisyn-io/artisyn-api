import { JsonResource } from ".";
import { Artisan, Location, User, Category, Subcategory } from "@prisma/client";

/**
 * ArtisanResource - Transforms the Artisan (Listing) model for API responses.
 */
export default class ArtisanResource extends JsonResource {
    /**
     * Build the response object
     * @returns this
     */
    data() {
        // Cast resource to the Prisma type for type safety
        const listing = this.resource as Artisan & {
            location?: Location;
            curator?: User;
            category?: Category;
            subcategory?: Subcategory;
        };

        return {
            id: listing.id,
            name: listing.name,
            description: listing.description,
            type: listing.type,
            price: listing.price,
            priceRange: listing.priceRange,
            images: listing.images,

            // Status flags
            isActive: listing.isActive,
            isVerified: listing.isVerified,

            // Format Relations
            category: listing.category ? {
                id: listing.category.id,
                name: listing.category.name,
                icon: listing.category.icon
            } : null,

            subcategory: listing.subcategory ? {
                id: listing.subcategory.id,
                name: listing.subcategory.name
            } : null,

            location: listing.location ? {
                id: listing.location.id,
                city: listing.location.city,
                state: listing.location.state,
                country: listing.location.country,
                latitude: listing.location.latitude,
                longitude: listing.location.longitude
            } : null,

            // Sensitive Data Stripping: Only expose public curator info
            curator: listing.curator ? {
                id: listing.curator.id,
                firstName: listing.curator.firstName,
                lastName: listing.curator.lastName,
                avatar: listing.curator.avatar,
                bio: listing.curator.bio
            } : null,

            createdAt: listing.createdAt,
            updatedAt: listing.updatedAt
        };
    }
}

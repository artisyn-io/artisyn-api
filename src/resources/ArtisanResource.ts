import { Resource } from './Resource';

export default class ArtisanResource extends Resource {
    toArray() {
        return {
            id: this.data.id,
            name: this.data.name,
            phone: this.data.phone,
            description: this.data.description,
            price: this.data.price,
            priceRange: this.data.priceRange,
            images: this.data.images,
            verified: this.data.isVerified,
            active: this.data.isActive,
            category: this.data.category ? {
                id: this.data.category.id,
                name: this.data.category.name,
                icon: this.data.category.icon
            } : null,
            subcategory: this.data.subcategory ? {
                id: this.data.subcategory.id,
                name: this.data.subcategory.name
            } : null,
            location: this.data.location ? {
                id: this.data.location.id,
                city: this.data.location.city,
                state: this.data.location.state,
                country: this.data.location.country
            } : null,
            curator: this.data.curator ? {
                id: this.data.curator.id,
                name: `${this.data.curator.firstName} ${this.data.curator.lastName}`
            } : null,
            createdAt: this.data.createdAt,
            updatedAt: this.data.updatedAt,
        };
    }
}

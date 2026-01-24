import { ResourceCollection } from './Resource';

export default class ArtisanCollection extends ResourceCollection {
    toArray() {
        return {
            data: this.collection.map((item: any) => ({
                id: item.id,
                name: item.name,
                phone: item.phone,
                description: item.description,
                price: item.price,
                images: item.images,
                verified: item.isVerified,
                active: item.isActive,
                category: item.category ? {
                    id: item.category.id,
                    name: item.category.name,
                    icon: item.category.icon
                } : null,
                location: item.location ? {
                    id: item.location.id,
                    city: item.location.city,
                    state: item.location.state
                } : null,
                curator: item.curator ? {
                    id: item.curator.id,
                    name: `${item.curator.firstName} ${item.curator.lastName}`
                } : null,
                createdAt: item.createdAt
            })),
            meta: { pagination: this.meta }
        };
    }
}

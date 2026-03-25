import { JsonResource } from ".";

export default class extends JsonResource {
    data() {
        return {
            id: this.id,
            applicationId: this.applicationId,
            listingId: this.listingId,
            clientId: this.clientId,
            curatorId: this.curatorId,
            status: this.resource.status,
            notes: this.notes,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            listing: this.listing ? {
                id: this.listing.id,
                name: this.listing.name,
                description: this.listing.description,
            } : undefined,
            client: this.client ? {
                id: this.client.id,
                firstName: this.client.firstName,
                lastName: this.client.lastName,
                avatar: this.client.avatar,
            } : undefined,
            curator: this.curator ? {
                id: this.curator.id,
                firstName: this.curator.firstName,
                lastName: this.curator.lastName,
                avatar: this.curator.avatar,
            } : undefined,
        };
    }
}

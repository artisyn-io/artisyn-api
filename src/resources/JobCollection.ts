import { JsonResource, Resource } from ".";

export default class extends JsonResource {
    data(): Resource {
        const jobs = Array.isArray(this.resource.data) ? this.resource.data : this.resource;

        return {
            data: Array.isArray(jobs) ? jobs.map((job: any) => ({
                id: job.id,
                applicationId: job.applicationId,
                listingId: job.listingId,
                clientId: job.clientId,
                curatorId: job.curatorId,
                status: job.status,
                notes: job.notes,
                createdAt: job.createdAt,
                updatedAt: job.updatedAt,
                listing: job.listing ? {
                    id: job.listing.id,
                    name: job.listing.name,
                    description: job.listing.description,
                } : undefined,
                client: job.client ? {
                    id: job.client.id,
                    firstName: job.client.firstName,
                    lastName: job.client.lastName,
                    avatar: job.client.avatar,
                } : undefined,
                curator: job.curator ? {
                    id: job.curator.id,
                    firstName: job.curator.firstName,
                    lastName: job.curator.lastName,
                    avatar: job.curator.avatar,
                } : undefined,
            })) : [],
            pagination: this.resource.pagination,
        };
    }
}

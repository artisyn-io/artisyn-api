import { JsonResource, Resource } from ".";

/**
 * TipCollection
 *
 * Transforms a collection of Tip models into the API response format
 */
export default class extends JsonResource {
    /**
     * Build the response object for a collection of tips
     * @returns Collection of tips formatted for API response
     */
    data(): Resource {
        const tips = Array.isArray(this.resource.data) ? this.resource.data : this.resource;

        return {
            data: Array.isArray(tips) ? tips.map((tip: any) => ({
                id: tip.id,
                amount: tip.amount,
                currency: tip.currency,
                message: tip.message,
                status: tip.status,
                senderId: tip.senderId,
                receiverId: tip.receiverId,
                artisanId: tip.artisanId,
                txHash: tip.txHash,
                createdAt: tip.createdAt,
                updatedAt: tip.updatedAt,
                sender: tip.sender ? {
                    id: tip.sender.id,
                    firstName: tip.sender.firstName,
                    lastName: tip.sender.lastName,
                    avatar: tip.sender.avatar,
                } : undefined,
                receiver: tip.receiver ? {
                    id: tip.receiver.id,
                    firstName: tip.receiver.firstName,
                    lastName: tip.receiver.lastName,
                    avatar: tip.receiver.avatar,
                } : undefined,
                artisan: tip.artisan ? {
                    id: tip.artisan.id,
                    name: tip.artisan.name,
                    avatar: tip.artisan.avatar,
                } : undefined,
            })) : [],
            pagination: this.resource.pagination,
        };
    }
}

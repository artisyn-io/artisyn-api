import { JsonResource } from ".";

/**
 * TipResource
 *
 * Transforms a single Tip model into the API response format
 */
export default class extends JsonResource {
    /**
     * Build the response object
     * @returns Tip data formatted for API response
     */
    data() {
        return {
            id: this.id,
            amount: this.amount,
            currency: this.currency,
            message: this.message,
            status: this.status,
            senderId: this.senderId,
            receiverId: this.receiverId,
            artisanId: this.artisanId,
            txHash: this.txHash,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            // Include relations if available
            sender: this.sender ? {
                id: this.sender.id,
                firstName: this.sender.firstName,
                lastName: this.sender.lastName,
                avatar: this.sender.avatar,
            } : undefined,
            receiver: this.receiver ? {
                id: this.receiver.id,
                firstName: this.receiver.firstName,
                lastName: this.receiver.lastName,
                avatar: this.receiver.avatar,
            } : undefined,
            artisan: this.artisan ? {
                id: this.artisan.id,
                name: this.artisan.name,
                avatar: this.artisan.avatar,
            } : undefined,
        };
    }
}

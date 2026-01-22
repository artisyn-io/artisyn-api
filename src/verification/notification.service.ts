import { Injectable } from "@nestjs/common";
import { VerificationApplication } from "./entities/verification-application.entity";

@Injectable()
export class NotificationService {
  async notifyStatusChange(app: VerificationApplication) {
    // Plug email / websocket / push later
    console.log(`[NOTIFY] Curator ${app.curatorId} verification ${app.status}`);
  }
}

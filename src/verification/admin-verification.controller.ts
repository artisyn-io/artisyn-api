import { Request, Response } from "express";
import { VerificationService } from "./verification.service";
import { ReviewApplicationDto } from "./dto/review-application.dto";

export default class AdminVerificationController {
  private readonly service: VerificationService;

  constructor() {
    this.service = new VerificationService();
  }

  async listAll(req: Request, res: Response) {
    try {
      const result = await this.service.listAllApplications();
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async review(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const dto: ReviewApplicationDto = req.body;
      const userId = (req as any).user.id;

      const result = await this.service.reviewApplication(id, dto, userId);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}

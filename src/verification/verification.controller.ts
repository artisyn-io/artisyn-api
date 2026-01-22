import { Request, Response } from "express";
import { VerificationService } from "./verification.service";
import { SubmitApplicationDto } from "./dto/submit-application.dto";

export default class VerificationController {
  private readonly service: VerificationService;

  constructor() {
    this.service = new VerificationService();
  }

  async apply(req: Request, res: Response) {
    try {
      const dto: SubmitApplicationDto = req.body;
      const result = await this.service.submitApplication(req.user.id, dto);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async getStatus(req: Request, res: Response) {
    try {
      const result = await this.service.getMyStatus(req.user.id);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}

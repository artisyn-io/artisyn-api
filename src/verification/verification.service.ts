import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { VerificationApplication } from "./entities/verification-application.entity";
import { VerificationHistory } from "./entities/verification-history.entity";
import { VerificationLevel } from "./entities/verification-level.entity";
import { SubmitApplicationDto } from "./dto/submit-application.dto";
import { ReviewApplicationDto } from "./dto/review-application.dto";
import { NotificationService } from "./notification.service";

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(VerificationApplication)
    private readonly applicationRepo: Repository<VerificationApplication>,

    @InjectRepository(VerificationHistory)
    private readonly historyRepo: Repository<VerificationHistory>,

    @InjectRepository(VerificationLevel)
    private readonly levelRepo: Repository<VerificationLevel>,

    private readonly notificationService: NotificationService,
  ) {}

  async submitApplication(curatorId: string, dto: SubmitApplicationDto) {
    const level = await this.levelRepo.findOneBy({ id: dto.levelId });
    if (!level) throw new NotFoundException("Verification level not found");

    const application = this.applicationRepo.create({
      curatorId,
      level,
    });

    const saved = await this.applicationRepo.save(application);

    await this.logHistory(saved.id, "SUBMITTED", curatorId);
    return saved;
  }

  async getMyStatus(curatorId: string) {
    return this.applicationRepo.find({
      where: { curatorId },
      order: { createdAt: "DESC" },
    });
  }

  async listAllApplications() {
    return this.applicationRepo.find({
      order: { createdAt: "DESC" },
    });
  }

  async reviewApplication(
    applicationId: string,
    dto: ReviewApplicationDto,
    adminId: string,
  ) {
    const application = await this.applicationRepo.findOneBy({
      id: applicationId,
    });

    if (!application) {
      throw new NotFoundException("Application not found");
    }

    application.status = dto.status;
    await this.applicationRepo.save(application);

    await this.logHistory(
      application.id,
      `STATUS_${dto.status.toUpperCase()}`,
      adminId,
    );

    await this.notificationService.notifyStatusChange(application);

    return application;
  }

  private async logHistory(
    applicationId: string,
    action: string,
    actorId: string,
  ) {
    const history = this.historyRepo.create({
      applicationId,
      action,
      actorId,
    });

    await this.historyRepo.save(history);
  }
}

import { IsEnum, IsOptional, IsString } from "class-validator";
import { VerificationStatus } from "../enums/verification-status.enum";

export class ReviewApplicationDto {
  @IsEnum(VerificationStatus)
  status: VerificationStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

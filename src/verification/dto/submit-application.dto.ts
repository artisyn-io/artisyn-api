import { IsUUID } from "class-validator";

export class SubmitApplicationDto {
  @IsUUID()
  levelId: string;
}

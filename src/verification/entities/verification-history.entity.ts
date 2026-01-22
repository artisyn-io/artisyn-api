import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity("verification_history")
export class VerificationHistory {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  applicationId: string;

  @Column()
  action: string;

  @Column()
  actorId: string;

  @CreateDateColumn()
  timestamp: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { VerificationStatus } from '../enums/verification-status.enum';
import { VerificationLevel } from './verification-level.entity';

@Entity('verification_applications')
export class VerificationApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  curatorId: string;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  status: VerificationStatus;

  @ManyToOne(() => VerificationLevel, { eager: true })
  level: VerificationLevel;

  @CreateDateColumn()
  createdAt: Date;
}

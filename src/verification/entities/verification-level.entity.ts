import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('verification_levels')
export class VerificationLevel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column('text')
  benefits: string;
}

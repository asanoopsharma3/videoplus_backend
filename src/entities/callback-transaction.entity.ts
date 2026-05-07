import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'callback_transactions' })
export class CallbackTransaction {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'serviceType', type: 'varchar', length: 100, nullable: true })
  serviceType: string | null;

  @Column({ name: 'contentId', type: 'integer', nullable: true })
  contentId: number | null;

  @Column({ name: 'resultCode', type: 'integer', nullable: true })
  resultCode: number | null;

  @Column({ name: 'renFlag', type: 'varchar', length: 10, nullable: true })
  renFlag: string | null;

  @Column({ name: 'requestNo', type: 'varchar', length: 200, unique: true })
  requestNo: string;

  @Column({ name: 'log_time', type: 'timestamp' })
  logTime: Date;

  @Column({
    name: 'optionalParameter3',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  optionalParameter3: string | null;

  @Column({ name: 'sequenceNo', type: 'varchar', length: 64, nullable: true })
  sequenceNo: string | null;

  @Column({ name: 'callingParty', type: 'varchar', length: 20, nullable: true })
  callingParty: string | null;

  @Column({ name: 'newContentId', type: 'integer', nullable: true })
  newContentId: number | null;

  @Column({ name: 'bearerId', type: 'varchar', length: 20, nullable: true })
  bearerId: string | null;

  @Column({ name: 'operationId', type: 'varchar', length: 20, nullable: true })
  operationId: string | null;

  @Column({ name: 'requestedPlan', type: 'varchar', length: 50, nullable: true })
  requestedPlan: string | null;

  @Column({ name: 'appliededPlan', type: 'varchar', length: 50, nullable: true })
  appliededPlan: string | null;

  @Column({
    name: 'chargeAmount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
  })
  chargeAmount: string;

  @Column({ name: 'serviceNode', type: 'varchar', length: 50, nullable: true })
  serviceNode: string | null;

  @Column({ name: 'msisdn', type: 'varchar', length: 20, nullable: true })
  msisdn: string | null;

  @Column({ name: 'serviceId', type: 'varchar', length: 50, nullable: true })
  serviceId: string | null;

  @Column({ name: 'keyword', type: 'varchar', length: 50, nullable: true })
  keyword: string | null;

  @Column({ name: 'category', type: 'varchar', length: 10, nullable: true })
  category: string | null;

  @Column({ name: 'validityDays', type: 'integer', nullable: true })
  validityDays: number | null;

  @Column({ name: 'status', type: 'varchar', length: 50, nullable: true })
  status: string | null;

  @Column({ name: 'action_type', type: 'varchar', length: 20, nullable: true })
  actionType: string | null;

  @Column({ name: 'event_date', type: 'date', nullable: true })
  eventDate: string | null;

  @Column({ name: 'is_chargeable', type: 'boolean', default: false })
  isChargeable: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

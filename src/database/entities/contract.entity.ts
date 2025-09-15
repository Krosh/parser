import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { Customer } from './customer.entity';
import { Participant } from './participant.entity';
import { ModelVariant } from './model-variant.entity';

@Entity('contracts')
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  contractNumber: string;

  @Column()
  reestrNumber: string;

  @Column({ nullable: true })
  versionNumber: string;

  @Column({ nullable: true })
  docType: string;

  @Column({ nullable: true })
  mainDocId: string;

  @Column('text', { nullable: true })
  contractSubject: string;

  @Column('decimal', { precision: 15, scale: 2, nullable: true })
  contractPrice: number;

  @Column({ nullable: true })
  currencyCode: string;

  @Column({ nullable: true })
  currencyName: string;

  @Column({ nullable: true })
  placingWayCode: string;

  @Column({ nullable: true })
  placingWayName: string;

  @Column({ nullable: true })
  purchaseCode: string;

  @Column({ nullable: true })
  purchaseNumber: string;

  @Column({ type: 'date', nullable: true })
  contractStartDate: Date;

  @Column({ type: 'date', nullable: true })
  contractEndDate: Date;

  @Column({ type: 'date', nullable: true })
  signDate: Date;

  @Column({ nullable: true })
  deliveryPlace: string;

  @Column('text', { nullable: true })
  warrantyTerm: string;

  @Column('decimal', { precision: 15, scale: 2, nullable: true })
  guaranteeAmount: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  guaranteePercent: number;

  @Column('uuid')
  customerId: string;

  @ManyToOne(() => Customer, customer => customer.contracts)
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column('uuid')
  participantId: string;

  @ManyToOne(() => Participant, participant => participant.contracts)
  @JoinColumn({ name: 'participantId' })
  participant: Participant;

  @OneToMany(() => ModelVariant, modelVariant => modelVariant.contract)
  modelVariants: ModelVariant[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
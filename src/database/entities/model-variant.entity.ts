import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { Contract } from './contract.entity';
import { Model } from './model.entity';
import { Characteristic } from './characteristic.entity';

@Entity('model_variants')
export class ModelVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  quantity: number;

  @Column('decimal', { precision: 15, scale: 2 })
  price: number;

  @Column('decimal', { precision: 15, scale: 2 })
  sum: number;

  @Column({ nullable: true })
  okeiCode: string;

  @Column({ nullable: true })
  okeiName: string;

  @Column({ nullable: true })
  vatCode: string;

  @Column({ nullable: true })
  vatName: string;

  @Column('uuid')
  contractId: string;

  @ManyToOne(() => Contract, contract => contract.modelVariants)
  @JoinColumn({ name: 'contractId' })
  contract: Contract;

  @Column('uuid')
  modelId: string;

  @ManyToOne(() => Model, model => model.variants)
  @JoinColumn({ name: 'modelId' })
  model: Model;

  @OneToMany(() => Characteristic, characteristic => characteristic.modelVariant)
  characteristics: Characteristic[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
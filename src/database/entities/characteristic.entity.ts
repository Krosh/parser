import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { ModelVariant } from './model-variant.entity';

@Entity('characteristics')
export class Characteristic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  code: string;

  @Column()
  name: string;

  @Column('text')
  value: string;

  @Column({ nullable: true })
  type: string;

  @Column({ nullable: true })
  kind: string;

  @Column({ nullable: true })
  okeiCode: string;

  @Column({ nullable: true })
  okeiName: string;

  @Column({ nullable: true })
  normalizedName: string;

  @Column('decimal', { precision: 5, scale: 4, nullable: true })
  matchSimilarity: number;

  @Column({ type: 'boolean', default: false })
  isMatched: boolean;

  @Column('uuid')
  modelVariantId: string;

  @ManyToOne(() => ModelVariant, modelVariant => modelVariant.characteristics)
  @JoinColumn({ name: 'modelVariantId' })
  modelVariant: ModelVariant;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
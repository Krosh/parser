import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('model_contract_mappings')
@Unique(['contractNumber', 'certificateName'])
@Index(['normalizedName'])
@Index(['contractNumber'])
export class ModelContractMapping {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'varchar',
    length: 255,
    comment: 'Реестровый номер контракта',
  })
  contractNumber: string;

  @Column({
    type: 'text',
    comment: 'Оригинальное название модели из сертификата',
  })
  certificateName: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'Нормализованное название модели',
  })
  normalizedName: string | null;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 3,
    nullable: true,
    comment: 'Коэффициент уверенности в нормализации (0-1)',
  })
  confidenceScore: number | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'Метод извлечения (pattern_name или smart_fallback)',
  })
  extractionMethod: string | null;

  @CreateDateColumn({ comment: 'Дата создания записи' })
  createdAt: Date;

  @UpdateDateColumn({ comment: 'Дата последнего обновления' })
  updatedAt: Date;
}

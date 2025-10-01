import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ModelVariant } from './model-variant.entity';

@Entity('models')
export class Model {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true, unique: true })
  normalizedName: string;

  @Column({ nullable: true })
  ktruCode: string;

  @Column({ nullable: true })
  ktruName: string;

  @Column({ nullable: true })
  okpd2Code: string;

  @Column({ nullable: true })
  okpd2Name: string;

  @Column({ nullable: true })
  medicalProductCode: string;

  @Column({ nullable: true })
  medicalProductName: string;

  @Column('text', { nullable: true })
  certificateName: string;

  @Column({ nullable: true })
  originCountryCode: string;

  @Column({ nullable: true })
  originCountryName: string;

  @OneToMany(() => ModelVariant, modelVariant => modelVariant.model)
  variants: ModelVariant[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
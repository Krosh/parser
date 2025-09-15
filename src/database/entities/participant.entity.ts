import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Contract } from './contract.entity';

@Entity('participants')
export class Participant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  middleName: string;

  @Column({ nullable: true })
  fullName: string;

  @Column({ default: false })
  isIP: boolean;

  @Column({ nullable: true })
  inn: string;

  @Column('text', { nullable: true })
  factAddress: string;

  @Column('text', { nullable: true })
  postAddress: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  contactPhone: string;

  @Column({ nullable: true })
  contractorRegistryNum: string;

  @Column({ nullable: true })
  statusCode: string;

  @Column({ nullable: true })
  statusName: string;

  @OneToMany(() => Contract, contract => contract.participant)
  contracts: Contract[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
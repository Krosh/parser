import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Contract } from './contract.entity';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  regNum: string;

  @Column({ nullable: true })
  consRegistryNum: string;

  @Column('text')
  fullName: string;

  @Column({ nullable: true })
  shortName: string;

  @Column('text', { nullable: true })
  postAddress: string;

  @Column('text', { nullable: true })
  factAddress: string;

  @Column()
  inn: string;

  @Column({ nullable: true })
  kpp: string;

  @Column({ nullable: true })
  okopfCode: string;

  @Column({ nullable: true })
  okopfName: string;

  @Column({ nullable: true })
  contactLastName: string;

  @Column({ nullable: true })
  contactFirstName: string;

  @Column({ nullable: true })
  contactMiddleName: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  contactPhone: string;

  @OneToMany(() => Contract, contract => contract.customer)
  contracts: Contract[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Model, ModelVariant, Characteristic, Contract } from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([Model, ModelVariant, Characteristic, Contract])
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
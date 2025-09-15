import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { 
  Customer, 
  Participant, 
  Contract, 
  Model, 
  ModelVariant, 
  Characteristic 
} from '../../database/entities';
import { XmlParserService } from './services/xml-parser.service';
import { ContractStorageService } from './services/contract-storage.service';
import { ContractParserService } from './services/contract-parser.service';
import { ContractListParserService } from './services/contract-list-parser.service';
import { ContractFileDownloaderService } from './services/contract-file-downloader.service';
import { ParserController } from './controllers/parser.controller';
import { DataController } from './controllers/data.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      Participant,
      Contract,
      Model,
      ModelVariant,
      Characteristic,
    ]),
  ],
  controllers: [
    ParserController,
    DataController,
  ],
  providers: [
    XmlParserService,
    ContractStorageService,
    ContractParserService,
    ContractListParserService,
    ContractFileDownloaderService,
  ],
  exports: [
    XmlParserService,
    ContractStorageService,
    ContractParserService,
    ContractListParserService,
    ContractFileDownloaderService,
  ],
})
export class ParserModule {}
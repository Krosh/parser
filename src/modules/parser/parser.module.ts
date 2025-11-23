import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { 
  Customer, 
  Participant, 
  Contract, 
  Model, 
  ModelVariant, 
  Characteristic,
  ModelContractMapping
} from '../../database/entities';
import { XmlParserService } from './services/xml-parser.service';
import { ContractStorageService } from './services/contract-storage.service';
import { ContractParserService } from './services/contract-parser.service';
import { ContractListParserService } from './services/contract-list-parser.service';
import { ContractFileDownloaderService } from './services/contract-file-downloader.service';
import { CharacteristicMatcherService } from './services/characteristic-matcher.service';
import { ModelNormalizerService } from './services/model-normalizer.service';
import { ModelSearchService } from './services/model-search.service';
import { ParserController } from './controllers/parser.controller';
import { DataController } from './controllers/data.controller';
import { ModelSearchController } from './controllers/model-search.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      Participant,
      Contract,
      Model,
      ModelVariant,
      Characteristic,
      ModelContractMapping,
    ]),
  ],
  controllers: [
    ParserController,
    DataController,
    ModelSearchController,
  ],
  providers: [
    XmlParserService,
    ContractStorageService,
    ContractParserService,
    ContractListParserService,
    ContractFileDownloaderService,
    CharacteristicMatcherService,
    ModelNormalizerService,
    ModelSearchService,
  ],
  exports: [
    XmlParserService,
    ContractStorageService,
    ContractParserService,
    ContractListParserService,
    ContractFileDownloaderService,
    CharacteristicMatcherService,
    ModelNormalizerService,
  ],
})
export class ParserModule {}
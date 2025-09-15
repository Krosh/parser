import { Injectable, Logger } from '@nestjs/common';
import { XmlParserService } from './xml-parser.service';
import { ContractStorageService } from './contract-storage.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ContractParserService {
  private readonly logger = new Logger(ContractParserService.name);

  constructor(
    private xmlParserService: XmlParserService,
    private contractStorageService: ContractStorageService,
  ) {}

  async parseContractFile(filePath: string): Promise<void> {
    try {
      this.logger.log(`Parsing contract file: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const xmlContent = fs.readFileSync(filePath, 'utf-8');
      const contractData = await this.xmlParserService.parseContractXml(xmlContent);
      await this.contractStorageService.saveContract(contractData);

      this.logger.log(`Successfully processed contract: ${contractData.contractNumber}`);
    } catch (error) {
      this.logger.error(`Error parsing contract file ${filePath}: ${error.message}`);
      throw error;
    }
  }

  async parseContractsFromDirectory(directoryPath: string): Promise<void> {
    try {
      this.logger.log(`Parsing contracts from directory: ${directoryPath}`);
      
      if (!fs.existsSync(directoryPath)) {
        throw new Error(`Directory not found: ${directoryPath}`);
      }

      const files = fs.readdirSync(directoryPath);
      const xmlFiles = files.filter(file => file.endsWith('.xml'));

      this.logger.log(`Found ${xmlFiles.length} XML files to process`);

      let successCount = 0;
      let errorCount = 0;

      for (const file of xmlFiles) {
        try {
          const filePath = path.join(directoryPath, file);
          await this.parseContractFile(filePath);
          successCount++;
        } catch (error) {
          this.logger.error(`Failed to process file ${file}: ${error.message}`);
          errorCount++;
        }
      }

      this.logger.log(`Processing complete. Success: ${successCount}, Errors: ${errorCount}`);
    } catch (error) {
      this.logger.error(`Error parsing contracts from directory: ${error.message}`);
      throw error;
    }
  }

  async parseContractFromXmlString(xmlContent: string): Promise<void> {
    try {
      const contractData = await this.xmlParserService.parseContractXml(xmlContent);
      await this.contractStorageService.saveContract(contractData);
      this.logger.log(`Successfully processed contract: ${contractData.contractNumber}`);
    } catch (error) {
      this.logger.error(`Error parsing contract from XML string: ${error.message}`);
      throw error;
    }
  }
}
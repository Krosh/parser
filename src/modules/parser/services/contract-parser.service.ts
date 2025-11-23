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

  async parseContractFile(
    filePath: string,
    contractNumber?: string,
  ): Promise<void> {
    try {
      this.logger.log(`Parsing contract file: ${filePath}`);

      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const xmlContent = fs.readFileSync(filePath, 'utf-8');
      const contractData = await this.xmlParserService.parseContractXml(
        xmlContent,
        contractNumber,
      );
      await this.contractStorageService.saveContract(contractData);

      this.logger.log(
        `Successfully processed contract: ${contractData.contractNumber}`,
      );
    } catch (error) {
      this.logger.error(
        `Error parsing contract file ${filePath}: ${error.message}`,
      );
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
      const xmlFiles = files.filter((file) => file.endsWith('.xml'));

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

      this.logger.log(
        `Processing complete. Success: ${successCount}, Errors: ${errorCount}`,
      );
    } catch (error) {
      this.logger.error(
        `Error parsing contracts from directory: ${error.message}`,
      );
      throw error;
    }
  }

  async findContractXmlFiles(reestrNumber: string): Promise<string[]> {
    try {
      // Ищем в downloads директории, где скачиваются файлы
      const downloadsDir = path.join(process.cwd(), 'downloads');

      if (!fs.existsSync(downloadsDir)) {
        this.logger.warn(`Downloads directory not found: ${downloadsDir}`);
        return [];
      }

      // Ищем файлы, которые начинаются с номера контракта
      const files = fs.readdirSync(downloadsDir);
      const xmlFiles = files
        .filter(
          (file) => file.startsWith(reestrNumber) && file.endsWith('.xml'),
        )
        .map((file) => path.join(downloadsDir, file));

      this.logger.log(
        `Found ${xmlFiles.length} XML files for contract ${reestrNumber}`,
      );
      return xmlFiles;
    } catch (error) {
      this.logger.error(
        `Error finding XML files for contract ${reestrNumber}: ${error.message}`,
      );
      return [];
    }
  }
}

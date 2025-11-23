import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ContractParserService } from '../services/contract-parser.service';
import { ContractListParserService } from '../services/contract-list-parser.service';
import { ContractFileDownloaderService } from '../services/contract-file-downloader.service';
import { CharacteristicMatcherService } from '../services/characteristic-matcher.service';

@Controller('parser')
export class ParserController {
  private readonly logger = new Logger(ParserController.name);

  constructor(
    private contractParserService: ContractParserService,
    private contractListParserService: ContractListParserService,
    private contractFileDownloaderService: ContractFileDownloaderService,
    private characteristicMatcherService: CharacteristicMatcherService,
  ) {}

  @Post('parse-file')
  async parseContractFile(@Body() body: { filePath: string }) {
    try {
      if (!body.filePath) {
        throw new BadRequestException('File path is required');
      }

      await this.contractParserService.parseContractFile(body.filePath);
      return {
        success: true,
        message: 'Contract file parsed and saved successfully',
      };
    } catch (error) {
      this.logger.error(`Error parsing file: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to parse file: ${error.message}`,
      );
    }
  }

  @Post('parse-directory')
  async parseContractsFromDirectory(@Body() body: { directoryPath: string }) {
    try {
      if (!body.directoryPath) {
        throw new BadRequestException('Directory path is required');
      }

      await this.contractParserService.parseContractsFromDirectory(
        body.directoryPath,
      );
      return {
        success: true,
        message: 'Directory contracts parsed successfully',
      };
    } catch (error) {
      this.logger.error(`Error parsing directory: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to parse directory: ${error.message}`,
      );
    }
  }

  @Get('contracts/search')
  async searchContracts(
    @Query('page') page: string = '1',
    @Query('startPage') startPage?: string,
    @Query('endPage') endPage?: string,
  ) {
    try {
      if (startPage && endPage) {
        const start = parseInt(startPage);
        const end = parseInt(endPage);

        if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
          throw new BadRequestException('Invalid page range');
        }

        const contracts =
          await this.contractListParserService.fetchMultiplePages(start, end);
        return {
          success: true,
          data: contracts,
          totalContracts: contracts.length,
          pageRange: { start, end },
        };
      } else {
        const pageNum = parseInt(page);
        if (isNaN(pageNum) || pageNum < 1) {
          throw new BadRequestException('Invalid page number');
        }

        const contracts =
          await this.contractListParserService.fetchContractList(pageNum);
        return {
          success: true,
          data: contracts,
          totalContracts: contracts.length,
          page: pageNum,
        };
      }
    } catch (error) {
      this.logger.error(`Error searching contracts: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to search contracts: ${error.message}`,
      );
    }
  }

  @Post('download/:reestrNumber')
  async downloadContractFiles(@Param('reestrNumber') reestrNumber: string) {
    try {
      if (!reestrNumber) {
        throw new BadRequestException('Reestr number is required');
      }

      const downloadedFiles =
        await this.contractFileDownloaderService.downloadAllContractFiles(
          reestrNumber,
        );
      return {
        success: true,
        message: `Downloaded ${downloadedFiles.length} files for contract ${reestrNumber}`,
        files: downloadedFiles,
      };
    } catch (error) {
      this.logger.error(`Error downloading contract files: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to download files: ${error.message}`,
      );
    }
  }

  @Post('process-contract/:reestrNumber')
  async processFullContract(@Param('reestrNumber') reestrNumber: string) {
    try {
      if (!reestrNumber) {
        throw new BadRequestException('Reestr number is required');
      }

      // Download files
      const downloadedFiles =
        await this.contractFileDownloaderService.downloadAllContractFiles(
          reestrNumber,
        );

      // Parse XML files
      const xmlFiles = downloadedFiles.filter((file) => file.endsWith('.xml'));
      let parsedCount = 0;

      for (const xmlFile of xmlFiles) {
        try {
          await this.contractParserService.parseContractFile(
            xmlFile,
            reestrNumber,
          );
          parsedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to parse file ${xmlFile}: ${error.message}`,
          );
        }
      }

      return {
        success: true,
        message: `Processed contract ${reestrNumber}`,
        downloadedFiles: downloadedFiles.length,
        parsedFiles: parsedCount,
        files: downloadedFiles,
      };
    } catch (error) {
      this.logger.error(`Error processing contract: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to process contract: ${error.message}`,
      );
    }
  }

  @Post('parse-single-contract/:reestrNumber')
  async parseSingleContract(@Param('reestrNumber') reestrNumber: string) {
    try {
      if (!reestrNumber) {
        throw new BadRequestException('Reestr number is required');
      }

      this.logger.log(`Starting to parse contract: ${reestrNumber}`);

      // Find XML files for this contract
      const xmlFiles =
        await this.contractParserService.findContractXmlFiles(reestrNumber);

      if (xmlFiles.length === 0) {
        throw new BadRequestException(
          `No XML files found for contract ${reestrNumber}. Download files first.`,
        );
      }

      let parsedCount = 0;
      const results: Array<{
        file: string;
        success: boolean;
        result?: any;
        error?: string;
      }> = [];

      for (const xmlFile of xmlFiles) {
        try {
          this.logger.log(`Parsing file: ${xmlFile}`);
          await this.contractParserService.parseContractFile(
            xmlFile,
            reestrNumber,
          );
          parsedCount++;
          results.push({
            file: xmlFile,
            success: true,
          });
          this.logger.log(`Successfully parsed: ${xmlFile}`);
        } catch (error) {
          this.logger.error(
            `Failed to parse file ${xmlFile}: ${error.message}`,
          );
          results.push({
            file: xmlFile,
            success: false,
            error: error.message,
          });
        }
      }

      return {
        success: true,
        message: `Parsed contract ${reestrNumber}`,
        reestrNumber,
        totalFiles: xmlFiles.length,
        parsedFiles: parsedCount,
        results,
      };
    } catch (error) {
      this.logger.error(`Error parsing single contract: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to parse contract: ${error.message}`,
      );
    }
  }

  @Post('batch-process')
  async batchProcessContracts(
    @Body()
    body: {
      page?: number;
      startPage?: number;
      endPage?: number;
      downloadOnly?: boolean;
    },
  ) {
    try {
      const results = {
        totalContracts: 0,
        processed: 0,
        errors: 0,
        downloaded: 0,
        parsed: 0,
      };

      if (body.startPage && body.endPage) {
        // Process pages one by one instead of fetching all at once
        for (let page = body.startPage; page <= body.endPage; page++) {
          try {
            const contracts =
              await this.contractListParserService.fetchContractList(page);
            results.totalContracts += contracts.length;
            this.logger.log(
              `Processing page ${page} with ${contracts.length} contracts`,
            );

            // Process contracts from this page immediately
            for (const contract of contracts) {
              try {
                const downloadedFiles =
                  await this.contractFileDownloaderService.downloadAllContractFiles(
                    contract.reestrNumber,
                  );
                results.downloaded += downloadedFiles.length;

                if (!body.downloadOnly) {
                  const xmlFiles = downloadedFiles.filter((file) =>
                    file.endsWith('.xml'),
                  );
                  for (const xmlFile of xmlFiles) {
                    try {
                      await this.contractParserService.parseContractFile(
                        xmlFile,
                        contract.reestrNumber,
                      );
                      results.parsed++;
                    } catch (error) {
                      this.logger.error(
                        `Failed to parse file ${xmlFile}: ${error.message}`,
                      );
                    }
                  }
                }

                results.processed++;
              } catch (error) {
                this.logger.error(
                  `Failed to process contract ${contract.reestrNumber}: ${error.message}`,
                );
                results.errors++;
              }
            }

            this.logger.log(
              `Completed page ${page}. Total processed: ${results.processed}`,
            );
          } catch (error) {
            this.logger.error(
              `Failed to process page ${page}: ${error.message}`,
            );
            results.errors++;
          }
        }
      } else {
        // Single page processing
        const page = body.page || 1;
        const contracts =
          await this.contractListParserService.fetchContractList(page);
        results.totalContracts = contracts.length;

        for (const contract of contracts) {
          try {
            const downloadedFiles =
              await this.contractFileDownloaderService.downloadAllContractFiles(
                contract.reestrNumber,
              );
            results.downloaded += downloadedFiles.length;

            if (!body.downloadOnly) {
              const xmlFiles = downloadedFiles.filter((file) =>
                file.endsWith('.xml'),
              );
              for (const xmlFile of xmlFiles) {
                try {
                  await this.contractParserService.parseContractFile(
                    xmlFile,
                    contract.reestrNumber,
                  );
                  results.parsed++;
                } catch (error) {
                  this.logger.error(
                    `Failed to parse file ${xmlFile}: ${error.message}`,
                  );
                }
              }
            }

            results.processed++;
          } catch (error) {
            this.logger.error(
              `Failed to process contract ${contract.reestrNumber}: ${error.message}`,
            );
            results.errors++;
          }
        }
      }

      return {
        success: true,
        message: 'Batch processing completed',
        results,
      };
    } catch (error) {
      this.logger.error(`Error in batch processing: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to batch process: ${error.message}`,
      );
    }
  }
}

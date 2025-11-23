import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Model, Characteristic, Contract } from '../../database/entities';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

interface ReportData {
  modelName: string;
  certificateName: string;
  characteristics: {
    [characteristicName: string]: Array<{
      value: string;
      reestrNumber: string;
    }>;
  };
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Model)
    private modelRepository: Repository<Model>,
    @InjectRepository(Characteristic)
    private characteristicRepository: Repository<Characteristic>,
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
  ) {}

  async generateSummaryReport(limit?: number): Promise<string> {
    this.logger.log('Starting summary report generation...');

    try {
      // Load allowed model names from file
      const allowedModelNames = this.loadAllowedModelNames();
      this.logger.log(
        `Loaded ${allowedModelNames.size} allowed model names from model_names_only.txt`,
      );

      // Get characteristics with related model and contract data (with optional limit)
      let query = this.characteristicRepository
        .createQueryBuilder('char')
        .leftJoinAndSelect('char.modelVariant', 'modelVariant')
        .leftJoinAndSelect('modelVariant.model', 'model')
        .leftJoinAndSelect('modelVariant.contract', 'contract')
        .where('char.name IS NOT NULL AND char.value IS NOT NULL')
        .orderBy('model.name', 'ASC')
        .addOrderBy('char.name', 'ASC');

      if (limit && limit > 0) {
        query = query.limit(limit);
      }

      const characteristics = await query.getMany();

      this.logger.log(`Found ${characteristics.length} characteristics`);

      // Group data by model+certificate and characteristic
      const reportData: { [key: string]: ReportData } = {};
      const allCharacteristicNames = new Set<string>();

      for (const char of characteristics) {
        if (!char.modelVariant?.model || !char.modelVariant?.contract) continue;

        const modelName =
          char.modelVariant.model.normalizedName ||
          char.modelVariant.model.name;
        // Filter by allowed model names - skip if not in the allowed list
        if (!allowedModelNames.has(modelName)) {
          continue;
        }

        const certificateName = char.modelVariant.model.certificateName || '';
        const charName = char.name;

        const charValue = char.value;
        const reestrNumber = char.modelVariant.contract.reestrNumber;

        // Create unique key for model + certificate combination
        const key = `${modelName}|${certificateName}`;

        // Track all characteristic names for CSV headers
        allCharacteristicNames.add(charName);

        // Initialize model+certificate data if not exists
        if (!reportData[key]) {
          reportData[key] = {
            modelName,
            certificateName,
            characteristics: {},
          };
        }

        // Initialize characteristic array if not exists
        if (!reportData[key].characteristics[charName]) {
          reportData[key].characteristics[charName] = [];
        }

        // Check if this value-reestr combination already exists
        const existing = reportData[key].characteristics[charName].find(
          (item) =>
            item.value === charValue && item.reestrNumber === reestrNumber,
        );

        if (!existing) {
          reportData[key].characteristics[charName].push({
            value: charValue,
            reestrNumber: reestrNumber,
          });
        }
      }

      // Convert to CSV format
      const csvContent = this.generateCSV(
        reportData,
        Array.from(allCharacteristicNames),
      );

      // Save to file
      const reportsDir = path.join(process.cwd(), 'reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      const filename = `summary_report_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
      const filePath = path.join(reportsDir, filename);

      fs.writeFileSync(filePath, csvContent, 'utf-8');

      this.logger.log(`Summary report generated: ${filePath}`);
      this.logger.log(
        `Report contains ${Object.keys(reportData).length} models and ${allCharacteristicNames.size} characteristics`,
      );

      return filePath;
    } catch (error) {
      this.logger.error(`Error generating summary report: ${error.message}`);
      throw error;
    }
  }

  async generateSummaryReportXLSX(limit?: number): Promise<string> {
    this.logger.log('Starting XLSX summary report generation...');

    try {
      // Load allowed model names from file
      const allowedModelNames = this.loadAllowedModelNames();
      this.logger.log(
        `Loaded ${allowedModelNames.size} allowed model names from model_names_only.txt`,
      );

      // Get characteristics with related model and contract data (reuse the same query logic)
      let query = this.characteristicRepository
        .createQueryBuilder('char')
        .leftJoinAndSelect('char.modelVariant', 'modelVariant')
        .leftJoinAndSelect('modelVariant.model', 'model')
        .leftJoinAndSelect('modelVariant.contract', 'contract')
        .where('char.name IS NOT NULL AND char.value IS NOT NULL')
        .orderBy('model.name', 'ASC')
        .addOrderBy('char.name', 'ASC');

      if (limit && limit > 0) {
        query = query.limit(limit);
      }

      const characteristics = await query.getMany();

      this.logger.log(`Found ${characteristics.length} characteristics`);

      // Group data by model+certificate and characteristic
      const reportData: { [key: string]: ReportData } = {};
      const allCharacteristicNames = new Set<string>();

      for (const char of characteristics) {
        if (!char.modelVariant?.model || !char.modelVariant?.contract) continue;

        const modelName =
          char.modelVariant.model.normalizedName ||
          char.modelVariant.model.name;
        // Filter by allowed model names - skip if not in the allowed list
        if (!allowedModelNames.has(modelName)) {
          continue;
        }

        const certificateName = char.modelVariant.model.certificateName || '';
        const charName = char.name;
        const charValue = char.value;
        const reestrNumber = char.modelVariant.contract.reestrNumber;

        // Create unique key for model + certificate combination
        const key = `${modelName}|${certificateName}`;

        // Track all characteristic names for Excel headers
        allCharacteristicNames.add(charName);

        // Initialize model+certificate data if not exists
        if (!reportData[key]) {
          reportData[key] = {
            modelName,
            certificateName,
            characteristics: {},
          };
        }

        // Initialize characteristic array if not exists
        if (!reportData[key].characteristics[charName]) {
          reportData[key].characteristics[charName] = [];
        }

        // Check if this value-reestr combination already exists
        const existing = reportData[key].characteristics[charName].find(
          (item) =>
            item.value === charValue && item.reestrNumber === reestrNumber,
        );

        if (!existing) {
          reportData[key].characteristics[charName].push({
            value: charValue,
            reestrNumber: reestrNumber,
          });
        }
      }

      // Log debugging info
      this.logger.log(`Models found: ${Object.keys(reportData).join(', ')}`);
      this.logger.log(`Total models: ${Object.keys(reportData).length}`);

      // Convert to XLSX format
      const worksheetData = this.generateWorksheetData(
        reportData,
        Array.from(allCharacteristicNames),
      );
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      // Auto-size columns
      const colWidths = worksheetData[0].map((_, colIndex) => {
        const maxLength = Math.max(
          ...worksheetData.map((row) =>
            row[colIndex] ? row[colIndex].toString().length : 0,
          ),
        );
        return { wch: Math.min(maxLength + 2, 50) }; // Max width 50 characters
      });
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Summary Report');

      // Save to file
      const reportsDir = path.join(process.cwd(), 'reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      const filename = `summary_report_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
      const filePath = path.join(reportsDir, filename);

      XLSX.writeFile(workbook, filePath);

      this.logger.log(`XLSX summary report generated: ${filePath}`);
      this.logger.log(
        `Report contains ${Object.keys(reportData).length} models and ${allCharacteristicNames.size} characteristics`,
      );

      return filePath;
    } catch (error) {
      this.logger.error(
        `Error generating XLSX summary report: ${error.message}`,
      );
      throw error;
    }
  }

  private generateWorksheetData(
    reportData: { [key: string]: ReportData },
    characteristicNames: string[],
  ): any[][] {
    const worksheetData: any[][] = [];

    // Create header row
    const headers = ['Model', 'Certificate Name', ...characteristicNames];
    worksheetData.push(headers);

    // Create data rows
    const keys = Object.keys(reportData).sort();
    this.logger.log(
      `Processing ${keys.length} model+certificate combinations for worksheet`,
    );

    for (const key of keys) {
      const data = reportData[key];
      const row: any[] = [data.modelName, data.certificateName || ''];

      for (const charName of characteristicNames) {
        const charData = data.characteristics[charName] || [];

        // Group values and their contracts
        const valueGroups: { [value: string]: string[] } = {};

        for (const item of charData) {
          if (!valueGroups[item.value]) {
            valueGroups[item.value] = [];
          }
          valueGroups[item.value].push(item.reestrNumber);
        }

        // Format cell content: "value1 (reestr1, reestr2); value2 (reestr3)"
        let cellContent = Object.entries(valueGroups)
          .map(([value, reestrs]) => {
            const uniqueReestrs = [...new Set(reestrs)].sort();
            return `${value} (${uniqueReestrs.join(', ')})`;
          })
          .join('; ');

        // Excel has a 32,767 character limit per cell
        const maxLength = 32767;
        if (cellContent.length > maxLength) {
          cellContent =
            cellContent.substring(0, maxLength - 20) + '... [truncated]';
        }

        row.push(cellContent || '');
      }

      worksheetData.push(row);
    }

    this.logger.log(
      `Generated worksheet with ${worksheetData.length} rows (including header)`,
    );
    return worksheetData;
  }

  private generateCSV(
    reportData: { [key: string]: ReportData },
    characteristicNames: string[],
  ): string {
    const csvLines: string[] = [];

    // Create header row
    const headers = ['Model', 'Certificate Name', ...characteristicNames];
    csvLines.push(this.csvEscape(headers).join(','));

    // Create data rows
    for (const key of Object.keys(reportData).sort()) {
      const data = reportData[key];
      const row: string[] = [
        this.csvEscapeCell(data.modelName),
        this.csvEscapeCell(data.certificateName || ''),
      ];

      for (const charName of characteristicNames) {
        const charData = data.characteristics[charName] || [];

        // Group values and their contracts
        const valueGroups: { [value: string]: string[] } = {};

        for (const item of charData) {
          if (!valueGroups[item.value]) {
            valueGroups[item.value] = [];
          }
          valueGroups[item.value].push(item.reestrNumber);
        }

        // Format cell content: "value1 (reestr1, reestr2); value2 (reestr3)"
        const cellContent = Object.entries(valueGroups)
          .map(([value, reestrs]) => {
            const uniqueReestrs = [...new Set(reestrs)].sort();
            return `${value} (${uniqueReestrs.join(', ')})`;
          })
          .join('; ');

        row.push(this.csvEscapeCell(cellContent));
      }

      csvLines.push(row.join(','));
    }

    return csvLines.join('\n');
  }

  private csvEscape(values: string[]): string[] {
    return values.map((value) => this.csvEscapeCell(value));
  }

  private csvEscapeCell(value: string): string {
    if (!value) return '""';

    // If the value contains comma, newline, or quotes, wrap in quotes and escape internal quotes
    if (value.includes(',') || value.includes('\n') || value.includes('"')) {
      return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
  }

  private loadAllowedModelNames(): Set<string> {
    try {
      const filePath = path.join(process.cwd(), 'model_names_only.txt');
      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Parse the file content - each line contains a model name
      const allowedNames = new Set<string>();
      const lines = fileContent.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine) {
          // Each line is just a model name (no prefix format)
          allowedNames.add(trimmedLine);
        }
      }

      this.logger.log(`Parsed ${allowedNames.size} model names from file`);
      if (allowedNames.size === 0) {
        this.logger.warn('No model names found in file - check file format');
        // Log first few lines for debugging
        const firstLines = lines
          .slice(0, 3)
          .map((l) => l.trim())
          .filter((l) => l);
        this.logger.log(`First lines: ${JSON.stringify(firstLines)}`);
      }

      return allowedNames;
    } catch (error) {
      this.logger.error(
        `Error loading model names from file: ${(error as Error).message}`,
      );
      // Return empty set if file can't be read - this will filter out all models
      return new Set<string>();
    }
  }

  async getReportStats(): Promise<{
    totalModels: number;
    totalCharacteristics: number;
    totalContracts: number;
  }> {
    const [totalModels, totalCharacteristics, totalContracts] =
      await Promise.all([
        this.modelRepository.count(),
        this.characteristicRepository.count(),
        this.contractRepository.count(),
      ]);

    return {
      totalModels,
      totalCharacteristics,
      totalContracts,
    };
  }
}

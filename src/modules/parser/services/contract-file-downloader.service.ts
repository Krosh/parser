import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { ContractFile } from '../dto/contract-list.dto';

@Injectable()
export class ContractFileDownloaderService {
  private readonly logger = new Logger(ContractFileDownloaderService.name);
  private readonly BASE_URL = 'https://zakupki.gov.ru';
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_BASE = 2000; // 2 seconds base delay

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = this.MAX_RETRIES
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          const delayMs = this.RETRY_DELAY_BASE * Math.pow(2, attempt - 2); // Exponential backoff
          this.logger.warn(`${operationName} - Attempt ${attempt}/${maxRetries} after ${delayMs}ms delay`);
          await this.delay(delayMs);
        }
        
        return await operation();
      } catch (error) {
        lastError = error;
        const isRetryableError = this.isRetryableError(error);
        
        if (attempt === maxRetries || !isRetryableError) {
          this.logger.error(`${operationName} - Final attempt ${attempt} failed: ${error.message}`);
          throw error;
        }
        
        this.logger.warn(`${operationName} - Attempt ${attempt} failed: ${error.message}, retrying...`);
      }
    }
    
    throw lastError;
  }

  private isRetryableError(error: any): boolean {
    // Retry on network errors, timeouts, and 5xx server errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }
    
    if (error.response?.status >= 500) {
      return true;
    }
    
    // Retry on specific 4xx errors that might be temporary
    if (error.response?.status === 429 || error.response?.status === 408) {
      return true;
    }
    
    return false;
  }

  async getContractInfoId(reestrNumber: string): Promise<string | null> {
    return this.retryOperation(
      async () => {
        const contractUrl = `/epz/contract/contractCard/common-info.html?reestrNumber=${reestrNumber}`;
        await this.delay(1000);

        const httpsAgent = new https.Agent({
          minVersion: 'TLSv1.2',
          ciphers: 'DEFAULT',
        });

        const response = await axios.get(`${this.BASE_URL}${contractUrl}`, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
            'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
            Connection: 'keep-alive',
          },
          httpsAgent,
        });

        const $ = cheerio.load(response.data);

        // Look for contractInfoId in links or forms
        const documentLink = $('a[href*="document-info.html"]').first();
        if (documentLink.length > 0) {
          const href = documentLink.attr('href');
          if (href) {
            const urlParams = new URLSearchParams(href.split('?')[1]);
            return urlParams.get('contractInfoId');
          }
        }

        // Alternative: look for it in JavaScript variables or hidden inputs
        const scriptText = response.data;
        const contractInfoIdMatch = scriptText.match(
          /contractInfoId[\"\\s]*[:=][\"\\s]*([^\"&\\s]+)/,
        );
        if (contractInfoIdMatch) {
          return contractInfoIdMatch[1];
        }

        return null;
      },
      `getContractInfoId(${reestrNumber})`
    ).catch(error => {
      this.logger.error(`Error getting contractInfoId for ${reestrNumber}:`, error.message);
      return null;
    });
  }

  async findContractFiles(
    reestrNumber: string,
    contractInfoId: string,
  ): Promise<ContractFile[]> {
    try {
      const documentUrl = `/epz/contract/contractCard/document-info.html?reestrNumber=${reestrNumber}&contractInfoId=${contractInfoId}`;
      await this.delay(1000);

      const httpsAgent = new https.Agent({
        minVersion: 'TLSv1.2',
        ciphers: 'DEFAULT',
      });

      const response = await axios.get(`${this.BASE_URL}${documentUrl}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
          'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
          Connection: 'keep-alive',
        },
        httpsAgent,
      });

      const $ = cheerio.load(response.data);
      const files: ContractFile[] = [];

      $(
        'a[href*="https://zakupki.gov.ru/44fz/filestore/public/1.0/download"]',
      ).each((i, el) => {
        const href = $(el).attr('href');
        const title = $(el).attr('title') || $(el).text().trim();

        if (href && title) {
          const extension = this.getFileExtension(title);
          const timestamp = Date.now();
          const filename = `${reestrNumber}_${timestamp}_${i}.${extension}`;
          files.push({
            url: href,
            title,
            filename,
          });
        }
      });

      return files;
    } catch (error) {
      this.logger.error(`Error finding contract files for ${reestrNumber}:`, error);
      return [];
    }
  }

  private getFileExtension(title: string): string {
    // Pattern for "filename.ext (size)" - most common case
    let match = title.match(/\.(\w+)\s*\(/);
    if (match) {
      const ext = match[1].toLowerCase();
      // Validate it's a supported extension
      if (['doc', 'docx', 'pdf', 'xml'].includes(ext)) {
        return ext;
      }
    }

    // Pattern for "filename.ext" at the end or before space
    match = title.match(/\.(\w+)(?:\s|$)/);
    if (match) {
      const ext = match[1].toLowerCase();
      if (['doc', 'docx', 'pdf', 'xml'].includes(ext)) {
        return ext;
      }
    }

    // Look for supported extensions anywhere in the title
    const supportedExts = ['docx', 'doc', 'pdf', 'xml'];
    for (const ext of supportedExts) {
      if (title.toLowerCase().includes(`.${ext}`)) {
        return ext;
      }
    }

    // Special cases - sometimes extensions appear without dots
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('docx')) return 'docx';
    if (lowerTitle.includes('pdf')) return 'pdf';
    if (lowerTitle.includes('xml')) return 'xml';
    if (lowerTitle.includes('doc')) return 'doc';

    // Default to doc if no extension found
    this.logger.warn(
      `Could not determine file extension for title: "${title}", defaulting to doc`,
    );
    return 'doc';
  }

  async downloadContractFile(
    fileUrl: string,
    filename: string,
    downloadDir: string = 'downloads',
  ): Promise<string> {
    return this.retryOperation(
      async () => {
        const downloadsDir = path.join(process.cwd(), downloadDir);

        // Create downloads directory if it doesn't exist
        if (!fs.existsSync(downloadsDir)) {
          fs.mkdirSync(downloadsDir, { recursive: true });
        }

        const filePath = path.join(downloadsDir, filename);

        const httpsAgent = new https.Agent({
          minVersion: 'TLSv1.2',
          ciphers: 'DEFAULT',
        });

        const response = await axios({
          method: 'GET',
          url: fileUrl,
          responseType: 'stream',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
          httpsAgent,
          timeout: 30000, // 30 second timeout
        });

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        return new Promise<string>((resolve, reject) => {
          writer.on('finish', () => resolve(filePath));
          writer.on('error', reject);
        });
      },
      `downloadContractFile(${filename})`
    );
  }

  async downloadAllContractFiles(reestrNumber: string): Promise<string[]> {
    try {
      const contractInfoId = await this.getContractInfoId(reestrNumber);
      if (!contractInfoId) {
        throw new Error(`Could not find contractInfoId for ${reestrNumber}`);
      }

      const files = await this.findContractFiles(reestrNumber, contractInfoId);
      
      // Filter only XML files
      const xmlFiles = files.filter(file => {
        const extension = this.getFileExtension(file.title);
        return extension === 'xml';
      });

      this.logger.log(`Found ${files.length} total files, ${xmlFiles.length} XML files for contract ${reestrNumber}`);
      
      const downloadedFiles: string[] = [];

      for (const file of xmlFiles) {
        try {
          const filePath = await this.downloadContractFile(file.url, file.filename);
          downloadedFiles.push(filePath);
          this.logger.log(`Downloaded: ${file.filename}`);
        } catch (error) {
          this.logger.error(`Failed to download ${file.filename}: ${error.message}`);
        }
      }

      return downloadedFiles;
    } catch (error) {
      this.logger.error(`Error downloading files for contract ${reestrNumber}: ${error.message}`);
      throw error;
    }
  }
}
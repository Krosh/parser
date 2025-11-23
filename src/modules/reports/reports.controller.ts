import { Controller, Get, Res, Query, Logger } from '@nestjs/common';
import { ReportsService } from './reports.service';
import * as fs from 'fs';
import * as path from 'path';

@Controller('reports')
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(private readonly reportsService: ReportsService) {}

  // @Get('summary')
  // async generateSummaryReport(@Res() res: any, @Query('limit') limit?: string) {
  //   try {
  //     this.logger.log('Generating summary report...');

  //     const limitNum = limit ? parseInt(limit, 10) : undefined;
  //     const filePath =
  //       await this.reportsService.generateSummaryReport(limitNum);
  //     const filename = path.basename(filePath);

  //     // Set headers for file download
  //     res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  //     res.setHeader(
  //       'Content-Disposition',
  //       `attachment; filename="${filename}"`,
  //     );

  //     // Stream the file
  //     const fileStream = fs.createReadStream(filePath);
  //     fileStream.pipe(res);

  //     this.logger.log(`Summary report sent: ${filename}`);
  //   } catch (error) {
  //     this.logger.error(`Error generating summary report: ${error.message}`);
  //     res.status(500).json({
  //       error: 'Failed to generate summary report',
  //       message: error.message,
  //     });
  //   }
  // }

  @Get('summary')
  async generateSummaryReportXLSX(@Query('limit') limit?: string) {
    this.logger.log('Generating XLSX summary report...');

    const limitNum = limit ? parseInt(limit!, 10) : undefined;
    const filePath =
      await this.reportsService.generateSummaryReportXLSX(limitNum);
    const filename = path.basename(filePath);

    return { filename };
  }

  @Get('stats')
  async getReportStats() {
    try {
      const stats = await this.reportsService.getReportStats();
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error(`Error getting report stats: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

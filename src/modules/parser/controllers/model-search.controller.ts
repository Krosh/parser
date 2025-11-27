import {
  Controller,
  Get,
  Post,
  Body,
  Render,
  Logger,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ModelSearchService } from '../services/model-search.service';
import { CsvFilterParserService } from '../services/csv-filter-parser.service';
import { ModelSearchDto } from '../dto/model-search.dto';

@Controller('model-search')
export class ModelSearchController {
  private readonly logger = new Logger(ModelSearchController.name);

  constructor(
    private modelSearchService: ModelSearchService,
    private csvFilterParserService: CsvFilterParserService,
  ) {}

  @Get()
  @Render('model-search')
  async getSearchPage() {
    try {
      const characteristics =
        await this.modelSearchService.getAvailableCharacteristics();
      return {
        title: 'Поиск моделей по характеристикам',
        characteristics,
        operators: [
          { value: '=', label: 'Равно (=)' },
          { value: '<=', label: 'Меньше или равно (<=)' },
          { value: '>=', label: 'Больше или равно (>=)' },
        ],
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error loading search page: ${errorMessage}`);
      return {
        title: 'Поиск моделей по характеристикам',
        characteristics: [],
        operators: [],
        error: 'Ошибка загрузки характеристик',
      };
    }
  }

  @Post('search')
  async searchModels(@Body() searchDto: ModelSearchDto) {
    try {
      const models = await this.modelSearchService.searchModels(searchDto);
      return {
        success: true,
        data: models,
        count: models.length,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error searching models: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
        data: [],
        count: 0,
      };
    }
  }

  @Post('upload-csv')
  @UseInterceptors(FileInterceptor('csvFile'))
  async uploadCsvFilters(@UploadedFile() file: Express.Multer.File) {
    try {
      if (!file) {
        return {
          success: false,
          error: 'Файл не загружен',
        };
      }

      // Парсим CSV и получаем фильтры
      const filters =
        await this.csvFilterParserService.parseFiltersCsv(file.buffer);

      return {
        success: true,
        filters: filters,
        count: filters.length,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error uploading CSV: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}

import { Controller, Get, Post, Body, Render, Logger } from '@nestjs/common';
import { ModelSearchService } from '../services/model-search.service';
import { ModelSearchDto } from '../dto/model-search.dto';

@Controller('model-search')
export class ModelSearchController {
  private readonly logger = new Logger(ModelSearchController.name);

  constructor(private modelSearchService: ModelSearchService) {}

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
}

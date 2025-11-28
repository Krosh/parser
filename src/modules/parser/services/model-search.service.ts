import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Model } from '../../../database/entities/model.entity';
import { ModelVariant } from '../../../database/entities/model-variant.entity';
import { Characteristic } from '../../../database/entities/characteristic.entity';
import { ModelSearchDto, SearchOperator } from '../dto/model-search.dto';

@Injectable()
export class ModelSearchService {
  constructor(
    @InjectRepository(Model)
    private modelRepository: Repository<Model>,
    @InjectRepository(ModelVariant)
    private modelVariantRepository: Repository<ModelVariant>,
    @InjectRepository(Characteristic)
    private characteristicRepository: Repository<Characteristic>,
  ) {}

  async searchModels(searchDto: ModelSearchDto): Promise<Model[]> {
    // Если есть фильтры по характеристикам, используем оптимизированный подход
    if (searchDto.characteristics && searchDto.characteristics.length > 0) {
      return this.searchModelsWithCharacteristicFilters(searchDto);
    }

    // Простой поиск без фильтров по характеристикам
    const queryBuilder = this.modelRepository
      .createQueryBuilder('model')
      .leftJoinAndSelect('model.variants', 'variant')
      .leftJoinAndSelect('variant.characteristics', 'characteristic');

    this.applyBasicFilters(queryBuilder, searchDto);

    return await queryBuilder.getMany();
  }

  /**
   * Оптимизированный поиск с фильтрацией по характеристикам
   * Сначала находим ID подходящих вариантов, затем загружаем только их
   */
  private async searchModelsWithCharacteristicFilters(
    searchDto: ModelSearchDto,
  ): Promise<Model[]> {
    // Шаг 1: Найти ID вариантов, соответствующих всем фильтрам
    const variantIds = await this.findMatchingVariantIds(searchDto);

    if (variantIds.length === 0) {
      return [];
    }

    // Шаг 2: Загрузить модели только с подходящими вариантами
    const queryBuilder = this.modelRepository
      .createQueryBuilder('model')
      .innerJoin(
        'model.variants',
        'variant',
        'variant.id IN (:...variantIds)',
        {
          variantIds,
        },
      )
      .leftJoinAndSelect('model.variants', 'allVariants')
      .leftJoinAndSelect('allVariants.characteristics', 'characteristic')
      .where('allVariants.id IN (:...variantIds)', { variantIds });

    this.applyBasicFilters(queryBuilder, searchDto);

    return await queryBuilder.getMany();
  }

  /**
   * Находит ID вариантов, которые соответствуют ВСЕМ фильтрам по характеристикам
   */
  private async findMatchingVariantIds(
    searchDto: ModelSearchDto,
  ): Promise<string[]> {
    if (!searchDto.characteristics || searchDto.characteristics.length === 0) {
      return [];
    }

    const filters = searchDto.characteristics;

    // Строим запрос, который находит варианты, имеющие все нужные характеристики с правильными значениями
    let query = this.modelVariantRepository
      .createQueryBuilder('variant')
      .select('variant.id');

    // Для каждого фильтра добавляем EXISTS условие
    filters.forEach((filter, index) => {
      const paramName = `charCode${index}`;
      const valueName = `charValue${index}`;

      query = query.andWhere(
        `EXISTS (
          SELECT 1 FROM characteristics ch
          WHERE ch."modelVariantId" = variant.id
          AND ch.code = :${paramName}
          AND ${this.buildCharacteristicCondition(filter.operator, `ch.value`, `:${valueName}`)}
        )`,
        {
          [paramName]: filter.code,
          [valueName]:
            filter.operator === SearchOperator.EQUALS
              ? `%${filter.value}%`
              : filter.value,
        },
      );
    });

    const results = await query.getRawMany<{ variant_id: string }>();
    return results.map((r) => r.variant_id);
  }

  private applyBasicFilters(
    queryBuilder: SelectQueryBuilder<Model>,
    searchDto: ModelSearchDto,
  ): void {
    // Filter by model name
    if (searchDto.modelName) {
      queryBuilder.andWhere('LOWER(model.name) LIKE LOWER(:modelName)', {
        modelName: `%${searchDto.modelName}%`,
      });
    }

    // Filter by KTRU code
    if (searchDto.ktruCode) {
      queryBuilder.andWhere('model.ktruCode = :ktruCode', {
        ktruCode: searchDto.ktruCode,
      });
    }
  }

  private buildCharacteristicCondition(
    operator: SearchOperator,
    fieldName: string,
    paramName: string,
  ): string {
    switch (operator) {
      case SearchOperator.EQUALS:
        return `LOWER(CAST(${fieldName} AS TEXT)) LIKE LOWER(${paramName})`;
      case SearchOperator.LESS_THAN_OR_EQUAL:
        return `
          CASE
            WHEN CAST(${fieldName} AS TEXT) ~ '^[0-9]+(\\.\\d+)?$'
            THEN CAST(${fieldName} AS DECIMAL) <= CAST(${paramName} AS DECIMAL)
            ELSE LOWER(CAST(${fieldName} AS TEXT)) LIKE LOWER(CONCAT('%', ${paramName}, '%'))
          END
        `;
      case SearchOperator.GREATER_THAN_OR_EQUAL:
        return `
          CASE
            WHEN CAST(${fieldName} AS TEXT) ~ '^[0-9]+(\\.\\d+)?$'
            THEN CAST(${fieldName} AS DECIMAL) >= CAST(${paramName} AS DECIMAL)
            ELSE LOWER(CAST(${fieldName} AS TEXT)) LIKE LOWER(CONCAT('%', ${paramName}, '%'))
          END
        `;
      default:
        return `LOWER(CAST(${fieldName} AS TEXT)) LIKE LOWER(${paramName})`;
    }
  }

  async getAvailableCharacteristics(): Promise<
    { code: string; name: string }[]
  > {
    const characteristics = await this.characteristicRepository
      .createQueryBuilder('characteristic')
      .select([
        'DISTINCT characteristic.code AS code',
        'characteristic.name AS name',
      ])
      .groupBy('characteristic.code, characteristic.name')
      .orderBy('characteristic.name', 'ASC')
      .getRawMany();

    return characteristics;
  }
}

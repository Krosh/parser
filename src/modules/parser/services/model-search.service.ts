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
    const queryBuilder = this.modelRepository
      .createQueryBuilder('model')
      .leftJoinAndSelect('model.variants', 'variant')
      .leftJoinAndSelect('variant.characteristics', 'characteristic');

    this.applyFilters(queryBuilder, searchDto);

    return await queryBuilder.getMany();
  }

  private applyFilters(
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

    // Filter by characteristics
    if (searchDto.characteristics && searchDto.characteristics.length > 0) {
      searchDto.characteristics.forEach((filter, index) => {
        const paramName = `charCode${index}`;
        const valueName = `charValue${index}`;

        queryBuilder.andWhere(
          `EXISTS (
            SELECT 1 FROM model_variants mv 
            JOIN characteristics ch ON ch."modelVariantId" = mv.id 
            WHERE mv."modelId" = model.id 
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

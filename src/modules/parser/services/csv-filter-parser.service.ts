import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parse } from 'csv-parse/sync';
import { CharacteristicFilter, SearchOperator } from '../dto/model-search.dto';
import { Characteristic } from '../../../database/entities/characteristic.entity';

interface CsvFilterRow {
  characteristicName: string;
  characteristicValue: string;
  unit?: string;
  instruction?: string;
}

@Injectable()
export class CsvFilterParserService {
  private readonly logger = new Logger(CsvFilterParserService.name);

  constructor(
    @InjectRepository(Characteristic)
    private characteristicRepository: Repository<Characteristic>,
  ) {}

  /**
   * Парсит CSV файл с условиями фильтра
   * Ожидаемый формат:
   * Column1;Column2;Column3;Column4
   * Наименование характеристики;Значение характеристики*;Единица измерения;Инструкция к заполнению
   */
  async parseFiltersCsv(fileBuffer: Buffer): Promise<CharacteristicFilter[]> {
    try {
      const content = fileBuffer.toString('utf-8');

      const records = parse(content, {
        delimiter: ';',
        skipEmptyLines: true,
        fromLine: 3, // Пропускаем первые 2 строки (заголовки)
        relax_column_count: true,
        trim: true,
      }) as string[][];

      // Загружаем все характеристики для маппинга имён в коды
      const characteristicMap = await this.loadCharacteristicNameToCodeMap();

      const filters: CharacteristicFilter[] = [];
      const notFoundCharacteristics: string[] = [];

      for (const record of records) {
        if (record.length < 2) continue;

        const characteristicName = record[0]?.trim();
        const characteristicValue = record[1]?.trim();

        if (!characteristicName || !characteristicValue) continue;

        // Пропускаем пустые значения
        if (characteristicValue === '' || characteristicValue === '-') continue;

        // Ищем код характеристики по названию
        const characteristicCode = this.findCharacteristicCode(
          characteristicName,
          characteristicMap,
        );

        if (!characteristicCode) {
          this.logger.warn(
            `Characteristic not found for name: "${characteristicName}"`,
          );
          notFoundCharacteristics.push(characteristicName);
          continue;
        }

        // Определяем оператор и значение из строки
        const { operator, value } =
          this.parseValueWithOperator(characteristicValue);

        filters.push({
          code: characteristicCode,
          value: value,
          operator: operator,
        });

        this.logger.debug(
          `Parsed filter: ${characteristicName} (${characteristicCode}) ${operator} ${value}`,
        );
      }

      if (notFoundCharacteristics.length > 0) {
        this.logger.warn(
          `Not found characteristics: ${notFoundCharacteristics.join(', ')}`,
        );
      }

      this.logger.log(
        `Parsed ${filters.length} filters from CSV (${notFoundCharacteristics.length} characteristics not found)`,
      );
      return filters;
    } catch (error) {
      this.logger.error('Error parsing CSV file', error);
      throw new BadRequestException(
        'Ошибка парсинга CSV файла. Проверьте формат файла.',
      );
    }
  }

  /**
   * Загружает все характеристики и создаёт маппинг имя -> код
   */
  private async loadCharacteristicNameToCodeMap(): Promise<
    Map<string, string>
  > {
    const characteristics = await this.characteristicRepository
      .createQueryBuilder('characteristic')
      .select(['characteristic.code', 'characteristic.name'])
      .getMany();

    const map = new Map<string, string>();

    for (const char of characteristics) {
      // Сохраняем как оригинальное имя, так и нормализованное (lowercase)
      const normalizedName = char.name.toLowerCase().trim();
      map.set(normalizedName, char.code);
    }

    return map;
  }

  /**
   * Ищет код характеристики по её названию (нечувствительно к регистру)
   */
  private findCharacteristicCode(
    name: string,
    characteristicMap: Map<string, string>,
  ): string | null {
    const normalizedName = name.toLowerCase().trim();
    return characteristicMap.get(normalizedName) || null;
  }

  /**
   * Извлекает оператор и значение из строки типа "≥ 46" или "Да"
   */
  private parseValueWithOperator(valueStr: string): {
    operator: SearchOperator;
    value: string;
  } {
    const trimmed = valueStr.trim();

    // Проверяем наличие оператора в начале строки
    if (trimmed.startsWith('≥') || trimmed.startsWith('>=')) {
      const value = trimmed.replace(/^(≥|>=)\s*/, '').trim();
      return { operator: SearchOperator.GREATER_THAN_OR_EQUAL, value };
    }

    if (trimmed.startsWith('≤') || trimmed.startsWith('<=')) {
      const value = trimmed.replace(/^(≤|<=)\s*/, '').trim();
      return { operator: SearchOperator.LESS_THAN_OR_EQUAL, value };
    }

    if (trimmed.startsWith('=')) {
      const value = trimmed.replace(/^=\s*/, '').trim();
      return { operator: SearchOperator.EQUALS, value };
    }

    // Если нет оператора, используем "равно" по умолчанию
    return { operator: SearchOperator.EQUALS, value: trimmed };
  }
}

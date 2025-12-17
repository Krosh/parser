import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parse } from 'csv-parse/sync';
import { CharacteristicFilter, SearchOperator } from '../dto/model-search.dto';
import { Characteristic } from '../../../database/entities/characteristic.entity';

export interface CharacteristicFilterWithName extends CharacteristicFilter {
  name: string;
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
  async parseFiltersCsv(fileBuffer: Buffer): Promise<CharacteristicFilterWithName[]> {
    try {
      const content = fileBuffer.toString('utf-8');

      const records = parse(content, {
        delimiter: ';',
        skipEmptyLines: true,
        fromLine: 1, // Пропускаем первые 2 строки (заголовки)
        relax_column_count: true,
        trim: true,
        skip_records_with_error: true, // Пропускаем проблемные строки вместо падения
      }) as string[][];

      // Загружаем все характеристики для маппинга имён в коды
      const characteristicMap = await this.loadCharacteristicNameToCodeMap();

      const filters: CharacteristicFilterWithName[] = [];
      const notFoundCharacteristics: string[] = [];

      // Группируем строки: если первая колонка пустая, это продолжение предыдущей характеристики
      const groupedRecords: Array<{
        name: string;
        values: string[];
      }> = [];

      for (const record of records) {
        if (record.length < 2) continue;

        const characteristicName = record[0]?.trim();
        const characteristicValue = record[1]?.trim();

        if (!characteristicValue) continue;

        if (characteristicName) {
          // Новая характеристика
          groupedRecords.push({
            name: characteristicName,
            values: [characteristicValue],
          });
        } else {
          // Продолжение предыдущей характеристики (первая колонка пустая)
          if (groupedRecords.length > 0) {
            groupedRecords[groupedRecords.length - 1].values.push(
              characteristicValue,
            );
          }
        }
      }

      // Обрабатываем сгруппированные записи
      for (const group of groupedRecords) {
        const characteristicName = group.name;
        const allValues = group.values.join(',');

        // Пропускаем пустые значения и "Неважно"
        if (
          allValues === '' ||
          allValues === '-' ||
          allValues.toLowerCase() === 'неважно'
        ) {
          this.logger.debug(
            `Skipping "${characteristicName}" with value "${allValues}"`,
          );
          continue;
        }

        // Ищем характеристику по названию
        const characteristic = this.findCharacteristic(
          characteristicName,
          characteristicMap,
        );

        if (!characteristic) {
          this.logger.warn(
            `Characteristic not found for name: "${characteristicName}"`,
          );
          notFoundCharacteristics.push(characteristicName);
          continue;
        }

        // Парсим значение и создаем фильтры (может быть несколько для диапазонов/списков)
        const parsedFilters = this.parseValueWithOperator(allValues);

        for (const parsed of parsedFilters) {
          filters.push({
            code: characteristic.code,
            name: characteristic.name,
            value: parsed.value,
            operator: parsed.operator,
          });

          this.logger.debug(
            `Parsed filter: ${characteristicName} (${characteristic.code}) ${parsed.operator} ${parsed.value}`,
          );
        }
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
   * Загружает все характеристики и создаёт маппинг имя -> {код, имя}
   */
  private async loadCharacteristicNameToCodeMap(): Promise<
    Map<string, { code: string; name: string }>
  > {
    const characteristics = await this.characteristicRepository
      .createQueryBuilder('characteristic')
      .select(['characteristic.code', 'characteristic.name'])
      .getMany();

    const map = new Map<string, { code: string; name: string }>();

    for (const char of characteristics) {
      // Сохраняем как оригинальное имя, так и нормализованное (lowercase)
      const normalizedName = char.name.toLowerCase().trim();
      map.set(normalizedName, { code: char.code, name: char.name });
    }

    return map;
  }

  /**
   * Ищет характеристику по её названию (нечувствительно к регистру)
   */
  private findCharacteristic(
    name: string,
    characteristicMap: Map<string, { code: string; name: string }>,
  ): { code: string; name: string } | null {
    const normalizedName = name.toLowerCase().trim();
    return characteristicMap.get(normalizedName) || null;
  }

  /**
   * Извлекает оператор и значение из строки
   * Поддерживает:
   * - Простые значения: "Да", "Нет"
   * - Операторы: "≥ 46", "≤ 2"
   * - Диапазоны: "27 - 46" (преобразуется в два фильтра: >= 27 и <= 46)
   * - Списки: "А,Б,В" (преобразуется в фильтр с объединенным значением)
   */
  private parseValueWithOperator(
    valueStr: string,
  ): Array<{ operator: SearchOperator; value: string }> {
    const trimmed = valueStr.trim();

    // Проверяем диапазон (например "27 - 46")
    const rangeMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
    if (rangeMatch) {
      const [, minValue, maxValue] = rangeMatch;
      return [
        { operator: SearchOperator.GREATER_THAN_OR_EQUAL, value: minValue },
        { operator: SearchOperator.LESS_THAN_OR_EQUAL, value: maxValue },
      ];
    }

    // Проверяем наличие оператора в начале строки
    if (trimmed.startsWith('≥') || trimmed.startsWith('>=')) {
      const value = trimmed.replace(/^(≥|>=)\s*/, '').trim();
      return [{ operator: SearchOperator.GREATER_THAN_OR_EQUAL, value }];
    }

    if (trimmed.startsWith('≤') || trimmed.startsWith('<=')) {
      const value = trimmed.replace(/^(≤|<=)\s*/, '').trim();
      return [{ operator: SearchOperator.LESS_THAN_OR_EQUAL, value }];
    }

    if (trimmed.startsWith('=')) {
      const value = trimmed.replace(/^=\s*/, '').trim();
      return [{ operator: SearchOperator.EQUALS, value }];
    }

    // Проверяем список значений через запятую
    if (trimmed.includes(',')) {
      // Для списков возвращаем один фильтр, который будет искать любое из значений
      // В данном случае просто сохраняем весь список как есть
      return [{ operator: SearchOperator.EQUALS, value: trimmed }];
    }

    // Если нет оператора, используем "равно" по умолчанию
    return [{ operator: SearchOperator.EQUALS, value: trimmed }];
  }
}

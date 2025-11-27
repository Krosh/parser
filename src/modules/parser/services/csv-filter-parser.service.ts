import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { CharacteristicFilter, SearchOperator } from '../dto/model-search.dto';

interface CsvFilterRow {
  characteristicName: string;
  characteristicValue: string;
  unit?: string;
  instruction?: string;
}

@Injectable()
export class CsvFilterParserService {
  private readonly logger = new Logger(CsvFilterParserService.name);

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

      const filters: CharacteristicFilter[] = [];

      for (const record of records) {
        if (record.length < 2) continue;

        const characteristicName = record[0]?.trim();
        const characteristicValue = record[1]?.trim();

        if (!characteristicName || !characteristicValue) continue;

        // Пропускаем пустые значения
        if (characteristicValue === '' || characteristicValue === '-') continue;

        // Определяем оператор и значение из строки
        const { operator, value } = this.parseValueWithOperator(characteristicValue);

        filters.push({
          code: characteristicName,
          value: value,
          operator: operator,
        });

        this.logger.debug(
          `Parsed filter: ${characteristicName} ${operator} ${value}`,
        );
      }

      this.logger.log(`Parsed ${filters.length} filters from CSV`);
      return filters;
    } catch (error) {
      this.logger.error('Error parsing CSV file', error);
      throw new BadRequestException(
        'Ошибка парсинга CSV файла. Проверьте формат файла.',
      );
    }
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

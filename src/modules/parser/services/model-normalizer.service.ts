import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelContractMapping } from '../../../database/entities';
import * as fs from 'fs';
import * as path from 'path';

// Импортируем логику извлечения паттернов
import { extractModelNameFromCertificate as extractFromPatterns } from '../utils/pattern-extractor';

interface ModelMatchResult {
  normalizedName: string | null;
  similarity: number;
  matched: boolean;
  patternName?: string | null;
}

@Injectable()
export class ModelNormalizerService {
  private readonly logger = new Logger(ModelNormalizerService.name);
  private modelNames: string[] = [];
  private readonly SIMILARITY_THRESHOLD = 0.8;

  constructor(
    @InjectRepository(ModelContractMapping)
    private mappingRepository: Repository<ModelContractMapping>,
  ) {
    this.loadModelNames();
  }

  private loadModelNames(): void {
    try {
      const filePath = path.join(process.cwd(), 'model_names_only.txt');
      const fileContent = fs.readFileSync(filePath, 'utf-8');

      this.modelNames = fileContent
        .split('\n')
        .map((line) => line.replace(/^\d+→/, '').trim())
        .filter((name) => name.length > 0);

      this.logger.log(
        `Loaded ${this.modelNames.length} model names for normalization`,
      );
    } catch (error) {
      this.logger.error(`Failed to load model names: ${error.message}`);
      this.modelNames = [];
    }
  }

  normalizeModelName(inputName: string): ModelMatchResult {
    if (!inputName || this.modelNames.length === 0) {
      return {
        normalizedName: null,
        similarity: 0,
        matched: false,
      };
    }

    let bestMatch = '';
    let bestSimilarity = 0;

    for (const modelName of this.modelNames) {
      const similarity = this.calculateSimilarity(inputName, modelName);

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = modelName;
      }
    }

    const matched = bestSimilarity >= this.SIMILARITY_THRESHOLD;

    if (matched) {
      this.logger.debug(
        `Normalized model "${inputName}" to "${bestMatch}" (similarity: ${bestSimilarity.toFixed(3)})`,
      );
    } else {
      this.logger.debug(
        `No suitable match found for model "${inputName}" (best similarity: ${bestSimilarity.toFixed(3)})`,
      );
    }

    return {
      normalizedName: matched ? bestMatch : null,
      similarity: bestSimilarity,
      matched,
    };
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const normalized1 = this.normalizeString(str1);
    const normalized2 = this.normalizeString(str2);

    if (normalized1 === normalized2) {
      return 1.0;
    }

    // Точное совпадение без учета регистра и пробелов
    if (
      normalized1.replace(/\s+/g, '').toLowerCase() ===
      normalized2.replace(/\s+/g, '').toLowerCase()
    ) {
      return 0.95;
    }

    // Проверка на вхождение одной строки в другую
    if (
      normalized1.includes(normalized2) ||
      normalized2.includes(normalized1)
    ) {
      return 0.9;
    }

    // Расстояние Левенштейна
    const levenshteinSimilarity = this.levenshteinSimilarity(
      normalized1,
      normalized2,
    );

    // Жаккардово сходство на уровне слов
    const jaccardSimilarity = this.jaccardSimilarity(normalized1, normalized2);

    // Комбинированная оценка
    return Math.max(levenshteinSimilarity, jaccardSimilarity);
  }

  private normalizeString(str: string): string {
    return str
      .trim()
      .replace(/[^\w\s\-\.]/gi, '') // Удаляем спецсимволы кроме дефисов и точек
      .replace(/\s+/g, ' ') // Нормализуем пробелы
      .toLowerCase();
  }

  private levenshteinSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);

    if (maxLength === 0) return 1.0;

    return 1 - distance / maxLength;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator, // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private jaccardSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(/\s+/));
    const words2 = new Set(str2.split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    if (union.size === 0) return 0;

    return intersection.size / union.size;
  }

  getModelNames(): string[] {
    return [...this.modelNames];
  }

  getModelCount(): number {
    return this.modelNames.length;
  }

  async saveModelContractMapping(
    contractNumber: string,
    certificateName: string,
    normalizedName: string | null,
    confidenceScore: number | null = null,
    extractionMethod: string | null = null,
  ): Promise<void> {
    this.logger.debug(
      `saveModelContractMapping called with: contract="${contractNumber}", certificate="${certificateName.substring(0, 50)}...", normalized="${normalizedName}"`,
    );

    try {
      // Проверяем, есть ли уже такая запись
      const existingMapping = await this.mappingRepository.findOne({
        where: {
          contractNumber,
          certificateName,
        },
      });

      if (existingMapping) {
        // Обновляем существующую запись
        existingMapping.normalizedName = normalizedName;
        existingMapping.confidenceScore = confidenceScore;
        existingMapping.extractionMethod = extractionMethod;
        await this.mappingRepository.save(existingMapping);

        this.logger.debug(
          `Updated model contract mapping: ${contractNumber} -> ${normalizedName}`,
        );
      } else {
        // Создаем новую запись
        const mapping = this.mappingRepository.create({
          contractNumber,
          certificateName,
          normalizedName,
          confidenceScore,
          extractionMethod,
        });

        await this.mappingRepository.save(mapping);

        this.logger.debug(
          `Created model contract mapping: ${contractNumber} -> ${normalizedName}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error saving model contract mapping: ${error.message}`,
      );
    }
  }

  extractModelNameFromCertificate(certificateName: string): {
    modelName: string;
    foundInReferenceList: boolean;
    patternName?: string;
  } {
    if (!certificateName) return { modelName: '', foundInReferenceList: false };

    // Используем общую логику извлечения паттернов
    // @ts-ignore
    const result: ModelMatchResult = extractFromPatterns(certificateName);

    if (result.matched && result.normalizedName) {
      this.logger.debug(
        `Extracted model name "${result.normalizedName}" using pattern "${result.patternName}" from certificate "${certificateName}"`,
      );
      // Если extractFromPatterns нашла совпадение, значит модель есть в эталонном списке
      return {
        modelName: result.normalizedName,
        foundInReferenceList: true,
        patternName: result.patternName || undefined,
      };
    }

    // Универсальный fallback: ищем наиболее похожее название из эталонного списка
    const bestMatch = this.findBestModelInCertificate(certificateName);
    if (bestMatch) {
      this.logger.debug(
        `Smart fallback found "${bestMatch}" in certificate "${certificateName}"`,
      );
      return {
        modelName: bestMatch,
        foundInReferenceList: true,
        patternName: 'smart fallback',
      };
    }

    // Если ничего не найдено, возвращаем первые несколько слов
    const words = certificateName.split(/\s+/);
    const result_fallback = words.slice(0, 3).join(' ');
    this.logger.debug(
      `Fallback model name "${result_fallback}" from certificate "${certificateName}"`,
    );
    return {
      modelName: result_fallback,
      foundInReferenceList: false,
      patternName: 'word fallback',
    };
  }

  private findBestModelInCertificate(certificateName: string): string | null {
    let bestMatch = '';
    let bestScore = 0;
    const SMART_FALLBACK_THRESHOLD = 0.7; // Минимальный порог для умного fallback

    // Нормализуем входную строку для поиска
    const normalizedCertificate = certificateName.toLowerCase();

    for (const modelName of this.modelNames) {
      // Проверяем, содержится ли название модели в сертификате
      const normalizedModel = modelName.toLowerCase();

      // 1. Точное вхождение (высший приоритет) - предпочитаем более длинные названия
      if (normalizedCertificate.includes(normalizedModel)) {
        const score = 1.0 + modelName.length / 1000; // Бонус за длину названия
        if (score > bestScore) {
          bestScore = score;
          bestMatch = modelName;
        }
        continue;
      }

      // 2. Частичное совпадение по словам
      const modelWords = normalizedModel.split(/\s+/);
      const certificateWords = normalizedCertificate.split(/\s+/);

      let matchingWords = 0;
      for (const modelWord of modelWords) {
        for (const certWord of certificateWords) {
          // Точное совпадение слова
          if (modelWord === certWord) {
            matchingWords += 1;
            break;
          }
          // Частичное совпадение (одно слово содержит другое)
          if (modelWord.length > 3 && certWord.includes(modelWord)) {
            matchingWords += 0.8;
            break;
          }
          if (certWord.length > 3 && modelWord.includes(certWord)) {
            matchingWords += 0.8;
            break;
          }
        }
      }

      const wordScore = matchingWords / modelWords.length;
      if (wordScore > bestScore && wordScore >= SMART_FALLBACK_THRESHOLD) {
        bestScore = wordScore;
        bestMatch = modelName;
      }

      // 3. Сходство по расстоянию Левенштейна (для коротких названий)
      if (modelName.length <= 15) {
        const similarity = this.levenshteinSimilarity(
          normalizedModel,
          normalizedCertificate,
        );
        if (similarity > bestScore && similarity >= SMART_FALLBACK_THRESHOLD) {
          bestScore = similarity;
          bestMatch = modelName;
        }
      }
    }

    if (bestScore >= SMART_FALLBACK_THRESHOLD) {
      this.logger.debug(
        `Smart fallback match: "${bestMatch}" with score ${bestScore.toFixed(3)}`,
      );
      return bestMatch;
    }

    return null;
  }
}

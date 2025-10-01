import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface NormalizedCharacteristic {
  name: string;
  value: string;
  unit: string;
}

export interface MatchResult {
  matched: boolean;
  normalizedName: string;
  originalName: string;
  distance: number;
  similarity: number;
}

@Injectable()
export class CharacteristicMatcherService {
  private readonly logger = new Logger(CharacteristicMatcherService.name);
  private normalizedCharacteristics: NormalizedCharacteristic[] = [];
  private readonly csvPath = '/Users/pavelprohorov/Documents/КТРУ 36.csv';
  private readonly maxDistance = 3;
  private readonly minSimilarity = 0.7;

  constructor() {
    this.loadNormalizedCharacteristics();
  }

  private loadNormalizedCharacteristics(): void {
    try {
      if (!fs.existsSync(this.csvPath)) {
        this.logger.warn(`CSV file not found at ${this.csvPath}`);
        return;
      }

      const csvContent = fs.readFileSync(this.csvPath, 'utf-8');
      const lines = csvContent.split('\n').slice(1);

      this.normalizedCharacteristics = lines
        .filter((line) => line.trim())
        .map((line) => {
          const parts = line.split(';');
          if (parts.length >= 3 && parts[0].trim()) {
            return {
              name: parts[0].trim(),
              value: parts[1]?.trim() || '',
              unit: parts[2]?.trim() || '',
            };
          }
          return null;
        })
        .filter(Boolean) as any;

      this.logger.log(
        `Loaded ${this.normalizedCharacteristics.length} normalized characteristics`,
      );
    } catch (error) {
      this.logger.error(
        `Error loading normalized characteristics: ${error.message}`,
      );
    }
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
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator,
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1;

    const distance = this.levenshteinDistance(
      str1.toLowerCase(),
      str2.toLowerCase(),
    );
    return 1 - distance / maxLength;
  }

  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  public findBestMatch(characteristicName: string): MatchResult {
    const normalizedInput = this.normalizeString(characteristicName);
    let bestMatch: MatchResult = {
      matched: false,
      normalizedName: '',
      originalName: characteristicName,
      distance: Infinity,
      similarity: 0,
    };

    for (const normalized of this.normalizedCharacteristics) {
      const normalizedTarget = this.normalizeString(normalized.name);
      const distance = this.levenshteinDistance(
        normalizedInput,
        normalizedTarget,
      );
      const similarity = this.calculateSimilarity(
        normalizedInput,
        normalizedTarget,
      );

      if (similarity > bestMatch.similarity) {
        bestMatch = {
          matched:
            distance <= this.maxDistance && similarity >= this.minSimilarity,
          normalizedName: normalized.name,
          originalName: characteristicName,
          distance,
          similarity,
        };
      }
    }

    return bestMatch;
  }

  public matchCharacteristics(
    characteristics: Array<{ name: string; value?: string }>,
  ): Array<{ original: string; matched: MatchResult }> {
    return characteristics.map((char) => ({
      original: char.name,
      matched: this.findBestMatch(char.name),
    }));
  }

  public getMatchingStatistics(
    matches: Array<{ original: string; matched: MatchResult }>,
  ): {
    total: number;
    matched: number;
    unmatched: number;
    matchRate: number;
  } {
    const total = matches.length;
    const matched = matches.filter((m) => m.matched.matched).length;
    const unmatched = total - matched;
    const matchRate = total > 0 ? matched / total : 0;

    return {
      total,
      matched,
      unmatched,
      matchRate,
    };
  }

  public reloadCharacteristics(): void {
    this.normalizedCharacteristics = [];
    this.loadNormalizedCharacteristics();
  }

  public getNormalizedCharacteristics(): NormalizedCharacteristic[] {
    return [...this.normalizedCharacteristics];
  }

  public setMatchingThresholds(
    maxDistance?: number,
    minSimilarity?: number,
  ): void {
    if (maxDistance !== undefined) {
      (this as any).maxDistance = maxDistance;
    }
    if (minSimilarity !== undefined) {
      (this as any).minSimilarity = minSimilarity;
    }
    this.logger.log(
      `Updated matching thresholds - maxDistance: ${this.maxDistance}, minSimilarity: ${this.minSimilarity}`,
    );
  }
}

import { IsArray, IsEnum, IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum SearchOperator {
  EQUALS = '=',
  LESS_THAN_OR_EQUAL = '<=',
  GREATER_THAN_OR_EQUAL = '>=',
}

export class CharacteristicFilter {
  @IsString()
  code: string;

  @IsString()
  value: string;

  @IsEnum(SearchOperator)
  operator: SearchOperator;
}

export class ModelSearchDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CharacteristicFilter)
  characteristics?: CharacteristicFilter[];

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsString()
  ktruCode?: string;
}
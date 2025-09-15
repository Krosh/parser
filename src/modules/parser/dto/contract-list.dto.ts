export interface ContractInfo {
  reestrNumber: string;
  contractInfoId?: string;
  signDate: string;
  customer: string;
  detailLink: string;
}

export interface ContractFile {
  url: string;
  title: string;
  filename: string;
}

export interface DocumentParsingResult {
  technicalRequirements: TechnicalRequirement[];
  technicalCharacteristics: RawPair[];
}

export interface TechnicalRequirement {
  name: string;
  characteristics: RawPair[];
}

export interface RawPair {
  attr: string;
  value: string;
}
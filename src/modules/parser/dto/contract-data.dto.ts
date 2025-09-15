export interface CustomerData {
  regNum: string;
  consRegistryNum?: string;
  fullName: string;
  shortName?: string;
  postAddress?: string;
  factAddress?: string;
  inn: string;
  kpp?: string;
  okopfCode?: string;
  okopfName?: string;
  contactLastName?: string;
  contactFirstName?: string;
  contactMiddleName?: string;
  email?: string;
  contactPhone?: string;
}

export interface ParticipantData {
  lastName?: string;
  firstName?: string;
  middleName?: string;
  fullName?: string;
  isIP: boolean;
  inn?: string;
  factAddress?: string;
  postAddress?: string;
  email?: string;
  contactPhone?: string;
  contractorRegistryNum?: string;
  statusCode?: string;
  statusName?: string;
}

export interface CharacteristicData {
  code: string;
  name: string;
  value: string;
  type?: string;
  kind?: string;
  okeiCode?: string;
  okeiName?: string;
}

export interface ModelData {
  name: string;
  ktruCode?: string;
  ktruName?: string;
  okpd2Code?: string;
  okpd2Name?: string;
  medicalProductCode?: string;
  medicalProductName?: string;
  certificateName?: string;
  originCountryCode?: string;
  originCountryName?: string;
  quantity: number;
  price: number;
  sum: number;
  okeiCode?: string;
  okeiName?: string;
  vatCode?: string;
  vatName?: string;
  characteristics: CharacteristicData[];
}

export interface ContractData {
  contractNumber: string;
  reestrNumber: string;
  versionNumber?: string;
  docType?: string;
  mainDocId?: string;
  contractSubject?: string;
  contractPrice?: number;
  currencyCode?: string;
  currencyName?: string;
  placingWayCode?: string;
  placingWayName?: string;
  purchaseCode?: string;
  purchaseNumber?: string;
  contractStartDate?: Date;
  contractEndDate?: Date;
  signDate?: Date;
  deliveryPlace?: string;
  warrantyTerm?: string;
  guaranteeAmount?: number;
  guaranteePercent?: number;
  customer: CustomerData;
  participant: ParticipantData;
  models: ModelData[];
}
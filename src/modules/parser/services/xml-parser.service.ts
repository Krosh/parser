import { Injectable, Logger } from '@nestjs/common';
import * as xml2js from 'xml2js';
import { ContractData, CustomerData, ParticipantData, ModelData, CharacteristicData } from '../dto/contract-data.dto';

@Injectable()
export class XmlParserService {
  private readonly logger = new Logger(XmlParserService.name);

  async parseContractXml(xmlContent: string): Promise<ContractData> {
    try {
      const parser = new xml2js.Parser({
        explicitArray: false,
        mergeAttrs: true,
        trim: true,
      });

      const result = await parser.parseStringPromise(xmlContent);
      const contract = result['ns6:cpElectronicContract'] || result.cpElectronicContract;

      if (!contract) {
        throw new Error('Invalid XML format: contract data not found');
      }

      return this.extractContractData(contract);
    } catch (error) {
      this.logger.error(`Error parsing XML: ${error.message}`);
      throw error;
    }
  }

  private extractContractData(contract: any): ContractData {
    const customer = this.extractCustomerData(contract.customerInfo);
    const participant = this.extractParticipantData(contract.participantInfo);
    const models = this.extractModelsData(contract.contractSubjectInfo?.productsInfo);

    // Extract contract dates
    const contractStartDate = this.extractDate(contract.contractConditionsInfo?.contractExecutionTermsInfo?.notRelativeTermsInfo?.startDate);
    const contractEndDate = this.extractDate(contract.contractConditionsInfo?.contractExecutionTermsInfo?.notRelativeTermsInfo?.endDate);

    return {
      contractNumber: contract.contractNumber,
      reestrNumber: this.extractReestrNumber(contract.contractNumber),
      versionNumber: contract.versionNumber,
      docType: contract.docType,
      mainDocId: contract.mainDocInfo?.id,
      contractSubject: contract.contractSubjectInfo?.contractSubject,
      contractPrice: parseFloat(contract.contractFinancingInfo?.contractPriceInfo?.price) || 0,
      currencyCode: contract.contractFinancingInfo?.contractPriceInfo?.currencyInfo?.['ns3:code'],
      currencyName: contract.contractFinancingInfo?.contractPriceInfo?.currencyInfo?.['ns3:name'],
      placingWayCode: contract.foundationInfo?.placingWay?.['ns3:code'],
      placingWayName: contract.foundationInfo?.placingWay?.['ns3:name'],
      purchaseCode: contract.foundationInfo?.purchaseCode,
      purchaseNumber: contract.foundationInfo?.purchaseNumber,
      contractStartDate,
      contractEndDate,
      signDate: new Date(), // TODO: extract actual sign date from XML
      deliveryPlace: contract.contractConditionsInfo?.deliveryPlaceInfo?.byGARInfo?.['ns2:GARInfo']?.['ns2:GARAddress'],
      warrantyTerm: contract.contractConditionsInfo?.warrantyInfo?.warrantyTerm,
      guaranteeAmount: parseFloat(contract.contractConditionsInfo?.contractGuaranteeInfo?.amount) || 0,
      guaranteePercent: parseFloat(contract.contractConditionsInfo?.contractGuaranteeInfo?.part) || 0,
      customer,
      participant,
      models,
    };
  }

  private extractCustomerData(customerInfo: any): CustomerData {
    return {
      regNum: customerInfo['ns2:regNum'],
      consRegistryNum: customerInfo['ns2:consRegistryNum'],
      fullName: customerInfo['ns2:fullName'],
      shortName: customerInfo['ns2:shortName'],
      postAddress: customerInfo['ns2:postAddress'],
      factAddress: customerInfo['ns2:factAddress'],
      inn: customerInfo['ns2:INN'],
      kpp: customerInfo['ns2:KPP'],
      okopfCode: customerInfo.OKOPFInfo?.['ns3:code'],
      okopfName: customerInfo.OKOPFInfo?.['ns3:singularName'],
      contactLastName: customerInfo.contactPersonInfo?.['ns2:lastName'],
      contactFirstName: customerInfo.contactPersonInfo?.['ns2:firstName'],
      contactMiddleName: customerInfo.contactPersonInfo?.['ns2:middleName'],
      email: customerInfo.email,
      contactPhone: customerInfo.contactPhone,
    };
  }

  private extractParticipantData(participantInfo: any): ParticipantData {
    const individualInfo = participantInfo.individualPersonRFInfo;
    
    return {
      lastName: individualInfo?.nameInfo?.['ns2:lastName'],
      firstName: individualInfo?.nameInfo?.['ns2:firstName'],
      middleName: individualInfo?.nameInfo?.['ns2:middleName'],
      fullName: participantInfo.fullName,
      isIP: individualInfo?.isIP === 'true' || individualInfo?.isIP === true,
      inn: individualInfo?.INN,
      factAddress: individualInfo?.factAddress,
      postAddress: individualInfo?.postAddress,
      email: individualInfo?.email,
      contactPhone: individualInfo?.contactPhone,
      contractorRegistryNum: participantInfo.contractorRegistryNum,
      statusCode: participantInfo.status?.['ns3:code'],
      statusName: participantInfo.status?.['ns3:name'],
    };
  }

  private extractModelsData(productsInfo: any): ModelData[] {
    if (!productsInfo?.productsInfoElectronicContract?.productInfo) {
      return [];
    }

    let products = productsInfo.productsInfoElectronicContract.productInfo;
    if (!Array.isArray(products)) {
      products = [products];
    }

    return products.map(product => this.extractModelData(product));
  }

  private extractModelData(product: any): ModelData {
    const characteristics = this.extractCharacteristics(product.KTRUInfo?.characteristics);

    return {
      name: product.name,
      ktruCode: product.KTRUInfo?.['ns3:code'],
      ktruName: product.KTRUInfo?.['ns3:name'],
      okpd2Code: product.OKPD2Info?.['ns3:OKPDCode'],
      okpd2Name: product.OKPD2Info?.['ns3:OKPDName'],
      medicalProductCode: product.medicalProductInfo?.medicalProductCode,
      medicalProductName: product.medicalProductInfo?.medicalProductName,
      certificateName: product.medicalProductInfo?.certificateNameMedicalProduct,
      originCountryCode: product.originCountryInfo?.['ns3:countryCode'],
      originCountryName: product.originCountryInfo?.['ns3:countryFullName'],
      quantity: parseInt(product.quantity) || 1,
      price: parseFloat(product.price) || 0,
      sum: parseFloat(product.sum) || 0,
      okeiCode: product.OKEIInfo?.['ns3:code'],
      okeiName: product.OKEIInfo?.['ns3:name'],
      vatCode: product.VATRateInfo?.['ns3:VATCode'],
      vatName: product.VATRateInfo?.['ns3:VATName'],
      characteristics,
    };
  }

  private extractCharacteristics(characteristicsData: any): CharacteristicData[] {
    if (!characteristicsData?.characteristicsUsingReferenceInfo) {
      return [];
    }

    let characteristics = characteristicsData.characteristicsUsingReferenceInfo;
    if (!Array.isArray(characteristics)) {
      characteristics = [characteristics];
    }

    return characteristics.map(char => ({
      code: char['ns2:code'],
      name: char['ns2:name'],
      value: this.extractCharacteristicValue(char['ns2:values']),
      type: char['ns2:type'],
      kind: char['ns2:kind'],
      okeiCode: char['ns2:OKEI']?.['ns3:code'],
      okeiName: char['ns2:OKEI']?.['ns3:name'],
    }));
  }

  private extractCharacteristicValue(values: any): string {
    if (!values?.['ns2:value']) {
      return '';
    }

    let valueItems = values['ns2:value'];
    if (!Array.isArray(valueItems)) {
      valueItems = [valueItems];
    }

    return valueItems.map(value => {
      if (value['ns2:qualityDescription']) {
        return value['ns2:qualityDescription'];
      }
      if (value['ns2:valueSet']?.['ns2:concreteValue']) {
        return value['ns2:valueSet']['ns2:concreteValue'];
      }
      return '';
    }).filter(v => v).join(', ');
  }

  private extractReestrNumber(contractNumber: string): string {
    // Extract reestr number from contract number (usually the part before the first dash)
    return contractNumber.split('-')[0];
  }

  private extractDate(dateString: string): Date | undefined {
    if (!dateString) return undefined;
    
    try {
      return new Date(dateString);
    } catch {
      return undefined;
    }
  }
}
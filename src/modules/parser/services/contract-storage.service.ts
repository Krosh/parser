import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import {
  Customer,
  Participant,
  Contract,
  Model,
  ModelVariant,
  Characteristic,
} from '../../../database/entities';
import { ContractData } from '../dto/contract-data.dto';

@Injectable()
export class ContractStorageService {
  private readonly logger = new Logger(ContractStorageService.name);

  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Participant)
    private participantRepository: Repository<Participant>,
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
    @InjectRepository(Model)
    private modelRepository: Repository<Model>,
    @InjectRepository(ModelVariant)
    private modelVariantRepository: Repository<ModelVariant>,
    @InjectRepository(Characteristic)
    private characteristicRepository: Repository<Characteristic>,
  ) {}

  async saveContract(contractData: ContractData): Promise<Contract> {
    try {
      // Check if contract already exists
      const existingContract = await this.contractRepository.findOne({
        where: { contractNumber: contractData.contractNumber },
      });

      if (existingContract) {
        this.logger.log(
          `Contract ${contractData.contractNumber} already exists, skipping`,
        );
        return existingContract;
      }

      // Save or get customer
      const savedCustomer = await this.saveCustomer(contractData.customer);

      // Save or get participant
      const savedParticipant = await this.saveParticipant(contractData.participant);

      // Create contract - exclude customer and participant objects from spread
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { customer, participant, ...contractProps } = contractData;
      const contract = this.contractRepository.create({
        ...contractProps,
        customerId: savedCustomer.id,
        participantId: savedParticipant.id,
      });

      const savedContract = await this.contractRepository.save(contract);

      // Save models and variants
      for (const modelData of contractData.models) {
        await this.saveModelVariant(savedContract.id, modelData);
      }

      this.logger.log(
        `Successfully saved contract ${contractData.contractNumber}`,
      );
      return savedContract;
    } catch (error) {
      this.logger.error(
        `Error saving contract ${contractData.contractNumber}: ${error.message}`,
      );
      throw error;
    }
  }

  private async saveCustomer(
    customerData: DeepPartial<Customer>,
  ): Promise<Customer> {
    let customer = await this.customerRepository.findOne({
      where: { regNum: customerData.regNum },
    });

    if (!customer) {
      const newCustomer = this.customerRepository.create(customerData);
      customer = await this.customerRepository.save(newCustomer);
    }

    return customer;
  }

  private async saveParticipant(
    participantData: DeepPartial<Participant>,
  ): Promise<Participant> {
    let participant: Participant | null = null;

    // Try to find by INN first
    if (participantData.inn) {
      participant = await this.participantRepository.findOne({
        where: { inn: participantData.inn },
      });
    }

    if (!participant) {
      const newParticipant = this.participantRepository.create(participantData);
      participant = await this.participantRepository.save(newParticipant);
    }

    return participant;
  }

  private async saveModelVariant(
    contractId: string,
    modelData: any,
  ): Promise<ModelVariant> {
    // Save or get model
    const model = await this.saveModel(modelData);

    // Create model variant
    const modelVariant = this.modelVariantRepository.create({
      contractId,
      modelId: model.id,
      quantity: modelData.quantity,
      price: modelData.price,
      sum: modelData.sum,
      okeiCode: modelData.okeiCode,
      okeiName: modelData.okeiName,
      vatCode: modelData.vatCode,
      vatName: modelData.vatName,
    });

    const savedVariant = await this.modelVariantRepository.save(modelVariant);

    // Save characteristics
    for (const charData of modelData.characteristics) {
      await this.saveCharacteristic(savedVariant.id, charData);
    }

    return savedVariant;
  }

  private async saveModel(modelData: any): Promise<Model> {
    let model: Model | null = null;

    // If we have a normalized name, use it as primary search criteria
    if (modelData.normalizedName) {
      model = await this.modelRepository.findOne({
        where: { normalizedName: modelData.normalizedName },
      });
      
      if (model) {
        this.logger.debug(
          `Found existing model with normalizedName "${modelData.normalizedName}"`
        );
        return model;
      }
    }

    // Fallback to original search criteria if no normalized name or no match found
    const searchCriteria: Record<string, any> = {};
    
    if (modelData.ktruCode) {
      searchCriteria.ktruCode = modelData.ktruCode;
    }
    if (modelData.certificateName) {
      searchCriteria.certificateName = modelData.certificateName;
    }
    if (modelData.medicalProductCode) {
      searchCriteria.medicalProductCode = modelData.medicalProductCode;
    }

    // Only search for existing model if we have meaningful criteria
    if (Object.keys(searchCriteria).length > 0) {
      model = await this.modelRepository.findOne({
        where: searchCriteria,
      });
    }

    if (!model) {
      model = this.modelRepository.create({
        name: modelData.name,
        normalizedName: modelData.normalizedName,
        ktruCode: modelData.ktruCode,
        ktruName: modelData.ktruName,
        okpd2Code: modelData.okpd2Code,
        okpd2Name: modelData.okpd2Name,
        medicalProductCode: modelData.medicalProductCode,
        medicalProductName: modelData.medicalProductName,
        certificateName: modelData.certificateName,
        originCountryCode: modelData.originCountryCode,
        originCountryName: modelData.originCountryName,
      });
      model = await this.modelRepository.save(model);
    }

    return model;
  }

  private async saveCharacteristic(
    modelVariantId: string,
    charData: any,
  ): Promise<Characteristic> {
    const characteristic = this.characteristicRepository.create({
      modelVariantId,
      code: charData.code,
      name: charData.name,
      value: charData.value,
      type: charData.type,
      kind: charData.kind,
      okeiCode: charData.okeiCode,
      okeiName: charData.okeiName,
      normalizedName: charData.normalizedName,
      matchSimilarity: charData.matchSimilarity,
      isMatched: charData.isMatched || false,
    });

    return await this.characteristicRepository.save(characteristic);
  }
}

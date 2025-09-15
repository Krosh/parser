import { Controller, Get, Query, Param, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Contract, Customer, Model, ModelVariant, Characteristic } from '../../../database/entities';

@Controller('data')
export class DataController {
  private readonly logger = new Logger(DataController.name);

  constructor(
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Model)
    private modelRepository: Repository<Model>,
    @InjectRepository(ModelVariant)
    private modelVariantRepository: Repository<ModelVariant>,
    @InjectRepository(Characteristic)
    private characteristicRepository: Repository<Characteristic>,
  ) {}

  @Get('contracts')
  async getContracts(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const whereClause: any = {};
    if (search) {
      whereClause.contractNumber = Like(`%${search}%`);
    }

    const [contracts, total] = await this.contractRepository.findAndCount({
      where: whereClause,
      relations: ['customer', 'participant'],
      take: limitNum,
      skip: offset,
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      data: contracts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      }
    };
  }

  @Get('contracts/:id')
  async getContractById(@Param('id') id: string) {
    const contract = await this.contractRepository.findOne({
      where: { id },
      relations: [
        'customer', 
        'participant', 
        'modelVariants',
        'modelVariants.model',
        'modelVariants.characteristics'
      ],
    });

    if (!contract) {
      return { success: false, message: 'Contract not found' };
    }

    return { success: true, data: contract };
  }

  @Get('customers')
  async getCustomers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const whereClause: any = {};
    if (search) {
      whereClause.fullName = Like(`%${search}%`);
    }

    const [customers, total] = await this.customerRepository.findAndCount({
      where: whereClause,
      take: limitNum,
      skip: offset,
      order: { fullName: 'ASC' },
    });

    return {
      success: true,
      data: customers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      }
    };
  }

  @Get('models')
  async getModels(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const whereClause: any = {};
    if (search) {
      whereClause.name = Like(`%${search}%`);
    }

    const [models, total] = await this.modelRepository.findAndCount({
      where: whereClause,
      relations: ['variants'],
      take: limitNum,
      skip: offset,
      order: { name: 'ASC' },
    });

    return {
      success: true,
      data: models,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      }
    };
  }

  @Get('models/:id')
  async getModelById(@Param('id') id: string) {
    const model = await this.modelRepository.findOne({
      where: { id },
      relations: [
        'variants',
        'variants.contract',
        'variants.contract.customer',
        'variants.characteristics'
      ],
    });

    if (!model) {
      return { success: false, message: 'Model not found' };
    }

    return { success: true, data: model };
  }

  @Get('models/:id/characteristics')
  async getModelCharacteristics(@Param('id') modelId: string) {
    const characteristics = await this.characteristicRepository
      .createQueryBuilder('char')
      .innerJoin('char.modelVariant', 'variant')
      .innerJoin('variant.model', 'model')
      .innerJoin('variant.contract', 'contract')
      .innerJoin('contract.customer', 'customer')
      .select([
        'char.name',
        'char.code',
        'char.value',
        'char.type',
        'char.kind',
        'contract.contractNumber',
        'customer.shortName'
      ])
      .where('model.id = :modelId', { modelId })
      .orderBy('char.name', 'ASC')
      .addOrderBy('contract.createdAt', 'DESC')
      .getRawMany();

    // Group characteristics by name to show variations across contracts
    const groupedCharacteristics = characteristics.reduce((acc, char) => {
      const key = char.char_name;
      if (!acc[key]) {
        acc[key] = {
          name: char.char_name,
          code: char.char_code,
          type: char.char_type,
          kind: char.char_kind,
          values: []
        };
      }
      acc[key].values.push({
        value: char.char_value,
        contractNumber: char.contract_contractNumber,
        customerShortName: char.customer_shortName
      });
      return acc;
    }, {});

    return {
      success: true,
      data: Object.values(groupedCharacteristics)
    };
  }

  @Get('statistics')
  async getStatistics() {
    const [
      totalContracts,
      totalCustomers,
      totalModels,
      totalVariants,
      totalCharacteristics
    ] = await Promise.all([
      this.contractRepository.count(),
      this.customerRepository.count(),
      this.modelRepository.count(),
      this.modelVariantRepository.count(),
      this.characteristicRepository.count(),
    ]);

    // Get contract price statistics
    const contractPriceStats = await this.contractRepository
      .createQueryBuilder('contract')
      .select([
        'SUM(contract.contractPrice) as totalValue',
        'AVG(contract.contractPrice) as averageValue',
        'MIN(contract.contractPrice) as minValue',
        'MAX(contract.contractPrice) as maxValue'
      ])
      .getRawOne();

    // Get recent contracts
    const recentContracts = await this.contractRepository.find({
      relations: ['customer'],
      order: { createdAt: 'DESC' },
      take: 5,
    });

    // Get top customers by contract count
    const topCustomers = await this.customerRepository
      .createQueryBuilder('customer')
      .leftJoin('customer.contracts', 'contract')
      .select([
        'customer.shortName',
        'customer.fullName',
        'COUNT(contract.id) as contractCount'
      ])
      .groupBy('customer.id')
      .orderBy('contractCount', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      success: true,
      data: {
        totals: {
          contracts: totalContracts,
          customers: totalCustomers,
          models: totalModels,
          modelVariants: totalVariants,
          characteristics: totalCharacteristics,
        },
        contractValues: {
          total: parseFloat(contractPriceStats.totalValue) || 0,
          average: parseFloat(contractPriceStats.averageValue) || 0,
          min: parseFloat(contractPriceStats.minValue) || 0,
          max: parseFloat(contractPriceStats.maxValue) || 0,
        },
        recentContracts,
        topCustomers: topCustomers.map(customer => ({
          shortName: customer.customer_shortName,
          fullName: customer.customer_fullName,
          contractCount: parseInt(customer.contractCount),
        })),
      }
    };
  }
}
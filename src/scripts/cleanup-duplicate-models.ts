import { DataSource } from 'typeorm';
import { Model, ModelVariant } from '../database/entities';

async function cleanupDuplicateModels() {
  const dataSource = new DataSource({
    type: 'postgres', // Измените на ваш тип БД
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_DATABASE || 'parser_db',
    entities: [Model, ModelVariant],
    synchronize: false,
  });

  await dataSource.initialize();
  
  try {
    const modelRepository = dataSource.getRepository(Model);
    const modelVariantRepository = dataSource.getRepository(ModelVariant);

    console.log('🔍 Searching for duplicate models with same normalizedName...');

    // Найти дубликаты по normalizedName
    const duplicatesQuery = `
      SELECT normalized_name, array_agg(id) as model_ids, count(*) as count
      FROM models 
      WHERE normalized_name IS NOT NULL
      GROUP BY normalized_name 
      HAVING count(*) > 1
    `;

    const duplicates = await dataSource.query(duplicatesQuery);
    
    console.log(`📊 Found ${duplicates.length} normalized names with duplicates`);

    for (const duplicate of duplicates) {
      const { normalized_name, model_ids, count } = duplicate;
      console.log(`\n🔧 Processing "${normalized_name}" with ${count} duplicates`);

      // Выбрать "мастер" модель (первую по ID)
      const [masterId, ...duplicateIds] = model_ids;
      console.log(`   Master model ID: ${masterId}`);
      console.log(`   Duplicate IDs: ${duplicateIds.join(', ')}`);

      // Перенести все ModelVariants с дубликатов на мастер модель
      for (const duplicateId of duplicateIds) {
        const variantsCount = await modelVariantRepository.update(
          { modelId: duplicateId },
          { modelId: masterId }
        );
        console.log(`   Moved ${variantsCount.affected} variants from ${duplicateId} to ${masterId}`);
      }

      // Удалить дубликаты
      await modelRepository.delete(duplicateIds);
      console.log(`   ✅ Deleted ${duplicateIds.length} duplicate models`);
    }

    console.log('\n🎉 Cleanup completed successfully!');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await dataSource.destroy();
  }
}

// Запуск если файл выполняется напрямую
if (require.main === module) {
  cleanupDuplicateModels()
    .then(() => {
      console.log('✨ Script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

export { cleanupDuplicateModels };
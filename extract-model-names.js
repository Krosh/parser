const fs = require('fs');
const csv = require('csv-parser');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CSV_FILE_PATH = '/Users/pavelprohorov/Desktop/Реестр МИ финао.csv';
const OUTPUT_FILE_PATH = './extracted_model_names_new.txt';

const PROMPT = `Из следующего текста о медицинском изделии извлеки только наименования моделей оборудования, исключи принадлежности, аксессуары, кабели, датчики, адаптеры, руководства и другие комплектующие.

Верни только основные модели медицинского оборудования в виде списка, каждую модель с новой строки. Если моделей несколько, укажи все. Если модель не найдена, верни "НЕТ МОДЕЛИ".

Текст:`;

async function extractModelName(deviceName) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: `${PROMPT}\n\n${deviceName}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Ошибка при обращении к OpenAI:', error);
    return 'ОШИБКА API';
  }
}

async function processCSV() {
  const extractedModels = [];
  const results = [];

  console.log('Читаем CSV файл...');

  return new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE_PATH)
      .pipe(csv({ separator: ';' }))
      .on('data', (row) => {
        const deviceName = row['Наименование медицинского изделия'];
        if (deviceName && deviceName.trim()) {
          results.push(deviceName.trim());
        }
      })
      .on('end', async () => {
        console.log(`Найдено ${results.length} записей для обработки`);

        for (let i = 0; i < results.length; i++) {
          console.log(`Обрабатываем запись ${i + 1}/${results.length}...`);

          const modelName = await extractModelName(results[i]);
          extractedModels.push({
            original: results[i],
            extracted: modelName,
          });

          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        const modelsOnly = extractedModels
          .filter(
            (item) =>
              item.extracted &&
              item.extracted !== 'НЕТ МОДЕЛИ' &&
              item.extracted !== 'ОШИБКА API',
          )
          .map((item) => item.extracted)
          .join('\n');

        fs.writeFileSync(OUTPUT_FILE_PATH, modelsOnly, 'utf8');

        console.log(`\nОбработка завершена!`);
        console.log(`Результаты сохранены в: ${OUTPUT_FILE_PATH}`);
        console.log(`Всего обработано записей: ${extractedModels.length}`);

        resolve();
      })
      .on('error', (error) => {
        console.error('Ошибка при чтении CSV:', error);
        reject(error);
      });
  });
}

if (!process.env.OPENAI_API_KEY) {
  console.error('Ошибка: Установите переменную окружения OPENAI_API_KEY');
  process.exit(1);
}

processCSV().catch(console.error);

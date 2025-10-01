// Тест только с алгоритмом Левенштейна без паттернов

// Моделируем список эталонных названий (из model_names_only.txt)
const modelNames = [
  'EPIQ',
  'EPIQ 5',
  'EPIQ 7', 
  'EPIQ Elite',
  'MyLab',
  'MyLab Seven',
  'MyLab X5',
  'MyLab X6', 
  'MyLab X7',
  'MyLab ClassC',
  'MyLab One',
  'MyLab Twice',
  'MyLab 9 eXP',
  'MyLab Omega',
  'MyLab Sigma',
  'MyLab X8',
  'MyLab X8 eXP',
  'Vivid iq Value console',
  'Vivid iq Premium console',
  'Vivid iq 4D console',
  'Vivid iq PoC console',
  'РуСкан 70П',
  'РуСкан 65',
  'РуСкан 60',
  'РуСкан 50'
];

function levenshteinDistance(str1, str2) {
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

function levenshteinSimilarity(str1, str2) {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);

  if (maxLength === 0) return 1.0;

  return 1 - distance / maxLength;
}

function normalizeString(str) {
  return str
    .trim()
    .replace(/[^\w\s\-\.]/gi, '') // Удаляем спецсимволы кроме дефисов и точек
    .replace(/\s+/g, ' ') // Нормализуем пробелы
    .toLowerCase();
}

function findBestModelLevenshteinOnly(certificateName) {
  let bestMatch = '';
  let bestSimilarity = 0;

  const normalizedCertificate = normalizeString(certificateName);

  console.log(`  Нормализованный сертификат: "${normalizedCertificate}"`);

  for (const modelName of modelNames) {
    const normalizedModel = normalizeString(modelName);
    
    // Рассчитываем сходство всей строки сертификата с названием модели
    const similarity = levenshteinSimilarity(normalizedCertificate, normalizedModel);
    
    console.log(`  "${modelName}" -> similarity: ${similarity.toFixed(3)}`);

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = modelName;
    }
  }

  console.log(`  🎯 Наибольшее similarity: "${bestMatch}" (${bestSimilarity.toFixed(3)})`);
  return bestMatch;
}

// Тестовые случаи
const testCases = [
  {
    input: 'Система ультразвуковая диагностическая EPIQ с принадлежностями варианты исполнения:  EPIQ I. Система ультразвуковая диагностическая EPIQ в варианте исполнения EPIQ, РЗН 2014/2234',
    expected: 'EPIQ'
  },
  {
    input: 'Аппарат ультразвуковой диагностический многофункциональный MyLab, вариант исполнения: MyLab Omega с принадлежностями',
    expected: 'MyLab Omega'
  },
  {
    input: 'Система ультразвуковая диагностическая EPIQ Elite с принадлежностями',
    expected: 'EPIQ Elite'
  },
  {
    input: 'MyLab X8 eXP с принадлежностями',
    expected: 'MyLab X8 eXP'
  },
  {
    input: 'Система ультразвуковая диагностическая медицинская Vivid iq с принадлежностями, вариант исполнения: Система ультразвуковая диагностическая медицинская  Vivid iq Premium console, производства ДжиИ Медикал Системз (Китай) Ко., Лтд., Китай (РЗН 2017/6506)',
    expected: 'Vivid iq Premium console'
  },
  {
    input: 'РЗН 2020/13006 Система ультразвуковая диагностическая медицинская «РуСкан 70П» по ТУ 26.60.12-004-98204792-2020 с принадлежностями',
    expected: 'РуСкан 70П'
  }
];

console.log('=== ТЕСТ ТОЛЬКО С АЛГОРИТМОМ ЛЕВЕНШТЕЙНА ===\n');

testCases.forEach((testCase, index) => {
  console.log(`\n--- Тест ${index + 1} ---`);
  console.log(`Ожидается: "${testCase.expected}"`);
  console.log(`Входная строка: "${testCase.input}"`);
  
  const result = findBestModelLevenshteinOnly(testCase.input);
  console.log(`Результат: "${result || 'null'}"`);
  console.log(`Статус: ${result === testCase.expected ? '✅ УСПЕХ' : '❌ ОШИБКА'}`);
});
// Тест совместимости между pattern-extractor и ModelNormalizerService

import { extractModelNameFromCertificate } from './src/modules/parser/utils/pattern-extractor';

// Эмулируем ModelNormalizerService логику
function emulateModelNormalizerService(certificateName: string): {
  modelName: string;
  foundInReferenceList: boolean;
  patternName?: string;
} {
  if (!certificateName) return { modelName: '', foundInReferenceList: false };

  // Используем единую логику извлечения из pattern-extractor
  const result = extractModelNameFromCertificate(certificateName);

  if (!result) {
    return { modelName: '', foundInReferenceList: false };
  }

  // Определяем, найдена ли модель в эталонном списке на основе типа паттерна
  const foundInReferenceList = result.matched && result.patternName !== 'word fallback';

  return {
    modelName: result.normalizedName,
    foundInReferenceList,
    patternName: result.patternName || undefined,
  };
}

// Тестовые случаи
const testCases = [
  {
    name: 'Consona N7Q case',
    input: 'РУ № РЗН 2024/23835 от 30.10.2024 г.: IV. Система ультразвуковой визуализации универсальная серии Consona N7 с принадлежностями, вариант исполнения: Consona N7Q по ТУ 26.60.12-001- 51850757 -2024',
    expected: {
      modelName: 'Consona N7Q',
      foundInReferenceList: true,
      patternName: 'вариант исполнения с ТУ'
    }
  },
  {
    name: 'Affiniti 70 case',
    input: 'Система ультразвуковая диагностическая Affiniti с принадлежностями, в варианте исполнения: Affiniti 70"Филипс Ультрасаунд, ЛЛС."',
    expected: {
      modelName: 'Affiniti 70',
      foundInReferenceList: true,
      patternName: 'в варианте исполнения с двоеточием до кавычек'
    }
  },
  {
    name: 'M9 case',
    input: 'Аппарат ультразвуковой диагностический серии М с принадлежностями, варианты исполнения: М9 Производитель: "Шэньчжэнь Майндрэй Био-Мeдикал Электроникс Ко., Лтд.", Shenzhen Mindray Bio-Medical Electronics Co., Ltd. Страна происхождения: Китайская Народная Республика',
    expected: {
      modelName: 'M9',
      foundInReferenceList: true,
      patternName: 'серии М варианты исполнения'
    }
  }
];

console.log('=== ТЕСТ СОВМЕСТИМОСТИ PATTERN-EXTRACTOR И MODELNORMALIZERSERVICE ===\n');

testCases.forEach((testCase, index) => {
  console.log(`--- Тест ${index + 1}: ${testCase.name} ---`);
  console.log(`Входная строка: "${testCase.input.substring(0, 100)}..."`);
  
  // Тестируем напрямую pattern-extractor
  const patternResult = extractModelNameFromCertificate(testCase.input);
  console.log(`Pattern-extractor результат:`, patternResult);
  
  // Тестируем эмуляцию ModelNormalizerService
  const serviceResult = emulateModelNormalizerService(testCase.input);
  console.log(`ModelNormalizerService результат:`, serviceResult);
  
  // Проверяем совместимость
  const isCompatible = 
    serviceResult.modelName === testCase.expected.modelName &&
    serviceResult.foundInReferenceList === testCase.expected.foundInReferenceList &&
    serviceResult.patternName === testCase.expected.patternName;
  
  console.log(`Статус: ${isCompatible ? '✅ СОВМЕСТИМЫ' : '❌ НЕ СОВМЕСТИМЫ'}`);
  
  if (!isCompatible) {
    console.log(`  Ожидалось: modelName="${testCase.expected.modelName}", foundInReferenceList=${testCase.expected.foundInReferenceList}, patternName="${testCase.expected.patternName}"`);
    console.log(`  Получено:  modelName="${serviceResult.modelName}", foundInReferenceList=${serviceResult.foundInReferenceList}, patternName="${serviceResult.patternName}"`);
  }
  
  console.log('');
});

console.log('=== ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА SMART FALLBACK ===\n');

// Тест случая, где должен сработать smart fallback
const fallbackCase = 'Система ультразвуковая с моделью CHISON в составе';
console.log(`Тестовая строка: "${fallbackCase}"`);

const fallbackResult = extractModelNameFromCertificate(fallbackCase);
console.log('Результат pattern-extractor:', fallbackResult);

const fallbackServiceResult = emulateModelNormalizerService(fallbackCase);
console.log('Результат ModelNormalizerService:', fallbackServiceResult);

console.log('\n=== ПРОВЕРКА WORD FALLBACK ===\n');

// Тест случая, где должен сработать word fallback
const wordFallbackCase = 'Какое-то неизвестное оборудование без моделей из списка';
console.log(`Тестовая строка: "${wordFallbackCase}"`);

const wordFallbackResult = extractModelNameFromCertificate(wordFallbackCase);
console.log('Результат pattern-extractor:', wordFallbackResult);

const wordFallbackServiceResult = emulateModelNormalizerService(wordFallbackCase);
console.log('Результат ModelNormalizerService:', wordFallbackServiceResult);

// Проверяем, что foundInReferenceList = false для word fallback
const wordFallbackCompatible = !wordFallbackServiceResult.foundInReferenceList && 
  wordFallbackServiceResult.patternName === 'word fallback';
console.log(`Word fallback совместимость: ${wordFallbackCompatible ? '✅ ОК' : '❌ ОШИБКА'}`);
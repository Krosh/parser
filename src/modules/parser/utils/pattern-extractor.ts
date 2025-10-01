// Утилита для извлечения названий моделей из сертификатов
// Используется в ModelNormalizerService и в тестах

import { normalize } from 'path';
import * as fs from 'fs';

// Кэш для эталонного списка названий моделей
let referenceModelNames: Set<string> | null = null;
// Кэш для приведенного к латинице эталонного списка
let transliteratedReferenceModelNames: Set<string> | null = null;

// Функция для загрузки эталонного списка названий моделей
function loadReferenceModelNames(): Set<string> {
  if (referenceModelNames !== null) {
    return referenceModelNames;
  }

  try {
    const filePath = normalize(process.cwd() + '/model_names_only.txt');
    const content = fs.readFileSync(filePath, 'utf-8');
    const modelNames = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    referenceModelNames = new Set(modelNames);
    return referenceModelNames;
  } catch (error) {
    console.warn('Не удалось загрузить эталонный список моделей:', error);
    referenceModelNames = new Set();
    return referenceModelNames;
  }
}

// Функция для загрузки приведенного к латинице эталонного списка
function loadTransliteratedReferenceModelNames(): Set<string> {
  if (transliteratedReferenceModelNames !== null) {
    return transliteratedReferenceModelNames;
  }

  const originalNames = loadReferenceModelNames();
  transliteratedReferenceModelNames = new Set();
  
  for (const name of originalNames) {
    const transliterated = normalizeCyrillicToLatin(name);
    transliteratedReferenceModelNames.add(transliterated);
  }
  
  return transliteratedReferenceModelNames;
}

// Функция для очистки кэша (для тестирования)
export function clearReferenceCache(): void {
  referenceModelNames = null;
  transliteratedReferenceModelNames = null;
}

// Функция для проверки, есть ли название модели в эталонном списке
function isModelInReferenceList(modelName: string): boolean {
  const referenceList = loadReferenceModelNames();
  return referenceList.has(modelName);
}

// Функция для проверки, есть ли приведенное к латинице название модели в приведенном к латинице эталонном списке
function isModelInTransliteratedReferenceList(modelName: string): boolean {
  const transliteratedList = loadTransliteratedReferenceModelNames();
  const transliteratedModelName = normalizeCyrillicToLatin(modelName);
  return transliteratedList.has(transliteratedModelName);
}

// Функция для проверки - можно ли записать все символы названия в латинице
export function canBeWrittenInLatin(text: string): boolean {
  // Набор кириллических символов, которые можно заменить на латинские
  const convertibleCyrillicChars = new Set([
    'А',
    'а',
    'В',
    'в',
    'С',
    'с',
    'Е',
    'е',
    'Н',
    'К',
    'к',
    'М',
    'м',
    'О',
    'о',
    'Р',
    'р',
    'Т',
    'т',
    'У',
    'Х',
    'х',
  ]);

  // Проверяем каждый символ в тексте
  for (const char of text) {
    // Если символ латинский, цифра или допустимый знак препинания - пропускаем
    if (/[A-Za-z0-9\s\-\.]/.test(char)) {
      continue;
    }

    // Если символ кириллический, но не может быть заменён на латинский - возвращаем false
    if (/[А-Яа-яЁё]/.test(char) && !convertibleCyrillicChars.has(char)) {
      return false;
    }
  }

  return true;
}

// Функция для универсальной нормализации всех кириллических букв в латинские
export function normalizeCyrillicToLatin(text: string): string {
  // Полный словарь замен кириллических букв на похожие латинские
  const cyrillicToLatinMap: { [key: string]: string } = {
    А: 'A',
    а: 'a',
    В: 'B',
    в: 'b',
    С: 'C',
    с: 'c',
    Е: 'E',
    е: 'e',
    Н: 'H',
    н: 'h',
    К: 'K',
    к: 'k',
    М: 'M',
    м: 'm',
    О: 'O',
    о: 'o',
    Р: 'P',
    р: 'p',
    Т: 'T',
    т: 't',
    У: 'Y',
    у: 'y',
    Х: 'X',
    х: 'x',
    Ё: 'E',
    ё: 'e',
  };

  let normalized = text;

  // Заменяем все кириллические символы на латинские
  for (const [cyrillic, latin] of Object.entries(cyrillicToLatinMap)) {
    normalized = normalized.replace(new RegExp(cyrillic, 'g'), latin);
  }

  return normalized;
}

export function extractModelNameFromCertificate(certificateName) {
  if (!certificateName) return null;

  let fallbackResult: any = null;

  // Паттерны для извлечения названия модели из сертификата
  const patterns = [
    // Паттерн для "вариант исполнения: N.N. Система ... ModelName" - извлекаем только ModelName
    {
      pattern:
        /вариант\s+исполнения:\s*\d+\.\d+\.\s*Система\s+ультразвуковая\s+диагностическая\s+медицинская\s+([A-Za-z0-9\s\-\.]+?)(?:\s*,|$)/i,
      name: 'вариант исполнения с нумерацией и полным описанием',
    },
    // Паттерн для "вариант исполнения: Система диагностическая ультразвуковая ModelName"
    {
      pattern:
        /вариант\s+исполнения:\s*Система\s+диагностическая\s+ультразвуковая\s+([A-Za-z0-9\s\-\.]+?)(?:\s*,|$)/i,
      name: 'вариант исполнения с диагностической системой',
    },
    // Паттерн для "вариант исполнения: ModelName" с двоеточием (высокий приоритет)
    {
      pattern:
        /вариант\s+исполнения:\s*([A-Za-z0-9\s\-\.]+?)(?:\s+с\s+принадлежностями|\s*,|$)/i,
      name: 'вариант исполнения с двоеточием',
    },
    // Паттерн для "универсальная серии ModelName с принадлежностями" 
    {
      pattern:
        /универсальная\s+серии\s+([A-Za-zА-Яа-я0-9\s\-\.ёЁ]+?)(?:\s+с\s+принадлежностями|\s*,|$)/i,
      name: 'универсальная серии',
    },
    // Паттерн для нумерованных списков "1. Система ... ModelName"
    {
      pattern:
        /\d+\.\s*Система\s+ультразвуковая\s+диагностическая\s+([A-Za-z0-9\s\-\.]+?)(?:\s+в\s+варианте|\s*,|$)/i,
      name: 'нумерованный список с вариантом',
    },
    // Паттерн для "вариант исполнения: Система ультразвуковая диагностическая медицинская ModelName"
    {
      pattern:
        /вариант\s+исполнения:\s*Система\s+ультразвуковая\s+диагностическая\s+медицинская\s+([A-Za-z0-9\s\-\.]+?)(?:\s*,|\s+производства|$)/i,
      name: 'вариант исполнения с полным описанием системы',
    },
    // Паттерн для "вариант исполнения: ModelName по ТУ" (с техническими условиями)
    {
      pattern:
        /вариант\s+исполнения:\s*([A-Za-zА-Яа-я0-9\s\-\.ёЁ]+?)(?:\s+по\s+ТУ|\s*,|$)/i,
      name: 'вариант исполнения с ТУ',
    },
    // Паттерн для "в варианте исполнения ModelName"
    {
      pattern: /в\s+варианте\s+исполнения\s+([A-Za-z0-9\s\-\.]+?)(?:\s*,|$)/i,
      name: 'в варианте исполнения',
    },
    // Паттерн для "варианты исполнения: I...диагностический "ModelName""
    {
      pattern: /варианты\s+исполнения:.*?I.*?диагностический\s+"([^"]+)"/i,
      name: 'варианты исполнения с диагностическим в кавычках',
    },
    // Паттерн для "варианты исполнения: ModelName I. Система ... ModelName"
    {
      pattern:
        /варианты\s+исполнения:.*?I\.\s*Система\s+ультразвуковая\s+диагностическая\s+([A-Za-z0-9\s\-\.]+?)(?:\s+в\s+варианте|\s*,|$)/i,
      name: 'варианты исполнения с римскими цифрами',
    },
    // Паттерн для "серии ModelName с принадлежностями"
    {
      pattern:
        /серии\s+([A-Za-z0-9\s\-\.]+?)(?:\s+с\s+принадлежностями|\s*,|$)/i,
      name: 'серии',
    },
    // Паттерн для "медицинская с ModelName c принадлежностями"
    {
      pattern:
        /медицинская\s+с\s+([A-Za-zА-Яа-я0-9\s\-\.ёЁ]+?)(?:\s+[cс]\s+принадлежностями|\s*,|$)/i,
      name: 'медицинская с моделью',
    },
    // Паттерн для "медицинская ModelName с принадлежностями" или до конца строки
    {
      pattern:
        /медицинская\s+([A-Za-z0-9\s\-\.]+?)(?:\s+с\s+принадлежностями|\s*,|$)/i,
      name: 'медицинская до конца',
    },
    // Паттерн для "медицинская ModelName1/ModelName2" - берём первую модель
    {
      pattern: /медицинская\s+([A-Za-z0-9\-]+)(?:\/[A-Za-z0-9\-]+)*/i,
      name: 'медицинская с слешем',
    },
    // Паттерн для "Система ультразвуковая диагностическая ModelName с принадлежностями, производитель"
    {
      pattern:
        /Система\s+ультразвуковая\s+диагностическая\s+([A-Za-z0-9\-]+)(?:\s+с\s+принадлежностями,\s*производитель|\s*,|$)/i,
      name: 'система ультразвуковая диагностическая с производителем',
    },
    // Паттерн для "Ультразвуковой диагностический аппарат ModelName с принадлежностями"
    {
      pattern:
        /Ультразвуковой\s+диагностический\s+аппарат\s+([A-Za-z0-9\s\-\.]+?)(?:\s+с\s+принадлежностями|\.|\s*,|$)/i,
      name: 'ультразвуковой диагностический аппарат',
    },
    // Паттерн для "вариант исполнения ModelName, "КОМПАНИЯ""
    {
      pattern:
        /вариант\s+исполнения\s+([A-Za-z0-9\s\-\.]+?)(?:\s*,\s*"[^"]+"|$)/i,
      name: 'вариант исполнения с компанией в кавычках',
    },
    // Паттерн для "вариант исполнения ModelName, производитель"
    {
      pattern:
        /вариант\s+исполнения\s+([A-Za-z0-9\s\-\.]+?)(?:\s*,\s*производитель|$)/i,
      name: 'вариант исполнения с производителем',
    },
    // Паттерн для "Система ультразвуковая диагностическая ModelName с принадлежностями"
    {
      pattern:
        /Система\s+ультразвуковая\s+диагностическая\s+([A-Za-z0-9\s\-\.]+?)(?:\s+с\s+принадлежностями|\s*,|$)/i,
      name: 'система ультразвуковая диагностическая',
    },
    // Паттерн для "Система ультразвуковая цифровая цветовая доплеровская ModelName"
    {
      pattern:
        /Система\s+ультразвуковая\s+.*?доплеровская\s+([A-Za-z0-9\s\-\.]+?)(?:\s*,|$)/i,
      name: 'система ультразвуковая доплеровская',
    },
    // Паттерн для "РуСкан 65" и подобных в угловых кавычках
    {
      pattern: /«([^»]+)»/,
      name: 'в угловых кавычках',
    },
    // Паттерн для "РуСкан 65" и подобных в обычных кавычках - НО НЕ НАЗВАНИЯ КОМПАНИЙ
    {
      pattern: /"([^"]+)"/,
      name: 'в обычных кавычках',
      // Добавляем специальную функцию проверки
      validate: (match: string) => {
        // Исключаем названия компаний
        const companyKeywords = ['КО', 'ЛТД', 'ООО', 'АО', 'ЗАО', 'Корпорэйшн', 'Системз', 'МЕДИСОН', 'САМСУНГ'];
        return !companyKeywords.some(keyword => match.includes(keyword));
      }
    },
    // Паттерн для "ModelName с принадлежностями" в начале строки
    {
      pattern: /^([A-Za-z0-9\s\-\.]+?)(?:\s+с\s+принадлежностями|$)/i,
      name: 'модель в начале строки с принадлежностями',
    },
  ];

  for (const { pattern, name, validate } of patterns) {
    const match = certificateName.match(pattern);
    if (match && match[1]) {
      let extracted = match[1].trim();

      // Если есть функция валидации, проверяем её
      if (validate && !validate(extracted)) {
        continue;
      }

      // Очистка от лишних слов
      extracted = extracted
        .replace(
          /^(Система\s+ультразвуковая\s+диагностическая\s+медицинская\s+)/i,
          '',
        )
        .replace(/^(Система\s+ультразвуковая\s+)/i, '')
        .replace(/^(медицинская\s+)/i, '')
        .replace(/\s+с\s+принадлежностями.*$/i, '')
        .replace(/\s+по\s+ТУ.*$/i, '')
        .trim();

      if (extracted.length > 0) {
        // Проверяем, можно ли записать все символы в латинице
        let normalizedName = extracted;
        if (canBeWrittenInLatin(extracted)) {
          // Если все символы можно записать в латинице, применяем преобразование
          normalizedName = normalizeCyrillicToLatin(extracted);
        }

        // Проверяем, есть ли полученное название в эталонном списке
        // Сначала проверяем точное совпадение
        if (isModelInReferenceList(normalizedName) || isModelInReferenceList(extracted)) {
          return {
            normalizedName: normalizedName,
            patternName: name,
            matched: true,
          };
        }
        
        // Затем проверяем приведенные к латинице названия с приведенным к латинице эталонным списком
        if (isModelInTransliteratedReferenceList(normalizedName) || isModelInTransliteratedReferenceList(extracted)) {
          return {
            normalizedName: normalizedName,
            patternName: name,
            matched: true,
          };
        }
        
        // Если название не найдено в эталонном списке, продолжаем поиск
        // но запоминаем первый найденный результат как fallback
        if (!fallbackResult) {
          fallbackResult = {
            normalizedName: normalizedName,
            patternName: name,
            matched: true,
          };
        }
      }
    }
  }

  // Если ни один паттерн не дал результат из эталонного списка, возвращаем fallback
  if (fallbackResult) {
    return fallbackResult;
  }

  return {
    normalizedName: '',
    patternName: null,
    matched: false,
  };
}

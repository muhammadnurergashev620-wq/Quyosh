import { ValidationError } from 'class-validator';

function firstNumber(text: string): string {
  const found = text.match(/-?\d+(\.\d+)?/);
  return found ? found[0] : '';
}

export function translateConstraint(field: string, rule: string, original: string): string {
  switch (rule) {
    case 'isNotEmpty':
      return `${field}: bu maydon bo‘sh bo‘lmasligi kerak`;
    case 'isDefined':
      return `${field}: bu maydon majburiy`;
    case 'isString':
      return `${field}: matn bo‘lishi kerak`;
    case 'isInt':
      return `${field}: butun son bo‘lishi kerak`;
    case 'isNumber':
    case 'isNumberString':
    case 'isDecimal':
      return `${field}: son bo‘lishi kerak`;
    case 'isPositive':
      return `${field}: musbat son bo‘lishi kerak`;
    case 'isBoolean':
      return `${field}: true yoki false bo‘lishi kerak`;
    case 'isEnum':
    case 'isIn':
      return `${field}: ruxsat etilgan qiymatlardan biri bo‘lishi kerak`;
    case 'isUuid':
      return `${field}: UUID formatida bo‘lishi kerak`;
    case 'isEmail':
      return `${field}: email manzil noto‘g‘ri`;
    case 'isPhoneNumber':
      return `${field}: telefon raqam noto‘g‘ri`;
    case 'isDateString':
    case 'isIso8601':
    case 'isDate':
      return `${field}: sana noto‘g‘ri formatda`;
    case 'min':
      return `${field}: ${firstNumber(original)} dan kichik bo‘lmasligi kerak`;
    case 'max':
      return `${field}: ${firstNumber(original)} dan katta bo‘lmasligi kerak`;
    case 'minLength':
      return `${field}: kamida ${firstNumber(original)} ta belgidan iborat bo‘lishi kerak`;
    case 'maxLength':
      return `${field}: ko‘pi bilan ${firstNumber(original)} ta belgidan iborat bo‘lishi kerak`;
    case 'isLength':
      return `${field}: uzunligi noto‘g‘ri`;
    case 'matches':
      return `${field}: formati noto‘g‘ri`;
    case 'isArray':
      return `${field}: ro‘yxat (massiv) bo‘lishi kerak`;
    case 'arrayNotEmpty':
    case 'arrayMinSize':
      return `${field}: ro‘yxat bo‘sh bo‘lmasligi kerak`;
    case 'arrayMaxSize':
      return `${field}: ro‘yxatda ko‘pi bilan ${firstNumber(original)} ta element bo‘lishi mumkin`;
    case 'arrayUnique':
      return `${field}: ro‘yxatdagi qiymatlar takrorlanmasligi kerak`;
    case 'isObject':
      return `${field}: obyekt bo‘lishi kerak`;
    case 'isLatitude':
      return `${field}: kenglik (latitude) noto‘g‘ri`;
    case 'isLongitude':
      return `${field}: uzunlik (longitude) noto‘g‘ri`;
    case 'isUrl':
      return `${field}: URL manzil noto‘g‘ri`;
    case 'whitelistValidation':
      return `${field}: bunday maydon yuborilmasligi kerak`;
    default:
      return `${field}: qiymat noto‘g‘ri`;
  }
}

function isDefaultMessage(field: string, message: string): boolean {
  return message.startsWith(`${field} `) || message.startsWith('each value in') || message.startsWith('property ');
}

export function collectValidationMessages(errors: ValidationError[], parent = ''): string[] {
  const result: string[] = [];
  for (const error of errors) {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const constraints = error.constraints ?? {};
    for (const rule of Object.keys(constraints)) {
      const message = constraints[rule];
      if (isDefaultMessage(error.property, message)) {
        result.push(translateConstraint(field, rule, message));
      } else {
        result.push(message);
      }
    }
    if (error.children && error.children.length > 0) {
      result.push(...collectValidationMessages(error.children, field));
    }
  }
  return result;
}

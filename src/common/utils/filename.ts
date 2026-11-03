/** Multer fayl nomini Latin-1 deb o‘qiydi; kirill va o‘zbek harflari buzilmasligi uchun UTF-8 ga qaytaramiz. */
export const decodeFilename = (name: string) => {
  if (/[^\u0000-ÿ]/.test(name)) return name; // allaqachon to‘g‘ri UTF-8
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('�') ? name : decoded;
};

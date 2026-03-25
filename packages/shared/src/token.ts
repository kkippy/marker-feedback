export const createId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

export const createShareToken = () => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 12 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
};

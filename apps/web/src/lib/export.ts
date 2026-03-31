const padTwoDigits = (value: number) => value.toString().padStart(2, '0');

export const buildExportFileName = (date = new Date()) => {
  const year = date.getFullYear();
  const month = padTwoDigits(date.getMonth() + 1);
  const day = padTwoDigits(date.getDate());
  const hours = padTwoDigits(date.getHours());
  const minutes = padTwoDigits(date.getMinutes());
  const seconds = padTwoDigits(date.getSeconds());

  return `marker-feedback_${year}${month}${day}${hours}${minutes}${seconds}.png`;
};

export const downloadDataUrl = (dataUrl: string, fileName: string) => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  link.click();
};

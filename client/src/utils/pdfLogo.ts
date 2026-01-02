let cachedLogo: string | null | undefined;

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export const loadLogoDataUrl = async () => {
  if (cachedLogo !== undefined) return cachedLogo;
  try {
    const response = await fetch('/logowf.png');
    if (!response.ok) {
      cachedLogo = null;
      return cachedLogo;
    }
    const blob = await response.blob();
    cachedLogo = await blobToDataUrl(blob);
    return cachedLogo;
  } catch {
    cachedLogo = null;
    return cachedLogo;
  }
};

export const getImageFormat = (dataUrl: string) => {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg)/i);
  if (!match) return 'PNG';
  return match[1].toUpperCase() === 'JPG' ? 'JPEG' : match[1].toUpperCase();
};

const GOOGLE_DRIVE_HOST = /^(?:www\.)?drive\.google\.com$/i;
const GOOGLE_DRIVE_LINK = /^(?:https?:\/\/)?(?:www\.)?drive\.google\.com(?:[/:?#]|$)/i;
const GOOGLE_DRIVE_FILE_ID = /^[A-Za-z0-9_-]+$/;

export function convertGoogleDriveUrl(imageUrl: string): string | null {
  const trimmedUrl = imageUrl.trim();
  if (!trimmedUrl) return '';

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(
      /^[a-z][a-z\d+.-]*:/i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`,
    );
  } catch {
    return GOOGLE_DRIVE_LINK.test(trimmedUrl) ? null : trimmedUrl;
  }

  if (!GOOGLE_DRIVE_HOST.test(parsedUrl.hostname)) return trimmedUrl;

  const filePathMatch = parsedUrl.pathname.match(/\/file\/d\/([^/]+)/);
  const fileId = filePathMatch?.[1] ?? parsedUrl.searchParams.get('id');
  if (!fileId || !GOOGLE_DRIVE_FILE_ID.test(fileId)) return null;

  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
}

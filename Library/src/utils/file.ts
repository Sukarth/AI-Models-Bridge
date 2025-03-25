/**
 * Convert a file to a base64 data URL
 * @param file The file to convert
 * @param withPrefix Whether to include the data URL prefix
 */
export function file2base64(file: File, withPrefix = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      if (withPrefix) {
        resolve(result);
      } else {
        // Remove the data URL prefix (e.g., "data:image/png;base64,")
        resolve(result.split(',')[1]);
      }
    };
    reader.onerror = reject;
  });
}
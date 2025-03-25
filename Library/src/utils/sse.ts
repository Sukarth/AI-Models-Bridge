/**
 * Parse a Server-Sent Events response
 * @param response The response to parse
 * @param onMessage Callback for each message
 */
export async function parseSSEResponse(response: Response, onMessage: (message: string) => void) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      if (trimmedLine.startsWith('data: ')) {
        const data = trimmedLine.slice(6);
        onMessage(data);
      }
    }
  }
  
  // Handle any remaining data
  if (buffer.trim() && buffer.startsWith('data: ')) {
    const data = buffer.slice(6);
    onMessage(data);
  }
}
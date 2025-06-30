import { ToolCall } from 'ai';

export function applyToolArgPatch() {
  const ToolCallProto = (globalThis as any).ToolCall?.prototype;
  if (!ToolCallProto) return;
  
  const orig = ToolCallProto.getArgs;
  ToolCallProto.getArgs = function patched() {
    const raw = orig.apply(this);
    
    // Log for debugging
    console.log('[ToolArgPatch] Raw args:', raw);
    
    // Handle truly empty strings
    if (raw === '') {
      // Check if this tool call expects specific parameters
      const toolName = this.toolName || this.name;
      console.log('[ToolArgPatch] Empty args for tool:', toolName);
      
      // For createContextItem, we know it expects attributes array
      if (toolName && toolName.includes('createContextItem')) {
        return '{"contextId":"","contextType":"","key":"","attributes":[]}';
      }
      
      return '{}';
    }
    
    // Handle malformed array cases
    if (raw === '[]') {
      console.log('[ToolArgPatch] Bare array detected, wrapping...');
      return '{"attributes":[]}';
    }
    
    return raw;
  };
}

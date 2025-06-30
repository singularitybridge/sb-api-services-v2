import { ToolCall } from 'ai';

export function applyToolArgPatch() {
  const ToolCallProto = (globalThis as any).ToolCall?.prototype;
  if (!ToolCallProto) return;
  const orig = ToolCallProto.getArgs;
  ToolCallProto.getArgs = function patched() {
    const raw = orig.apply(this);
    return raw === '' ? '{}' : raw;  // convert "" → "{}"
  };
}

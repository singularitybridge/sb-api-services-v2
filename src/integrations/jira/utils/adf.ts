/**
 * ADF (Atlassian Document Format) Conversion Utilities
 * Handles conversion between ADF, plain text, and Markdown
 */

// ============================================================================
// ADF to Plain Text
// ============================================================================

/**
 * Convert an ADF (Atlassian Document Format) node to plain text
 * @param adfNode - The ADF document or node to convert
 * @returns Plain text representation
 */
export const adfToText = (adfNode: any): string => {
  if (!adfNode) return '';

  let resultText = '';

  function processNode(node: any): void {
    if (!node) return;

    switch (node.type) {
      case 'text':
        resultText += node.text || '';
        break;

      case 'paragraph':
      case 'heading':
        if (node.content) node.content.forEach(processNode);
        resultText += '\n';
        break;

      case 'bulletList':
      case 'orderedList':
        if (node.content) {
          node.content.forEach((listItem: any, index: number) => {
            if (node.type === 'orderedList') {
              resultText += `${index + 1}. `;
            } else {
              resultText += '- ';
            }
            if (listItem.content) listItem.content.forEach(processNode);
          });
        }
        break;

      case 'listItem':
        if (node.content) node.content.forEach(processNode);
        break;

      case 'codeBlock':
        if (node.content) {
          node.content.forEach((textNode: any) => {
            if (textNode.type === 'text') {
              resultText += textNode.text + '\n';
            }
          });
        }
        break;

      case 'blockquote':
        if (node.content) {
          node.content.forEach((pNode: any) => {
            resultText += '> ';
            processNode(pNode);
          });
        }
        break;

      case 'panel':
        if (node.content) node.content.forEach(processNode);
        resultText += '\n';
        break;

      case 'hardBreak':
        resultText += '\n';
        break;

      case 'mention':
        resultText += node.attrs?.text || '[mention]';
        break;

      case 'emoji':
        resultText += node.attrs?.shortName || '[emoji]';
        break;

      case 'inlineCard':
      case 'blockCard':
        resultText += node.attrs?.url || '[card link]';
        break;

      case 'table':
        if (node.content) {
          node.content.forEach((row: any) => {
            if (row.content) {
              row.content.forEach((cell: any) => {
                if (cell.content) cell.content.forEach(processNode);
                resultText += '\t';
              });
            }
            resultText += '\n';
          });
        }
        break;

      default:
        if (node.content && Array.isArray(node.content)) {
          node.content.forEach(processNode);
        }
        break;
    }
  }

  if (adfNode.type === 'doc' && adfNode.content) {
    adfNode.content.forEach(processNode);
  } else {
    processNode(adfNode);
  }

  // Clean up multiple consecutive newlines
  return resultText.replace(/\n\s*\n/g, '\n').trim();
};

// ============================================================================
// Markdown to ADF
// ============================================================================

interface AdfNode {
  type: string;
  version?: number;
  attrs?: Record<string, any>;
  content?: AdfNode[];
  text?: string;
  marks?: Array<{ type: string }>;
}

/**
 * Process inline formatting (bold, italic) in text
 */
const processInlineFormatting = (text: string): AdfNode[] => {
  if (!text.trim()) return [];

  const segments: AdfNode[] = [];
  const boldParts = text.split(/\*\*|__/);

  boldParts.forEach((part, i) => {
    if (i % 2 === 1) {
      // Bold text
      segments.push({
        type: 'text',
        text: part,
        marks: [{ type: 'strong' }],
      });
    } else {
      // Check for italic
      const italicParts = part.split(/\*|_/);
      italicParts.forEach((italicPart, j) => {
        if (j % 2 === 1) {
          segments.push({
            type: 'text',
            text: italicPart,
            marks: [{ type: 'em' }],
          });
        } else if (italicPart) {
          segments.push({ type: 'text', text: italicPart });
        }
      });
    }
  });

  return segments.filter((s) => s.text && s.text.length > 0);
};

/**
 * Convert Markdown text to ADF (Atlassian Document Format)
 * @param markdown - The markdown text to convert
 * @returns ADF document object
 */
export const markdownToAdf = (markdown: string): AdfNode => {
  if (!markdown || typeof markdown !== 'string') {
    return { type: 'doc', version: 1, content: [] };
  }

  const adfContent: AdfNode[] = [];
  const lines = markdown.split('\n');

  let inList = false;
  let listType: 'bulletList' | 'orderedList' | null = null;
  let listItems: AdfNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent = '';

  const flushList = (): void => {
    if (inList && listType && listItems.length > 0) {
      adfContent.push({ type: listType, content: listItems });
    }
    inList = false;
    listType = null;
    listItems = [];
  };

  const flushCodeBlock = (): void => {
    if (inCodeBlock && codeBlockContent.length > 0) {
      adfContent.push({
        type: 'codeBlock',
        content: [{ type: 'text', text: codeBlockContent.trimEnd() }],
      });
    }
    inCodeBlock = false;
    codeBlockContent = '';
  };

  for (const line of lines) {
    // Code block handling
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock();
      } else {
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent += line + '\n';
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      adfContent.push({
        type: 'heading',
        attrs: { level },
        content: processInlineFormatting(text),
      });
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^(\s*)([-*+])\s+(.*)/);
    if (ulMatch) {
      if (!inList || listType !== 'bulletList') {
        flushList();
        inList = true;
        listType = 'bulletList';
      }
      listItems.push({
        type: 'listItem',
        content: [
          { type: 'paragraph', content: processInlineFormatting(ulMatch[3]) },
        ],
      });
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
    if (olMatch) {
      if (!inList || listType !== 'orderedList') {
        flushList();
        inList = true;
        listType = 'orderedList';
      }
      listItems.push({
        type: 'listItem',
        content: [
          { type: 'paragraph', content: processInlineFormatting(olMatch[3]) },
        ],
      });
      continue;
    }

    // End list on non-list content
    if (inList && !ulMatch && !olMatch) {
      flushList();
    }

    // Empty line
    if (line.trim() === '') {
      flushList();
    } else {
      // Regular paragraph
      flushList();
      adfContent.push({
        type: 'paragraph',
        content: processInlineFormatting(line),
      });
    }
  }

  // Final flush
  flushList();
  flushCodeBlock();

  // Filter out empty paragraphs
  const finalContent = adfContent.filter(
    (node) =>
      !(
        node.type === 'paragraph' &&
        (!node.content || node.content.length === 0)
      ),
  );

  return {
    type: 'doc',
    version: 1,
    content:
      finalContent.length > 0
        ? finalContent
        : [{ type: 'paragraph', content: [] }],
  };
};

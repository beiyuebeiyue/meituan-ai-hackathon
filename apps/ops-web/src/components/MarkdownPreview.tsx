import { Image, Tag, Typography } from "antd";
import type { ReactNode } from "react";
import { resolveAssetUrl } from "../api/client";

type MarkdownPreviewProps = {
  content: string;
};

function cleanCell(value: string): string {
  return value.trim().replace(/^`|`$/g, "");
}

function isImagePath(value: string): boolean {
  const clean = cleanCell(value);
  return /\.(webp|png|jpe?g|gif)(\?.*)?$/i.test(clean);
}

function isTagColumn(header?: string): boolean {
  return cleanCell(header ?? "").includes("标签");
}

function isMetricColumn(header?: string): boolean {
  return ["点赞", "收藏", "分享", "Like", "Collect", "Share"].includes(cleanCell(header ?? ""));
}

function renderInline(value: string, keyPrefix: string): ReactNode[] {
  return value.split(/(`[^`]+`)/g).flatMap((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={`${keyPrefix}-${index}`}>{cleanCell(part)}</code>;
    }
    return part.split(/(\*\*[^*]+\*\*)/g).map((inlinePart, inlineIndex) => {
      if (inlinePart.startsWith("**") && inlinePart.endsWith("**")) {
        return <strong key={`${keyPrefix}-${index}-${inlineIndex}`}>{inlinePart.slice(2, -2)}</strong>;
      }
      return inlinePart;
    });
  });
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderTags(value: string, key: string) {
  const tags = cleanCell(value)
    .split(/[、,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (tags.length === 0 || tags[0] === "-") {
    return <span className="markdown-muted">-</span>;
  }

  return (
    <div className="markdown-tag-list">
      {tags.map((tag, index) => (
        <Tag key={`${key}-${index}`}>{tag}</Tag>
      ))}
    </div>
  );
}

function renderCell(value: string, key: string, header?: string) {
  if (isImagePath(value)) {
    const path = cleanCell(value);
    return (
      <Image
        className="markdown-table-image"
        src={resolveAssetUrl(path)}
        alt={path}
        preview
        width={15}
        height={15}
        style={{ objectFit: "cover", borderRadius: 4 }}
      />
    );
  }
  if (isTagColumn(header)) {
    return renderTags(value, key);
  }
  if (isMetricColumn(header)) {
    return <span className="markdown-metric">{cleanCell(value)}</span>;
  }
  return renderInline(value, key);
}

function renderImage(path: string, alt: string, key: string, width?: number) {
  const size = width ? Math.max(40, Math.min(width, 320)) : undefined;
  return (
    <figure className="markdown-image" key={key} style={size ? { width: size } : undefined}>
      <Image
        src={resolveAssetUrl(path)}
        alt={alt}
        preview
        width={size}
        height={size}
        style={size ? { objectFit: "cover", borderRadius: 8 } : undefined}
      />
      <figcaption>{alt}</figcaption>
    </figure>
  );
}

function MarkdownTable({ lines, index }: { lines: string[]; index: number }) {
  const rows = lines.map(splitTableRow);
  const headers = rows[0] ?? [];
  const body = rows.slice(2);

  return (
    <div className="markdown-table-wrap" key={`table-${index}`}>
      <table className="markdown-table">
        <thead>
          <tr>
            {headers.map((header, headerIndex) => (
              <th key={`h-${headerIndex}`}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={`r-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`c-${cellIndex}`}>{renderCell(cell, `table-${index}-${rowIndex}-${cellIndex}`, headers[cellIndex])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const lines = content.split("\n");
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        tableLines.push(lines[index]);
        index += 1;
      }
      nodes.push(<MarkdownTable key={`table-${index}`} lines={tableLines} index={index} />);
      continue;
    }

    const image = line.match(/^!\[(.*)]\((.*)\)$/);
    if (image) {
      nodes.push(renderImage(image[2], image[1], `image-${index}`));
      index += 1;
      continue;
    }

    const htmlImage = line.match(/^<img\s+src="([^"]+)"\s+alt="([^"]*)"\s+width="(\d+)"\s*\/>$/);
    if (htmlImage) {
      nodes.push(renderImage(htmlImage[1], htmlImage[2], `image-${index}`, Number(htmlImage[3])));
      index += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      nodes.push(
        <Typography.Title level={5} key={`h3-${index}`}>
          {line.slice(4)}
        </Typography.Title>,
      );
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      nodes.push(
        <Typography.Title level={4} key={`h2-${index}`}>
          {line.slice(3)}
        </Typography.Title>,
      );
      index += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      nodes.push(
        <Typography.Title level={3} key={`h1-${index}`}>
          {line.slice(2)}
        </Typography.Title>,
      );
      index += 1;
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith("- ")) {
        items.push(lines[index].trim().slice(2));
        index += 1;
      }
      nodes.push(
        <ul className="markdown-list" key={`list-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={`item-${itemIndex}`}>{renderInline(item, `list-${index}-${itemIndex}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    nodes.push(
      <Typography.Paragraph key={`p-${index}`}>{renderInline(line, `p-${index}`)}</Typography.Paragraph>,
    );
    index += 1;
  }

  return <div className="markdown-preview">{nodes}</div>;
}

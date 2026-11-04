/**
 * Notion 페이지 속성 읽기/쓰기 헬퍼.
 * Notion 응답 타입은 매우 넓은 union 이라, 여기서 좁혀서 도메인 객체로 변환한다.
 */

// 응답의 속성 값은 type 필드로 구분되는 객체. 필요한 필드만 느슨하게 정의한다.
export type PropValue = { type: string; [k: string]: unknown };
export type Props = Record<string, PropValue>;

type RichTextItem = { plain_text?: string };

const RICH_TEXT_LIMIT = 2000;

function joinRichText(items: unknown): string {
  if (!Array.isArray(items)) return "";
  return (items as RichTextItem[]).map((t) => t.plain_text ?? "").join("");
}

export const read = {
  title(props: Props, name: string): string {
    const p = props[name];
    return p?.type === "title" ? joinRichText(p.title) : "";
  },
  text(props: Props, name: string): string {
    const p = props[name];
    return p?.type === "rich_text" ? joinRichText(p.rich_text) : "";
  },
  number(props: Props, name: string): number | null {
    const p = props[name];
    return p?.type === "number" && typeof p.number === "number" ? p.number : null;
  },
  checkbox(props: Props, name: string): boolean {
    const p = props[name];
    return p?.type === "checkbox" ? p.checkbox === true : false;
  },
  url(props: Props, name: string): string | null {
    const p = props[name];
    return p?.type === "url" && typeof p.url === "string" ? p.url : null;
  },
  select<T extends string = string>(props: Props, name: string): T | null {
    const p = props[name];
    if (p?.type !== "select" || !p.select) return null;
    return ((p.select as { name?: string }).name ?? null) as T | null;
  },
  multiSelect(props: Props, name: string): string[] {
    const p = props[name];
    if (p?.type !== "multi_select" || !Array.isArray(p.multi_select)) return [];
    return (p.multi_select as { name: string }[]).map((o) => o.name);
  },
  date(props: Props, name: string): { start: string; end: string | null } | null {
    const p = props[name];
    if (p?.type !== "date" || !p.date) return null;
    const d = p.date as { start: string; end?: string | null };
    return { start: d.start, end: d.end ?? null };
  },
  relation(props: Props, name: string): string[] {
    const p = props[name];
    if (p?.type !== "relation" || !Array.isArray(p.relation)) return [];
    return (p.relation as { id: string }[]).map((r) => r.id);
  },
  formulaNumber(props: Props, name: string): number | null {
    const p = props[name];
    if (p?.type !== "formula" || !p.formula) return null;
    const f = p.formula as { type: string; number?: number | null };
    return f.type === "number" && typeof f.number === "number" ? f.number : null;
  },
};

/** 2000자 제한을 넘는 텍스트를 여러 rich_text 객체로 분할 */
export function toRichText(text: string) {
  const chunks: { type: "text"; text: { content: string } }[] = [];
  for (let i = 0; i < text.length; i += RICH_TEXT_LIMIT) {
    chunks.push({ type: "text", text: { content: text.slice(i, i + RICH_TEXT_LIMIT) } });
  }
  return chunks;
}

export const write = {
  title: (text: string) => ({ title: toRichText(text) }),
  text: (text: string) => ({ rich_text: toRichText(text) }),
  number: (n: number | null) => ({ number: n }),
  checkbox: (v: boolean) => ({ checkbox: v }),
  url: (u: string | null) => ({ url: u || null }),
  select: (name: string | null) => ({ select: name ? { name } : null }),
  multiSelect: (names: string[]) => ({ multi_select: names.map((name) => ({ name })) }),
  date: (start: string | null, end?: string | null) => ({
    date: start ? { start, end: end ?? null } : null,
  }),
  relation: (ids: string[]) => ({ relation: ids.map((id) => ({ id })) }),
};

/** 페이지 응답에서 properties 를 안전하게 꺼낸다 */
export function propsOf(page: unknown): Props {
  if (page && typeof page === "object" && "properties" in page) {
    return (page as { properties: Props }).properties;
  }
  return {};
}

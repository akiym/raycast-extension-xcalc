import { Action, ActionPanel, clearSearchBar, Detail, Icon, List, useNavigation } from "@raycast/api";
import { execSync } from "child_process";
import { decode as decodeHtmlEntities, encode as encodeHtmlEntities } from "html-entities";
import React from "react";
import { hexdump } from "./lib/hexdump";

const UNICODE_LITERAL_RE = new RegExp("\\\\u(?:([0-9a-fA-F]{4})|{([0-9a-fA-F]+)})", "g");

interface Fn {
  name: string;
  encode: (b: Buffer) => string;
  decode: (b: Buffer) => Buffer;
}

interface Output {
  name: string;
  encode: ReturnType<Fn["encode"]> | null;
  decode: ReturnType<Fn["decode"]> | null;
}

function readClipboard() {
  return execSync("pbpaste", { env: { LANG: "en_US.UTF-8" } });
}

const functions: Fn[] = [
  {
    name: "base64",
    encode: (b) => b.toString("base64"),
    decode: (b) => {
      const s = b.toString();
      if (!/^[A-Za-z0-9+/]+=*$/.test(s)) {
        throw new Error("invalid base64 string");
      }
      return Buffer.from(s, "base64");
    },
  },
  {
    name: "hex",
    encode: (b) => Buffer.from(b).toString("hex"),
    decode: (b) => {
      const s = b.toString().replace(/\s/g, "");
      if (s.length % 2 != 0 || !/^[0-9a-fA-F\s]+$/.test(s)) {
        throw new Error("invalid hex string");
      }
      return Buffer.from(s, "hex");
    },
  },
  {
    name: "uri",
    encode: (b) => encodeURIComponent(b.toString()),
    decode: (b) => Buffer.from(decodeURIComponent(b.toString())),
  },
  {
    name: "html",
    encode: (b) => encodeHtmlEntities(b.toString()),
    decode: (b) => Buffer.from(decodeHtmlEntities(b.toString())),
  },
  {
    name: "json",
    encode: (b) => JSON.stringify(b.toString()),
    decode: (b) => Buffer.from(JSON.parse(b.toString()).toString()),
  },
  {
    name: "char code",
    encode: (b) => {
      const c = b.toString();
      if (c.length !== 1) {
        throw new Error("not a character");
      }
      return String(c.charCodeAt(0));
    },
    decode: (b) => {
      if (!Number.isInteger(Number(b)) || isNaN(parseInt(b.toString(), 10))) {
        throw new Error("not an integer");
      }
      return Buffer.from(String.fromCharCode(Number(b)));
    },
  },
  {
    name: "unicode",
    encode: (b) => {
      return Array.from(b.toString())
        .map((c) => {
          const hex = c.codePointAt(0)?.toString(16).padStart(4, "0");
          if (hex) {
            return hex.length > 4 ? `\\u{${hex}}` : `\\u${hex}`;
          }
        })
        .join("");
    },
    decode: (b) => {
      let str = "";
      let m;
      while ((m = UNICODE_LITERAL_RE.exec(b.toString())) !== null) {
        str += String.fromCodePoint(parseInt(m[2] ?? m[1], 16));
      }
      return Buffer.from(str);
    },
  },
  {
    name: "unixtime",
    encode: (b) => {
      const n = Number(b.toString());
      if (isNaN(n)) {
        throw new Error("not a number");
      }
      const date = new Date(n * 1000);
      if (isNaN(date.getTime())) {
        throw new Error("invalid date");
      }
      return date.toLocaleString();
    },
    decode: (b) => {
      const date = new Date(b.toString());
      if (isNaN(date.getTime())) {
        throw new Error("invalid date");
      }
      return Buffer.from(String(Math.floor(date.getTime() / 1000)));
    },
  },
];

function wrap<T>(f: () => T): T | null {
  try {
    return f();
  } catch {
    return null;
  }
}

function filter(output: string | Buffer | null, input: string | undefined) {
  if (output === null || input === undefined) {
    return false;
  }

  if (typeof output === "string") {
    return output.length > 0 && output !== input;
  } else {
    return output.length > 0 && !output.equals(Buffer.from(input));
  }
}

function dumpMarkdown(output: Buffer) {
  const s = output.toString();
  return `
**Words:** ${s.split(" ").length}  
**Lines:** ${s.split("\n").length}  
**Characters:** ${[...s].length}  
**Bytes:** ${output.length}
\`\`\`
${hexdump(output)}\`\`\`
\`\`\`
${s}
\`\`\`
`;
}

const Dump: React.FC<{ buffer: Buffer }> = ({ buffer }) => {
  const { pop } = useNavigation();
  return (
    <Detail
      markdown={dumpMarkdown(buffer)}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy as hex" content={buffer.toString("hex")} onCopy={pop} />
        </ActionPanel>
      }
    />
  );
};

const Item: React.FC<{
  name?: string;
  output: string | Buffer;
  icon?: "decode" | "encode";
  onConvert: (buffer: Buffer) => void;
}> = ({ name, output, icon, onConvert }) => {
  const buffer = typeof output === "string" ? Buffer.from(output) : output;
  return (
    <List.Item
      accessories={[
        {
          text: name,
          ...(icon !== undefined && {
            icon: {
              source: icon === "decode" ? Icon.ArrowRight : Icon.ArrowLeft,
            },
          }),
        },
      ]}
      title={output.toString()}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy" content={output.toString()} />
          <ActionPanel.Item title="Convert" onAction={() => onConvert(buffer)} />
          <Action.Push title="Dump" shortcut={{ modifiers: ["cmd"], key: "d" }} target={<Dump buffer={buffer} />} />
        </ActionPanel>
      }
    />
  );
};

export default function Command() {
  const [query, setQuery] = React.useState("");
  const [outputs, setOutputs] = React.useState<Output[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [clipboard, setClipboard] = React.useState<Buffer | null>(null);
  const [buffer, setBuffer] = React.useState<Buffer | null>(null);

  React.useEffect(() => {
    if (query === "") {
      setClipboard(readClipboard());
      setIsLoading(false);
      setBuffer(null);
    }
  }, [query]);

  React.useEffect(() => {
    const input = query !== "" ? Buffer.from(query) : buffer ?? clipboard;

    if (input === null || input.length === 0) {
      setOutputs([]);
    } else {
      setOutputs(
        functions.map((f) => ({
          encode: wrap(() => f.encode(input)),
          decode: wrap(() => f.decode(input)),
          name: f.name,
        })),
      );
    }
  }, [query, clipboard, buffer]);

  const onConvert = React.useCallback(async (buffer: Buffer) => {
    await clearSearchBar();
    setQuery("");
    setBuffer(buffer);
  }, []);

  const input = query !== "" ? query : buffer?.toString() ?? clipboard?.toString();

  return (
    <List onSearchTextChange={setQuery} searchBarPlaceholder={"..."} isLoading={isLoading}>
      {input && (
        <List.Section>
          <Item output={input} onConvert={onConvert} />
        </List.Section>
      )}
      <List.Section title="Decode">
        {outputs
          .filter((output) => filter(output.decode, input))
          .map((output) => (
            <Item key={output.name} name={output.name} output={output.decode!} icon="decode" onConvert={onConvert} />
          ))}
      </List.Section>
      <List.Section title="Encode">
        {outputs
          .filter((output) => filter(output.encode, input))
          .map((output) => (
            <Item key={output.name} name={output.name} output={output.encode!} icon="encode" onConvert={onConvert} />
          ))}
      </List.Section>
    </List>
  );
}

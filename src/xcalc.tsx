import { Action, ActionPanel, Clipboard, List, Toast } from "@raycast/api";
import { execFile } from "child_process";
import React from "react";
import { promisify } from "util";

const execFilePromise = promisify(execFile);

const accessoryTitles = ["dec", "hex", "oct", "bin"];

interface Output {
  value: string;
  name?: string;
}

interface ExecError extends Error {
  code: number;
  stdout: string;
  stderr: string;
}

function safeeval(query: string) {
  return execFilePromise("python3", [`${__dirname}/assets/safeeval.py`, query]);
}

async function showFailureToast(title: string, error: Error): Promise<void> {
  if (error.name == "AbortError") {
    return;
  }

  const stderr = (error as ExecError).stderr?.trim() ?? "";
  const options: Toast.Options = {
    style: Toast.Style.Failure,
    title: title,
    message: stderr,
    primaryAction: {
      title: "Copy Error Log",
      onAction: () => {
        Clipboard.copy(stderr);
      },
    },
  };

  const toast = new Toast(options);
  await toast.show();
}

export default function Command() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [outputs, setOutputs] = React.useState<Output[]>([]);

  React.useEffect(() => {
    setIsLoading(true);
    safeeval(query)
      .then((result) => {
        setIsLoading(false);
        const lines = result.stdout.split("\n").filter((l) => l.length > 0);
        if (lines.length === 1) {
          return setOutputs([{ value: lines[0] }]);
        } else {
          return setOutputs(
            lines.map((l, i) => ({
              value: l,
              name: accessoryTitles[i],
            }))
          );
        }
      })
      .catch((err) => {
        setIsLoading(false);
        showFailureToast("xcalc failed", err);
      });
  }, [query]);

  return (
    <List onSearchTextChange={setQuery} searchBarPlaceholder={"0x1234+0x5678"} isLoading={isLoading}>
      {outputs.map((output, i) => (
        <List.Item
          key={i}
          title={output.value}
          accessoryTitle={output.name}
          actions={
            <ActionPanel>
              <Action.CopyToClipboard title="Copy" content={output.value} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

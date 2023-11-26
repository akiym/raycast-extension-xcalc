import { Action, ActionPanel, Clipboard, List, Toast } from "@raycast/api";
import { execFile } from "child_process";
import React from "react";
import { promisify } from "util";

const execFilePromise = promisify(execFile);

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
  const [isLoading, setIsLoading] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [outputs, setOutputs] = React.useState<Output[]>([]);

  React.useEffect(() => {
    if (query === "") {
      return;
    }

    setIsLoading(true);
    safeeval(query)
      .then((result) => {
        setIsLoading(false);
        setOutputs(JSON.parse(result.stdout));
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
          accessories={[
            {
              text: output.name,
            },
          ]}
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

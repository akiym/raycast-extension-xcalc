import {
  ActionPanel,
  copyTextToClipboard,
  CopyToClipboardAction,
  List,
  Toast,
  ToastOptions,
  ToastStyle,
} from "@raycast/api";
import { execFile } from "child_process";
import React from "react";
import { promisify } from "util";

const execFilePromise = promisify(execFile);

function safeeval(query: string) {
  return execFilePromise("python3", [`${__dirname}/assets/safeeval.py`, query]);
}

interface ExecError extends Error {
  code: number;
  stdout: string;
  stderr: string;
}

async function showFailureToast(title: string, error: Error): Promise<void> {
  if (error.name == "AbortError") {
    return;
  }

  const stderr = (error as ExecError).stderr?.trim() ?? "";
  const options: ToastOptions = {
    style: ToastStyle.Failure,
    title: title,
    message: stderr,
    primaryAction: {
      title: "Copy Error Log",
      onAction: () => {
        copyTextToClipboard(stderr);
      },
    },
  };

  const toast = new Toast(options);
  await toast.show();
}

export default function Command() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [outputLines, setOutputLines] = React.useState<string[]>([]);

  React.useEffect(() => {
    setIsLoading(true);
    safeeval(query)
      .then((result) => {
        setIsLoading(false);
        setOutputLines(result.stdout.split("\n").filter((l) => l.length > 0));
      })
      .catch((err) => {
        setIsLoading(false);
        showFailureToast("xcalc failed", err);
      });
  }, [query]);

  const accessoryTitles = ["dec", "hex", "oct", "bin"];

  return (
    <List onSearchTextChange={setQuery} searchBarPlaceholder={"0x1234+0x5678"} isLoading={isLoading}>
      {outputLines.map((line, i) => (
        <List.Item
          key={i}
          accessoryTitle={outputLines.length === 1 ? undefined : accessoryTitles[i]}
          title={line}
          actions={
            <ActionPanel>
              <CopyToClipboardAction title="Copy" content={line} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

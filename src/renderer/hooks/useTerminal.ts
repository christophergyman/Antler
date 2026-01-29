import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import type { PtyHandle, AgentStatus } from "@core/types";
import { spawnPty } from "@services/pty";
import { logWorktree } from "@services/logging";

// Import xterm CSS
import "xterm/css/xterm.css";

interface UseTerminalOptions {
  worktreePath: string;
  port: number | null;
  autoStart?: boolean;
}

interface UseTerminalReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  status: AgentStatus;
  error: string | null;
  startAgent: () => Promise<void>;
  stopAgent: () => Promise<void>;
}

export function useTerminal({
  worktreePath,
  port,
  autoStart = true,
}: UseTerminalOptions): UseTerminalReturn {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyRef = useRef<PtyHandle | null>(null);
  const [status, setStatus] = useState<AgentStatus>("stopped");
  const [error, setError] = useState<string | null>(null);

  // Initialize xterm.js terminal
  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"MesloLGS NF", "JetBrainsMono Nerd Font", "FiraCode Nerd Font", "Hack Nerd Font", Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#aeafad",
        cursorAccent: "#1e1e1e",
        selectionBackground: "#264f78",
        black: "#1e1e1e",
        red: "#f44747",
        green: "#6a9955",
        yellow: "#dcdcaa",
        blue: "#569cd6",
        magenta: "#c586c0",
        cyan: "#4ec9b0",
        white: "#d4d4d4",
        brightBlack: "#808080",
        brightRed: "#f44747",
        brightGreen: "#6a9955",
        brightYellow: "#dcdcaa",
        brightBlue: "#569cd6",
        brightMagenta: "#c586c0",
        brightCyan: "#4ec9b0",
        brightWhite: "#d4d4d4",
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.open(containerRef.current);

    // Initial fit
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current && terminalRef.current) {
        fitAddonRef.current.fit();
        // Notify PTY of resize
        if (ptyRef.current) {
          const { cols, rows } = terminalRef.current;
          ptyRef.current.resize(cols, rows).catch((err) => {
            logWorktree("warn", "Failed to resize PTY", { error: String(err) });
          });
        }
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // Start agent
  const startAgent = useCallback(async () => {
    if (!terminalRef.current) {
      logWorktree("warn", "Cannot start agent: terminal not initialized");
      return;
    }

    if (ptyRef.current) {
      logWorktree("warn", "Agent already running");
      return;
    }

    setStatus("starting");
    setError(null);

    // Fit terminal to get accurate dimensions
    if (fitAddonRef.current) {
      fitAddonRef.current.fit();
    }

    const terminal = terminalRef.current;
    const env: Record<string, string> = {};
    if (port !== null) {
      env.PORT = String(port);
    }

    logWorktree("info", "Starting Claude agent", { worktreePath, port });

    const result = await spawnPty({
      cmd: "claude",
      args: [],
      cwd: worktreePath,
      cols: terminal.cols,
      rows: terminal.rows,
      env,
    });

    if (!result.ok) {
      setStatus("error");
      setError(result.error.message);
      terminal.writeln(`\r\n\x1b[31mError: ${result.error.message}\x1b[0m\r\n`);
      if (result.error.details) {
        terminal.writeln(`\x1b[90m${result.error.details}\x1b[0m\r\n`);
      }
      return;
    }

    const pty = result.value;
    ptyRef.current = pty;
    setStatus("running");

    // Connect PTY output to terminal
    const unsubData = pty.onData((data) => {
      terminal.write(data);
    });

    // Connect terminal input to PTY
    const disposeOnData = terminal.onData((data) => {
      pty.write(data).catch((err) => {
        logWorktree("warn", "Failed to write to PTY", { error: String(err) });
      });
    });

    // Handle PTY exit
    const unsubExit = pty.onExit((code) => {
      logWorktree("info", "Agent exited", { code });
      setStatus("stopped");
      terminal.writeln(`\r\n\x1b[90mProcess exited with code ${code ?? "unknown"}\x1b[0m\r\n`);

      // Clean up
      unsubData();
      unsubExit();
      disposeOnData.dispose();
      ptyRef.current = null;
    });
  }, [worktreePath, port]);

  // Stop agent
  const stopAgent = useCallback(async () => {
    if (ptyRef.current) {
      await ptyRef.current.kill();
      ptyRef.current = null;
      setStatus("stopped");
    }
  }, []);

  // Auto-start on mount if enabled
  useEffect(() => {
    if (autoStart && terminalRef.current && !ptyRef.current) {
      // Small delay to ensure terminal is ready
      const timer = setTimeout(() => {
        startAgent();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoStart, startAgent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ptyRef.current) {
        ptyRef.current.kill().catch(() => {
          // Ignore errors during cleanup
        });
        ptyRef.current = null;
      }
    };
  }, []);

  return {
    containerRef,
    status,
    error,
    startAgent,
    stopAgent,
  };
}

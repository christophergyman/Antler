import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal } from "xterm";
import { WebLinksAddon } from "xterm-addon-web-links";
import type { PtyHandle, AgentStatus } from "@core/types";
import { spawnPty } from "@services/pty";
import { logWorktree } from "@services/logging";
import { DEFAULT_TERMINAL_COLS, DEFAULT_TERMINAL_ROWS } from "@services/config";

// Import xterm CSS
import "xterm/css/xterm.css";

interface UseTerminalOptions {
  worktreePath: string;
  port: number | null;
  autoStart?: boolean;
  cols?: number;
  rows?: number;
}

interface UseTerminalReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  terminalMountRef: React.RefObject<HTMLDivElement>;
  status: AgentStatus;
  error: string | null;
  startAgent: () => Promise<void>;
  stopAgent: () => Promise<void>;
  scale: number;
}

export function useTerminal({
  worktreePath,
  port,
  autoStart = true,
  cols = DEFAULT_TERMINAL_COLS,
  rows = DEFAULT_TERMINAL_ROWS,
}: UseTerminalOptions): UseTerminalReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalMountRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const ptyRef = useRef<PtyHandle | null>(null);
  const terminalSizeRef = useRef<{ width: number; height: number } | null>(null);
  const [status, setStatus] = useState<AgentStatus>("stopped");
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1);

  // Calculate scale to fit terminal within container
  const calculateScale = useCallback(() => {
    if (!containerRef.current || !terminalSizeRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const termSize = terminalSizeRef.current;

    // Calculate scale factors for both dimensions
    const scaleX = containerRect.width / termSize.width;
    const scaleY = containerRect.height / termSize.height;

    // Use the smaller scale to fit within container, but never scale up
    const newScale = Math.min(scaleX, scaleY, 1.0);
    setScale(newScale);
  }, []);

  // Initialize xterm.js terminal
  useEffect(() => {
    if (!terminalMountRef.current || terminalRef.current) return;

    const terminal = new Terminal({
      cols,
      rows,
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

    const webLinksAddon = new WebLinksAddon();
    terminal.loadAddon(webLinksAddon);
    terminal.open(terminalMountRef.current);

    terminalRef.current = terminal;

    // Get actual terminal dimensions after render
    requestAnimationFrame(() => {
      const screen = terminalMountRef.current?.querySelector('.xterm-screen');
      if (screen) {
        const rect = screen.getBoundingClientRect();
        terminalSizeRef.current = { width: rect.width, height: rect.height };
        calculateScale();
      }
    });

    // Observe container for resize to recalculate scale
    const resizeObserver = new ResizeObserver(() => {
      calculateScale();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
    };
  }, [cols, rows, calculateScale]);

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

    const terminal = terminalRef.current;
    const env: Record<string, string> = {};
    if (port !== null) {
      env.PORT = String(port);
    }

    logWorktree("info", "Starting Claude agent", { worktreePath, port, cols, rows });

    const result = await spawnPty({
      cmd: "claude",
      args: [],
      cwd: worktreePath,
      cols,
      rows,
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
  }, [worktreePath, port, cols, rows]);

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
    terminalMountRef,
    status,
    error,
    startAgent,
    stopAgent,
    scale,
  };
}

#!/usr/bin/env python3
"""Capture the web demo autoplay flow as a README-friendly GIF.

The script uses Chromium's DevTools Protocol directly so it does not require
Playwright, Puppeteer, or external Python packages beyond Pillow.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import os
import socket
import struct
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from PIL import Image


class CDPClient:
    def __init__(self, websocket_url: str) -> None:
        self._id = 0
        parsed = urlparse(websocket_url)
        self._sock = socket.create_connection((parsed.hostname, parsed.port), timeout=10)
        key = base64.b64encode(os.urandom(16)).decode("ascii")
        path = parsed.path
        if parsed.query:
            path += "?" + parsed.query
        request = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {parsed.hostname}:{parsed.port}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n"
        )
        self._sock.sendall(request.encode("ascii"))
        response = self._recv_http_response()
        if b" 101 " not in response.split(b"\r\n", 1)[0]:
            raise RuntimeError(f"DevTools websocket handshake failed: {response[:120]!r}")
        self._sock.settimeout(60)

    def close(self) -> None:
        self._sock.close()

    def call(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        self._id += 1
        message_id = self._id
        self._send_json({"id": message_id, "method": method, "params": params or {}})
        while True:
            message = json.loads(self._recv_message())
            if message.get("id") == message_id:
                if "error" in message:
                    raise RuntimeError(f"CDP error for {method}: {message['error']}")
                return message.get("result", {})

    def _recv_http_response(self) -> bytes:
        data = b""
        while b"\r\n\r\n" not in data:
            data += self._sock.recv(4096)
        return data

    def _send_json(self, payload: dict[str, Any]) -> None:
        raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        header = bytearray([0x81])
        length = len(raw)
        if length < 126:
            header.append(0x80 | length)
        elif length < 65536:
            header.append(0x80 | 126)
            header.extend(struct.pack("!H", length))
        else:
            header.append(0x80 | 127)
            header.extend(struct.pack("!Q", length))
        mask = os.urandom(4)
        masked = bytes(byte ^ mask[index % 4] for index, byte in enumerate(raw))
        self._sock.sendall(bytes(header) + mask + masked)

    def _recv_exact(self, size: int) -> bytes:
        data = b""
        while len(data) < size:
            chunk = self._sock.recv(size - len(data))
            if not chunk:
                raise RuntimeError("websocket closed")
            data += chunk
        return data

    def _recv_message(self) -> str:
        parts: list[bytes] = []
        opcode = None
        while True:
            first, second = self._recv_exact(2)
            fin = bool(first & 0x80)
            frame_opcode = first & 0x0F
            masked = bool(second & 0x80)
            length = second & 0x7F
            if length == 126:
                length = struct.unpack("!H", self._recv_exact(2))[0]
            elif length == 127:
                length = struct.unpack("!Q", self._recv_exact(8))[0]
            mask = self._recv_exact(4) if masked else b""
            payload = self._recv_exact(length)
            if masked:
                payload = bytes(byte ^ mask[index % 4] for index, byte in enumerate(payload))
            if frame_opcode in (0x1, 0x2):
                opcode = frame_opcode
                parts.append(payload)
            elif frame_opcode == 0x0:
                parts.append(payload)
            elif frame_opcode == 0x8:
                raise RuntimeError("websocket closed by peer")
            if fin and opcode is not None:
                return b"".join(parts).decode("utf-8")


def wait_for_devtools(port: int) -> str:
    endpoint = f"http://127.0.0.1:{port}/json/list"
    deadline = time.time() + 10
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(endpoint, timeout=1) as response:
                targets = json.load(response)
                for target in targets:
                    if target.get("type") == "page" and target.get("webSocketDebuggerUrl"):
                        return target["webSocketDebuggerUrl"]
        except Exception:
            time.sleep(0.1)
    raise RuntimeError("Chromium DevTools endpoint did not start")


def capture(args: argparse.Namespace) -> None:
    root = Path(__file__).resolve().parents[1]
    target_url = args.url or (root / "web" / "index.html").resolve().as_uri()
    output = (root / args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="simplebuddy-chrome-", ignore_cleanup_errors=True) as profile:
        chrome = subprocess.Popen(
            [
                args.chromium,
                "--headless=new",
                "--disable-gpu",
                "--no-sandbox",
                "--hide-scrollbars",
                f"--remote-debugging-port={args.port}",
                f"--user-data-dir={profile}",
                f"--window-size={args.width},{args.height}",
                "about:blank",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        client: CDPClient | None = None
        try:
            client = CDPClient(wait_for_devtools(args.port))
            client.call("Page.enable")
            client.call("Runtime.enable")
            client.call(
                "Emulation.setDeviceMetricsOverride",
                {
                    "width": args.width,
                    "height": args.height,
                    "deviceScaleFactor": 1,
                    "mobile": False,
                },
            )
            client.call("Page.navigate", {"url": target_url})
            wait_for_page_ready(client, args.initial_wait)
            start_autoplay(client)
            frames: list[Image.Image] = []
            total_frames = int(args.seconds * args.fps)
            interval = 1 / args.fps
            for _ in range(total_frames):
                result = client.call(
                    "Page.captureScreenshot",
                    {
                        "format": "jpeg",
                        "quality": args.jpeg_quality,
                        "captureBeyondViewport": False,
                    },
                )
                image_data = base64.b64decode(result["data"])
                image = Image.open(io.BytesIO(image_data))
                if args.scale != 1:
                    new_size = (int(image.width * args.scale), int(image.height * args.scale))
                    image = image.resize(new_size, Image.Resampling.LANCZOS)
                frames.append(image.convert("P", palette=Image.Palette.ADAPTIVE, colors=128))
                time.sleep(interval)
            frames[0].save(
                output,
                save_all=True,
                append_images=frames[1:],
                duration=int(1000 / args.fps),
                loop=0,
                optimize=True,
            )
            digest = hashlib.sha256(output.read_bytes()).hexdigest()[:12]
            print(f"wrote {output} ({output.stat().st_size} bytes, sha256:{digest})")
        finally:
            if client:
                client.close()
            chrome.terminate()
            try:
                chrome.wait(timeout=5)
            except subprocess.TimeoutExpired:
                chrome.kill()


def wait_for_page_ready(client: CDPClient, minimum_wait: float) -> None:
    time.sleep(minimum_wait)
    deadline = time.time() + 12
    expression = """
    (() => {
      const play = document.getElementById('playBtn');
      const used = document.getElementById('usedPages');
      const memory = document.getElementById('memory');
      return Boolean(play && used && memory && !play.disabled);
    })()
    """
    while time.time() < deadline:
        result = client.call("Runtime.evaluate", {"expression": expression, "returnByValue": True})
        if result.get("result", {}).get("value") is True:
            return
        time.sleep(0.2)
    raise RuntimeError("web demo did not finish initializing")


def start_autoplay(client: CDPClient) -> None:
    deadline = time.time() + 10
    state_expression = """
    (() => {
      const used = document.getElementById('usedPages');
      const play = document.getElementById('playBtn');
      const label = document.getElementById('playLabel') || play;
      return {
        used: used ? used.textContent.trim() : '',
        playing: Boolean(label && /pause|暂停/i.test(label.textContent)),
        disabled: Boolean(play && play.disabled),
        hasPlay: Boolean(play)
      };
    })()
    """
    while time.time() < deadline:
        result = client.call("Runtime.evaluate", {"expression": state_expression, "returnByValue": True})
        value = result.get("result", {}).get("value", {})
        if value.get("playing") or (value.get("used") and value["used"] != "0"):
            return
        if value.get("hasPlay") and not value.get("playing") and not value.get("disabled"):
            client.call(
                "Runtime.evaluate",
                {
                    "expression": """
                    (() => {
                      const play = document.getElementById('playBtn');
                      play.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                      return true;
                    })()
                    """,
                    "awaitPromise": True,
                },
            )
        time.sleep(0.2)
    raise RuntimeError("autoplay did not start after clicking play")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--chromium", default="chromium")
    parser.add_argument("--output", default="assets/simplebuddy-demo.gif")
    parser.add_argument("--url")
    parser.add_argument("--port", type=int, default=9333)
    parser.add_argument("--width", type=int, default=1180)
    parser.add_argument("--height", type=int, default=720)
    parser.add_argument("--seconds", type=float, default=10)
    parser.add_argument("--fps", type=int, default=5)
    parser.add_argument("--scale", type=float, default=0.72)
    parser.add_argument("--jpeg-quality", type=int, default=72)
    parser.add_argument("--initial-wait", type=float, default=1.2)
    capture(parser.parse_args())


if __name__ == "__main__":
    main()

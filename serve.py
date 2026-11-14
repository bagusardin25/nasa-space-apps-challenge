"""Tiny development server for GO/NO-GO: serves this folder with caching disabled,
so edits to JavaScript modules show up on a normal reload.

Usage:  python serve.py [port]      (default port 5173)
"""
import functools
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript", ".svg": "image/svg+xml"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    root = os.path.dirname(os.path.abspath(__file__))
    handler = functools.partial(NoCacheHandler, directory=root)
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"GO/NO-GO running at http://localhost:{port}  (Ctrl+C to stop)")
        httpd.serve_forever()


if __name__ == "__main__":
    main()

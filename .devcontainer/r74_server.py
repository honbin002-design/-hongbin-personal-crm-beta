#!/usr/bin/env python3
"""Private, development-only R74 preview server. NEVER serves the R73 production site."""
from argparse import ArgumentParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit


class R74Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        # Opening the forwarded Codespaces port leads to origin-guarded synthetic sample data.
        if urlsplit(self.path).path == "/":
            self.send_response(302)
            self.send_header("Location", "/r74-test.html")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Robots-Tag", "noindex, nofollow")
        super().end_headers()

    def list_directory(self, path):
        self.send_error(403, "TEST directory listing is disabled")
        return None


def main():
    parser = ArgumentParser()
    parser.add_argument("--bind", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=4174)
    args = parser.parse_args()
    print(f"R74 TEST synthetic-data preview on http://{args.bind}:{args.port}", flush=True)
    ThreadingHTTPServer((args.bind, args.port), R74Handler).serve_forever()


if __name__ == "__main__":
    main()

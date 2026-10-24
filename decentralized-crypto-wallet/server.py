#!/usr/bin/env python3
"""
Apex Decentralized Crypto Wallet - Local Server Launcher
Zero-dependency Python 3 HTTP server that opens the decentralized wallet in your default browser.
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 5173
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Enable CORS and disable aggressive caching for local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

def main():
    os.chdir(DIRECTORY)
    # Handle port in use gracefully
    port = PORT
    for attempt in range(10):
        try:
            with socketserver.TCPServer(("", port), Handler) as httpd:
                url = f"http://localhost:{port}"
                print("=" * 60)
                print(" 🛡️  APEX DECENTRALIZED MULTI-CHAIN CRYPTO WALLET")
                print("=" * 60)
                print(f" Local Web App running at: {url}")
                print(f" Project Directory:        {DIRECTORY}")
                print(" Non-Custodial Security:   Keys encrypted locally with AES-256-GCM")
                print(" Chains Supported:         Ethereum (EVM), Solana, Bitcoin")
                print("=" * 60)
                print(" Press Ctrl+C in terminal to stop server.")
                print("=" * 60)
                
                # Automatically open in browser
                webbrowser.open(url)
                httpd.serve_forever()
                break
        except OSError as e:
            if "address already in use" in str(e).lower() or e.errno == 98 or e.errno == 10048:
                port += 1
            else:
                raise e

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[+] Apex Wallet server stopped.")
        sys.exit(0)

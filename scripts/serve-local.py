"""Loopback-only static preview with room for parallel local asset requests."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('directory', choices=['public', 'runtime-public', 'dist'])
parser.add_argument('port', type=int, nargs='?', default=4173)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1] / args.directory
if not root.is_dir():
    parser.error(f'{args.directory} is missing; build or synchronize it first')

class PreviewServer(ThreadingHTTPServer):
    request_queue_size = 128

server = PreviewServer(('127.0.0.1', args.port), partial(SimpleHTTPRequestHandler, directory=str(root)))
print(f'Serving {args.directory} at http://127.0.0.1:{server.server_port}/', flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()

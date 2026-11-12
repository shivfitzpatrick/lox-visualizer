#!/usr/bin/env python3
"""
Sends LSP messages to typescript-language-server and prints the diagnostics
it reports for lox-visualizer-demo.ts. Useful for diagnosing path resolution
issues that only appear in the language server, not in tsc.

Usage: python3 lsp_diag_test.py
"""
import subprocess, json, os, select, sys, time

PROJECT_ROOT = '/mnt/home/siobhan/Code/project/active/goodskynet'
TARGET_FILE  = f'{PROJECT_ROOT}/assets/js/lox-visualizer/lox-visualizer-demo.ts'

# ── LSP wire helpers ──────────────────────────────────────────────────────────

def encode(obj: dict) -> bytes:
    body = json.dumps(obj)
    return f'Content-Length: {len(body)}\r\n\r\n{body}'.encode()

def read_all_available(stdout) -> bytes:
    """Read whatever bytes are currently buffered on stdout (non-blocking)."""
    buf = b''
    while True:
        r, _, _ = select.select([stdout], [], [], 0.05)
        if not r:
            break
        chunk = os.read(stdout.fileno(), 65536)
        if not chunk:
            break
        buf += chunk
    return buf

def parse_messages(raw: bytes) -> list:
    """Parse one or more LSP messages from a raw byte buffer."""
    msgs = []
    i = 0
    while i < len(raw):
        # Find Content-Length header
        cl_start = raw.find(b'Content-Length:', i)
        if cl_start == -1:
            break
        cl_end = raw.find(b'\r\n', cl_start)
        content_length = int(raw[cl_start + 15:cl_end].strip())
        # Skip \r\n\r\n separator
        body_start = raw.find(b'\r\n\r\n', cl_end) + 4
        body_end   = body_start + content_length
        if body_end > len(raw):
            break  # incomplete message, stop
        msgs.append(json.loads(raw[body_start:body_end]))
        i = body_end
    return msgs

def drain(proc, wait=4.0) -> list:
    """Wait up to `wait` seconds for messages, return all parsed ones."""
    time.sleep(wait)
    raw = read_all_available(proc.stdout)
    return parse_messages(raw)

def send(proc, obj: dict):
    proc.stdin.write(encode(obj))
    proc.stdin.flush()

# ── Main ──────────────────────────────────────────────────────────────────────

proc = subprocess.Popen(
    ['typescript-language-server', '--stdio'],
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    cwd=PROJECT_ROOT,
)

# Step 1: initialize
send(proc, {
    'jsonrpc': '2.0', 'id': 1, 'method': 'initialize',
    'params': {
        'processId': None,
        'rootUri': f'file://{PROJECT_ROOT}',
        'workspaceFolders': [{'uri': f'file://{PROJECT_ROOT}', 'name': 'goodskynet'}],
        'capabilities': {
            'textDocument': {'publishDiagnostics': {'relatedInformation': True}},
            'workspace':    {'workspaceFolders': True},
        },
        'initializationOptions': {},
    }
})

msgs = drain(proc, wait=3.0)
for m in msgs:
    method = m.get('method', '')
    if method == '$/typescriptVersion' or method == 'window/logMessage':
        print(f'[server] {m["params"].get("message", json.dumps(m["params"]))}')
    elif m.get('id') == 1:
        print(f'[initialize] server capabilities received (id=1)')

# Step 2: initialized notification
send(proc, {'jsonrpc': '2.0', 'method': 'initialized', 'params': {}})

# Step 3: open the target file
with open(TARGET_FILE) as f:
    content = f.read()

print(f'\n[opening] {TARGET_FILE}')
send(proc, {
    'jsonrpc': '2.0', 'method': 'textDocument/didOpen',
    'params': {
        'textDocument': {
            'uri':        f'file://{TARGET_FILE}',
            'languageId': 'typescript',
            'version':    1,
            'text':       content,
        }
    }
})

# Step 4: wait for diagnostics (tsserver can take a few seconds)
print('[waiting for diagnostics...]')
msgs = drain(proc, wait=10.0)

diag_msgs = [m for m in msgs if m.get('method') == 'textDocument/publishDiagnostics']
other_msgs = [m for m in msgs if m.get('method') != 'textDocument/publishDiagnostics']

for m in other_msgs:
    method = m.get('method', '')
    if method == 'window/logMessage':
        print(f'[log] {m["params"]["message"][:160]}')
    elif method:
        print(f'[{method}] (ignored)')

print(f'\n=== publishDiagnostics received for {len(diag_msgs)} file(s) ===\n')
for m in diag_msgs:
    uri   = m['params']['uri'].replace(f'file://{PROJECT_ROOT}/', '')
    diags = m['params']['diagnostics']
    if not diags:
        continue
    print(f'  {uri}  ({len(diags)} diagnostic(s))')
    for d in diags:
        sev  = {1:'ERROR',2:'WARN',3:'INFO',4:'HINT'}.get(d['severity'],'?')
        line = d['range']['start']['line'] + 1
        code = d.get('code', '')
        msg  = d['message']
        print(f'    [{sev}] line {line:3d}  TS{code}: {msg[:100]}')
    print()

# Step 5: also send a hover request over the first @/ import to see what tsserver says
# Find the line with the first @/ import
lines = content.splitlines()
import_line = next((i for i, l in enumerate(lines) if '@/' in l), None)
if import_line is not None:
    col = lines[import_line].index('@/')
    print(f'\n=== hover over import on line {import_line+1}: {lines[import_line].strip()} ===')
    send(proc, {
        'jsonrpc': '2.0', 'id': 2, 'method': 'textDocument/hover',
        'params': {
            'textDocument': {'uri': f'file://{TARGET_FILE}'},
            'position':     {'line': import_line, 'character': col + 2},
        }
    })
    msgs = drain(proc, wait=5.0)
    for m in msgs:
        if m.get('id') == 2:
            print(f'  hover result: {json.dumps(m.get("result"), indent=2)[:400]}')

proc.terminate()
proc.wait()

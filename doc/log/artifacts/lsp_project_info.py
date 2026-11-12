#!/usr/bin/env python3
"""
Asks typescript-language-server which tsconfig.json it is actually using
for lox-visualizer-demo.ts, and what module resolution settings are active.

Uses the `typescript.tsserverRequest` workspace command to send raw tsserver
protocol messages (which give richer project introspection than the LSP layer).
"""
import subprocess, json, os, select, sys, time

PROJECT_ROOT = '/mnt/home/siobhan/Code/project/active/goodskynet'
TARGET_FILE  = f'{PROJECT_ROOT}/assets/js/lox-visualizer/lox-visualizer-demo.ts'

# ── wire helpers ──────────────────────────────────────────────────────────────

def encode(obj):
    body = json.dumps(obj)
    return f'Content-Length: {len(body)}\r\n\r\n{body}'.encode()

def read_available(stdout, wait=0.1):
    buf = b''
    while True:
        r, _, _ = select.select([stdout], [], [], wait)
        if not r:
            break
        chunk = os.read(stdout.fileno(), 65536)
        if not chunk:
            break
        buf += chunk
    return buf

def parse_messages(raw):
    msgs, i = [], 0
    while i < len(raw):
        cl = raw.find(b'Content-Length:', i)
        if cl == -1:
            break
        cl_end = raw.find(b'\r\n', cl)
        length = int(raw[cl + 15:cl_end].strip())
        body_start = raw.find(b'\r\n\r\n', cl_end) + 4
        body_end   = body_start + length
        if body_end > len(raw):
            break
        msgs.append(json.loads(raw[body_start:body_end]))
        i = body_end
    return msgs

def drain(proc, wait=5.0):
    time.sleep(wait)
    return parse_messages(read_available(proc.stdout, wait=0.2))

_id = 0
def send(proc, method, params, notif=False):
    global _id
    msg = {'jsonrpc': '2.0', 'method': method, 'params': params}
    if not notif:
        _id += 1
        msg['id'] = _id
    proc.stdin.write(encode(msg))
    proc.stdin.flush()
    return None if notif else _id

# ── start server ──────────────────────────────────────────────────────────────

proc = subprocess.Popen(
    ['typescript-language-server', '--stdio'],
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    cwd=PROJECT_ROOT,
)

# initialize
init_id = send(proc, 'initialize', {
    'processId': None,
    'rootUri':   f'file://{PROJECT_ROOT}',
    'workspaceFolders': [{'uri': f'file://{PROJECT_ROOT}', 'name': 'goodskynet'}],
    'capabilities': {
        'textDocument': {'publishDiagnostics': {'relatedInformation': True}},
        'workspace':    {'workspaceFolders': True,
                         'executeCommand':   {'dynamicRegistration': True}},
    },
    'initializationOptions': {},
})

msgs = drain(proc, wait=3.0)
init_caps = {}
for m in msgs:
    if m.get('method') == 'window/logMessage':
        print(f'[log] {m["params"]["message"]}')
    if m.get('id') == init_id:
        init_caps = m.get('result', {}).get('capabilities', {})

print(f'[init] executeCommandProvider commands:')
for cmd in init_caps.get('executeCommandProvider', {}).get('commands', []):
    print(f'  {cmd}')

send(proc, 'initialized', {}, notif=True)

# open the file
with open(TARGET_FILE) as f:
    content = f.read()
send(proc, 'textDocument/didOpen', {'textDocument': {
    'uri': f'file://{TARGET_FILE}', 'languageId': 'typescript',
    'version': 1, 'text': content,
}}, notif=True)

# wait for diagnostics to settle
print('\n[waiting for diagnostics + project setup...]')
msgs = drain(proc, wait=10.0)
for m in msgs:
    if m.get('method') == 'window/logMessage':
        print(f'[log] {m["params"]["message"][:200]}')

# ── ask tsserver for project info via typescript.tsserverRequest ──────────────
# This sends a raw tsserver `projectInfo` command, which returns the tsconfig
# path that tsserver has associated with this file.

print(f'\n=== requesting projectInfo for file ===')
pi_id = send(proc, 'workspace/executeCommand', {
    'command': 'typescript.tsserverRequest',
    'arguments': ['projectInfo', {
        'file':              TARGET_FILE,
        'needFileNameList':  False,
    }],
})

msgs = drain(proc, wait=5.0)
for m in msgs:
    if m.get('id') == pi_id:
        result = m.get('result')
        body   = (result or {}).get('body', result)
        print(json.dumps(body, indent=2))
    elif m.get('method') == 'window/logMessage':
        print(f'[log] {m["params"]["message"][:200]}')
    elif m.get('method') == 'textDocument/publishDiagnostics':
        diags = m['params']['diagnostics']
        uri   = m['params']['uri'].replace(f'file://{PROJECT_ROOT}/', '')
        errs  = [d for d in diags if d['severity'] == 1]
        if errs:
            print(f'[diags] {uri}: {len(errs)} error(s), first: {errs[0]["message"][:80]}')

# ── also ask for compiler options diagnostics to see active settings ──────────

print(f'\n=== requesting compilerOptionsForFile ===')
co_id = send(proc, 'workspace/executeCommand', {
    'command': 'typescript.tsserverRequest',
    'arguments': ['compilerOptionsForInferredProjects', {}],
})

msgs = drain(proc, wait=5.0)
for m in msgs:
    if m.get('id') == co_id:
        print(json.dumps(m.get('result'), indent=2))

proc.terminate()
proc.wait()

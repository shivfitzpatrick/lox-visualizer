#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
# SPDX-License-Identifier: GPL-3.0-or-later
"""Python visualizer emitter.

Reads source from stdin, runs tokenize / ast / dis, and writes PyRawData JSON
to stdout. Requires Python 3.11+ for per-instruction position data (PEP 657).
"""

import ast as _ast
import dis
import inspect
import io
import json
import keyword
import sys
import token
import tokenize
import types

MAX_STEPS = 10_000


# ---------------------------------------------------------------------------
# Position helpers
# ---------------------------------------------------------------------------

def _line_start_offsets(src: str) -> list[int]:
    """Return the absolute character offset of the start of each line.
    Index is 1-based: offsets[1] = start of line 1 = 0.
    offsets[0] is unused (set to 0 for safety).
    """
    offsets = [0, 0]  # offsets[1] = 0 (line 1 starts at char 0)
    for i, ch in enumerate(src):
        if ch == '\n':
            offsets.append(i + 1)
    return offsets


def _to_offset(line_starts: list[int], line: int, col: int) -> int:
    """Convert 1-indexed (line, col) to an absolute UTF-16 code-unit offset.

    tokenize uses character (UTF-16) columns; ast/dis use UTF-8 byte columns.
    For ASCII source these are identical. Non-ASCII handling is deferred.
    """
    return line_starts[line] + col


# ---------------------------------------------------------------------------
# Lexer stage
# ---------------------------------------------------------------------------

_PAREN_CHARS = frozenset('()[]')
_BRACE_CHARS = frozenset('{}')


def _tok_name_override(t) -> str:
    """Map a tokenize Token to its PyRawLexeme tok_name.

    Three synthetic names supplement the stdlib tokenize.tok_name:
      'KEYWORD' — NAME tokens that are Python keywords
      'PAREN'   — OP tokens that are parentheses or brackets: ( ) [ ]
      'BRACE'   — OP tokens that are curly braces: { }
    These match the entries in PYTHON_TOKEN_CATEGORY_MAP in py-data.ts.

    Use t.type (the generic category) rather than t.exact_type (the specific
    sub-type) so that '(' maps to OP → PAREN, not LPAR → unknown, and '='
    falls back to 'OP' rather than 'EQUAL'.
    """
    if t.type == token.NAME and keyword.iskeyword(t.string):
        return 'KEYWORD'
    if t.type == token.OP:
        if t.string in _PAREN_CHARS:
            return 'PAREN'
        if t.string in _BRACE_CHARS:
            return 'BRACE'
    return tokenize.tok_name[t.type]


_SKIP_TYPES = frozenset({
    token.ENDMARKER,
    token.ENCODING,
    token.NEWLINE,
    token.NL,
    token.COMMENT,
    token.INDENT,
    token.DEDENT,
})


def _lex(src: str, line_starts: list[int]) -> list[dict]:
    lexemes = []
    try:
        for t in tokenize.generate_tokens(io.StringIO(src).readline):
            if t.type in _SKIP_TYPES:
                continue
            row, col = t.start
            end_row, end_col = t.end
            start = _to_offset(line_starts, row, col)
            length = _to_offset(line_starts, end_row, end_col) - start
            if length <= 0:
                continue
            lexemes.append({
                'tok_name': _tok_name_override(t),
                'text': t.string,
                'start': start,
                'length': length,
            })
    except tokenize.TokenError:
        pass  # incomplete source — return what we have
    return lexemes


# ---------------------------------------------------------------------------
# AST stage
# ---------------------------------------------------------------------------

# Maps (node_type, python_field) -> canonical attr key expected by the visualizer.
# The panel renders attrs['name'] (string) and attrs['params'] (string[]).
_ATTR_REMAP: dict[tuple[str, str], str] = {
    ('Name',     'id'):    'name',
    ('Constant', 'value'): 'name',
    ('arg',      'arg'):   'name',
}

# Node types whose 'name' attr's source position equals the node's own start.
_NAME_AT_NODE_START = frozenset({'Name', 'Constant', 'arg'})

# Node types with a declaration name whose position must be found via token search.
_DECL_NODE_TYPES = frozenset({'FunctionDef', 'AsyncFunctionDef', 'ClassDef'})


def _find_name_token_start(name_tokens: list[dict], after: int, text: str) -> int | None:
    """Return the start of the first NAME token with matching text at position >= after."""
    for tok in name_tokens:
        if tok['start'] >= after and tok['text'] == text:
            return tok['start']
    return None


def _ast_to_node(
    node: _ast.AST,
    line_starts: list[int],
    name_tokens: list[dict],
    child_type: str | None = None,
    _fn_qualname: str | None = None,
    _in_class: bool = False,
) -> dict:
    node_type = type(node).__name__
    start: int | None = None
    if hasattr(node, 'lineno') and node.lineno is not None:
        start = _to_offset(line_starts, node.lineno, node.col_offset)

    attrs: dict = {}
    attr_starts: dict = {}
    children: list = []

    # Compute the qualname context to pass into child nodes so that arg nodes
    # can record which compiled chunk they belong to.
    child_fn_qualname = _fn_qualname
    child_in_class = False
    if node_type in ('FunctionDef', 'AsyncFunctionDef'):
        fn_name = getattr(node, 'name', '') or ''
        if _fn_qualname is None:
            child_fn_qualname = fn_name
        elif _in_class:
            child_fn_qualname = f'{_fn_qualname}.{fn_name}'
        else:
            child_fn_qualname = f'{_fn_qualname}.<locals>.{fn_name}'
    elif node_type == 'ClassDef':
        cls_name = getattr(node, 'name', '') or ''
        child_fn_qualname = cls_name if _fn_qualname is None else f'{_fn_qualname}.<locals>.{cls_name}'
        child_in_class = True

    for field, value in _ast.iter_fields(node):
        if isinstance(value, list):
            for item in value:
                if isinstance(item, _ast.AST):
                    children.append(_ast_to_node(item, line_starts, name_tokens, field.title(), child_fn_qualname, child_in_class))
        elif isinstance(value, _ast.AST):
            children.append(_ast_to_node(value, line_starts, name_tokens, field.title(), child_fn_qualname, child_in_class))
        elif value is not None and isinstance(value, (int, float, bool, str, bytes)):
            key = _ATTR_REMAP.get((node_type, field), field)
            attrs[key] = str(value)

    # Annotate parameter declarations with their enclosing function's chunk name
    # so the bytecode panel can highlight all local-variable instructions for a
    # param when the user selects its arg node in the AST.
    if node_type == 'arg' and _fn_qualname is not None:
        attrs['chunk'] = _fn_qualname

    # attrStarts: source offset of the 'name' attr, enabling click-to-focus on identifiers.
    if 'name' in attrs and start is not None:
        if node_type in _NAME_AT_NODE_START:
            attr_starts['name'] = start
        elif node_type in _DECL_NODE_TYPES:
            pos = _find_name_token_start(name_tokens, start, attrs['name'])
            if pos is not None:
                attr_starts['name'] = pos

    # Collect positional parameter names and positions for function definitions.
    if node_type in ('FunctionDef', 'AsyncFunctionDef') and hasattr(node, 'args'):
        args_node = node.args  # type: ignore[attr-defined]
        all_args = list(getattr(args_node, 'posonlyargs', [])) + list(getattr(args_node, 'args', []))
        if all_args:
            param_names = [a.arg for a in all_args]
            attrs['params'] = param_names
            param_starts = [
                _to_offset(line_starts, a.lineno, a.col_offset)
                for a in all_args
                if getattr(a, 'lineno', None) is not None
            ]
            if len(param_starts) == len(param_names):
                attr_starts['params'] = param_starts

    result: dict = {
        'type': node_type,
        'childType': child_type,
        'start': start,
        'attrs': attrs,
        'children': children,
    }
    if attr_starts:
        result['attrStarts'] = attr_starts
    return result


# ---------------------------------------------------------------------------
# Bytecode stage
# ---------------------------------------------------------------------------

def _smallest_enclosing_start(abs_start: int, ast_root: dict) -> int:
    """Return the start offset of the deepest AST node whose start <= abs_start.

    This is used as the src_start for a bytecode instruction, linking it to
    the nearest enclosing AST node rather than an arbitrary span start.
    """
    best_start: int | None = None
    best_gap = float('inf')

    def walk(node: dict) -> None:
        nonlocal best_start, best_gap
        s = node.get('start')
        if s is not None and s <= abs_start:
            gap = abs_start - s
            if gap < best_gap:
                best_gap = gap
                best_start = s
        for child in node.get('children', []):
            walk(child)

    walk(ast_root)
    return best_start if best_start is not None else abs_start


def _collect_chunks(
    code_obj: types.CodeType,
    line_starts: list[int],
    ast_root: dict,
    chunks: dict | None = None,
) -> dict:
    if chunks is None:
        chunks = {}

    name = getattr(code_obj, 'co_qualname', code_obj.co_name)
    instrs = []

    for inst in dis.get_instructions(code_obj, adaptive=False):
        entry: dict = {'offset': inst.offset, 'op': inst.opname}
        if inst.arg is not None:
            entry['arg'] = inst.arg
        if inst.argrepr:
            entry['constant'] = inst.argrepr

        pos = getattr(inst, 'positions', None)
        if pos is not None and getattr(pos, 'lineno', None) is not None and getattr(pos, 'col_offset', None) is not None:
            abs_start = _to_offset(line_starts, pos.lineno, pos.col_offset)
            entry['src_start'] = _smallest_enclosing_start(abs_start, ast_root)

        instrs.append(entry)

    chunks[name] = instrs

    for const in code_obj.co_consts:
        if isinstance(const, types.CodeType):
            _collect_chunks(const, line_starts, ast_root, chunks)

    return chunks


# ---------------------------------------------------------------------------
# Execution trace (sys.monitoring or sys.settrace fallback)
# ---------------------------------------------------------------------------

def _value_to_stack(v) -> dict:
    if v is None:
        return {'t': 'nil'}
    if isinstance(v, bool):
        return {'t': 'bool', 'v': v}
    if isinstance(v, (int, float)):
        return {'t': 'num', 'v': v}
    if isinstance(v, str):
        return {'t': 'str', 'v': v}
    if isinstance(v, (types.FunctionType, types.BuiltinFunctionType)):
        name = getattr(v, '__name__', '<fn>')
        arity = getattr(getattr(v, '__code__', None), 'co_argcount', None)
        out: dict = {'t': 'native' if isinstance(v, types.BuiltinFunctionType) else 'fn', 'name': name}
        if arity is not None:
            out['arity'] = arity
        return out
    return {'t': 'str', 'v': repr(v)[:40]}


def _index_code_objects(code_obj: types.CodeType) -> dict[int, str]:
    names: dict[int, str] = {}

    def walk(co: types.CodeType) -> None:
        names[id(co)] = getattr(co, 'co_qualname', co.co_name)
        for const in co.co_consts:
            if isinstance(const, types.CodeType):
                walk(const)

    walk(code_obj)
    return names


def _instr_maps(code_obj: types.CodeType) -> dict[int, dict[int, dis.Instruction]]:
    maps: dict[int, dict[int, dis.Instruction]] = {}

    def walk(co: types.CodeType) -> None:
        maps[id(co)] = {
            inst.offset: inst for inst in dis.get_instructions(co, adaptive=False)
        }
        for const in co.co_consts:
            if isinstance(const, types.CodeType):
                walk(const)

    walk(code_obj)
    return maps


class _StackSimulator:
    def __init__(self) -> None:
        self.stack: list[dict] = []

    def apply(self, inst: dis.Instruction, frame) -> None:
        op = inst.opname
        arg = inst.arg

        if op in ('LOAD_CONST', 'LOAD_SMALL_INT'):
            val = inst.argval if op == 'LOAD_CONST' else arg
            self.stack.append(_value_to_stack(val))
        elif op in ('LOAD_NAME', 'LOAD_GLOBAL', 'LOAD_FAST', 'LOAD_DEREF'):
            name = inst.argval if isinstance(inst.argval, str) else str(inst.argval)
            val = frame.f_locals.get(name, frame.f_globals.get(name, name))
            self.stack.append(_value_to_stack(val))
        elif op.startswith('STORE_'):
            if self.stack:
                self.stack.pop()
        elif op in ('POP_TOP', 'POP_JUMP_IF_FALSE', 'POP_JUMP_IF_TRUE'):
            if self.stack:
                self.stack.pop()
        elif op == 'RETURN_VALUE':
            if self.stack:
                self.stack.pop()
        elif op == 'CALL':
            argc = inst.arg if inst.arg is not None else 0
            for _ in range(min(argc + 2, len(self.stack))):
                if self.stack:
                    self.stack.pop()
            self.stack.append(_value_to_stack(None))
        elif op == 'BINARY_OP':
            if len(self.stack) >= 2:
                b = self.stack.pop()
                a = self.stack.pop()
                av = a.get('v')
                bv = b.get('v')
                if isinstance(av, (int, float)) and isinstance(bv, (int, float)):
                    self.stack.append(_value_to_stack(av + bv))
                else:
                    self.stack.append(_value_to_stack(None))
        elif op == 'PUSH_NULL':
            self.stack.append(_value_to_stack(None))
        else:
            effect = dis.stack_effect(inst.opcode, inst.arg)
            if effect > 0:
                for _ in range(effect):
                    self.stack.append(_value_to_stack(None))
            elif effect < 0:
                for _ in range(-effect):
                    if self.stack:
                        self.stack.pop()


class _ExecutionTracer:
    def __init__(
        self,
        root_code: types.CodeType,
        instr_maps: dict[int, dict[int, dis.Instruction]],
        tracked: set[int],
    ) -> None:
        self.instr_maps = instr_maps
        self.tracked = tracked
        self.steps: list[dict] = []
        self.prints: list[dict] = []
        self.step_count = 0
        self.sim = _StackSimulator()
        self.frames: list[dict] = [{'fn': '<module>', 'base': 0}]
        self._root_code = root_code
        self._current_frame = None

    def record_print(self, text: str, src_offset: int | None = None) -> None:
        entry: dict = {'text': text, 'stepIndex': self.step_count}
        if src_offset is not None:
            entry['src_offset'] = src_offset
        code = self._current_frame.f_code if self._current_frame else self._root_code
        entry['chunk'] = self._chunk_name(code)
        entry['offset'] = self._current_frame.f_lasti if self._current_frame else 0
        self.prints.append(entry)

    def _chunk_name(self, code: types.CodeType) -> str:
        return getattr(code, 'co_qualname', code.co_name)

    def on_step(self, code: types.CodeType, offset: int, frame) -> None:
        if id(code) not in self.tracked:
            return
        if len(self.steps) >= MAX_STEPS:
            return

        self._current_frame = frame
        inst_map = self.instr_maps.get(id(code), {})
        inst = inst_map.get(offset)
        if inst is not None:
            self.sim.apply(inst, frame)

        self.steps.append({
            'msg_type': 'vm_step',
            'chunk': self._chunk_name(code),
            'offset': offset,
            'stack': list(self.sim.stack),
            'frames': list(self.frames),
        })
        self.step_count += 1

    def on_call(self, code: types.CodeType, offset: int, callable_obj) -> None:
        if id(code) not in self.tracked:
            return
        name = getattr(callable_obj, '__qualname__', repr(callable_obj))
        self.frames.append({'fn': name, 'base': len(self.sim.stack)})

    def on_return(self, code: types.CodeType, offset: int) -> None:
        if id(code) not in self.tracked:
            return
        if len(self.frames) > 1:
            base = self.frames[-1]['base']
            self.frames.pop()
            del self.sim.stack[base:]


def _frame_for_code(code: types.CodeType):
    frame = inspect.currentframe()
    if frame:
        frame = frame.f_back
    while frame is not None:
        if frame.f_code is code:
            return frame
        frame = frame.f_back
    return None


class _StdoutCapture(io.TextIOBase):
    def __init__(self, tracer: _ExecutionTracer, real_stdout) -> None:
        self.tracer = tracer
        self._real = real_stdout
        self._buf = ''

    def write(self, s: str) -> int:
        self._buf += s
        while '\n' in self._buf:
            line, self._buf = self._buf.split('\n', 1)
            if line:
                self.tracer.record_print(line)
        return len(s)

    def flush(self) -> None:
        if self._buf:
            self.tracer.record_print(self._buf)
            self._buf = ''
        if self._real:
            self._real.flush()


def _run_with_monitoring(code_obj: types.CodeType, tracer: _ExecutionTracer) -> None:
    m = sys.monitoring
    tid = m.DEBUGGER_ID
    m.use_tool_id(tid, 'viz')

    def on_instr(code, offset, /):
        frame = _frame_for_code(code)
        if frame is not None:
            tracer.on_step(code, offset, frame)

    def on_start(code, offset, /, *rest):
        callable_obj = rest[0] if rest else None
        if callable_obj is not None:
            tracer.on_call(code, offset, callable_obj)
        else:
            # Python 3.14+: PY_START is (code, offset) only — skip module frame.
            pass

    def on_return(code, offset, /, *rest):
        tracer.on_return(code, offset)

    m.register_callback(tid, m.events.INSTRUCTION, on_instr)
    m.register_callback(tid, m.events.PY_START, on_start)
    m.register_callback(tid, m.events.PY_RETURN, on_return)
    m.set_events(tid, m.events.INSTRUCTION | m.events.PY_START | m.events.PY_RETURN)
    try:
        exec(code_obj, {})
    finally:
        m.set_events(tid, 0)
        m.free_tool_id(tid)


def _run_with_settrace(code_obj: types.CodeType, tracer: _ExecutionTracer, tracked: set[int]) -> None:
    def trace(frame, event, arg):
        code = frame.f_code
        if id(code) not in tracked:
            return trace
        if event == 'opcode':
            tracer.on_step(code, frame.f_lasti, frame)
        elif event == 'call':
            tracer.on_call(code, frame.f_lasti, frame.f_locals.get('self', frame.f_code.co_name))
        elif event == 'return':
            tracer.on_return(code, frame.f_lasti)
        return trace

    sys.settrace(trace)
    try:
        exec(code_obj, {})
    finally:
        sys.settrace(None)


def _execute(code_obj: types.CodeType) -> tuple[list[dict], list[dict], str | None]:
    tracked = set(_index_code_objects(code_obj))
    instr_maps = _instr_maps(code_obj)
    tracer = _ExecutionTracer(code_obj, instr_maps, tracked)

    old_stdout = sys.stdout
    sys.stdout = _StdoutCapture(tracer, old_stdout)
    error: str | None = None
    try:
        if hasattr(sys, 'monitoring'):
            _run_with_monitoring(code_obj, tracer)
        else:
            _run_with_settrace(code_obj, tracer, tracked)
    except Exception as exc:
        error = str(exc)
    finally:
        sys.stdout.flush()
        sys.stdout = old_stdout

    return tracer.steps, tracer.prints, error


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run(src: str) -> dict:
    line_starts = _line_start_offsets(src)
    lexemes = _lex(src, line_starts)
    name_tokens = [tok for tok in lexemes if tok['tok_name'] == 'NAME']

    try:
        tree = _ast.parse(src)
        ast_root = _ast_to_node(tree, line_starts, name_tokens)
    except SyntaxError as e:
        return {'error': str(e), 'source': src}

    try:
        code_obj = compile(src, '<viz>', 'exec')
    except SyntaxError as e:
        return {'error': str(e), 'source': src, 'lexemes': lexemes, 'ast': ast_root, 'chunks': {}}

    chunks = _collect_chunks(code_obj, line_starts, ast_root)

    steps, prints, exec_error = _execute(code_obj)

    result: dict = {
        'source': src,
        'lexemes': lexemes,
        'ast': ast_root,
        'chunks': chunks,
        'steps': steps,
        'prints': prints,
    }
    if exec_error:
        result['exec_error'] = exec_error
    if len(steps) >= MAX_STEPS:
        result['steps_capped'] = True
    return result


if __name__ == '__main__':
    try:
        src = sys.stdin.read()
        print(json.dumps(run(src)))
    except OSError:
        pass  # stdin unavailable in Pyodide browser context

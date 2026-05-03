/**
 * Computed (formula) fields.
 *
 * A field of type 'formula' carries an expression in `fields.config.formula`.
 * The expression is evaluated per-row at display time using the row's data.
 * No DB persistence — purely a derived value.
 *
 * Supported syntax (Excel-ish):
 *   - References: [field_slug] resolves to record.data[field_slug]
 *   - Numbers: 42, 3.14, -5
 *   - Strings: "hello" or 'hello'
 *   - Booleans: TRUE / FALSE / true / false
 *   - Operators: + - * / ( ) , (string + string concatenates)
 *   - Comparison: > >= < <= = == != <>
 *   - Logical: AND, OR, NOT (functional form: AND(x,y), OR(x,y), NOT(x))
 *   - Functions:
 *       IF(cond, then, else)
 *       CONCAT(a, b, c, ...)
 *       DATEDIFF(date1, date2)            // days between
 *       ROUND(num, decimals?)
 *       SUM(a, b, ...)  AVG(a, b, ...)  MIN(a, b, ...)  MAX(a, b, ...)
 *       LEN(s)  UPPER(s)  LOWER(s)
 *       ABS(n)  FLOOR(n)  CEIL(n)
 *       NOW()  TODAY()
 *
 * Evaluator returns: { value: any; error?: string }
 * On any error returns { value: null, error: '#ERROR' } so the UI can render
 * a clean fallback. Errors never throw.
 */

export type Token =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'bool'; value: boolean }
  | { type: 'ref'; name: string }
  | { type: 'ident'; name: string } // function name or AND/OR/NOT keyword
  | { type: 'op'; value: string }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' };

// ---- Tokenizer ----------------------------------------------------------

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const c = input[i];

    // Whitespace
    if (/\s/.test(c)) { i++; continue; }

    // Field reference [slug]
    if (c === '[') {
      const end = input.indexOf(']', i + 1);
      if (end < 0) throw new Error('unclosed_ref');
      tokens.push({ type: 'ref', name: input.slice(i + 1, end).trim() });
      i = end + 1;
      continue;
    }

    // String literal
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let out = '';
      while (j < n && input[j] !== quote) {
        if (input[j] === '\\' && j + 1 < n) { out += input[j + 1]; j += 2; }
        else { out += input[j]; j++; }
      }
      if (j >= n) throw new Error('unclosed_string');
      tokens.push({ type: 'string', value: out });
      i = j + 1;
      continue;
    }

    // Number (no leading-minus handling — that's a unary op below)
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(input[i + 1] || ''))) {
      let j = i;
      while (j < n && /[0-9.]/.test(input[j])) j++;
      tokens.push({ type: 'number', value: Number(input.slice(i, j)) });
      i = j;
      continue;
    }

    // Identifier / keyword / function name
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < n && /[a-zA-Z0-9_]/.test(input[j])) j++;
      const word = input.slice(i, j);
      const upper = word.toUpperCase();
      if (upper === 'TRUE') tokens.push({ type: 'bool', value: true });
      else if (upper === 'FALSE') tokens.push({ type: 'bool', value: false });
      else tokens.push({ type: 'ident', name: upper });
      i = j;
      continue;
    }

    // Multi-char operators
    if (c === '>' && input[i + 1] === '=') { tokens.push({ type: 'op', value: '>=' }); i += 2; continue; }
    if (c === '<' && input[i + 1] === '=') { tokens.push({ type: 'op', value: '<=' }); i += 2; continue; }
    if (c === '!' && input[i + 1] === '=') { tokens.push({ type: 'op', value: '!=' }); i += 2; continue; }
    if (c === '<' && input[i + 1] === '>') { tokens.push({ type: 'op', value: '!=' }); i += 2; continue; }
    if (c === '=' && input[i + 1] === '=') { tokens.push({ type: 'op', value: '==' }); i += 2; continue; }

    // Single-char operators
    if ('+-*/'.includes(c)) { tokens.push({ type: 'op', value: c }); i++; continue; }
    if (c === '>' || c === '<') { tokens.push({ type: 'op', value: c }); i++; continue; }
    if (c === '=') { tokens.push({ type: 'op', value: '==' }); i++; continue; }

    if (c === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
    if (c === ')') { tokens.push({ type: 'rparen' }); i++; continue; }
    if (c === ',') { tokens.push({ type: 'comma' }); i++; continue; }

    throw new Error(`bad_char:${c}`);
  }

  return tokens;
}

// ---- Parser (recursive descent, Pratt-style for operators) -------------
//
// Grammar:
//   expr     := comparison
//   comparison := add (('>'|'<'|'>='|'<='|'=='|'!=') add)*
//   add      := mul (('+'|'-') mul)*
//   mul      := unary (('*'|'/') unary)*
//   unary    := ('-' | '+') unary | primary
//   primary  := number | string | bool | ref | call | '(' expr ')'
//   call     := IDENT '(' (expr (',' expr)*)? ')'

export type Ast =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'bool'; value: boolean }
  | { kind: 'ref'; name: string }
  | { kind: 'binop'; op: string; left: Ast; right: Ast }
  | { kind: 'unary'; op: string; arg: Ast }
  | { kind: 'call'; name: string; args: Ast[] };

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  peek(): Token | undefined { return this.tokens[this.pos]; }
  next(): Token | undefined { return this.tokens[this.pos++]; }

  expect(type: Token['type']): Token {
    const t = this.next();
    if (!t || t.type !== type) throw new Error(`expected_${type}`);
    return t;
  }

  parse(): Ast {
    const ast = this.expr();
    if (this.pos < this.tokens.length) throw new Error('trailing_tokens');
    return ast;
  }

  expr(): Ast { return this.comparison(); }

  comparison(): Ast {
    let left = this.add();
    while (true) {
      const t = this.peek();
      if (t?.type !== 'op' || !['>', '<', '>=', '<=', '==', '!='].includes(t.value)) break;
      this.next();
      const right = this.add();
      left = { kind: 'binop', op: t.value, left, right };
    }
    return left;
  }

  add(): Ast {
    let left = this.mul();
    while (true) {
      const t = this.peek();
      if (t?.type !== 'op' || !['+', '-'].includes(t.value)) break;
      this.next();
      const right = this.mul();
      left = { kind: 'binop', op: t.value, left, right };
    }
    return left;
  }

  mul(): Ast {
    let left = this.unary();
    while (true) {
      const t = this.peek();
      if (t?.type !== 'op' || !['*', '/'].includes(t.value)) break;
      this.next();
      const right = this.unary();
      left = { kind: 'binop', op: t.value, left, right };
    }
    return left;
  }

  unary(): Ast {
    const t = this.peek();
    if (t?.type === 'op' && (t.value === '-' || t.value === '+')) {
      this.next();
      return { kind: 'unary', op: t.value, arg: this.unary() };
    }
    return this.primary();
  }

  primary(): Ast {
    const t = this.next();
    if (!t) throw new Error('unexpected_end');
    if (t.type === 'number') return { kind: 'num', value: t.value };
    if (t.type === 'string') return { kind: 'str', value: t.value };
    if (t.type === 'bool')   return { kind: 'bool', value: t.value };
    if (t.type === 'ref')    return { kind: 'ref', name: t.name };
    if (t.type === 'lparen') {
      const e = this.expr();
      this.expect('rparen');
      return e;
    }
    if (t.type === 'ident') {
      // function call
      this.expect('lparen');
      const args: Ast[] = [];
      if (this.peek()?.type !== 'rparen') {
        args.push(this.expr());
        while (this.peek()?.type === 'comma') {
          this.next();
          args.push(this.expr());
        }
      }
      this.expect('rparen');
      return { kind: 'call', name: t.name, args };
    }
    throw new Error('unexpected_token');
  }
}

export function parse(formula: string): Ast {
  const tokens = tokenize(formula);
  return new Parser(tokens).parse();
}

// ---- Evaluator ----------------------------------------------------------

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return NaN;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.getTime();
  const n = Number(String(v).replace(/,/g, ''));
  return n;
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (v === null || v === undefined || v === '' || v === 0) return false;
  return true;
}

function toDate(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string' && v) {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function evalAst(node: Ast, row: Record<string, unknown>): unknown {
  switch (node.kind) {
    case 'num':  return node.value;
    case 'str':  return node.value;
    case 'bool': return node.value;
    case 'ref':  return row[node.name] ?? null;

    case 'unary': {
      const v = toNum(evalAst(node.arg, row));
      if (node.op === '-') return -v;
      return v;
    }

    case 'binop': {
      const a = evalAst(node.left, row);
      const b = evalAst(node.right, row);
      switch (node.op) {
        case '+': {
          // null/undefined → treat as 0 in arithmetic context so a missing
          // optional field doesn't kill the whole formula. But if either side
          // is a non-empty string that doesn't look like a number, concatenate.
          if (a === null || a === undefined) {
            if (typeof b === 'string') return b;
            return toNum(b);
          }
          if (b === null || b === undefined) {
            if (typeof a === 'string') return a;
            return toNum(a);
          }
          if (typeof a === 'string' || typeof b === 'string') {
            const an = toNum(a), bn = toNum(b);
            if (!isNaN(an) && !isNaN(bn) && a !== '' && b !== '') return an + bn;
            return toStr(a) + toStr(b);
          }
          return toNum(a) + toNum(b);
        }
        case '-': return toNum(a) - toNum(b);
        case '*': return toNum(a) * toNum(b);
        case '/': {
          const bn = toNum(b);
          if (bn === 0) throw new Error('division_by_zero');
          return toNum(a) / bn;
        }
        case '>':  return toNum(a) >  toNum(b);
        case '<':  return toNum(a) <  toNum(b);
        case '>=': return toNum(a) >= toNum(b);
        case '<=': return toNum(a) <= toNum(b);
        case '==': return toStr(a) === toStr(b) || toNum(a) === toNum(b);
        case '!=': return !(toStr(a) === toStr(b) || toNum(a) === toNum(b));
      }
      throw new Error('unknown_op');
    }

    case 'call': {
      const name = node.name;
      const args = node.args.map((a) => evalAst(a, row));
      switch (name) {
        case 'IF': {
          if (args.length < 2) throw new Error('if_needs_2_args');
          return toBool(args[0]) ? args[1] : (args[2] ?? null);
        }
        case 'CONCAT':
          return args.map(toStr).join('');
        case 'DATEDIFF': {
          // Days between args[0] and args[1] (args[1] - args[0], can be negative)
          const d1 = toDate(args[0]);
          const d2 = toDate(args[1]);
          if (!d1 || !d2) return null;
          return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
        }
        case 'ROUND': {
          const n = toNum(args[0]);
          const d = args.length > 1 ? toNum(args[1]) : 0;
          if (isNaN(n)) return null;
          const factor = Math.pow(10, d);
          return Math.round(n * factor) / factor;
        }
        case 'SUM': return args.reduce<number>((acc, v) => acc + toNum(v), 0);
        case 'AVG': {
          const nums = args.map(toNum).filter((n) => !isNaN(n));
          return nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length;
        }
        case 'MIN': {
          const nums = args.map(toNum).filter((n) => !isNaN(n));
          return nums.length === 0 ? null : Math.min(...nums);
        }
        case 'MAX': {
          const nums = args.map(toNum).filter((n) => !isNaN(n));
          return nums.length === 0 ? null : Math.max(...nums);
        }
        case 'LEN':   return toStr(args[0]).length;
        case 'UPPER': return toStr(args[0]).toUpperCase();
        case 'LOWER': return toStr(args[0]).toLowerCase();
        case 'ABS':   return Math.abs(toNum(args[0]));
        case 'FLOOR': return Math.floor(toNum(args[0]));
        case 'CEIL':  return Math.ceil(toNum(args[0]));
        case 'NOW':   return new Date().toISOString();
        case 'TODAY': return new Date().toISOString().slice(0, 10);
        case 'AND':   return args.every(toBool);
        case 'OR':    return args.some(toBool);
        case 'NOT':   return !toBool(args[0]);
      }
      throw new Error(`unknown_fn:${name}`);
    }
  }
}

/**
 * Top-level safe wrapper. Caller passes the formula string and the record
 * data object. Returns { value, error? } — never throws.
 */
export function evalFormula(
  formula: string,
  row: Record<string, unknown>,
): { value: unknown; error?: string } {
  if (!formula || !formula.trim()) return { value: null };
  try {
    const ast = parse(formula);
    const value = evalAst(ast, row);
    return { value };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { value: null, error: msg };
  }
}

// ---- Helpers for the field-edit UI --------------------------------------

/**
 * Static analysis: list every [field_slug] referenced in the formula.
 * The fields-manager UI shows these as chips so the user knows what they
 * are depending on. Used to detect simple cycles (formula referring to itself).
 */
export function extractReferences(formula: string): string[] {
  if (!formula) return [];
  const refs = new Set<string>();
  const re = /\[([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(formula)) !== null) refs.add(m[1].trim());
  return Array.from(refs);
}

/**
 * Quick-pick palette of formula templates the user can drop in.
 * Each item: label (Hebrew), formula template, brief description.
 */
export const FORMULA_TEMPLATES: { label: string; formula: string; description: string }[] = [
  { label: 'סכום',     formula: '[field_a] + [field_b]',                           description: 'חיבור שני שדות מספריים' },
  { label: 'מכפלה',    formula: '[quantity] * [unit_price]',                        description: 'כמות × מחיר ליחידה' },
  { label: 'אחוז',     formula: 'ROUND([part] / [total] * 100, 1)',                 description: 'חלק מתוך סך כולל באחוזים' },
  { label: 'מע"מ',     formula: 'ROUND([amount] * 0.18, 2)',                        description: 'חישוב מע״מ 18%' },
  { label: 'סך עם מע"מ', formula: 'ROUND([amount] * 1.18, 2)',                      description: 'סכום כולל מע״מ' },
  { label: 'IF',       formula: 'IF([area_sqm] > 30, "גדול", "קטן")',                description: 'תנאי פשוט' },
  { label: 'גיל בימים', formula: 'DATEDIFF([created_at], TODAY())',                  description: 'מספר ימים מתאריך עד היום' },
  { label: 'שילוב טקסט', formula: 'CONCAT([first_name], " ", [last_name])',          description: 'איחוד מחרוזות' },
];

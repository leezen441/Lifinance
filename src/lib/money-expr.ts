/**
 * Tiny money calculator — safe expression eval for amount fields.
 *
 * Supports + − × ÷ and parentheses. No `eval()`: only digits and those
 * operators are accepted, so pasted scripts cannot run.
 */

const OPS = new Set(["+", "-", "*", "/"]);

/** True when the string still needs another number (e.g. `120+`). */
export function isIncompleteMoneyExpression(raw: string): boolean {
  const s = normalizeMoneyExpression(raw);
  if (!s) return false;
  const last = s[s.length - 1];
  return OPS.has(last) || last === "(";
}

/**
 * Evaluate a money expression.
 * Returns `null` when empty, incomplete, or invalid.
 */
export function evalMoneyExpression(raw: string | number): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = normalizeMoneyExpression(raw);
  if (!s || isIncompleteMoneyExpression(s)) return null;

  try {
    const tokens = tokenize(s);
    if (tokens.length === 0) return null;
    const rpn = toRpn(tokens);
    const value = evalRpn(rpn);
    if (!Number.isFinite(value)) return null;
    // Money: keep cents, drop float dust.
    return Math.round(value * 100) / 100;
  } catch {
    return null;
  }
}

/** Strip currency junk; map ×÷x to * /. Keep digits and operators. */
export function normalizeMoneyExpression(raw: string): string {
  return String(raw)
    .trim()
    .replace(/,/g, "")
    .replace(/[×xX]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/−/g, "-")
    .replace(/\s+/g, "")
    .replace(/[^0-9+\-*/().]/g, "");
}

type Token = { type: "num"; value: number } | { type: "op"; value: string };

function tokenize(s: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch >= "0" && ch <= "9") {
      let j = i + 1;
      while (j < s.length && ((s[j] >= "0" && s[j] <= "9") || s[j] === ".")) j++;
      const n = Number(s.slice(i, j));
      if (!Number.isFinite(n)) throw new Error("bad number");
      tokens.push({ type: "num", value: n });
      i = j;
      continue;
    }
    // Unary minus / plus: start, or after operator / '('.
    if (
      (ch === "-" || ch === "+") &&
      (tokens.length === 0 ||
        (tokens[tokens.length - 1].type === "op" &&
          (tokens[tokens.length - 1] as { value: string }).value !== ")"))
    ) {
      let j = i + 1;
      if (j < s.length && ((s[j] >= "0" && s[j] <= "9") || s[j] === ".")) {
        while (j < s.length && ((s[j] >= "0" && s[j] <= "9") || s[j] === ".")) j++;
        const n = Number(s.slice(i, j));
        if (!Number.isFinite(n)) throw new Error("bad number");
        tokens.push({ type: "num", value: n });
        i = j;
        continue;
      }
    }
    if (OPS.has(ch) || ch === "(" || ch === ")") {
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }
    throw new Error("bad char");
  }
  return tokens;
}

function precedence(op: string): number {
  if (op === "+" || op === "-") return 1;
  if (op === "*" || op === "/") return 2;
  return 0;
}

function toRpn(tokens: Token[]): Token[] {
  const out: Token[] = [];
  const stack: string[] = [];
  for (const t of tokens) {
    if (t.type === "num") {
      out.push(t);
      continue;
    }
    const op = t.value;
    if (op === "(") {
      stack.push(op);
      continue;
    }
    if (op === ")") {
      while (stack.length && stack[stack.length - 1] !== "(") {
        out.push({ type: "op", value: stack.pop()! });
      }
      if (stack.pop() !== "(") throw new Error("paren");
      continue;
    }
    while (
      stack.length &&
      stack[stack.length - 1] !== "(" &&
      precedence(stack[stack.length - 1]) >= precedence(op)
    ) {
      out.push({ type: "op", value: stack.pop()! });
    }
    stack.push(op);
  }
  while (stack.length) {
    const op = stack.pop()!;
    if (op === "(" || op === ")") throw new Error("paren");
    out.push({ type: "op", value: op });
  }
  return out;
}

function evalRpn(rpn: Token[]): number {
  const stack: number[] = [];
  for (const t of rpn) {
    if (t.type === "num") {
      stack.push(t.value);
      continue;
    }
    if (stack.length < 2) throw new Error("arity");
    const b = stack.pop()!;
    const a = stack.pop()!;
    switch (t.value) {
      case "+":
        stack.push(a + b);
        break;
      case "-":
        stack.push(a - b);
        break;
      case "*":
        stack.push(a * b);
        break;
      case "/":
        if (b === 0) throw new Error("div0");
        stack.push(a / b);
        break;
      default:
        throw new Error("op");
    }
  }
  if (stack.length !== 1) throw new Error("stack");
  return stack[0];
}

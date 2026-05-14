import { AppError } from "../utils/AppError.js";

function tokenize(input) {
  return String(input).match(/\d+(?:\.\d+)?|[()+\-*/%]/g) || [];
}

function parseExpression(tokens) {
  let position = 0;
  const peek = () => tokens[position];
  const consume = () => tokens[position++];
  const parseNumber = () => {
    const token = consume();
    if (token === "(") {
      const value = parseAddSub();
      if (consume() !== ")") throw new Error("Missing closing parenthesis.");
      return value;
    }
    const value = Number(token);
    if (!Number.isFinite(value)) throw new Error("Invalid number.");
    return value;
  };
  const parseMulDiv = () => {
    let value = parseNumber();
    while (["*", "/", "%"].includes(peek())) {
      const op = consume();
      const right = parseNumber();
      if (op === "*") value *= right;
      if (op === "/") value /= right;
      if (op === "%") value %= right;
    }
    return value;
  };
  const parseAddSub = () => {
    let value = parseMulDiv();
    while (["+", "-"].includes(peek())) {
      const op = consume();
      const right = parseMulDiv();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  };
  const value = parseAddSub();
  if (position !== tokens.length) throw new Error("Unexpected token.");
  return value;
}

export const calculatorTool = {
  id: "calculator",
  name: "Calculator",
  description: "Safely evaluate arithmetic expressions.",
  creditCost: 0,
  async execute({ expression }) {
    const cleanExpression = String(expression || "").trim();
    if (!/^[\d+\-*/().%\s]+$/.test(cleanExpression)) {
      throw new AppError("Calculator only accepts arithmetic input.", 400, "CALCULATOR_INPUT_REJECTED");
    }
    const value = parseExpression(tokenize(cleanExpression));
    if (!Number.isFinite(value)) throw new AppError("Calculator result is not finite.", 400, "CALCULATOR_INVALID_RESULT");
    return { expression: cleanExpression, value };
  }
};

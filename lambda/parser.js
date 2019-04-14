import {App, Lam, Val, Var} from './core';

export const fromString = string => parse(string.split(''), [], false);

const parse = (tokens, vars, isBound) => {
  if (tokens[0] === '(')
    return parsePar(tokens, vars, isBound);
  if (tokens[0] === 'λ')
    return parseLam(tokens, vars);
  return parseApp(tokens, vars, parseVar(tokens, vars));
};

const parseApp = (tokens, vars, app) => {
  if (tokens[0] === '(')
    return parseApp(tokens, vars, App(app, parsePar(tokens, vars, true)));
  if (parseVarRegex.test(tokens[0]))
    return parseApp(tokens, vars, App(app, parseVar(tokens, vars)));
  return app;
};

const parseEnd = (tokens, vars, app) => {
  if (tokens[0] !== ')')
    return parseEnd(tokens, vars, App(app, parse(tokens, vars, false)));
  return app;
};

const parseLam = (tokens, vars) => {
  if (tokens.shift() !== 'λ')
    throw new Error('ParsingError');
  const name = tokens.shift();
  if (tokens.shift() !== '.')
    throw new Error('ParsingError');
  return Lam(vars.length, parse(tokens, vars.concat(name), false));
};

const parsePar = (tokens, vars, isBound) => {
  if (tokens.shift() !== '(')
    throw new Error('ParsingError');
  const app = parseEnd(tokens, vars, parse(tokens, vars, false));
  if (tokens.shift() !== ')')
    throw new Error('ParsingError');
  return isBound ? app : parseApp(tokens, vars, app);
};

const parseVarRegex = /^[a-z]$/;
const parseVar = (tokens, vars) => {
  if (!parseVarRegex.test(tokens[0]))
    throw new Error('ParsingError');
  const name = tokens.shift();
  const bind = vars.lastIndexOf(name);
  return bind === -1 ? Val(name) : Var(bind);
};

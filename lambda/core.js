const $App = 0;
const $Lam = 1;
const $Val = 2;
const $Var = 3;

export const App = (m, n) => [$App, m, n];
export const Lam = (x, n) => [$Lam, x, n];
export const Val = x => [$Val, x];
export const Var = x => [$Var, x];

export const isApp = term => term[0] === $App;
export const isLam = term => term[0] === $Lam;
export const isVal = term => term[0] === $Val;
export const isVar = term => term[0] === $Var;

export const fold = (Var, Val, Lam, App) => (term, ...args) => {
  if (isApp(term)) return App(term, ...args);
  if (isLam(term)) return Lam(term, ...args);
  if (isVal(term)) return Val(term, ...args);
  if (isVar(term)) return Var(term, ...args);
};

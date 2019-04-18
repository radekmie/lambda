const $App = 0;
const $Lam = 1;
const $Val = 2;
const $Var = 3;

export const App = (M, N) => [$App, M, N];
export const Lam = (x, N) => [$Lam, x, N];
export const Val = x => [$Val, x];
export const Var = x => [$Var, x];

export const isApp = M => M[0] === $App;
export const isLam = M => M[0] === $Lam;
export const isVal = M => M[0] === $Val;
export const isVar = M => M[0] === $Var;

export const match = (Var, Val, Lam, App) => (M, ...args) => {
  if (isApp(M)) return App(M, ...args);
  if (isLam(M)) return Lam(M, ...args);
  if (isVal(M)) return Val(M, ...args);
  if (isVar(M)) return Var(M, ...args);
};

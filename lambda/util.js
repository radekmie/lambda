import {App, Lam, Val, Var, fold, isApp, isLam, isVal, isVar} from './core';

export const alpha = (M, N) => {
  const diff = compare(M, N);
  return diff === 0 ? true : equal(M, lift(N, 0, diff));
};

export const beta = (M, N) => betaAt(M, N, 0);

export const betaAt = fold(
  (M, N, d) => M,
  (M, N, d) => M,
  (M, N, d) => Lam(M[1], betaAt(M[2], N, d + 1)),
  (M, N, d) => M === N ? replaceAt(M[1][2], M[1][1], M[2], d-M[1][1]) : App(betaAt(M[1], N, d), betaAt(M[2], N, d))
);

export const betaGraph = term => {
  const nodes = [term];
  const found = new Set([toAST(term)]);
  const graph = new Map();

  while (nodes.length && found.size < 100) {
    const term = nodes.shift();

    graph.set(term, redexes(term).map(redex => [beta(term, redex), redex]));
    graph.get(term).forEach(pair => {
      const tag = toAST(pair[0]);
      if (!found.has(tag)) {
        found.add(tag);
        nodes.push(pair[0]);
      }
    });
  }

  return graph;
};

export const compare = fold(
  (M, N) => !isVar(N) ? (N[0] - M[0]) * Infinity : M[1] - N[1],
  (M, N) => !isVal(N) ? (N[0] - M[0]) * Infinity : M[1].localeCompare(N[1]),
  (M, N) => !isLam(N) ? (N[0] - M[0]) * Infinity : M[1] - N[1] || compare(M[2], N[2]),
  (M, N) => !isApp(N) ? (N[0] - M[0]) * Infinity : compare(M[1], N[1]) || compare(M[2], N[2])
);

export const copy = M => lift(M, 0, 0);

export const equal = (M, N) => compare(M, N) === 0;

export const lift = fold(
  (M, d, n) => Var(M[1] < d ? M[1] : M[1] + n),
  (M, d, n) => Val(M[1]),
  (M, d, n) => Lam(M[1] + n, lift(M[2], d, n)),
  (M, d, n) => App(lift(M[1], d, n), lift(M[2], d, n))
);

export const phi = fold(
  M => M,
  M => M,
  M => Lam(M[1], phi(M[2])),
  M => isLam(M[1]) ? replace(phi(M[1][2]), M[1][1], phi(M[2])) : App(phi(M[1]), phi(M[2]))
);

export const redexes = fold(
  M => [],
  M => [],
  M => redexes(M[2]),
  M => redexes(M[2]).concat(redexes(M[1]), isLam(M[1]) ? [M] : [])
);

export const replace = M => replaceAt(M, 0);

export const replaceAt = fold(
  (M, x, N, d) => x === M[1] ? lift(N, x, d) : x < M[1] ? Var(M[1] - 1) : M,
  (M, x, N, d) => M,
  (M, x, N, d) => x === M[1] ? M : Lam(x < M[1] ? M[1] - 1 : M[1], replaceAt(M[2], x, N, d + 1)),
  (M, x, N, d) => App(replaceAt(M[1], x, N, d), replaceAt(M[2], x, N, d))
);

export const toAST = fold(
  M => `Var(${M[1]})`,
  M => `Val(${M[1]})`,
  M => `Lam(${M[1]}, ${toAST(M[2])})`,
  M => `App(${toAST(M[1])}, ${toAST(M[2])})`
);

export const toChurch = n => {
  let app = Var(1);
  while (n-- > 0)
    app = App(Var(0), app);
  return Lam(0, Lam(1, app));
};

export const toName = x => (x + 10).toString(36);

export const toString = fold(
  M => toName(M[1]),
  M => M[1],
  M => `λ${toName(M[1])}.${toString(M[2])}`,
  M => {
    const m = toString(M[1]);
    const n = toString(M[2]);
    return `${isLam(M[1]) ? `(${m})` : m}${isVal(M[2]) || isVar(M[2]) ? n : `(${n})`}`;
  }
);

import {Graph} from 'graphlib';

import {
  alpha,
  betaGraph,
  fold,
  fromChurch,
  fromString,
  isLam,
  isVal,
  isVar,
  size,
  toAST,
  toChurch,
  toName,
  toString
} from '../lambda';

const knownTermsMatch = {regex: /$^/};
const knownTermsNames = [];
const knownTermsTerms = [];
const knownTermsName2text = new Map();
const knownTermsTerm2Name = new Map();
const knownTermsGet = name => knownTermsName2text.get(name);
const knownTermsAdd = (names, text) => {
  const term = fromString(text);
  names.forEach(name => {
    knownTermsNames.push(name);
    knownTermsName2text.set(name, text);
    knownTermsTerm2Name.set(term, name);
  });

  knownTermsTerms.push(term);
  knownTermsMatch.regex = new RegExp(knownTermsNames.join('|'), 'g');
};

knownTermsAdd(['I'], '(λx.x)');
knownTermsAdd(['K'], '(λxy.x)');
knownTermsAdd(['S'], '(λxyz.xz(yz))');
knownTermsAdd(['Y'], '(λf.(λx.f(xx))(λx.f(xx)))');
for (let n = 0; n < 10; ++n)
  knownTermsAdd([`${n}`, `C<sub>${n}</sub>`], `(${toString(toChurch(n))})`);

export const fromInput = ({string, useNames}) => {
  const graph = new Graph({multigraph: true}).setGraph({});
  const input = string.replace(/\\/g, 'λ').replace(knownTermsMatch.regex, knownTermsGet);
  const M = fromString(input);

  for (const [termA, pairs] of betaGraph(M, Math.min(size(M) ** 2, 50))) {
    const textA = toAST(termA);
    graph.setNode(textA, {
      label: toLabel(termA, pairs.map(pair => pair[1]), useNames)[0],
      labelType: 'html'
    });

    for (const pair of pairs) {
      const textB = toAST(pair[0]);
      const textC = toAST(pair[1]);

      if (!graph.node(textB)) {
        graph.setNode(textB, {
          label: toLabel(pair[0], [], useNames)[0],
          labelType: 'html'
        });
      }

      graph.setEdge(
        textA,
        textB,
        {class: `redex redex-${pairs.indexOf(pair)}`, label: ''},
        [textA, textB, textC]
      );
    }
  }

  return graph;
};

const toKnown = fold(
  M => null,
  M => null,
  M => {
    const n = fromChurch(M);
    if (isFinite(n) && !knownTermsNames.includes(`${n}`))
      knownTermsAdd([`C<sub>${n}</sub>`], `(${toString(toChurch(n))})`);

    const knownTerm = knownTermsTerms.find(term => alpha(M, term));
    if (knownTerm)
      return knownTermsTerm2Name.get(knownTerm);

    return null;
  },
  M => null
);

const toLabel = fold(
  (M, Ns, useNames) => [toName(M[1]), false, false],
  (M, Ns, useNames) => [`<b>${M[1]}</b>`, false, false],
  (M, Ns, useNames) => {
    const [m, hasRedexM] = toLabel(M[2], Ns, useNames);
    if (!hasRedexM && useNames) {
      const knownTerm = toKnown(M);
      if (knownTerm)
        return [knownTerm, false, true];
    }

    let tail = M;
    let vars = '';
    while (isLam(tail) && (!useNames || !toKnown(tail))) {
      vars += toName(tail[1]);
      tail = tail[2];
    }

    return [`λ${vars}.${toLabel(tail, Ns, useNames)[0]}`, hasRedexM, false];
  },
  (M, Ns, useNames) => {
    const [m, hasRedexM, isKnownM] = toLabel(M[1], Ns, useNames);
    const [n, hasRedexN, isKnownN] = toLabel(M[2], Ns, useNames);

    const index = Ns.indexOf(M);
    const label = `${isKnownM || !isLam(M[1]) ? m : `(${m})`}${isKnownN || isVal(M[2]) || isVar(M[2]) ? n : `(${n})`}`;
    return [index === -1 ? label : `<span class="redex redex-${index}">${label}</span>`, hasRedexM || hasRedexN, false];
  }
);

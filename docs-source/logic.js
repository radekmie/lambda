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
knownTermsAdd(['K'], '(λx.λy.x)');
knownTermsAdd(['S'], '(λx.λy.λz.xz(yz))');
knownTermsAdd(['Y'], '(λf.(λx.f(xx))(λx.f(xx)))');
for (let n = 0; n < 10; ++n)
  knownTermsAdd([`${n}`, `C<sub>${n}</sub>`], `(${toString(toChurch(n))})`);

export const fromInput = ({string, useNames}) => {
  const graph = new Graph({multigraph: true}).setGraph({});
  const input = string.replace(/\\/g, 'λ').replace(knownTermsMatch.regex, knownTermsGet);
  const M = fromString(input);

  for (const [termA, pairs] of betaGraph(M, Math.min(size(M) ** 2, 50))) {
    const textA = toString(termA);
    graph.setNode(textA, {
      label: toLabel(termA, pairs.map(pair => pair[1]), useNames)[0],
      labelType: 'html'
    });

    for (const pair of pairs) {
      const textB = toString(pair[0]);
      const textC = toString(pair[1]);

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

const toLabel = fold(
  (M, Ns, useNames) => [toName(M[1]), false, false],
  (M, Ns, useNames) => [`<b>${M[1]}</b>`, false, false],
  (M, Ns, useNames) => {
    const [m, hasRedexM] = toLabel(M[2], Ns, useNames);
    if (!hasRedexM && useNames) {
      const n = fromChurch(M);
      if (!knownTermsNames.includes(`${n}`))
        knownTermsAdd([`${n}`, `C<sub>${n}</sub>`], `(${toString(toChurch(n))})`);

      const knownTerm = knownTermsTerms.find(term => alpha(M, term));
      if (knownTerm)
        return [knownTermsTerm2Name.get(knownTerm), false, true];
    }

    return [`λ${toName(M[1])}.${m}`, hasRedexM, false];
  },
  (M, Ns, useNames) => {
    const [m, hasRedexM, isKnownM] = toLabel(M[1], Ns, useNames);
    const [n, hasRedexN, isKnownN] = toLabel(M[2], Ns, useNames);

    const index = Ns.indexOf(M);
    const label = `${isKnownM || !isLam(M[1]) ? m : `(${m})`}${isKnownN || isVal(M[2]) || isVar(M[2]) ? n : `(${n})`}`;
    return [index === -1 ? label : `<span class="redex redex-${index}">${label}</span>`, hasRedexM || hasRedexN, false];
  }
);

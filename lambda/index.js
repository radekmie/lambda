const parser = {
  parse(tokens, vars, isBound) {
    if (tokens[0] === '(')
      return this.parsePar(tokens, vars, isBound);
    if (tokens[0] === 'λ')
      return this.parseLam(tokens, vars);
    return this.parseApp(tokens, vars, this.parseVar(tokens, vars));
  },

  parseApp(tokens, vars, app) {
    if (tokens[0] === '(')
      return this.parseApp(tokens, vars, App(app, this.parsePar(tokens, vars, true)));
    if (this.parseVarRegex.test(tokens[0]))
      return this.parseApp(tokens, vars, App(app, this.parseVar(tokens, vars)));
    return app;
  },

  parseEnd(tokens, vars, app) {
    if (tokens[0] !== ')')
      return this.parseEnd(tokens, vars, App(app, this.parse(tokens, vars, false)));
    return app;
  },

  parseLam(tokens, vars) {
    if (tokens.shift() !== 'λ')
      throw new Error('ParsingError');
    const name = tokens.shift();
    if (tokens.shift() !== '.')
      throw new Error('ParsingError');
    return Lam(vars.length, this.parse(tokens, vars.concat(name), false));
  },

  parsePar(tokens, vars, isBound) {
    if (tokens.shift() !== '(')
      throw new Error('ParsingError');
    const app = this.parseEnd(tokens, vars, this.parse(tokens, vars, false));
    if (tokens.shift() !== ')')
      throw new Error('ParsingError');
    return isBound ? app : this.parseApp(tokens, vars, app);
  },

  parseVarRegex: /^[a-z]$/,
  parseVar(tokens, vars) {
    if (!this.parseVarRegex.test(tokens[0]))
      throw new Error('ParsingError');
    const name = tokens.shift();
    const bind = vars.lastIndexOf(name);
    return bind === -1 ? Val(name) : Var(bind);
  }
};

const _wrapIf = (condition, string, a = '(', b = ')') => condition ? `${a}${string}${b}` : string;

const $App = 0;
const $Lam = 1;
const $Val = 2;
const $Var = 3;

const App = (m, n) => [$App, m, n];
const Lam = (x, n) => [$Lam, x, n];
const Val = x => [$Val, x];
const Var = x => [$Var, x];

const isApp = term => term[0] === $App;
const isLam = term => term[0] === $Lam;
const isVal = term => term[0] === $Val;
const isVar = term => term[0] === $Var;

const fold = (Var, Val, Lam, App) => {
  return (term, ...args) => {
    switch (term[0]) {
      case $App: return App(term, ...args);
      case $Lam: return Lam(term, ...args);
      case $Val: return Val(term, ...args);
      case $Var: return Var(term, ...args);
    }
  };
};

const alpha = (M, N) => equal(M, lift(N, 0, compare(M, N)));
const equal = (M, N) => compare(M, N) === 0;
const compare = fold(
  (M, N) => !isVar(N) ? (N[0] - M[0]) * Infinity : M[1] - N[1],
  (M, N) => !isVal(N) ? (N[0] - M[0]) * Infinity : M[1].localeCompare(N[1]),
  (M, N) => !isLam(N) ? (N[0] - M[0]) * Infinity : M[1] - N[1] || compare(M[2], N[2]),
  (M, N) => !isApp(N) ? (N[0] - M[0]) * Infinity : compare(M[1], N[1]) || compare(M[2], N[2])
);

const copy = M => lift(M, 0, 0);
const lift = fold(
  (M, d, n) => Var(M[1] < d ? M[1] : M[1] + n),
  (M, d, n) => Val(M[1]),
  (M, d, n) => Lam(M[1] + n, lift(M[2], d, n)),
  (M, d, n) => App(lift(M[1], d, n), lift(M[2], d, n))
);

const toName = x => (x + 10).toString(36);
const toAST = fold(
  M => `Var(${M[1]})`,
  M => `Val(${M[1]})`,
  M => `Lam(${M[1]}, ${toAST(M[2])})`,
  M => `App(${toAST(M[1])}, ${toAST(M[2])})`
);

const knownTerms = {
  add: (name, text) => {
    const term = fromString(text);
    console.assert(isLam(term));
    knownTerms.names.push(name);
    knownTerms.name2term.set(name, term);
    knownTerms.name2text.set(name, text);
    knownTerms.terms.push(term);
    knownTerms.term2name.set(term, name);
    knownTerms.regex = new RegExp(knownTerms.names.join('|'), 'g');
  },
  getName: term => knownTerms.term2name.get(term),
  getTerm: name => knownTerms.name2term.get(name),
  getText: name => knownTerms.name2text.get(name),
  regex: /$^/,
  names: [],
  terms: [],
  name2term: new Map(),
  name2text: new Map(),
  term2name: new Map()
};

const fromString = source => parser.parse(
  source
    .replace(/\\/g, 'λ')
    .replace(knownTerms.regex, knownTerms.getText)
    .split(''),
  [],
  false
);

knownTerms.add('0', '(λf.λx.x)');
knownTerms.add('1', '(λf.λx.fx)');
knownTerms.add('2', '(λf.λx.f(fx))');
knownTerms.add('3', '(λf.λx.f(f(fx)))');
knownTerms.add('4', '(λf.λx.f(f(f(fx))))');
knownTerms.add('5', '(λf.λx.f(f(f(f(fx)))))');
knownTerms.add('6', '(λf.λx.f(f(f(f(f(fx))))))');
knownTerms.add('7', '(λf.λx.f(f(f(f(f(f(fx)))))))');
knownTerms.add('8', '(λf.λx.f(f(f(f(f(f(f(fx))))))))');
knownTerms.add('9', '(λf.λx.f(f(f(f(f(f(f(f(fx)))))))))');
knownTerms.add('I', '(λx.x)');
knownTerms.add('K', '(λx.λy.x)');
knownTerms.add('S', '(λx.λy.λz.xz(yz))');
knownTerms.add('Y', '(λf.(λx.f(xx))(λx.f(xx)))');

const toString = fold(
  M => toName(M[1]),
  M => M[1],
  M => `λ${toName(M[1])}.${toString(M[2])}`,
  M => _wrapIf(isLam(M[1]), toString(M[1])) + _wrapIf(!isVal(M[2]) && !isVar(M[2]), toString(M[2]))
);

const redexes = fold(
  M => [],
  M => [],
  M => redexes(M[2]),
  M => redexes(M[2]).concat(redexes(M[1]), isLam(M[1]) ? [M] : [])
);

const replace = M => replaceAt(M, 0);
const replaceAt = fold(
  (M, x, N, d) => x === M[1] ? lift(N, x, d) : x < M[1] ? Var(M[1] - 1) : M,
  (M, x, N, d) => M,
  (M, x, N, d) => x === M[1] ? M : Lam(x < M[1] ? M[1] - 1 : M[1], replaceAt(M[2], x, N, d + 1)),
  (M, x, N, d) => App(replaceAt(M[1], x, N, d), replaceAt(M[2], x, N, d))
);

const phi = fold(
  M => M,
  M => M,
  M => Lam(M[1], phi(M[2])),
  M => isLam(M[1]) ? replace(phi(M[1][2]), M[1][1], phi(M[2])) : App(phi(M[1]), phi(M[2]))
);

const beta = (M, N) => betaAt(M, N, 0);
const betaAt = fold(
  (M, N, d) => M,
  (M, N, d) => M,
  (M, N, d) => Lam(M[1], betaAt(M[2], N, d + 1)),
  (M, N, d) => M === N ? replaceAt(M[1][2], M[1][1], M[2], d-M[1][1]) : App(betaAt(M[1], N, d), betaAt(M[2], N, d))
);

const betaGraph = term => {
  const nodes = [term];
  const found = new Set([toString(term)]);
  const graph = new Map();

  while (nodes.length && found.size < 100) {
    const term = nodes.shift();

    graph.set(term, redexes(term).map(redex => [beta(term, redex), redex]));
    graph.get(term).forEach(pair => {
      const tag = toString(pair[0]);
      if (!found.has(tag)) {
        found.add(tag);
        nodes.push(pair[0]);
      }
    });
  }

  return graph;
};

if (typeof window !== 'undefined') {
  const D3 = require('d3');
  const dagreD3 = require('dagre-d3');

  const toStringColor = fold(
    (M, Ns) => toName(M[1]),
    (M, Ns) => M[1],
    (M, Ns) => `λ${toName(M[1])}.${toStringColor(M[2], Ns)}`,
    (M, Ns) => _wrapIf(Ns.includes(M), _wrapIf(isLam(M[1]), toStringColor(M[1], Ns)) + _wrapIf(!isVal(M[2]) && !isVar(M[2]), toStringColor(M[2], Ns)), `<tspan class="redex redex-${Ns.indexOf(M)}">`, '</tspan>')
  );

  const render = dagreD3.render();
  const zoom = D3.zoom().on('zoom', () => g.attr('transform', D3.event.transform));
  const body = D3.select('body');
  const input = body.append('input');
  const svg = body.append('svg');
  const g = svg.append('g');
  svg.call(zoom);

  render.arrows().normal = function normal(parent, id, edge, type) {
    const marker = parent.append('marker')
      .attr('id', id)
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 5)
      .attr('refY', 5)
      .attr('markerUnits', 'strokeWidth')
      .attr('markerWidth', 6)
      .attr('markerHeight', 4)
      .attr('orient', 'auto');

    const path = marker.append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z');

    if (edge[type + 'Class'])
      path.attr('class', edge[type + 'Class']);

    dagreD3.util.applyStyle(path, edge[type + 'Style']);
  };

  input.on('input', update);
  update.call({value: '(λy.y(λx.y(λx.y(λx.y))))(λy.y)'});
  window.addEventListener('resize', () => update.call({value: input.node().value}));

  function update() {
    try {
      input.attr('value', this.value);

      const graph = new dagreD3.graphlib.Graph({multigraph: true}).setGraph({});
      for (const [termA, pairs] of betaGraph(fromString(this.value))) {
        const textA = toString(termA);
        const label = toStringColor(termA, pairs.map(pair => pair[1]));
        graph.setNode(textA, {label, labelType: 'html'});

        for (const pair of pairs) {
          const textB = toString(pair[0]);
          const textC = toString(pair[1]);
          if (!graph.node(textB))
            graph.setNode(textB, {label: textB});
          graph.setEdge(
            textA,
            textB,
            {class: `redex redex-${pairs.indexOf(pair)}`, label: ''},
            textA + textB + textC
          );
        }
      }

      svg.call(zoom.transform, D3.zoomIdentity);

      render(g, graph);

      const {height: h, width: w} = graph.graph();
      const {innerHeight: H, innerWidth: W} = window;
      const scale = 0.75 * Math.min(W / w, H / h);

      svg.call(
        zoom.transform,
        D3.zoomIdentity
          .translate((W - w * scale) / 2, (H - h * scale) / 2)
          .scale(scale)
      );
    } catch (error) {
      console.error(error);
    }
  }
}

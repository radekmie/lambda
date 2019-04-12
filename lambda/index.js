const _wrapIf = (condition, string, a = '(', b = ')') => condition ? `${a}${string}${b}` : string;
const _build = (tokens, vars, app) => !/^[a-z\(]$/.test(tokens[0]) ? app : _build(tokens, vars, App(app, tokens[0] === '(' ? _parse(tokens, vars, true) : _found(tokens, vars)));
const _found = (tokens, vars) => {
  const name = tokens.shift();
  return Var(vars.includes(name) ? vars.lastIndexOf(name) : name);
};
const _parse = (tokens, vars, bound) => {
  switch (tokens[0]) {
    case undefined:
      throw new Error('ParsingError');

    case '(':
      tokens.shift(); // (
      let app = _parse(tokens, vars);
      while (tokens[0] !== ')')
        app = App(app, _parse(tokens, vars));
      tokens.shift(); // )
      return bound ? app : _build(tokens, vars, app);

    case 'λ':
      tokens.shift(); // λ
      const name = tokens.shift();
      const bind = vars.length;
      tokens.shift(); // .
      return Lam(bind, _parse(tokens, vars.concat(name)));

    default:
      return _build(tokens, vars, _found(tokens, vars));
  }
};

const $App = 0;
const $Lam = 1;
const $Var = 2;

const App = (m, n) => [$App, m, n];
const Lam = (x, n) => [$Lam, x, n];
const Var = x => [$Var, x];

const isApp = term => term[0] === $App;
const isLam = term => term[0] === $Lam;
const isVar = term => term[0] === $Var;

const fold = (Var, Lam, App) => {
  return (term, ...args) => {
    switch (term[0]) {
      case $App: return App(term, ...args);
      case $Lam: return Lam(term, ...args);
      case $Var: return Var(term, ...args);
    }
  };
};

const copy = term => lift(term, 0);
const lift = fold(
  (M, d) => Var(typeof M[1] === 'string' ? M[1] : M[1] + Math.max(0, d)),
  (M, d) => Lam(M[1] + Math.max(0, d), lift(M[2], d)),
  (M, d) => App(lift(M[1], d), lift(M[2], d))
);

const toName = x => typeof x === 'string' ? x : (x + 10).toString(36);
const toAST = fold(
  M => `Var(${M[1]})`,
  M => `Lam(${M[1]}, ${toAST(M[2])})`,
  M => `App(${toAST(M[1])}, ${toAST(M[2])})`
);

const fromString = source => _parse(
  source
    .replace(/0/g, '(λf.λx.x)')
    .replace(/1/g, '(λf.λx.fx)')
    .replace(/2/g, '(λf.λx.f(fx))')
    .replace(/3/g, '(λf.λx.f(f(fx)))')
    .replace(/4/g, '(λf.λx.f(f(f(fx))))')
    .replace(/5/g, '(λf.λx.f(f(f(f(fx)))))')
    .replace(/6/g, '(λf.λx.f(f(f(f(f(fx))))))')
    .replace(/7/g, '(λf.λx.f(f(f(f(f(f(fx)))))))')
    .replace(/8/g, '(λf.λx.f(f(f(f(f(f(f(fx))))))))')
    .replace(/9/g, '(λf.λx.f(f(f(f(f(f(f(f(fx)))))))))')
    .replace(/I/g, '(λx.x)')
    .replace(/K/g, '(λx.λy.x)')
    .replace(/S/g, '(λx.λy.λz.xz(yz))')
    .replace(/Y/g, '(λf.(λx.f(xx))(λx.f(xx)))')
    .replace(/\\/g, 'λ')
    .split(''),
  []
);

const toString = fold(
  M => toName(M[1]),
  M => `λ${toName(M[1])}.${toString(M[2])}`,
  M => _wrapIf(isLam(M[1]), toString(M[1])) + _wrapIf(!isVar(M[2]), toString(M[2]))
);

const redexes = fold(
  M => [],
  M => redexes(M[2]),
  M => redexes(M[2]).concat(redexes(M[1]), isLam(M[1]) ? [M] : [])
);

const replace = term => replaceAt(term, 0);
const replaceAt = fold(
  (M, x, N, d) => x === M[1] ? lift(N, d) : x < M[1] ? Var(M[1] - 1) : M,
  (M, x, N, d) => x === M[1] ? M : Lam(x < M[1] ? M[1] - 1 : M[1], replaceAt(M[2], x, N, d + 1)),
  (M, x, N, d) => App(replaceAt(M[1], x, N, d), replaceAt(M[2], x, N, d))
);

const phi = fold(
  M => M,
  M => Lam(M[1], phi(M[2])),
  M => isLam(M[1]) ? replace(phi(M[1][2]), M[1][1], phi(M[2])) : App(phi(M[1]), phi(M[2]))
);

const beta = fold(
  (M, N) => M,
  (M, N) => Lam(M[1], beta(M[2], N)),
  (M, N) => M === N ? replaceAt(M[1][2], M[1][1], M[2], -M[1][1]) : App(beta(M[1], N), beta(M[2], N))
);

const betaGraph = (term) => {
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
    (M, Ns) => `λ${toName(M[1])}.${toStringColor(M[2], Ns)}`,
    (M, Ns) => _wrapIf(Ns.includes(M), _wrapIf(isLam(M[1]), toStringColor(M[1], Ns)) + _wrapIf(!isVar(M[2]), toStringColor(M[2], Ns)), `<tspan class="redex redex-${Ns.indexOf(M)}">`, '</tspan>')
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

const _wrapIf = (condition, string) => condition ? `(${string})` : string;
const _found = (tokens, vars) => Var(vars.lastIndexOf(tokens.shift()));
const _build = (tokens, vars, app) => !/^[a-z\(]$/.test(tokens[0]) ? app : _build(tokens, vars, App(app, tokens[0] === '(' ? _parse(tokens, vars, true) : _found(tokens, vars)));
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

const App = (m, n) => ['App', m, n];
const Lam = (x, n) => ['Lam', x, n];
const Var = x => ['Var', x];

const isApp = term => term[0] === 'App';
const isLam = term => term[0] === 'Lam';
const isVar = term => term[0] === 'Var';

const fold = (Var, Lam, App) => (term, ...args) => ({App, Lam, Var}[term[0]])(term, ...args);

const copy = fold(
  M => Var(M[1]),
  M => Lam(M[1], copy(M[2])),
  M => App(copy(M[1]), copy(M[2]))
);

const toName = x => (x + 10).toString(36);
const toAST = fold(
  M => `Var(${M[1]})`,
  M => `Lam(${M[1]}, ${toAST(M[2])})`,
  M => `App(${toAST(M[1])}, ${toAST(M[2])})`
);

const fromString = source => _parse(source.replace(/\\/g, 'λ').split(''), []);
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

const replace = fold(
  (M, x, N) => x === M[1] ? copy(N) : x < M[1] ? Var(M[1] - 1) : M,
  (M, x, N) => x === M[1] ? M : Lam(x < M[1] ? M[1] - 1 : M[1], replace(M[2], x, N)),
  (M, x, N) => App(replace(M[1], x, N), replace(M[2], x, N))
);

const phi = fold(
  M => M,
  M => Lam(M[1], phi(M[2])),
  M => isLam(M[1]) ? replace(phi(M[1][2]), M[1][1], phi(M[2])) : App(phi(M[1]), phi(M[2]))
);

const beta = fold(
  (M, N) => M,
  (M, N) => Lam(M[1], beta(M[2], N)),
  (M, N) => M === N ? replace(M[1][2], M[1][1], M[2]) : App(beta(M[1], N), beta(M[2], N))
);

const betaGraph = (term, size = 25) => {
  const nodes = [term];
  const found = new Set();
  const graph = new Map();

  while (nodes.length && size-- > 0) {
    const term = nodes.shift();
    found.add(toString(term));
    graph.set(term, redexes(term).map(redex => [beta(term, redex), redex]));
    graph.get(term).forEach(pair => {
      if (!found.has(toString(pair[0])))
        nodes.push(pair[0]);
    });
  }

  return graph;
};

if (typeof window !== 'undefined') {
  const D3 = require('d3');
  const dagreD3 = require('dagre-d3');

  const render = dagreD3.render();
  const zoom = D3.zoom().on('zoom', () => g.attr('transform', D3.event.transform));
  const body = D3.select('body');
  const input = body.append('input');
  const svg = body.append('svg');
  const g = svg.append('g');
  svg.call(zoom);

  input.on('input', update);
  update.call({value: '(λx.xx)(λx.x(λy.y)xx)'});

  function update() {
    try {
      input.attr('value', this.value);

      const graph = new dagreD3.graphlib.Graph().setGraph({});
      for (const [termA, pairs] of betaGraph(fromString(this.value))) {
        const textA = toString(termA);
        graph.setNode(textA, {label: textA});

        for (const [termB, redex] of pairs) {
          const textB = toString(termB);
          graph.setNode(textB, {label: textB});
          graph.setEdge(textA, textB, {label: ''});
        }
      }

      render(g, graph);

      const scale = 0.8 * Math.min(
        window.innerWidth / graph.graph().width,
        window.innerHeight / graph.graph().height
      );

      svg.call(
        zoom.transform,
        D3.zoomIdentity
          .translate(
            (window.innerWidth - graph.graph().width * scale) / 2,
            (window.innerHeight - graph.graph().height * scale) / 2
          )
          .scale(scale)
      );
    } catch (error) {
      console.error(error);
    }
  }
}

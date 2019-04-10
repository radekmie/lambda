const App = (m, n) => ['App', m, n];
const Lam = (x, n) => ['Lam', x, n];
const Var = x => ['Var', x];

const isApp = term => term[0] === 'App';
const isLam = term => term[0] === 'Lam';
const isVar = term => term[0] === 'Var';

const fold = (Var, Lam, App) => (term, ...args) => ({App, Lam, Var}[term[0]])(term, ...args);

const fromString = source => {
  source = source.replace(/\\/g, 'λ');

  let index = 0;
  function parse(vars, bound) {
    if (index > source.length)
      throw Error(`Error while parsing ${source}`);

    if (source[index] === '(') {
      ++index; // (
      let app = parse(vars);
      while (source[index] !== ')')
        app = App(app, parse(vars));
      ++index; // )

      if (!bound) {
        while (/^[a-z\(]$/.test(source[index])) {
          if (source[index] === '(')
            app = App(app, parse(vars));
          else
            app = App(app, Var(vars.lastIndexOf(source[index++])));
        }
      }

      return app;
    }

    if (source[index] === 'λ') {
      ++index; // λ
      const name = source[index++];
      const bind = vars.length;
      ++index; // .

      return Lam(bind, parse(vars.concat(name)));
    }

    let app = Var(vars.lastIndexOf(source[index++]));
    while (/^[a-z\(]$/.test(source[index])) {
      if (source[index] === '(')
        app = App(app, parse(vars, true));
      else
        app = App(app, Var(vars.lastIndexOf(source[index++])));
    }

    return app;
  }

  return parse([]);
};

const toName = x => 'xyz'[x];
const toAST = fold(
  M => `Var(${M[1]})`,
  M => `Lam(${M[1]}, ${toAST(M[2])})`,
  M => `App(${toAST(M[1])}, ${toAST(M[2])})`
);

const wrapIf = (condition, string) => condition ? `(${string})` : string;
const toString = fold(
  M => toName(M[1]),
  M => `λ${toName(M[1])}.${toString(M[2])}`,
  M => wrapIf(isLam(M[1]), toString(M[1])) + wrapIf(!isVar(M[2]), toString(M[2]))
);

const clone = term => fromString(toString(term));

const redexes = fold(
  M => [],
  M => redexes(M[2]),
  M => redexes(M[2]).concat(redexes(M[1]), isLam(M[1]) ? [M] : [])
);

const replace = fold(
  (M, x, N) => x === M[1] ? N : x < M[1] ? Var(M[1] - 1) : M,
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

const betaGraph = (term, size = 10) => {
  let stop = false;
  const nodes = [term];
  const graph = {};

  while (nodes.length && size-- > 0) {
    const term = nodes.shift();
    const text = toString(term);
    if (graph[text]) break;

    graph[text] = redexes(term).map(redex => beta(term, redex));
    graph[text].forEach(term => nodes.push(term));
  }

  return graph;
};

const betaGraphToDot = graph => `digraph G {${Object.entries(graph).map(([text, terms]) => terms.map(term => `"${text}" -> "${toString(term)}"`)).reduce((a, b) => (a.push(...b), a), ['']).join('\n  ')}\n}`;

const d3 = require('d3');
const dd3 = require('dagre-d3');
const dot = require('graphlib-dot');

const render = dd3.render();
const input = d3.select('body').append('input');
const zoom = d3.zoom().on('zoom', () => tag.attr('transform', d3.event.transform));
const svg = d3.select('body').append('svg');
const tag = svg.append('g');
svg.call(zoom);

input.on('input', update);
update.call({value: '(λx.xx)(λx.(λy.y)xx)'});

function update() {
  try {
    input.attr('value', this.value);
    const term = fromString(this.value);
    const text = betaGraphToDot(betaGraph(term));
    const node = dot.read(text);
    render(tag, node);

    const graph = node.graph();
    const scale = 0.8 * Math.min(
      window.innerWidth / graph.width,
      window.innerHeight / graph.height
    );

    svg.call(
      zoom.transform,
      d3.zoomIdentity
        .translate(
          (window.innerWidth - graph.width * scale) / 2,
          (window.innerHeight - graph.height * scale) / 2
        )
        .scale(scale)
    );
  } catch (error) {
    console.error(error);
  }
}

import * as D3 from 'd3';
import dagreD3 from 'dagre-d3';

import {fromInput} from './logic';

// Renderer.
const render = dagreD3.render();
const arrows = render.arrows();
const normal = arrows.normal;
arrows.normal = (parent, id, edge, type) => {
  normal(parent, id, edge, type);
  parent.select('marker')
    .attr('markerHeight', 4)
    .attr('markerWidth', 4)
    .attr('refX', 5);
};

// World.
const $body = D3.select('body');
const $bool = $body.append('input').attr('type', 'checkbox');
const $text = $body.append('input').attr('type', 'text');
const $rect = $body.append('svg');
const $root = $rect.append('g');

// Zoom.
const zoom = D3.zoom().on('zoom', () => $root.attr('transform', D3.event.transform));
$rect.call(zoom);

// Reactivity.
$bool.on('input', onEvent);
$text.on('input', onEvent);
window.addEventListener('resize', onEvent);
update({string: '(λx.x(λy.x(λy.x(λy.x))))(λx.x)', useNames: true});

// Renderer core.
function update({string, useNames}) {
  $rect.call(zoom.transform, D3.zoomIdentity);
  $bool.attr('checked', useNames);
  $text.attr('value', string);

  let graph = new dagreD3.graphlib.Graph().setGraph({});
  try {
    graph = fromInput({string, useNames});
  } catch (error) {
    graph.setNode('error', {label: '' + error});
  }

  render($root, graph);

  const {height: h, width: w} = graph.graph();
  const {innerHeight: H, innerWidth: W} = window;
  const scale = 0.75 * Math.min(W / w, H / h);

  $rect.call(
    zoom.transform,
    D3.zoomIdentity
      .translate((W - w * scale) / 2, (H - h * scale) / 2)
      .scale(scale)
  );
}

function onEvent() {
  update({string: $text.node().value, useNames: $bool.node().checked});
}

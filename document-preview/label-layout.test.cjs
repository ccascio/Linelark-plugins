const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ linelark: { addPreview() {},
    measureText(text, options) { return { width: Array.from(text).length * options.size * 0.6,
        height: options.size * 1.35 }; }
} });
vm.runInContext(fs.readFileSync(__dirname + '/Document Preview.linelarkplugin/main.js', 'utf8'), context);
for (const align of ['left', 'center', 'right']) {
    for (const verticalalign of ['top', 'middle', 'bottom']) {
        const cell = { ax: 30, ay: 20, width: 120, height: 60,
            value: 'transcription and masking withaverylongunbrokentoken',
            style: { align, verticalalign, fontstyle: '1', spacingleft: '8', spacingright: '12' } };
        const figure = new context.Figure();
        context.drawioVertexLabel(figure, new context.Measurer(), cell);
        assert(figure.shapes.length > 1);
        for (const label of figure.shapes) {
            const w = label.text.length * label.size * 0.6;
            const h = label.size * 1.35;
            assert.equal(label.align, { left: 'leading', center: 'center', right: 'trailing' }[align]);
            const left = label.x - (label.align === 'center' ? w / 2 : label.align === 'trailing' ? w : 0);
            assert(left >= cell.ax, 'left edge stays inside');
            assert(left + w <= cell.ax + cell.width, 'right edge stays inside');
            assert(label.y - h / 2 >= cell.ay, 'top stays inside');
            assert(label.y + h / 2 <= cell.ay + cell.height, 'bottom stays inside');
        }
    }
}
assert.equal(context.drawioWrapLabel('one\ntwo', new context.Measurer(), 12, false, 100), 'one\ntwo');
console.log('Passed label containment for all nine alignments and explicit line breaks.');

const from = { isVertex: true, ax: 0, ay: 0, width: 100, height: 100 };
const to = { isVertex: true, ax: 300, ay: 150, width: 100, height: 100 };
const edge = { source: 'a', target: 'b', points: [], style: {
    exitx: '1', exity: '0.25', entryx: '0', entryy: '0.75', edgestyle: 'orthogonalEdgeStyle', rounded: '1'
} };
const path = context.drawioEdgePath(edge, { a: from, b: to });
assert.equal(JSON.stringify(path[0]), JSON.stringify({ x: 100, y: 25 }));
assert.equal(JSON.stringify(path.at(-1)), JSON.stringify({ x: 300, y: 225 }));
for (let i = 1; i < path.length; i++) {
    assert(path[i].x === path[i - 1].x || path[i].y === path[i - 1].y);
}
assert(path[1].x > path[0].x);
assert(path.at(-2).x < path.at(-1).x);
const labelPoint = context.drawioEdgeLabelPoint([{ x: 0, y: 0 }, { x: 100, y: 0 }],
    { relative: true, x: 0, y: 10, offset: { x: 3, y: 4 } }, []);
assert.equal(JSON.stringify(labelPoint), JSON.stringify({ x: 53, y: -6 }));
for (const kind of ['block', 'classic', 'open', 'diamond', 'oval']) {
    const figure = new context.Figure();
    context.drawioMarker(figure, { x: 100, y: 0 }, { x: 0, y: 0 }, kind, 16, false, 'secondary', 2);
    assert.equal(figure.shapes.length, 1);
    assert.equal(figure.shapes[0].closed, kind !== 'open');
    assert.equal(figure.shapes[0].fill, kind === 'open' ? 'none' : '#ffffff');
}
// Optional real-world fixture; the test remains portable without the user's file.
if (process.argv[2]) {
    const pages = context.drawioPages(fs.readFileSync(process.argv[2], 'utf8'));
    let edges = 0, labels = 0;
    for (const page of pages) {
        const model = context.drawioCells(page.model);
        context.drawioPlace(model);
        for (const cell of model.cells) {
            if (cell.isEdge) {
                const points = context.drawioEdgePath(cell, model.byID);
                assert(points && points.length >= 2);
                for (const [prefix, id, point] of [['exit', cell.source, points[0]], ['entry', cell.target, points.at(-1)]]) {
                    const vertex = model.byID[id];
                    if (vertex && cell.style[prefix + 'x'] !== undefined) {
                        assert.equal(point.x, vertex.ax + Number(cell.style[prefix + 'x']) * vertex.width);
                        assert.equal(point.y, vertex.ay + Number(cell.style[prefix + 'y']) * vertex.height);
                    }
                }
                edges++;
            } else if (cell.isVertex && model.byID[cell.parent]?.isEdge !== true) {
                const figure = new context.Figure();
                context.drawioVertexLabel(figure, new context.Measurer(), cell);
                for (const label of figure.shapes) {
                    const w = Array.from(label.text).length * label.size * 0.6;
                    const left = label.x - (label.align === 'center' ? w / 2 : label.align === 'trailing' ? w : 0);
                    assert(left >= cell.ax - 0.01, cell.id + ' left');
                    assert(left + w <= cell.ax + cell.width + 0.01, cell.id + ' right');
                    labels++;
                }
            }
        }
        const figure = context.drawioPage(page, new context.Measurer(), 0);
        for (const shape of figure.shapes) {
            if (shape.points) { assert(shape.points.length <= 64); }
        }
    }
    console.log(`Real diagram: ${edges} connector endpoints and ${labels} label bounds passed.`);
}
console.log('Passed connector ports, orthogonal routes, label offsets and marker styles.');

assert.equal(context.drawioInk('#9673a6', 'border'), '#9673a6');
assert.equal(context.drawioInk('#abc', 'border'), '#aabbcc');
assert.equal(context.drawioInk('url(example)', 'border'), 'border');
const colored = new context.Figure();
context.drawioEdge(colored, { ...edge, style: { ...edge.style, strokecolor: '#9673a6', strokewidth: '2' } }, { a: from, b: to });
assert(colored.shapes.every(shape => shape.stroke === '#9673a6'));
assert(colored.shapes.at(-1).closed);
assert.equal(colored.shapes.at(-1).fill, '#9673a6');
console.log('Passed literal colors and matching connector/arrowhead colors.');

for (const shape of ['cylinder', 'cylinder3', 'datastore']) {
    const figure = new context.Figure();
    context.drawioVertexShape(figure, { ax: 10, ay: 20, width: 180, height: 90,
        style: { shape, size: '12', fillcolor: '#f8cecc', strokecolor: '#b85450', strokewidth: '2', dashed: '1' } });
    assert.equal(figure.shapes.length, 2);
    const [body, rim] = figure.shapes;
    assert.equal(body.type, 'line');
    assert.equal(body.closed, true);
    assert.equal(rim.closed, false);
    assert.equal(rim.fill, 'none');
    assert.equal(body.points.length, 50);
    assert.equal(body.points[0].y, 32);
    assert.equal(body.points.at(-1).y, 98);
    assert.equal(Math.min(...body.points.map(p => p.y)), 20);
    assert.equal(Math.max(...body.points.map(p => p.y)), 110);
    assert(figure.shapes.every(p => p.strokeWidth === 2 && p.dashed));
}
console.log('Passed cylinder silhouettes: curved base and rim, no surrounding rectangle.');

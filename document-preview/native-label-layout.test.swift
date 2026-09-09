// Run with the plugin main.js path and an uncompressed .drawio fixture path.
import AppKit
import JavaScriptCore
let context = JSContext()!
context.exceptionHandler = { _, error in fatalError(error!.toString()) }
let measure: @convention(block) (String, JSValue) -> [String: Double] = { text, options in
    let size = options.forProperty("size")!.toDouble()
    let bold = options.forProperty("bold")!.toBool()
    let bounds = (text as NSString).size(withAttributes: [.font: NSFont.systemFont(ofSize: size, weight: bold ? .semibold : .regular)])
    return ["width": ceil(bounds.width), "height": ceil(bounds.height)]
}
context.setObject(measure, forKeyedSubscript: "nativeMeasure" as NSString)
context.evaluateScript("var linelark = { addPreview: function () {}, measureText: nativeMeasure };")
context.evaluateScript(try String(contentsOfFile: CommandLine.arguments[1], encoding: .utf8))
context.setObject(try String(contentsOfFile: CommandLine.arguments[2], encoding: .utf8), forKeyedSubscript: "source" as NSString)
context.evaluateScript("""
var checked = 0;
drawioPages(source).forEach(function (page) {
 var model = drawioCells(page.model); drawioPlace(model);
 model.cells.forEach(function (cell) {
  if (!cell.isVertex || (model.byID[cell.parent] || {}).isEdge) return;
  var figure = new Figure(); drawioVertexLabel(figure, new Measurer(), cell);
  figure.shapes.forEach(function (label) {
   var measured = linelark.measureText(label.text, {size: label.size, bold: label.bold});
   var x = label.x - (label.align === 'center' ? measured.width/2 : label.align === 'trailing' ? measured.width : 0);
   if (x < cell.ax - 1 || x + measured.width > cell.ax + cell.width + 1 ||
       label.y - measured.height/2 < cell.ay - 1 || label.y + measured.height/2 > cell.ay + cell.height + 1)
       throw new Error('Label outside cell ' + cell.id + ': ' + label.text);
   checked++;
  });
 });
});
""")
print("Native macOS font containment passed for \(context.objectForKeyedSubscript("checked")!.toInt32()) labels")

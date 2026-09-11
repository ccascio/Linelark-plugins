/* The host owns navigation and confirmation; the plugin receives only the
   snapshot explicitly imported by the user. No background network access. */
var status = 'Import a webpage or local HTML file into a new tab.';
var sequence = 0;
async function importPage() {
    try {
        var result = await linelark.importWebPage();
        if (!result) return;
        var html = result.format === 'html';
        var title = (result.title || 'Imported page').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').slice(0, 120);
        linelark.openVirtual({
            key: 'web-import-' + Date.now() + '-' + (++sequence),
            name: title + (html ? '.html' : '.md'),
            text: result.text,
            language: html ? 'html' : 'markdown',
            label: result.url
        });
        status = 'Imported ' + title + '. Use Save As to keep the generated document.';
    } catch (error) {
        status = String(error);
        linelark.log(status);
    }
    linelark.refreshPanels();
}
linelark.addCommand('import-web-page', 'Import Web Content…', importPage);
linelark.addPanel({
    id: 'web-import', title: 'Web Import', symbol: 'square.and.arrow.down', side: 'right',
    render: function () {
        return [
            {type: 'text', text: status},
            {type: 'button', id: 'import', title: 'Import Web Content…', symbol: 'globe', prominent: true}
        ];
    },
    onSelect: function (id) { if (id === 'import') importPage(); }
});

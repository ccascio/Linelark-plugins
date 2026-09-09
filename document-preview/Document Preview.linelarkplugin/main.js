// Document Preview — an example Linelark plugin.
//
// It registers two *previews*: renderings of a document that the editor shows in place of
// the text when the toolbar's Preview button is pressed. One for Markdown, one for HTML.
// The plugin turns a file into preview nodes and Linelark draws every pixel of them, so the
// result matches the theme, scrolls with the pane, and cannot run script — there is no HTML
// document anywhere in this, not even for the HTML preview.
//
// Several files would be tidier than one. A plugin is a single script with no module
// loader, so the parser is vendored inline below and everything that uses it follows.

// ---------------------------------------------------------------------------------------
// marked v15.0.7, from <https://github.com/markedjs/marked>, MIT licensed, unmodified.
// Only its lexer is used: `marked.lexer(text)` gives the token tree, which is the structure
// a preview needs. `marked.parse` would produce HTML that this plugin would only have to
// take apart again. HTML has no vendored parser — see that section for why.
// ---------------------------------------------------------------------------------------
/**
 * marked v15.0.7 - a markdown parser
 * Copyright (c) 2011-2025, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/markedjs/marked
 */
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?t(exports):"function"==typeof define&&define.amd?define(["exports"],t):t((e="undefined"!=typeof globalThis?globalThis:e||self).marked={})}(this,(function(e){"use strict";function t(){return{async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null}}function n(t){e.defaults=t}e.defaults={async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null};const s={exec:()=>null};function r(e,t=""){let n="string"==typeof e?e:e.source;const s={replace:(e,t)=>{let r="string"==typeof t?t:t.source;return r=r.replace(i.caret,"$1"),n=n.replace(e,r),s},getRegex:()=>new RegExp(n,t)};return s}const i={codeRemoveIndent:/^(?: {1,4}| {0,3}\t)/gm,outputLinkReplace:/\\([\[\]])/g,indentCodeCompensation:/^(\s+)(?:```)/,beginningSpace:/^\s+/,endingHash:/#$/,startingSpaceChar:/^ /,endingSpaceChar:/ $/,nonSpaceChar:/[^ ]/,newLineCharGlobal:/\n/g,tabCharGlobal:/\t/g,multipleSpaceGlobal:/\s+/g,blankLine:/^[ \t]*$/,doubleBlankLine:/\n[ \t]*\n[ \t]*$/,blockquoteStart:/^ {0,3}>/,blockquoteSetextReplace:/\n {0,3}((?:=+|-+) *)(?=\n|$)/g,blockquoteSetextReplace2:/^ {0,3}>[ \t]?/gm,listReplaceTabs:/^\t+/,listReplaceNesting:/^ {1,4}(?=( {4})*[^ ])/g,listIsTask:/^\[[ xX]\] /,listReplaceTask:/^\[[ xX]\] +/,anyLine:/\n.*\n/,hrefBrackets:/^<(.*)>$/,tableDelimiter:/[:|]/,tableAlignChars:/^\||\| *$/g,tableRowBlankLine:/\n[ \t]*$/,tableAlignRight:/^ *-+: *$/,tableAlignCenter:/^ *:-+: *$/,tableAlignLeft:/^ *:-+ *$/,startATag:/^<a /i,endATag:/^<\/a>/i,startPreScriptTag:/^<(pre|code|kbd|script)(\s|>)/i,endPreScriptTag:/^<\/(pre|code|kbd|script)(\s|>)/i,startAngleBracket:/^</,endAngleBracket:/>$/,pedanticHrefTitle:/^([^'"]*[^\s])\s+(['"])(.*)\2/,unicodeAlphaNumeric:/[\p{L}\p{N}]/u,escapeTest:/[&<>"']/,escapeReplace:/[&<>"']/g,escapeTestNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,escapeReplaceNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,unescapeTest:/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/gi,caret:/(^|[^\[])\^/g,percentDecode:/%25/g,findPipe:/\|/g,splitPipe:/ \|/,slashPipe:/\\\|/g,carriageReturn:/\r\n|\r/g,spaceLine:/^ +$/gm,notSpaceStart:/^\S*/,endingNewline:/\n$/,listItemRegex:e=>new RegExp(`^( {0,3}${e})((?:[\t ][^\\n]*)?(?:\\n|$))`),nextBulletRegex:e=>new RegExp(`^ {0,${Math.min(3,e-1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ \t][^\\n]*)?(?:\\n|$))`),hrRegex:e=>new RegExp(`^ {0,${Math.min(3,e-1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),fencesBeginRegex:e=>new RegExp(`^ {0,${Math.min(3,e-1)}}(?:\`\`\`|~~~)`),headingBeginRegex:e=>new RegExp(`^ {0,${Math.min(3,e-1)}}#`),htmlBeginRegex:e=>new RegExp(`^ {0,${Math.min(3,e-1)}}<(?:[a-z].*>|!--)`,"i")},l=/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,o=/(?:[*+-]|\d{1,9}[.)])/,a=/^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/,c=r(a).replace(/bull/g,o).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/\|table/g,"").getRegex(),h=r(a).replace(/bull/g,o).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/table/g,/ {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(),p=/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,u=/(?!\s*\])(?:\\.|[^\[\]\\])+/,g=r(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label",u).replace("title",/(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(),k=r(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g,o).getRegex(),d="address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul",f=/<!--(?:-?>|[\s\S]*?(?:-->|$))/,x=r("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$))","i").replace("comment",f).replace("tag",d).replace("attribute",/ +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(),b=r(p).replace("hr",l).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("|table","").replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",d).getRegex(),w={blockquote:r(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph",b).getRegex(),code:/^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/,def:g,fences:/^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,heading:/^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,hr:l,html:x,lheading:c,list:k,newline:/^(?:[ \t]*(?:\n|$))+/,paragraph:b,table:s,text:/^[^\n]+/},m=r("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr",l).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("blockquote"," {0,3}>").replace("code","(?: {4}| {0,3}\t)[^\\n]").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",d).getRegex(),y={...w,lheading:h,table:m,paragraph:r(p).replace("hr",l).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("table",m).replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",d).getRegex()},$={...w,html:r("^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:\"[^\"]*\"|'[^']*'|\\s[^'\"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))").replace("comment",f).replace(/tag/g,"(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),def:/^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,heading:/^(#{1,6})(.*)(?:\n+|$)/,fences:s,lheading:/^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,paragraph:r(p).replace("hr",l).replace("heading"," *#{1,6} *[^\n]").replace("lheading",c).replace("|table","").replace("blockquote"," {0,3}>").replace("|fences","").replace("|list","").replace("|html","").replace("|tag","").getRegex()},R=/^( {2,}|\\)\n(?!\s*$)/,S=/[\p{P}\p{S}]/u,T=/[\s\p{P}\p{S}]/u,z=/[^\s\p{P}\p{S}]/u,A=r(/^((?![*_])punctSpace)/,"u").replace(/punctSpace/g,T).getRegex(),_=/(?!~)[\p{P}\p{S}]/u,P=/^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/,I=r(P,"u").replace(/punct/g,S).getRegex(),L=r(P,"u").replace(/punct/g,_).getRegex(),B="^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)",C=r(B,"gu").replace(/notPunctSpace/g,z).replace(/punctSpace/g,T).replace(/punct/g,S).getRegex(),q=r(B,"gu").replace(/notPunctSpace/g,/(?:[^\s\p{P}\p{S}]|~)/u).replace(/punctSpace/g,/(?!~)[\s\p{P}\p{S}]/u).replace(/punct/g,_).getRegex(),E=r("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)","gu").replace(/notPunctSpace/g,z).replace(/punctSpace/g,T).replace(/punct/g,S).getRegex(),Z=r(/\\(punct)/,"gu").replace(/punct/g,S).getRegex(),v=r(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme",/[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email",/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(),D=r(f).replace("(?:--\x3e|$)","--\x3e").getRegex(),M=r("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment",D).replace("attribute",/\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(),O=/(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/,Q=r(/^!?\[(label)\]\(\s*(href)(?:\s+(title))?\s*\)/).replace("label",O).replace("href",/<(?:\\.|[^\n<>\\])+>|[^\s\x00-\x1f]*/).replace("title",/"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(),j=r(/^!?\[(label)\]\[(ref)\]/).replace("label",O).replace("ref",u).getRegex(),N=r(/^!?\[(ref)\](?:\[\])?/).replace("ref",u).getRegex(),G={_backpedal:s,anyPunctuation:Z,autolink:v,blockSkip:/\[[^[\]]*?\]\((?:\\.|[^\\\(\)]|\((?:\\.|[^\\\(\)])*\))*\)|`[^`]*?`|<[^<>]*?>/g,br:R,code:/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,del:s,emStrongLDelim:I,emStrongRDelimAst:C,emStrongRDelimUnd:E,escape:/^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,link:Q,nolink:N,punctuation:A,reflink:j,reflinkSearch:r("reflink|nolink(?!\\()","g").replace("reflink",j).replace("nolink",N).getRegex(),tag:M,text:/^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,url:s},H={...G,link:r(/^!?\[(label)\]\((.*?)\)/).replace("label",O).getRegex(),reflink:r(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label",O).getRegex()},X={...G,emStrongRDelimAst:q,emStrongLDelim:L,url:r(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/,"i").replace("email",/[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),_backpedal:/(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,del:/^(~~?)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/,text:/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/},F={...X,br:r(R).replace("{2,}","*").getRegex(),text:r(X.text).replace("\\b_","\\b_| {2,}\\n").replace(/\{2,\}/g,"*").getRegex()},U={normal:w,gfm:y,pedantic:$},J={normal:G,gfm:X,breaks:F,pedantic:H},K={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"},V=e=>K[e];function W(e,t){if(t){if(i.escapeTest.test(e))return e.replace(i.escapeReplace,V)}else if(i.escapeTestNoEncode.test(e))return e.replace(i.escapeReplaceNoEncode,V);return e}function Y(e){try{e=encodeURI(e).replace(i.percentDecode,"%")}catch{return null}return e}function ee(e,t){const n=e.replace(i.findPipe,((e,t,n)=>{let s=!1,r=t;for(;--r>=0&&"\\"===n[r];)s=!s;return s?"|":" |"})).split(i.splitPipe);let s=0;if(n[0].trim()||n.shift(),n.length>0&&!n.at(-1)?.trim()&&n.pop(),t)if(n.length>t)n.splice(t);else for(;n.length<t;)n.push("");for(;s<n.length;s++)n[s]=n[s].trim().replace(i.slashPipe,"|");return n}function te(e,t,n){const s=e.length;if(0===s)return"";let r=0;for(;r<s;){if(e.charAt(s-r-1)!==t)break;r++}return e.slice(0,s-r)}function ne(e,t,n,s,r){const i=t.href,l=t.title||null,o=e[1].replace(r.other.outputLinkReplace,"$1");if("!"!==e[0].charAt(0)){s.state.inLink=!0;const e={type:"link",raw:n,href:i,title:l,text:o,tokens:s.inlineTokens(o)};return s.state.inLink=!1,e}return{type:"image",raw:n,href:i,title:l,text:o}}class se{options;rules;lexer;constructor(t){this.options=t||e.defaults}space(e){const t=this.rules.block.newline.exec(e);if(t&&t[0].length>0)return{type:"space",raw:t[0]}}code(e){const t=this.rules.block.code.exec(e);if(t){const e=t[0].replace(this.rules.other.codeRemoveIndent,"");return{type:"code",raw:t[0],codeBlockStyle:"indented",text:this.options.pedantic?e:te(e,"\n")}}}fences(e){const t=this.rules.block.fences.exec(e);if(t){const e=t[0],n=function(e,t,n){const s=e.match(n.other.indentCodeCompensation);if(null===s)return t;const r=s[1];return t.split("\n").map((e=>{const t=e.match(n.other.beginningSpace);if(null===t)return e;const[s]=t;return s.length>=r.length?e.slice(r.length):e})).join("\n")}(e,t[3]||"",this.rules);return{type:"code",raw:e,lang:t[2]?t[2].trim().replace(this.rules.inline.anyPunctuation,"$1"):t[2],text:n}}}heading(e){const t=this.rules.block.heading.exec(e);if(t){let e=t[2].trim();if(this.rules.other.endingHash.test(e)){const t=te(e,"#");this.options.pedantic?e=t.trim():t&&!this.rules.other.endingSpaceChar.test(t)||(e=t.trim())}return{type:"heading",raw:t[0],depth:t[1].length,text:e,tokens:this.lexer.inline(e)}}}hr(e){const t=this.rules.block.hr.exec(e);if(t)return{type:"hr",raw:te(t[0],"\n")}}blockquote(e){const t=this.rules.block.blockquote.exec(e);if(t){let e=te(t[0],"\n").split("\n"),n="",s="";const r=[];for(;e.length>0;){let t=!1;const i=[];let l;for(l=0;l<e.length;l++)if(this.rules.other.blockquoteStart.test(e[l]))i.push(e[l]),t=!0;else{if(t)break;i.push(e[l])}e=e.slice(l);const o=i.join("\n"),a=o.replace(this.rules.other.blockquoteSetextReplace,"\n    $1").replace(this.rules.other.blockquoteSetextReplace2,"");n=n?`${n}\n${o}`:o,s=s?`${s}\n${a}`:a;const c=this.lexer.state.top;if(this.lexer.state.top=!0,this.lexer.blockTokens(a,r,!0),this.lexer.state.top=c,0===e.length)break;const h=r.at(-1);if("code"===h?.type)break;if("blockquote"===h?.type){const t=h,i=t.raw+"\n"+e.join("\n"),l=this.blockquote(i);r[r.length-1]=l,n=n.substring(0,n.length-t.raw.length)+l.raw,s=s.substring(0,s.length-t.text.length)+l.text;break}if("list"!==h?.type);else{const t=h,i=t.raw+"\n"+e.join("\n"),l=this.list(i);r[r.length-1]=l,n=n.substring(0,n.length-h.raw.length)+l.raw,s=s.substring(0,s.length-t.raw.length)+l.raw,e=i.substring(r.at(-1).raw.length).split("\n")}}return{type:"blockquote",raw:n,tokens:r,text:s}}}list(e){let t=this.rules.block.list.exec(e);if(t){let n=t[1].trim();const s=n.length>1,r={type:"list",raw:"",ordered:s,start:s?+n.slice(0,-1):"",loose:!1,items:[]};n=s?`\\d{1,9}\\${n.slice(-1)}`:`\\${n}`,this.options.pedantic&&(n=s?n:"[*+-]");const i=this.rules.other.listItemRegex(n);let l=!1;for(;e;){let n=!1,s="",o="";if(!(t=i.exec(e)))break;if(this.rules.block.hr.test(e))break;s=t[0],e=e.substring(s.length);let a=t[2].split("\n",1)[0].replace(this.rules.other.listReplaceTabs,(e=>" ".repeat(3*e.length))),c=e.split("\n",1)[0],h=!a.trim(),p=0;if(this.options.pedantic?(p=2,o=a.trimStart()):h?p=t[1].length+1:(p=t[2].search(this.rules.other.nonSpaceChar),p=p>4?1:p,o=a.slice(p),p+=t[1].length),h&&this.rules.other.blankLine.test(c)&&(s+=c+"\n",e=e.substring(c.length+1),n=!0),!n){const t=this.rules.other.nextBulletRegex(p),n=this.rules.other.hrRegex(p),r=this.rules.other.fencesBeginRegex(p),i=this.rules.other.headingBeginRegex(p),l=this.rules.other.htmlBeginRegex(p);for(;e;){const u=e.split("\n",1)[0];let g;if(c=u,this.options.pedantic?(c=c.replace(this.rules.other.listReplaceNesting,"  "),g=c):g=c.replace(this.rules.other.tabCharGlobal,"    "),r.test(c))break;if(i.test(c))break;if(l.test(c))break;if(t.test(c))break;if(n.test(c))break;if(g.search(this.rules.other.nonSpaceChar)>=p||!c.trim())o+="\n"+g.slice(p);else{if(h)break;if(a.replace(this.rules.other.tabCharGlobal,"    ").search(this.rules.other.nonSpaceChar)>=4)break;if(r.test(a))break;if(i.test(a))break;if(n.test(a))break;o+="\n"+c}h||c.trim()||(h=!0),s+=u+"\n",e=e.substring(u.length+1),a=g.slice(p)}}r.loose||(l?r.loose=!0:this.rules.other.doubleBlankLine.test(s)&&(l=!0));let u,g=null;this.options.gfm&&(g=this.rules.other.listIsTask.exec(o),g&&(u="[ ] "!==g[0],o=o.replace(this.rules.other.listReplaceTask,""))),r.items.push({type:"list_item",raw:s,task:!!g,checked:u,loose:!1,text:o,tokens:[]}),r.raw+=s}const o=r.items.at(-1);if(!o)return;o.raw=o.raw.trimEnd(),o.text=o.text.trimEnd(),r.raw=r.raw.trimEnd();for(let e=0;e<r.items.length;e++)if(this.lexer.state.top=!1,r.items[e].tokens=this.lexer.blockTokens(r.items[e].text,[]),!r.loose){const t=r.items[e].tokens.filter((e=>"space"===e.type)),n=t.length>0&&t.some((e=>this.rules.other.anyLine.test(e.raw)));r.loose=n}if(r.loose)for(let e=0;e<r.items.length;e++)r.items[e].loose=!0;return r}}html(e){const t=this.rules.block.html.exec(e);if(t){return{type:"html",block:!0,raw:t[0],pre:"pre"===t[1]||"script"===t[1]||"style"===t[1],text:t[0]}}}def(e){const t=this.rules.block.def.exec(e);if(t){const e=t[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal," "),n=t[2]?t[2].replace(this.rules.other.hrefBrackets,"$1").replace(this.rules.inline.anyPunctuation,"$1"):"",s=t[3]?t[3].substring(1,t[3].length-1).replace(this.rules.inline.anyPunctuation,"$1"):t[3];return{type:"def",tag:e,raw:t[0],href:n,title:s}}}table(e){const t=this.rules.block.table.exec(e);if(!t)return;if(!this.rules.other.tableDelimiter.test(t[2]))return;const n=ee(t[1]),s=t[2].replace(this.rules.other.tableAlignChars,"").split("|"),r=t[3]?.trim()?t[3].replace(this.rules.other.tableRowBlankLine,"").split("\n"):[],i={type:"table",raw:t[0],header:[],align:[],rows:[]};if(n.length===s.length){for(const e of s)this.rules.other.tableAlignRight.test(e)?i.align.push("right"):this.rules.other.tableAlignCenter.test(e)?i.align.push("center"):this.rules.other.tableAlignLeft.test(e)?i.align.push("left"):i.align.push(null);for(let e=0;e<n.length;e++)i.header.push({text:n[e],tokens:this.lexer.inline(n[e]),header:!0,align:i.align[e]});for(const e of r)i.rows.push(ee(e,i.header.length).map(((e,t)=>({text:e,tokens:this.lexer.inline(e),header:!1,align:i.align[t]}))));return i}}lheading(e){const t=this.rules.block.lheading.exec(e);if(t)return{type:"heading",raw:t[0],depth:"="===t[2].charAt(0)?1:2,text:t[1],tokens:this.lexer.inline(t[1])}}paragraph(e){const t=this.rules.block.paragraph.exec(e);if(t){const e="\n"===t[1].charAt(t[1].length-1)?t[1].slice(0,-1):t[1];return{type:"paragraph",raw:t[0],text:e,tokens:this.lexer.inline(e)}}}text(e){const t=this.rules.block.text.exec(e);if(t)return{type:"text",raw:t[0],text:t[0],tokens:this.lexer.inline(t[0])}}escape(e){const t=this.rules.inline.escape.exec(e);if(t)return{type:"escape",raw:t[0],text:t[1]}}tag(e){const t=this.rules.inline.tag.exec(e);if(t)return!this.lexer.state.inLink&&this.rules.other.startATag.test(t[0])?this.lexer.state.inLink=!0:this.lexer.state.inLink&&this.rules.other.endATag.test(t[0])&&(this.lexer.state.inLink=!1),!this.lexer.state.inRawBlock&&this.rules.other.startPreScriptTag.test(t[0])?this.lexer.state.inRawBlock=!0:this.lexer.state.inRawBlock&&this.rules.other.endPreScriptTag.test(t[0])&&(this.lexer.state.inRawBlock=!1),{type:"html",raw:t[0],inLink:this.lexer.state.inLink,inRawBlock:this.lexer.state.inRawBlock,block:!1,text:t[0]}}link(e){const t=this.rules.inline.link.exec(e);if(t){const e=t[2].trim();if(!this.options.pedantic&&this.rules.other.startAngleBracket.test(e)){if(!this.rules.other.endAngleBracket.test(e))return;const t=te(e.slice(0,-1),"\\");if((e.length-t.length)%2==0)return}else{const e=function(e,t){if(-1===e.indexOf(t[1]))return-1;let n=0;for(let s=0;s<e.length;s++)if("\\"===e[s])s++;else if(e[s]===t[0])n++;else if(e[s]===t[1]&&(n--,n<0))return s;return-1}(t[2],"()");if(e>-1){const n=(0===t[0].indexOf("!")?5:4)+t[1].length+e;t[2]=t[2].substring(0,e),t[0]=t[0].substring(0,n).trim(),t[3]=""}}let n=t[2],s="";if(this.options.pedantic){const e=this.rules.other.pedanticHrefTitle.exec(n);e&&(n=e[1],s=e[3])}else s=t[3]?t[3].slice(1,-1):"";return n=n.trim(),this.rules.other.startAngleBracket.test(n)&&(n=this.options.pedantic&&!this.rules.other.endAngleBracket.test(e)?n.slice(1):n.slice(1,-1)),ne(t,{href:n?n.replace(this.rules.inline.anyPunctuation,"$1"):n,title:s?s.replace(this.rules.inline.anyPunctuation,"$1"):s},t[0],this.lexer,this.rules)}}reflink(e,t){let n;if((n=this.rules.inline.reflink.exec(e))||(n=this.rules.inline.nolink.exec(e))){const e=t[(n[2]||n[1]).replace(this.rules.other.multipleSpaceGlobal," ").toLowerCase()];if(!e){const e=n[0].charAt(0);return{type:"text",raw:e,text:e}}return ne(n,e,n[0],this.lexer,this.rules)}}emStrong(e,t,n=""){let s=this.rules.inline.emStrongLDelim.exec(e);if(!s)return;if(s[3]&&n.match(this.rules.other.unicodeAlphaNumeric))return;if(!(s[1]||s[2]||"")||!n||this.rules.inline.punctuation.exec(n)){const n=[...s[0]].length-1;let r,i,l=n,o=0;const a="*"===s[0][0]?this.rules.inline.emStrongRDelimAst:this.rules.inline.emStrongRDelimUnd;for(a.lastIndex=0,t=t.slice(-1*e.length+n);null!=(s=a.exec(t));){if(r=s[1]||s[2]||s[3]||s[4]||s[5]||s[6],!r)continue;if(i=[...r].length,s[3]||s[4]){l+=i;continue}if((s[5]||s[6])&&n%3&&!((n+i)%3)){o+=i;continue}if(l-=i,l>0)continue;i=Math.min(i,i+l+o);const t=[...s[0]][0].length,a=e.slice(0,n+s.index+t+i);if(Math.min(n,i)%2){const e=a.slice(1,-1);return{type:"em",raw:a,text:e,tokens:this.lexer.inlineTokens(e)}}const c=a.slice(2,-2);return{type:"strong",raw:a,text:c,tokens:this.lexer.inlineTokens(c)}}}}codespan(e){const t=this.rules.inline.code.exec(e);if(t){let e=t[2].replace(this.rules.other.newLineCharGlobal," ");const n=this.rules.other.nonSpaceChar.test(e),s=this.rules.other.startingSpaceChar.test(e)&&this.rules.other.endingSpaceChar.test(e);return n&&s&&(e=e.substring(1,e.length-1)),{type:"codespan",raw:t[0],text:e}}}br(e){const t=this.rules.inline.br.exec(e);if(t)return{type:"br",raw:t[0]}}del(e){const t=this.rules.inline.del.exec(e);if(t)return{type:"del",raw:t[0],text:t[2],tokens:this.lexer.inlineTokens(t[2])}}autolink(e){const t=this.rules.inline.autolink.exec(e);if(t){let e,n;return"@"===t[2]?(e=t[1],n="mailto:"+e):(e=t[1],n=e),{type:"link",raw:t[0],text:e,href:n,tokens:[{type:"text",raw:e,text:e}]}}}url(e){let t;if(t=this.rules.inline.url.exec(e)){let e,n;if("@"===t[2])e=t[0],n="mailto:"+e;else{let s;do{s=t[0],t[0]=this.rules.inline._backpedal.exec(t[0])?.[0]??""}while(s!==t[0]);e=t[0],n="www."===t[1]?"http://"+t[0]:t[0]}return{type:"link",raw:t[0],text:e,href:n,tokens:[{type:"text",raw:e,text:e}]}}}inlineText(e){const t=this.rules.inline.text.exec(e);if(t){const e=this.lexer.state.inRawBlock;return{type:"text",raw:t[0],text:t[0],escaped:e}}}}class re{tokens;options;state;tokenizer;inlineQueue;constructor(t){this.tokens=[],this.tokens.links=Object.create(null),this.options=t||e.defaults,this.options.tokenizer=this.options.tokenizer||new se,this.tokenizer=this.options.tokenizer,this.tokenizer.options=this.options,this.tokenizer.lexer=this,this.inlineQueue=[],this.state={inLink:!1,inRawBlock:!1,top:!0};const n={other:i,block:U.normal,inline:J.normal};this.options.pedantic?(n.block=U.pedantic,n.inline=J.pedantic):this.options.gfm&&(n.block=U.gfm,this.options.breaks?n.inline=J.breaks:n.inline=J.gfm),this.tokenizer.rules=n}static get rules(){return{block:U,inline:J}}static lex(e,t){return new re(t).lex(e)}static lexInline(e,t){return new re(t).inlineTokens(e)}lex(e){e=e.replace(i.carriageReturn,"\n"),this.blockTokens(e,this.tokens);for(let e=0;e<this.inlineQueue.length;e++){const t=this.inlineQueue[e];this.inlineTokens(t.src,t.tokens)}return this.inlineQueue=[],this.tokens}blockTokens(e,t=[],n=!1){for(this.options.pedantic&&(e=e.replace(i.tabCharGlobal,"    ").replace(i.spaceLine,""));e;){let s;if(this.options.extensions?.block?.some((n=>!!(s=n.call({lexer:this},e,t))&&(e=e.substring(s.raw.length),t.push(s),!0))))continue;if(s=this.tokenizer.space(e)){e=e.substring(s.raw.length);const n=t.at(-1);1===s.raw.length&&void 0!==n?n.raw+="\n":t.push(s);continue}if(s=this.tokenizer.code(e)){e=e.substring(s.raw.length);const n=t.at(-1);"paragraph"===n?.type||"text"===n?.type?(n.raw+="\n"+s.raw,n.text+="\n"+s.text,this.inlineQueue.at(-1).src=n.text):t.push(s);continue}if(s=this.tokenizer.fences(e)){e=e.substring(s.raw.length),t.push(s);continue}if(s=this.tokenizer.heading(e)){e=e.substring(s.raw.length),t.push(s);continue}if(s=this.tokenizer.hr(e)){e=e.substring(s.raw.length),t.push(s);continue}if(s=this.tokenizer.blockquote(e)){e=e.substring(s.raw.length),t.push(s);continue}if(s=this.tokenizer.list(e)){e=e.substring(s.raw.length),t.push(s);continue}if(s=this.tokenizer.html(e)){e=e.substring(s.raw.length),t.push(s);continue}if(s=this.tokenizer.def(e)){e=e.substring(s.raw.length);const n=t.at(-1);"paragraph"===n?.type||"text"===n?.type?(n.raw+="\n"+s.raw,n.text+="\n"+s.raw,this.inlineQueue.at(-1).src=n.text):this.tokens.links[s.tag]||(this.tokens.links[s.tag]={href:s.href,title:s.title});continue}if(s=this.tokenizer.table(e)){e=e.substring(s.raw.length),t.push(s);continue}if(s=this.tokenizer.lheading(e)){e=e.substring(s.raw.length),t.push(s);continue}let r=e;if(this.options.extensions?.startBlock){let t=1/0;const n=e.slice(1);let s;this.options.extensions.startBlock.forEach((e=>{s=e.call({lexer:this},n),"number"==typeof s&&s>=0&&(t=Math.min(t,s))})),t<1/0&&t>=0&&(r=e.substring(0,t+1))}if(this.state.top&&(s=this.tokenizer.paragraph(r))){const i=t.at(-1);n&&"paragraph"===i?.type?(i.raw+="\n"+s.raw,i.text+="\n"+s.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=i.text):t.push(s),n=r.length!==e.length,e=e.substring(s.raw.length)}else if(s=this.tokenizer.text(e)){e=e.substring(s.raw.length);const n=t.at(-1);"text"===n?.type?(n.raw+="\n"+s.raw,n.text+="\n"+s.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=n.text):t.push(s)}else if(e){const t="Infinite loop on byte: "+e.charCodeAt(0);if(this.options.silent){console.error(t);break}throw new Error(t)}}return this.state.top=!0,t}inline(e,t=[]){return this.inlineQueue.push({src:e,tokens:t}),t}inlineTokens(e,t=[]){let n=e,s=null;if(this.tokens.links){const e=Object.keys(this.tokens.links);if(e.length>0)for(;null!=(s=this.tokenizer.rules.inline.reflinkSearch.exec(n));)e.includes(s[0].slice(s[0].lastIndexOf("[")+1,-1))&&(n=n.slice(0,s.index)+"["+"a".repeat(s[0].length-2)+"]"+n.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex))}for(;null!=(s=this.tokenizer.rules.inline.blockSkip.exec(n));)n=n.slice(0,s.index)+"["+"a".repeat(s[0].length-2)+"]"+n.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);for(;null!=(s=this.tokenizer.rules.inline.anyPunctuation.exec(n));)n=n.slice(0,s.index)+"++"+n.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);let r=!1,i="";for(;e;){let s;if(r||(i=""),r=!1,this.options.extensions?.inline?.some((n=>!!(s=n.call({lexer:this},e,t))&&(e=e.substring(s.raw.length),t.push(s),!0))))continue;if(s=this.tokenizer.escape(e)){e=e.substring(s.raw.length),t.push(s);continue}if(s=this.tokenizer.tag(e)){e=e.substring(s.raw.length),t.push(s);continue}if(s=this.tokenizer.link(e)){e=e.substring(s.raw.length),t.push(s);continue}if(s=this.tokenizer.reflink(e,this.tokens.links)){e=e.substring(s.raw.length);const n=t.at(-1);"text"===s.type&&"text"===n?.type?(n.raw+=s.raw,n.text+=s.text):t.push(s);continue}if(s=this.tokenizer.emStrong(e,n,i)){e=e.substring(s.raw.length),t.push(s);continue}if(s=this.tokenizer.codespan(e)){e=e.substring(s.raw.length),t.push(s);continue}if(s=this.tokenizer.br(e)){e=e.substring(s.raw.length),t.push(s);continue}if(s=this.tokenizer.del(e)){e=e.substring(s.raw.length),t.push(s);continue}if(s=this.tokenizer.autolink(e)){e=e.substring(s.raw.length),t.push(s);continue}if(!this.state.inLink&&(s=this.tokenizer.url(e))){e=e.substring(s.raw.length),t.push(s);continue}let l=e;if(this.options.extensions?.startInline){let t=1/0;const n=e.slice(1);let s;this.options.extensions.startInline.forEach((e=>{s=e.call({lexer:this},n),"number"==typeof s&&s>=0&&(t=Math.min(t,s))})),t<1/0&&t>=0&&(l=e.substring(0,t+1))}if(s=this.tokenizer.inlineText(l)){e=e.substring(s.raw.length),"_"!==s.raw.slice(-1)&&(i=s.raw.slice(-1)),r=!0;const n=t.at(-1);"text"===n?.type?(n.raw+=s.raw,n.text+=s.text):t.push(s)}else if(e){const t="Infinite loop on byte: "+e.charCodeAt(0);if(this.options.silent){console.error(t);break}throw new Error(t)}}return t}}class ie{options;parser;constructor(t){this.options=t||e.defaults}space(e){return""}code({text:e,lang:t,escaped:n}){const s=(t||"").match(i.notSpaceStart)?.[0],r=e.replace(i.endingNewline,"")+"\n";return s?'<pre><code class="language-'+W(s)+'">'+(n?r:W(r,!0))+"</code></pre>\n":"<pre><code>"+(n?r:W(r,!0))+"</code></pre>\n"}blockquote({tokens:e}){return`<blockquote>\n${this.parser.parse(e)}</blockquote>\n`}html({text:e}){return e}heading({tokens:e,depth:t}){return`<h${t}>${this.parser.parseInline(e)}</h${t}>\n`}hr(e){return"<hr>\n"}list(e){const t=e.ordered,n=e.start;let s="";for(let t=0;t<e.items.length;t++){const n=e.items[t];s+=this.listitem(n)}const r=t?"ol":"ul";return"<"+r+(t&&1!==n?' start="'+n+'"':"")+">\n"+s+"</"+r+">\n"}listitem(e){let t="";if(e.task){const n=this.checkbox({checked:!!e.checked});e.loose?"paragraph"===e.tokens[0]?.type?(e.tokens[0].text=n+" "+e.tokens[0].text,e.tokens[0].tokens&&e.tokens[0].tokens.length>0&&"text"===e.tokens[0].tokens[0].type&&(e.tokens[0].tokens[0].text=n+" "+W(e.tokens[0].tokens[0].text),e.tokens[0].tokens[0].escaped=!0)):e.tokens.unshift({type:"text",raw:n+" ",text:n+" ",escaped:!0}):t+=n+" "}return t+=this.parser.parse(e.tokens,!!e.loose),`<li>${t}</li>\n`}checkbox({checked:e}){return"<input "+(e?'checked="" ':"")+'disabled="" type="checkbox">'}paragraph({tokens:e}){return`<p>${this.parser.parseInline(e)}</p>\n`}table(e){let t="",n="";for(let t=0;t<e.header.length;t++)n+=this.tablecell(e.header[t]);t+=this.tablerow({text:n});let s="";for(let t=0;t<e.rows.length;t++){const r=e.rows[t];n="";for(let e=0;e<r.length;e++)n+=this.tablecell(r[e]);s+=this.tablerow({text:n})}return s&&(s=`<tbody>${s}</tbody>`),"<table>\n<thead>\n"+t+"</thead>\n"+s+"</table>\n"}tablerow({text:e}){return`<tr>\n${e}</tr>\n`}tablecell(e){const t=this.parser.parseInline(e.tokens),n=e.header?"th":"td";return(e.align?`<${n} align="${e.align}">`:`<${n}>`)+t+`</${n}>\n`}strong({tokens:e}){return`<strong>${this.parser.parseInline(e)}</strong>`}em({tokens:e}){return`<em>${this.parser.parseInline(e)}</em>`}codespan({text:e}){return`<code>${W(e,!0)}</code>`}br(e){return"<br>"}del({tokens:e}){return`<del>${this.parser.parseInline(e)}</del>`}link({href:e,title:t,tokens:n}){const s=this.parser.parseInline(n),r=Y(e);if(null===r)return s;let i='<a href="'+(e=r)+'"';return t&&(i+=' title="'+W(t)+'"'),i+=">"+s+"</a>",i}image({href:e,title:t,text:n}){const s=Y(e);if(null===s)return W(n);let r=`<img src="${e=s}" alt="${n}"`;return t&&(r+=` title="${W(t)}"`),r+=">",r}text(e){return"tokens"in e&&e.tokens?this.parser.parseInline(e.tokens):"escaped"in e&&e.escaped?e.text:W(e.text)}}class le{strong({text:e}){return e}em({text:e}){return e}codespan({text:e}){return e}del({text:e}){return e}html({text:e}){return e}text({text:e}){return e}link({text:e}){return""+e}image({text:e}){return""+e}br(){return""}}class oe{options;renderer;textRenderer;constructor(t){this.options=t||e.defaults,this.options.renderer=this.options.renderer||new ie,this.renderer=this.options.renderer,this.renderer.options=this.options,this.renderer.parser=this,this.textRenderer=new le}static parse(e,t){return new oe(t).parse(e)}static parseInline(e,t){return new oe(t).parseInline(e)}parse(e,t=!0){let n="";for(let s=0;s<e.length;s++){const r=e[s];if(this.options.extensions?.renderers?.[r.type]){const e=r,t=this.options.extensions.renderers[e.type].call({parser:this},e);if(!1!==t||!["space","hr","heading","code","table","blockquote","list","html","paragraph","text"].includes(e.type)){n+=t||"";continue}}const i=r;switch(i.type){case"space":n+=this.renderer.space(i);continue;case"hr":n+=this.renderer.hr(i);continue;case"heading":n+=this.renderer.heading(i);continue;case"code":n+=this.renderer.code(i);continue;case"table":n+=this.renderer.table(i);continue;case"blockquote":n+=this.renderer.blockquote(i);continue;case"list":n+=this.renderer.list(i);continue;case"html":n+=this.renderer.html(i);continue;case"paragraph":n+=this.renderer.paragraph(i);continue;case"text":{let r=i,l=this.renderer.text(r);for(;s+1<e.length&&"text"===e[s+1].type;)r=e[++s],l+="\n"+this.renderer.text(r);n+=t?this.renderer.paragraph({type:"paragraph",raw:l,text:l,tokens:[{type:"text",raw:l,text:l,escaped:!0}]}):l;continue}default:{const e='Token with "'+i.type+'" type was not found.';if(this.options.silent)return console.error(e),"";throw new Error(e)}}}return n}parseInline(e,t=this.renderer){let n="";for(let s=0;s<e.length;s++){const r=e[s];if(this.options.extensions?.renderers?.[r.type]){const e=this.options.extensions.renderers[r.type].call({parser:this},r);if(!1!==e||!["escape","html","link","image","strong","em","codespan","br","del","text"].includes(r.type)){n+=e||"";continue}}const i=r;switch(i.type){case"escape":case"text":n+=t.text(i);break;case"html":n+=t.html(i);break;case"link":n+=t.link(i);break;case"image":n+=t.image(i);break;case"strong":n+=t.strong(i);break;case"em":n+=t.em(i);break;case"codespan":n+=t.codespan(i);break;case"br":n+=t.br(i);break;case"del":n+=t.del(i);break;default:{const e='Token with "'+i.type+'" type was not found.';if(this.options.silent)return console.error(e),"";throw new Error(e)}}}return n}}class ae{options;block;constructor(t){this.options=t||e.defaults}static passThroughHooks=new Set(["preprocess","postprocess","processAllTokens"]);preprocess(e){return e}postprocess(e){return e}processAllTokens(e){return e}provideLexer(){return this.block?re.lex:re.lexInline}provideParser(){return this.block?oe.parse:oe.parseInline}}class ce{defaults={async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null};options=this.setOptions;parse=this.parseMarkdown(!0);parseInline=this.parseMarkdown(!1);Parser=oe;Renderer=ie;TextRenderer=le;Lexer=re;Tokenizer=se;Hooks=ae;constructor(...e){this.use(...e)}walkTokens(e,t){let n=[];for(const s of e)switch(n=n.concat(t.call(this,s)),s.type){case"table":{const e=s;for(const s of e.header)n=n.concat(this.walkTokens(s.tokens,t));for(const s of e.rows)for(const e of s)n=n.concat(this.walkTokens(e.tokens,t));break}case"list":{const e=s;n=n.concat(this.walkTokens(e.items,t));break}default:{const e=s;this.defaults.extensions?.childTokens?.[e.type]?this.defaults.extensions.childTokens[e.type].forEach((s=>{const r=e[s].flat(1/0);n=n.concat(this.walkTokens(r,t))})):e.tokens&&(n=n.concat(this.walkTokens(e.tokens,t)))}}return n}use(...e){const t=this.defaults.extensions||{renderers:{},childTokens:{}};return e.forEach((e=>{const n={...e};if(n.async=this.defaults.async||n.async||!1,e.extensions&&(e.extensions.forEach((e=>{if(!e.name)throw new Error("extension name required");if("renderer"in e){const n=t.renderers[e.name];t.renderers[e.name]=n?function(...t){let s=e.renderer.apply(this,t);return!1===s&&(s=n.apply(this,t)),s}:e.renderer}if("tokenizer"in e){if(!e.level||"block"!==e.level&&"inline"!==e.level)throw new Error("extension level must be 'block' or 'inline'");const n=t[e.level];n?n.unshift(e.tokenizer):t[e.level]=[e.tokenizer],e.start&&("block"===e.level?t.startBlock?t.startBlock.push(e.start):t.startBlock=[e.start]:"inline"===e.level&&(t.startInline?t.startInline.push(e.start):t.startInline=[e.start]))}"childTokens"in e&&e.childTokens&&(t.childTokens[e.name]=e.childTokens)})),n.extensions=t),e.renderer){const t=this.defaults.renderer||new ie(this.defaults);for(const n in e.renderer){if(!(n in t))throw new Error(`renderer '${n}' does not exist`);if(["options","parser"].includes(n))continue;const s=n,r=e.renderer[s],i=t[s];t[s]=(...e)=>{let n=r.apply(t,e);return!1===n&&(n=i.apply(t,e)),n||""}}n.renderer=t}if(e.tokenizer){const t=this.defaults.tokenizer||new se(this.defaults);for(const n in e.tokenizer){if(!(n in t))throw new Error(`tokenizer '${n}' does not exist`);if(["options","rules","lexer"].includes(n))continue;const s=n,r=e.tokenizer[s],i=t[s];t[s]=(...e)=>{let n=r.apply(t,e);return!1===n&&(n=i.apply(t,e)),n}}n.tokenizer=t}if(e.hooks){const t=this.defaults.hooks||new ae;for(const n in e.hooks){if(!(n in t))throw new Error(`hook '${n}' does not exist`);if(["options","block"].includes(n))continue;const s=n,r=e.hooks[s],i=t[s];ae.passThroughHooks.has(n)?t[s]=e=>{if(this.defaults.async)return Promise.resolve(r.call(t,e)).then((e=>i.call(t,e)));const n=r.call(t,e);return i.call(t,n)}:t[s]=(...e)=>{let n=r.apply(t,e);return!1===n&&(n=i.apply(t,e)),n}}n.hooks=t}if(e.walkTokens){const t=this.defaults.walkTokens,s=e.walkTokens;n.walkTokens=function(e){let n=[];return n.push(s.call(this,e)),t&&(n=n.concat(t.call(this,e))),n}}this.defaults={...this.defaults,...n}})),this}setOptions(e){return this.defaults={...this.defaults,...e},this}lexer(e,t){return re.lex(e,t??this.defaults)}parser(e,t){return oe.parse(e,t??this.defaults)}parseMarkdown(e){return(t,n)=>{const s={...n},r={...this.defaults,...s},i=this.onError(!!r.silent,!!r.async);if(!0===this.defaults.async&&!1===s.async)return i(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));if(null==t)return i(new Error("marked(): input parameter is undefined or null"));if("string"!=typeof t)return i(new Error("marked(): input parameter is of type "+Object.prototype.toString.call(t)+", string expected"));r.hooks&&(r.hooks.options=r,r.hooks.block=e);const l=r.hooks?r.hooks.provideLexer():e?re.lex:re.lexInline,o=r.hooks?r.hooks.provideParser():e?oe.parse:oe.parseInline;if(r.async)return Promise.resolve(r.hooks?r.hooks.preprocess(t):t).then((e=>l(e,r))).then((e=>r.hooks?r.hooks.processAllTokens(e):e)).then((e=>r.walkTokens?Promise.all(this.walkTokens(e,r.walkTokens)).then((()=>e)):e)).then((e=>o(e,r))).then((e=>r.hooks?r.hooks.postprocess(e):e)).catch(i);try{r.hooks&&(t=r.hooks.preprocess(t));let e=l(t,r);r.hooks&&(e=r.hooks.processAllTokens(e)),r.walkTokens&&this.walkTokens(e,r.walkTokens);let n=o(e,r);return r.hooks&&(n=r.hooks.postprocess(n)),n}catch(e){return i(e)}}}onError(e,t){return n=>{if(n.message+="\nPlease report this to https://github.com/markedjs/marked.",e){const e="<p>An error occurred:</p><pre>"+W(n.message+"",!0)+"</pre>";return t?Promise.resolve(e):e}if(t)return Promise.reject(n);throw n}}}const he=new ce;function pe(e,t){return he.parse(e,t)}pe.options=pe.setOptions=function(e){return he.setOptions(e),pe.defaults=he.defaults,n(pe.defaults),pe},pe.getDefaults=t,pe.defaults=e.defaults,pe.use=function(...e){return he.use(...e),pe.defaults=he.defaults,n(pe.defaults),pe},pe.walkTokens=function(e,t){return he.walkTokens(e,t)},pe.parseInline=he.parseInline,pe.Parser=oe,pe.parser=oe.parse,pe.Renderer=ie,pe.TextRenderer=le,pe.Lexer=re,pe.lexer=re.lex,pe.Tokenizer=se,pe.Hooks=ae,pe.parse=pe;const ue=pe.options,ge=pe.setOptions,ke=pe.use,de=pe.walkTokens,fe=pe.parseInline,xe=pe,be=oe.parse,we=re.lex;e.Hooks=ae,e.Lexer=re,e.Marked=ce,e.Parser=oe,e.Renderer=ie,e.TextRenderer=le,e.Tokenizer=se,e.getDefaults=t,e.lexer=we,e.marked=pe,e.options=ue,e.parse=xe,e.parseInline=fe,e.parser=be,e.setOptions=ge,e.use=ke,e.walkTokens=de}));


// ---------------------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------------------

// What both converters need: the size a preview refuses past, entity decoding, and the
// span helpers. Two renderers in one plugin is deliberate — the editor asks each one which
// documents it claims, so Markdown and HTML get their own button titles while sharing every
// line of this.

// Both parsers run here, in the plugin's own context, and JavaScriptCore interprets them.
// Measured on this machine, on a 33 KB document: marked takes ~72 ms, the hand-written HTML
// parser below ~1.7 ms. That gap is why HTML has no vendored parser — and why the cap is
// set by the slower of the two, plus what the editor then does with a few thousand blocks.
// A quarter of a megabyte is about half a second of Markdown, which is the most a redraw
// may cost while somebody is typing in the other pane. There is no watchdog around a
// plugin, so the limit has to be ours.
var PREVIEW_LIMIT = 256 * 1024;

function tooLarge(text) {
    return [{ type: "heading", level: 3,
              spans: [{ text: "This document is too large to preview" }], source: 0 },
            { type: "paragraph",
              spans: [{ text: "Document Preview renders documents up to 256 KB. This one is "
                              + Math.round(text.length / 1024) + " KB, and parsing it on "
                              + "every edit would stall the editor." }],
              source: 0 }];
}

// The named entities that actually turn up in hand-written documents, plus every numeric
// one. An unknown name is left as the author wrote it rather than swallowed: `&foo;` shown
// intact is a document with an odd word in it, where an empty space is a document with
// something missing and no way to tell what.
var ENTITIES = {
    amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ",
    copy: "©", reg: "®", trade: "™", hellip: "…",
    mdash: "—", ndash: "–", minus: "−", times: "×",
    lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
    laquo: "«", raquo: "»", middot: "·", bull: "•",
    deg: "°", plusmn: "±", frac12: "½", sect: "§",
    para: "¶", dagger: "†", euro: "€", pound: "£",
    yen: "¥", cent: "¢", larr: "←", rarr: "→",
    harr: "↔", ne: "≠", le: "≤", ge: "≥", ensp: " ", emsp: " "
};

function decode(text) {
    if (text.indexOf("&") === -1) {
        return text;
    }
    return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, function (whole, body) {
        if (body.charAt(0) === "#") {
            var code = body.charAt(1) === "x" || body.charAt(1) === "X"
                ? parseInt(body.slice(2), 16)
                : parseInt(body.slice(1), 10);
            return isNaN(code) || code < 0 || code > 0x10ffff ? whole
                : String.fromCodePoint(code);
        }
        return Object.prototype.hasOwnProperty.call(ENTITIES, body) ? ENTITIES[body] : whole;
    });
}

function span(text, marks) {
    var result = { text: text };
    if (marks.bold) { result.bold = true; }
    if (marks.italic) { result.italic = true; }
    if (marks.code) { result.code = true; }
    if (marks.strike) { result.strike = true; }
    // A field left out is absent; a field set to `undefined` reads back on the host as the
    // *string* "undefined", which is how a span acquires a link to nowhere.
    if (marks.link) { result.link = marks.link; }
    return result;
}

function extend(marks, added) {
    var result = {};
    var key;
    for (key in marks) {
        if (Object.prototype.hasOwnProperty.call(marks, key)) { result[key] = marks[key]; }
    }
    for (key in added) {
        if (Object.prototype.hasOwnProperty.call(added, key)) { result[key] = added[key]; }
    }
    return result;
}

// Whether a run of spans is worth drawing as a paragraph of its own. Markup is full of
// whitespace between tags, and a paragraph made of it is a blank line the author never
// wrote.
function hasText(spans) {
    for (var i = 0; i < spans.length; i++) {
        if (/\S/.test(spans[i].text)) { return true; }
    }
    return false;
}

// ---------------------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------------------

// The Markdown converter.
//
// Linelark draws blocks, not HTML, so marked is used through its *lexer* rather than
// through `marked.parse`: the tokens are what carry the structure, and the HTML string
// would only have to be parsed a second time to get it back.

// Where each block came from in the source, which is what keeps the two views over one
// line when the button is pressed.
//
// marked normalises line endings before it lexes, so `raw` lengths count `\n` where the
// file on disk has `\r\n`; walking the original text in step is what stops every offset in
// a CRLF document from drifting one character per line further behind.
function MarkdownCursor(original) {
    this.original = original;
    this.index = 0;
    this.normalized = 0;
}

// The offset this token starts at, having moved past it. Tokens come out of the lexer in
// document order and their `raw` reconstitutes the source, so one pass is enough.
MarkdownCursor.prototype.take = function (raw) {
    var start = this.index;
    var remaining = raw ? raw.length : 0;
    while (remaining > 0 && this.index < this.original.length) {
        if (this.original.charAt(this.index) === "\r"
            && this.original.charAt(this.index + 1) === "\n") {
            this.index += 2;
        } else {
            this.index += 1;
        }
        remaining -= 1;
    }
    this.normalized += raw ? raw.length : 0;
    return start;
};

// MARK: - Inline text

// Flattens marked's inline tree into spans, carrying the marks down rather than nesting
// them: bold inside a link inside emphasis is one span with three things true of it,
// which is what the host draws and what stops arbitrarily deep nesting from being handed
// across at all.
function mdSpans(tokens, marks) {
    marks = marks || {};
    var out = [];
    if (!tokens) {
        return out;
    }
    for (var i = 0; i < tokens.length; i++) {
        var token = tokens[i];
        switch (token.type) {
        case "strong":
            out = out.concat(mdSpans(token.tokens, extend(marks, { bold: true })));
            break;
        case "em":
            out = out.concat(mdSpans(token.tokens, extend(marks, { italic: true })));
            break;
        case "del":
            out = out.concat(mdSpans(token.tokens, extend(marks, { strike: true })));
            break;
        case "link":
            out = out.concat(mdSpans(token.tokens, extend(marks, { link: token.href || "" })));
            break;
        case "codespan":
            out.push(span(decode(token.text), extend(marks, { code: true })));
            break;
        case "br":
            out.push(span("\n", marks));
            break;
        case "image":
            // No image is drawn: a preview node describes text, and a remote one would be
            // a request the plugin never asked to make. The alt text is what the author
            // wrote for exactly this case.
            out.push(span(token.text || token.href || "image",
                          extend(marks, { italic: true })));
            break;
        case "escape":
            out.push(span(token.text, marks));
            break;
        default:
            if (token.tokens && token.tokens.length) {
                out = out.concat(mdSpans(token.tokens, marks));
            } else if (typeof token.text === "string") {
                out.push(span(decode(token.text), marks));
            }
        }
    }
    return out;
}

// MARK: - Blocks

// `source` is only ever meaningful at the top level: a blockquote's children are lexed
// from text the markers have been stripped out of, so their `raw` lengths no longer
// measure anything in the file. -1 says so, and the host simply never scrolls to them —
// which is honest, where a guessed offset would quietly scroll to the wrong line.
function mdBlock(token, source) {
    switch (token.type) {
    case "space":
        return null;
    case "hr":
        return { type: "rule", source: source };
    case "heading":
        return { type: "heading", level: token.depth, spans: mdSpans(token.tokens),
                 source: source };
    case "paragraph":
        return { type: "paragraph", spans: mdSpans(token.tokens), source: source };
    case "text":
        return { type: "paragraph",
                 spans: token.tokens ? mdSpans(token.tokens) : [span(decode(token.text), {})],
                 source: source };
    case "code":
        var language = token.lang ? String(token.lang).split(/\s+/)[0] : "";
        // A ```mermaid fence is a picture in a document that happens to be
        // written as text, so it is drawn rather than shown as source. Only when
        // it can be: an unknown header, a diagram past its caps, or one that
        // parses to nothing all fall through to the code block, which is
        // readable and honest about not having been rendered.
        var drawn = renderFencedDiagram(language, token.text, source);
        if (drawn) {
            return drawn;
        }
        return { type: "code", text: token.text, language: language, source: source };
    case "blockquote":
        return { type: "quote", children: mdNested(token.tokens), source: source };
    case "list":
        return { type: "list", ordered: !!token.ordered,
                 start: typeof token.start === "number" && token.start ? token.start : 1,
                 items: mdListItems(token.items), source: source };
    case "table":
        return { type: "table", headers: mdCells(token.header),
                 rows: (token.rows || []).map(mdCells), source: source };
    case "html":
        // Comments are the one kind of HTML a Markdown document is full of and nobody
        // wants to read. The rest is shown as what it is rather than pretended to be
        // rendered, because a preview that silently drops content is worse than one that
        // admits it did not render it.
        if (/^\s*<!--/.test(token.raw)) {
            return null;
        }
        return { type: "code", text: token.raw.replace(/\s+$/, ""), language: "html",
                 source: source };
    default:
        // `def` — a link definition — and anything a later marked adds. Both are text the
        // reader is not meant to see.
        return null;
    }
}

function mdNested(tokens) {
    var out = [];
    for (var i = 0; i < (tokens || []).length; i++) {
        var node = mdBlock(tokens[i], -1);
        if (node) { out.push(node); }
    }
    return out;
}

function mdListItems(items) {
    var out = [];
    for (var i = 0; i < (items || []).length; i++) {
        var item = items[i];
        var itemSpans = [];
        var children = [];
        for (var j = 0; j < (item.tokens || []).length; j++) {
            var token = item.tokens[j];
            // The item's own line, then anything indented under it. Once a real block has
            // started, later prose belongs under it rather than back on the first line.
            if (children.length === 0 && (token.type === "text" || token.type === "paragraph")) {
                if (itemSpans.length) { itemSpans.push({ text: "\n" }); }
                itemSpans = itemSpans.concat(mdSpans(token.tokens));
            } else {
                var node = mdBlock(token, -1);
                if (node) { children.push(node); }
            }
        }
        var entry = { spans: itemSpans };
        // Only a task item has `checked` at all: a bullet with a `false` in it would draw
        // an empty checkbox against a list that never asked for one.
        if (item.task) { entry.checked = !!item.checked; }
        if (children.length) { entry.children = children; }
        out.push(entry);
    }
    return out;
}

function mdCells(row) {
    return (row || []).map(function (cell) { return mdSpans(cell.tokens); });
}

// MARK: - The Markdown preview

function renderMarkdown(text) {
    if (text.length > PREVIEW_LIMIT) {
        return tooLarge(text);
    }

    // The same normalisation marked does to `src` before lexing it, done here so the
    // cursor and the lexer are walking the same string.
    var normalized = text.indexOf("\r") === -1 ? text : text.replace(/\r\n|\r/g, "\n");
    var tokens = marked.lexer(normalized);
    var cursor = new MarkdownCursor(text);
    var nodes = [];
    for (var i = 0; i < tokens.length; i++) {
        var node = mdBlock(tokens[i], cursor.take(tokens[i].raw));
        if (node) { nodes.push(node); }
    }
    if (nodes.length === 0) {
        nodes.push({ type: "paragraph",
                     spans: [{ text: "Nothing to preview yet.", italic: true }], source: 0 });
    }
    return nodes;
}

// ---------------------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------------------

// The HTML converter.
//
// This renders a document's *structure*, not a web page: headings, prose, lists, tables,
// quotes, code and links, drawn by the editor on the editor's theme. There is no CSS, no
// images, no script and no layout, because a preview node describes text and nothing else.
// For documentation-shaped HTML that is what you want; for a styled page it is not a
// browser, and the README says so where somebody will read it.
//
// A parser is written here rather than vendored. parse5 is 100 KB of JavaScript that
// JavaScriptCore would interpret, and the subset that maps onto preview nodes at all is
// small. This one is deliberately tolerant — real files have unclosed `<p>`s, stray `</div>`s
// and attributes nobody quoted — and it never throws: an unparseable document should come
// out as less structure, not as an error where the document was.

// Elements that never have children, so a missing `/` is not an unclosed tag.
var HTML_VOID = { area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1,
                  link: 1, meta: 1, param: 1, source: 1, track: 1, wbr: 1 };

// Elements whose content is text, not markup. Scanning to the matching close tag is what
// stops a `<` inside a script from being read as the start of one.
var HTML_RAW = { script: 1, style: 1, textarea: 1, title: 1 };

// Dropped whole, content included. `head` holds nothing to read; the rest either cannot be
// drawn at all or would come out as a wall of the source that produced them.
var HTML_DROPPED = { head: 1, script: 1, style: 1, svg: 1, math: 1, noscript: 1,
                     template: 1, iframe: 1, object: 1, canvas: 1, video: 1, audio: 1,
                     map: 1, select: 1, textarea: 1, button: 1 };

// Inline by default: anything not here starts a new block.
var HTML_INLINE = { a: 1, abbr: 1, b: 1, bdi: 1, bdo: 1, big: 1, br: 1, cite: 1, code: 1,
                    data: 1, del: 1, dfn: 1, em: 1, i: 1, img: 1, ins: 1, kbd: 1, label: 1,
                    mark: 1, q: 1, s: 1, samp: 1, small: 1, span: 1, strike: 1, strong: 1,
                    sub: 1, sup: 1, time: 1, tt: 1, u: 1, var: 1, wbr: 1 };

// Containers with no meaning of their own: their children are spliced in where they stood.
var HTML_TRANSPARENT = { div: 1, section: 1, article: 1, main: 1, header: 1, footer: 1,
                         aside: 1, nav: 1, figure: 1, form: 1, fieldset: 1, details: 1,
                         body: 1, html: 1, center: 1, address: 1, hgroup: 1, picture: 1 };

// What an unclosed tag implies. `<li>` ends the `<li>` above it; a `<td>` ends the cell
// beside it. Without these a list written the way most people write one nests itself.
var HTML_IMPLIES_END = {
    p: { p: 1 }, li: { li: 1 }, tr: { tr: 1, td: 1, th: 1 },
    td: { td: 1, th: 1 }, th: { td: 1, th: 1 },
    dt: { dt: 1, dd: 1 }, dd: { dt: 1, dd: 1 },
    option: { option: 1 }, thead: { tr: 1, td: 1, th: 1 },
    tbody: { tr: 1, td: 1, th: 1 }, tfoot: { tr: 1, td: 1, th: 1 }
};

// MARK: - Parsing

// Where a tag ends, respecting quoted attribute values — `<a title="a > b">` is one tag,
// and a naive indexOf(">") cuts it in half.
function htmlTagEnd(text, from) {
    var quote = "";
    for (var i = from; i < text.length; i++) {
        var ch = text.charAt(i);
        if (quote) {
            if (ch === quote) { quote = ""; }
        } else if (ch === "\"" || ch === "'") {
            quote = ch;
        } else if (ch === ">") {
            return i;
        }
    }
    return -1;
}

var HTML_ATTR = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;

function htmlAttributes(source) {
    var attrs = {};
    var match;
    HTML_ATTR.lastIndex = 0;
    while ((match = HTML_ATTR.exec(source)) !== null) {
        var value = match[2] || "";
        if (value.charAt(0) === "\"" || value.charAt(0) === "'") {
            value = value.slice(1, -1);
        }
        // A bare attribute is its own name — `checked` means checked.
        attrs[match[1].toLowerCase()] = match[2] === undefined ? match[1] : decode(value);
    }
    return attrs;
}

// A tolerant tree. Every element keeps the offset of its `<`, which is what the preview
// scrolls to — and unlike Markdown-inside-a-blockquote, an HTML offset is exact at every
// depth, because nothing was stripped out to get there.
function parseHTML(text) {
    var root = { tag: "#root", attrs: {}, children: [], start: 0 };
    var stack = [root];
    var index = 0;

    function top() { return stack[stack.length - 1]; }

    function addText(body, start) {
        if (body) { top().children.push({ tag: "#text", text: body, start: start }); }
    }

    // Pop back to a matching open tag. A `</div>` with no `<div>` anywhere above it is a
    // stray, and unwinding the stack on it would throw away everything the document had
    // built up so far.
    function closeTag(tag) {
        for (var i = stack.length - 1; i > 0; i--) {
            if (stack[i].tag === tag) {
                stack.length = i;
                return;
            }
        }
    }

    while (index < text.length) {
        var lt = text.indexOf("<", index);
        if (lt === -1) {
            addText(text.slice(index), index);
            break;
        }
        if (lt > index) { addText(text.slice(index, lt), index); }

        if (text.substr(lt, 4) === "<!--") {
            var commentEnd = text.indexOf("-->", lt + 4);
            index = commentEnd === -1 ? text.length : commentEnd + 3;
            continue;
        }
        // A doctype, a processing instruction, or CDATA: nothing to draw either way.
        if (text.charAt(lt + 1) === "!" || text.charAt(lt + 1) === "?") {
            var declarationEnd = htmlTagEnd(text, lt + 1);
            index = declarationEnd === -1 ? text.length : declarationEnd + 1;
            continue;
        }
        var name = /^<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)/.exec(text.substr(lt, 80));
        if (!name) {
            // A `<` that is not a tag at all — a stray comparison in prose.
            addText("<", lt);
            index = lt + 1;
            continue;
        }
        var gt = htmlTagEnd(text, lt + name[0].length);
        if (gt === -1) {
            addText(text.slice(lt), lt);
            break;
        }
        var tag = name[2].toLowerCase();
        index = gt + 1;

        if (name[1] === "/") {
            closeTag(tag);
            continue;
        }

        var inner = text.slice(lt + name[0].length, gt);
        var selfClosing = inner.charAt(inner.length - 1) === "/";
        var node = { tag: tag, attrs: htmlAttributes(inner), children: [], start: lt };

        // Implied ends, then the looser rule that any block start closes an open `<p>` —
        // which is how most hand-written HTML ends its paragraphs.
        var implied = HTML_IMPLIES_END[tag];
        while (implied && stack.length > 1 && implied[top().tag]) { stack.pop(); }
        if (!HTML_INLINE[tag] && stack.length > 1 && top().tag === "p") { stack.pop(); }

        top().children.push(node);

        if (HTML_RAW[tag]) {
            // Everything to the matching close tag is text, `<` included. Searched with a
            // regex from here rather than by lowercasing the document: a page with fifty
            // `<script>`s would otherwise copy the whole file fifty times.
            var closer = new RegExp("</" + tag + "[\\s>]", "ig");
            closer.lastIndex = index;
            var found = closer.exec(text);
            var closing = found ? found.index : -1;
            var bodyEnd = closing === -1 ? text.length : closing;
            node.children.push({ tag: "#text", text: text.slice(index, bodyEnd),
                                 start: index, raw: true });
            var afterClose = closing === -1 ? -1 : htmlTagEnd(text, closing);
            index = afterClose === -1 ? text.length : afterClose + 1;
            continue;
        }
        if (!HTML_VOID[tag] && !selfClosing) { stack.push(node); }
    }
    return root;
}

// MARK: - Inline text

// Whitespace in markup is layout, not content: the newlines and indentation between tags
// would otherwise arrive as text the author never wrote.
function htmlCollapse(text) {
    return text.replace(/\s+/g, " ");
}

function htmlSpans(nodes, marks, out) {
    marks = marks || {};
    out = out || [];
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.tag === "#text") {
            out.push(span(decode(htmlCollapse(node.text)), marks));
            continue;
        }
        if (HTML_DROPPED[node.tag]) { continue; }
        switch (node.tag) {
        case "br":
            out.push(span("\n", marks));
            break;
        case "img":
            // No image is drawn: a preview node describes text, and fetching a remote one
            // would be a request the plugin never asked to make. Alt text is what the
            // author wrote for exactly this case.
            out.push(span(node.attrs.alt || node.attrs.title || "image",
                          extend(marks, { italic: true })));
            break;
        case "strong": case "b":
            htmlSpans(node.children, extend(marks, { bold: true }), out);
            break;
        case "em": case "i": case "cite": case "dfn": case "var":
            htmlSpans(node.children, extend(marks, { italic: true }), out);
            break;
        case "del": case "s": case "strike":
            htmlSpans(node.children, extend(marks, { strike: true }), out);
            break;
        case "code": case "kbd": case "samp": case "tt":
            htmlSpans(node.children, extend(marks, { code: true }), out);
            break;
        case "a":
            htmlSpans(node.children, node.attrs.href
                ? extend(marks, { link: node.attrs.href }) : marks, out);
            break;
        default:
            htmlSpans(node.children, marks, out);
        }
    }
    return out;
}

// The text of an element as written, entities decoded but nothing collapsed — for `<pre>`,
// where every space was put there on purpose.
function htmlRawText(nodes, parts) {
    parts = parts || [];
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].tag === "#text") {
            parts.push(decode(nodes[i].text));
        } else if (nodes[i].tag === "br") {
            parts.push("\n");
        } else if (!HTML_DROPPED[nodes[i].tag]) {
            htmlRawText(nodes[i].children, parts);
        }
    }
    return parts;
}

// `class="language-swift"`, on the `<pre>` or on the `<code>` inside it — the convention
// every highlighter and every static site generator writes.
function htmlLanguage(node) {
    var classes = node.attrs["class"] || "";
    var match = /(?:language|lang|highlight)-([\w+#.-]+)/.exec(classes);
    if (match) { return match[1]; }
    for (var i = 0; i < node.children.length; i++) {
        if (node.children[i].tag === "code") { return htmlLanguage(node.children[i]); }
    }
    return "";
}

// MARK: - Blocks

function htmlElements(nodes, tags) {
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].tag !== "#text" && tags[nodes[i].tag]) { out.push(nodes[i]); }
    }
    return out;
}

// Rows of a table wherever they sit — `<tr>` is usually inside a `<thead>` or `<tbody>`,
// and quite often inside neither.
function htmlRows(node, out) {
    out = out || [];
    for (var i = 0; i < node.children.length; i++) {
        var child = node.children[i];
        if (child.tag === "tr") {
            out.push(child);
        } else if (child.tag === "thead" || child.tag === "tbody" || child.tag === "tfoot") {
            htmlRows(child, out);
        }
    }
    return out;
}

function htmlCells(row) {
    return htmlElements(row.children, { td: 1, th: 1 }).map(function (cell) {
        return htmlSpans(cell.children);
    });
}

function htmlListItems(node, depth) {
    return htmlElements(node.children, { li: 1 }).map(function (item) {
        var inline = [];
        var children = [];
        var checked;
        for (var i = 0; i < item.children.length; i++) {
            var child = item.children[i];
            // `<li><input type=checkbox>` is how every task list on the web is written, and
            // the box belongs to the item rather than in its text.
            if (child.tag === "input"
                && (child.attrs.type || "").toLowerCase() === "checkbox") {
                checked = Object.prototype.hasOwnProperty.call(child.attrs, "checked");
                continue;
            }
            if (child.tag === "#text" || HTML_INLINE[child.tag]) {
                htmlSpans([child], {}, inline);
            } else {
                children = children.concat(htmlBlocks([child], depth + 1));
            }
        }
        var entry = { spans: htmlTrim(inline) };
        // Only a task item has `checked` at all: a `false` on an ordinary bullet would draw
        // an empty checkbox against a list that never asked for one.
        if (checked !== undefined) { entry.checked = checked; }
        if (children.length) { entry.children = children; }
        return entry;
    });
}

// Markup indents, so the first and last spans of a block are usually padding.
function htmlTrim(spans) {
    var out = spans.slice();
    while (out.length && !/\S/.test(out[0].text)) { out.shift(); }
    while (out.length && !/\S/.test(out[out.length - 1].text)) { out.pop(); }
    if (out.length) {
        out[0] = extend(out[0], { text: out[0].text.replace(/^\s+/, "") });
        var last = out.length - 1;
        out[last] = extend(out[last], { text: out[last].text.replace(/\s+$/, "") });
    }
    return out;
}

// The depth cap is the host's — a description nested past it is cut off there anyway, and
// stopping here means the work is never done twice.
var HTML_MAX_DEPTH = 8;

function htmlBlocks(nodes, depth) {
    var out = [];
    var pending = [];
    var pendingStart = -1;

    // Loose inline content between blocks is a paragraph. Flushing on every block start is
    // what keeps `<div>text<h2>…` from losing the text in front of the heading.
    function flush() {
        if (hasText(pending)) {
            out.push({ type: "paragraph", spans: htmlTrim(pending), source: pendingStart });
        }
        pending = [];
        pendingStart = -1;
    }

    if (depth > HTML_MAX_DEPTH) { return out; }

    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.tag === "#text") {
            if (/\S/.test(node.text) || pending.length) {
                if (pendingStart === -1) { pendingStart = node.start; }
                pending.push(span(decode(htmlCollapse(node.text)), {}));
            }
            continue;
        }
        if (HTML_DROPPED[node.tag]) { continue; }
        if (HTML_INLINE[node.tag]) {
            if (pendingStart === -1) { pendingStart = node.start; }
            htmlSpans([node], {}, pending);
            continue;
        }

        flush();
        if (HTML_TRANSPARENT[node.tag]) {
            out = out.concat(htmlBlocks(node.children, depth + 1));
            continue;
        }
        switch (node.tag) {
        case "h1": case "h2": case "h3": case "h4": case "h5": case "h6":
            out.push({ type: "heading", level: parseInt(node.tag.charAt(1), 10),
                       spans: htmlTrim(htmlSpans(node.children)), source: node.start });
            break;
        case "p":
            var paragraph = htmlTrim(htmlSpans(node.children));
            if (hasText(paragraph)) {
                out.push({ type: "paragraph", spans: paragraph, source: node.start });
            }
            break;
        case "pre":
            out.push({ type: "code",
                       text: htmlRawText(node.children).join("").replace(/^\n/, "")
                           .replace(/\s+$/, ""),
                       language: htmlLanguage(node), source: node.start });
            break;
        case "blockquote":
            out.push({ type: "quote", children: htmlBlocks(node.children, depth + 1),
                       source: node.start });
            break;
        case "ul": case "ol":
            var items = htmlListItems(node, depth);
            if (items.length) {
                out.push({ type: "list", ordered: node.tag === "ol",
                           start: parseInt(node.attrs.start, 10) || 1,
                           items: items, source: node.start });
            }
            break;
        case "dl":
            // A definition list has no node type of its own. The term reads as a heading
            // for what follows it, which is what the indent under it says too.
            for (var j = 0; j < node.children.length; j++) {
                var entry = node.children[j];
                if (entry.tag === "dt") {
                    out.push({ type: "paragraph",
                               spans: htmlTrim(htmlSpans(entry.children, { bold: true })),
                               source: entry.start });
                } else if (entry.tag === "dd") {
                    out.push({ type: "quote",
                               children: htmlBlocks(entry.children, depth + 1),
                               source: entry.start });
                }
            }
            break;
        case "table":
            var rows = htmlRows(node);
            var headers = [];
            if (rows.length && htmlElements(rows[0].children, { th: 1 }).length) {
                headers = htmlCells(rows.shift());
            }
            if (headers.length || rows.length) {
                out.push({ type: "table", headers: headers, rows: rows.map(htmlCells),
                           source: node.start });
            }
            break;
        case "hr":
            out.push({ type: "rule", source: node.start });
            break;
        case "figcaption":
            out = out.concat(htmlBlocks(node.children, depth + 1));
            break;
        default:
            // Anything this version has never heard of is a box around its content — which
            // is what an unknown element usually is, and losing the content would be the
            // one unrecoverable mistake.
            out = out.concat(htmlBlocks(node.children, depth + 1));
        }
    }
    flush();
    return out;
}

// MARK: - The HTML preview

function renderHTML(text) {
    if (text.length > PREVIEW_LIMIT) {
        return tooLarge(text);
    }
    var nodes = htmlBlocks(parseHTML(text).children, 0);
    if (nodes.length === 0) {
        nodes.push({ type: "paragraph",
                     spans: [{ text: "Nothing to preview yet.", italic: true }], source: 0 });
    }
    return nodes;
}

// ---------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------
//
// Two previews, not one with both extension lists: the title is what the toolbar button
// says, so a `.md` file offers "Preview as Markdown" and a `.html` file "Preview as HTML".
// Which documents each claims is declared rather than asked — the toolbar reads it on every
// redraw, and running a plugin's JavaScript there would run it on every keystroke.

// ---------------------------------------------------------------------------
// Diagrams
//
// A subset of Mermaid, parsed and *laid out* here. Linelark draws boxes, lines,
// polygons and labels in a coordinate space of our choosing and knows nothing
// about what any of it means — there is no `class`, no `lifeline` and no
// `association` on the other side of `linelark.addPreview`. That is what makes
// a diagram language a plugin release rather than an editor release, and it is
// the only shape this could take: the editor draws every pixel of a preview on
// purpose, so there is no WebView to hand an SVG to and no image to fetch.
//
// The price is that positioning is ours, including the part that needs a font.
// `linelark.measureText` answers with the same NSFont the editor will paint
// with, which is the whole reason a box ends up the size of the words in it.
// ---------------------------------------------------------------------------

// A diagram is laid out on every keystroke that settles, in an interpreter with
// no JIT, so it is capped by what it would cost rather than by what is
// reasonable to draw. Past any of these the source is shown as a code block:
// unrendered and readable beats half-rendered and wrong.
var DIAGRAM_MAX_LINES = 1200;
var DIAGRAM_MAX_NODES = 240;
var DIAGRAM_MAX_EDGES = 480;

// Spacing, in points, in the diagram's own space.
var NODE_PAD_X = 14;
var NODE_PAD_Y = 9;
var MIN_NODE_WIDTH = 46;
var RANK_GAP = 52;
var SIBLING_GAP = 26;
var FIGURE_MARGIN = 12;
var LABEL_SIZE = 13;
var SMALL_LABEL_SIZE = 11;

// Every call crosses into Swift, and a class diagram measures every member of
// every class — with the same words recurring all over a real document. The
// cache is rebuilt per render, so it can never answer with a stale font size.
function Measurer() {
    this.cache = {};
}

Measurer.prototype.size = function (text, size, bold, mono) {
    var key = size + (bold ? "b" : "-") + (mono ? "m" : "-") + " " + text;
    var hit = this.cache[key];
    if (hit) {
        return hit;
    }
    var measured = linelark.measureText(text, { size: size, bold: !!bold, mono: !!mono });
    // A host that answered with nothing would otherwise lay every box on top of
    // every other, which reads as a broken editor rather than a missing call.
    var answer = {
        width: measured && measured.width > 0 ? measured.width : text.length * size * 0.6,
        height: measured && measured.height > 0 ? measured.height : size * 1.35
    };
    this.cache[key] = answer;
    return answer;
};

// Collects shapes in the order they are painted. Order is the only z-ordering
// there is, so edges go in before nodes and labels go in last.
function Figure() {
    this.shapes = [];
}

Figure.prototype.box = function (x, y, width, height, options) {
    options = options || {};
    this.shapes.push({
        type: options.ellipse ? "ellipse" : "box",
        x: x, y: y, width: width, height: height,
        radius: options.radius || 0,
        fill: options.fill || "surface",
        stroke: options.stroke || "border",
        strokeWidth: options.strokeWidth || 1,
        dashed: !!options.dashed
    });
};

Figure.prototype.line = function (points, options) {
    options = options || {};
    this.shapes.push({
        type: "line", points: points,
        stroke: options.stroke || "border",
        strokeWidth: options.strokeWidth || 1,
        dashed: !!options.dashed,
        arrowStart: !!options.arrowStart,
        arrowEnd: !!options.arrowEnd,
        closed: !!options.closed,
        fill: options.fill || "none"
    });
};

Figure.prototype.label = function (text, x, y, options) {
    options = options || {};
    this.shapes.push({
        type: "label", text: text, x: x, y: y,
        size: options.size || LABEL_SIZE,
        align: options.align === "left" ? "leading" : options.align === "right" ? "trailing" : (options.align || "center"),
        baseline: options.baseline || "middle",
        bold: !!options.bold,
        italic: !!options.italic,
        mono: !!options.mono,
        ink: options.ink || "foreground"
    });
};

// A label sitting on an edge, with a patch of page under it so the line does
// not run through the words. Deliberately not a bordered box: that reads as
// another node, which is exactly what an edge label is not.
Figure.prototype.edgeLabel = function (measurer, text, x, y) {
    var size = measurer.size(text, SMALL_LABEL_SIZE, false, false);
    this.box(x - size.width / 2 - 3, y - size.height / 2 - 1,
             size.width + 6, size.height + 2,
             { fill: "background", stroke: "none" });
    this.label(text, x, y, { size: SMALL_LABEL_SIZE, ink: "secondary" });
};

// What render() hands back for one diagram, or null when there is nothing to
// draw. The margin is added here rather than by every layout in turn.
Figure.prototype.figure = function (width, height, label, source) {
    if (!this.shapes.length || !(width > 0) || !(height > 0)) {
        return null;
    }
    var shifted = this.shapes.map(function (shape) {
        return shiftShape(shape, FIGURE_MARGIN, FIGURE_MARGIN);
    });
    return {
        type: "figure", source: source,
        width: width + FIGURE_MARGIN * 2, height: height + FIGURE_MARGIN * 2,
        label: label, shapes: shifted
    };
};

function shiftShape(shape, dx, dy) {
    if (shape.type === "line") {
        shape.points = shape.points.map(function (point) {
            return { x: point.x + dx, y: point.y + dy };
        });
        return shape;
    }
    shape.x += dx;
    shape.y += dy;
    return shape;
}

// The lines of a diagram, with what nobody is meant to read taken out: Mermaid
// comments, blank lines, and the trailing semicolons its grammar allows.
function diagramLines(source) {
    var lines = [];
    var raw = String(source).split(/\r\n|\r|\n/);
    for (var i = 0; i < raw.length && lines.length <= DIAGRAM_MAX_LINES; i++) {
        var line = raw[i].replace(/%%.*$/, "").replace(/;\s*$/, "").trim();
        if (line) {
            lines.push(line);
        }
    }
    return lines;
}

// Quoted or bare, with the escapes Mermaid actually uses turned back into what
// they stand for. `<br>` is the common one and it is a *line break*: a label
// that keeps it as three words is a box a third too wide with a stray tag
// through the middle of it.
function diagramText(raw) {
    var text = String(raw == null ? "" : raw).trim();
    var quoted = text.match(/^"([\s\S]*)"$/);
    if (quoted) {
        text = quoted[1];
    }
    return text.replace(/<br\s*\/?>/gi, "\n")
        .replace(/#quot;/g, '"')
        .replace(/\\n/g, "\n")
        .trim();
}

// A multi-line label: as wide as its widest line and as tall as all of them.
function measureLines(measurer, text, size, bold, mono) {
    var lines = String(text).split("\n");
    var width = 0;
    var height = 0;
    for (var i = 0; i < lines.length; i++) {
        var measured = measurer.size(lines[i] || " ", size, bold, mono);
        width = Math.max(width, measured.width);
        height += measured.height;
    }
    return { width: width, height: height, lines: lines };
}

// Draws one centred on a point, since a label is a single line to the host.
function drawLines(figure, measurer, text, x, y, options) {
    options = options || {};
    var size = options.size || LABEL_SIZE;
    var measured = measureLines(measurer, text, size, options.bold, options.mono);
    var lineHeight = measured.height / measured.lines.length;
    var top = y - measured.height / 2 + lineHeight / 2;
    for (var i = 0; i < measured.lines.length; i++) {
        figure.label(measured.lines[i], x, top + i * lineHeight, options);
    }
}

// Which diagram this is. Mermaid's header is its first word, and anything that
// is not one of ours is left alone rather than half-parsed — an unknown header
// means the fence is shown as source, which is what the reader of a document
// written for a newer Mermaid should get.
function renderDiagram(source, sourceOffset) {
    var lines = diagramLines(source);
    if (!lines.length || lines.length > DIAGRAM_MAX_LINES) {
        return null;
    }
    var header = lines[0];
    var measurer = new Measurer();
    var flow = header.match(/^(?:flowchart|graph)\s+(TB|TD|BT|LR|RL)?/i);
    if (flow) {
        return layoutGraph(parseFlow(lines.slice(1)), (flow[1] || "TD").toUpperCase(),
                           measurer, sourceOffset, "Flowchart");
    }
    if (/^stateDiagram(-v2)?\b/i.test(header)) {
        return layoutGraph(parseState(lines.slice(1)), directionOf(lines, "TD"),
                           measurer, sourceOffset, "State diagram");
    }
    if (/^classDiagram(-v2)?\b/i.test(header)) {
        return layoutGraph(parseClass(lines.slice(1)), directionOf(lines, "TD"),
                           measurer, sourceOffset, "Class diagram");
    }
    if (/^sequenceDiagram\b/i.test(header)) {
        return layoutSequence(parseSequence(lines.slice(1)), measurer, sourceOffset);
    }
    return null;
}

// `direction LR` in the body, which is how state and class diagrams say it.
function directionOf(lines, fallback) {
    for (var i = 0; i < lines.length; i++) {
        var found = lines[i].match(/^direction\s+(TB|TD|BT|LR|RL)\b/i);
        if (found) {
            return found[1].toUpperCase();
        }
    }
    return fallback;
}

// A graph, before anything has been positioned. One shape for flowcharts, state
// diagrams and class diagrams, because all three are boxes joined by lines and
// only the boxes differ — which is the whole reason one layout serves them.
function Graph() {
    this.nodes = [];
    this.byID = {};
    this.edges = [];
    this.overflowed = false;
}

Graph.prototype.node = function (id, options) {
    var existing = this.byID[id];
    if (existing) {
        // A node named again with a label keeps the label: `A --> B` then
        // `B[Done]` is the ordinary way a flowchart is written.
        if (options && options.text) {
            existing.text = options.text;
            existing.shape = options.shape || existing.shape;
        }
        return existing;
    }
    if (this.nodes.length >= DIAGRAM_MAX_NODES) {
        this.overflowed = true;
        return null;
    }
    options = options || {};
    var node = {
        id: id,
        text: options.text || id,
        shape: options.shape || "rect",
        members: options.members || null,
        index: this.nodes.length
    };
    this.nodes.push(node);
    this.byID[id] = node;
    return node;
};

Graph.prototype.edge = function (from, to, options) {
    if (!from || !to) {
        return;
    }
    if (this.edges.length >= DIAGRAM_MAX_EDGES) {
        this.overflowed = true;
        return;
    }
    options = options || {};
    this.edges.push({
        from: from.id, to: to.id,
        text: options.text || "",
        dashed: !!options.dashed,
        thick: !!options.thick,
        arrowEnd: options.arrowEnd !== false,
        arrowStart: !!options.arrowStart,
        headStart: options.headStart || null,
        headEnd: options.headEnd || null
    });
};

// The bracket pairs Mermaid uses for node shapes, longest first — `[[` has to
// be tried before `[`, or a subroutine box parses as a rectangle whose label
// begins with a bracket.
var NODE_SHAPES = [
    { open: "([", close: "])", shape: "stadium" },
    { open: "[[", close: "]]", shape: "subroutine" },
    { open: "[(", close: ")]", shape: "cylinder" },
    { open: "((", close: "))", shape: "circle" },
    { open: "{{", close: "}}", shape: "hexagon" },
    { open: "[", close: "]", shape: "rect" },
    { open: "(", close: ")", shape: "rounded" },
    { open: "{", close: "}", shape: "diamond" },
    { open: ">", close: "]", shape: "flag" }
];

// The three connector families, each of which may carry its label inside itself
// (`-- yes -->`) as well as after it (`-->|yes|`). Written as one regex per
// family rather than one for all three: the families differ in what may appear
// *inside* them, and a single pattern that allowed everything would swallow a
// node id on the far side of a malformed line.
var CONNECTORS = [
    { re: /^-\.(?:([^.|]*)\.)?-+(>)?/, dashed: true },
    { re: /^==(?:([^=|]*)=)?=*(>)?/, thick: true },
    { re: /^--(?:([^->|]*)-)?-*(>)?/ }
];

// A node reference at the head of `text`: an id, and the shape and label that
// may be wrapped around it.
function readNode(text, graph) {
    var id = text.match(/^\s*([A-Za-z0-9_][\w.-]*)/);
    if (!id) {
        return null;
    }
    var rest = text.slice(id[0].length);
    for (var i = 0; i < NODE_SHAPES.length; i++) {
        var form = NODE_SHAPES[i];
        if (rest.slice(0, form.open.length) !== form.open) {
            continue;
        }
        var end = rest.indexOf(form.close, form.open.length);
        if (end < 0) {
            continue;
        }
        var label = rest.slice(form.open.length, end);
        return {
            node: graph.node(id[1], { text: diagramText(label) || id[1], shape: form.shape }),
            rest: rest.slice(end + form.close.length)
        };
    }
    return { node: graph.node(id[1], {}), rest: rest };
}

function readConnector(text) {
    var trimmed = text.replace(/^\s+/, "");
    for (var i = 0; i < CONNECTORS.length; i++) {
        var found = trimmed.match(CONNECTORS[i].re);
        if (!found) {
            continue;
        }
        var rest = trimmed.slice(found[0].length);
        var label = found[1] ? diagramText(found[1]) : "";
        // `-->|yes|`, the other half of Mermaid's two ways of saying the same
        // thing. Read here so the caller never has to know which was used.
        var piped = rest.match(/^\s*\|([^|]*)\|/);
        if (piped) {
            label = diagramText(piped[1]);
            rest = rest.slice(piped[0].length);
        }
        return {
            text: label,
            dashed: !!CONNECTORS[i].dashed,
            thick: !!CONNECTORS[i].thick,
            arrowEnd: !!found[2],
            rest: rest
        };
    }
    return null;
}

// `flowchart TD` and `graph LR`.
//
// A chain — `A --> B --> C` — is read a link at a time rather than split on the
// connector, because a label may contain one: `A -- a --> b --> B` is two
// links, and splitting on `-->` would make it three nodes and lose the label.
function parseFlow(lines) {
    var graph = new Graph();
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        // Styling, interaction and grouping. Ignored rather than refused: a
        // diagram that uses them should still draw, minus the colours we would
        // not honour anyway — the editor's theme decides those.
        if (/^(subgraph|end|style|classDef|class\s|click|linkStyle|direction)\b/i.test(line)) {
            continue;
        }
        var left = readNode(line, graph);
        if (!left || !left.node) {
            continue;
        }
        var rest = left.rest;
        var from = left.node;
        for (;;) {
            var link = readConnector(rest);
            if (!link) {
                break;
            }
            var right = readNode(link.rest, graph);
            if (!right || !right.node) {
                break;
            }
            graph.edge(from, right.node, link);
            from = right.node;
            rest = right.rest;
        }
    }
    return graph;
}

// `stateDiagram-v2`. The same shape of language as a flowchart with a smaller
// vocabulary, so it reuses the connector reader and differs in two things: the
// label comes after a colon rather than inside the arrow, and `[*]` is the
// start or end marker, which is drawn as a filled dot rather than as a box.
function parseState(lines) {
    var graph = new Graph();
    var terminals = 0;
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (/^(state\s|note\b|direction\b|classDef\b|class\s|\}|--)/i.test(line)) {
            continue;
        }
        // `Still : the label`, which names a state rather than joining two.
        var named = line.match(/^([A-Za-z0-9_][\w.-]*)\s*:\s*(.+)$/);
        if (named && !/-{2,}>|-{2,}/.test(line)) {
            graph.node(named[1], { text: diagramText(named[2]), shape: "rounded" });
            continue;
        }
        var parts = line.split(/\s*-{2,}>\s*/);
        if (parts.length < 2) {
            continue;
        }
        // The transition's own label, which is everything after the last colon.
        var label = "";
        var tail = parts[parts.length - 1].match(/^([^:]*):\s*(.*)$/);
        if (tail) {
            parts[parts.length - 1] = tail[1];
            label = diagramText(tail[2]);
        }
        var previous = null;
        for (var p = 0; p < parts.length; p++) {
            var name = parts[p].trim();
            if (!name) {
                continue;
            }
            var node;
            if (name === "[*]") {
                // Each `[*]` is its own node: one shared start-and-end state
                // would join the beginning of the diagram to its end with an
                // edge nobody wrote.
                node = graph.node("__terminal" + (terminals++), { text: "", shape: "terminal" });
            } else {
                node = graph.node(name, { text: name, shape: "rounded" });
            }
            if (previous) {
                graph.edge(previous, node, { text: p === parts.length - 1 ? label : "" });
            }
            previous = node;
        }
    }
    return graph;
}

// The ends UML puts on a relationship, and what each is drawn as. `head` is the
// shape at the arrow end; `line` says whether the connector itself is dashed.
var CLASS_RELATIONS = [
    { op: "<|..", head: "hollowTriangle", at: "from", dashed: true },
    { op: "..|>", head: "hollowTriangle", at: "to", dashed: true },
    { op: "<|--", head: "hollowTriangle", at: "from" },
    { op: "--|>", head: "hollowTriangle", at: "to" },
    { op: "*--", head: "filledDiamond", at: "from" },
    { op: "--*", head: "filledDiamond", at: "to" },
    { op: "o--", head: "hollowDiamond", at: "from" },
    { op: "--o", head: "hollowDiamond", at: "to" },
    { op: "<--", head: "arrow", at: "from" },
    { op: "-->", head: "arrow", at: "to" },
    { op: "<..", head: "arrow", at: "from", dashed: true },
    { op: "..>", head: "arrow", at: "to", dashed: true },
    { op: "--", head: null, at: null },
    { op: "..", head: null, at: null, dashed: true }
];

// `classDiagram`.
//
// Two statements matter: what a class contains, and how two classes are
// related. Members arrive either inside braces or one at a time as
// `Animal : +String name`, and both forms are common enough in real documents
// that supporting only one would look broken.
function parseClass(lines) {
    var graph = new Graph();
    var open = null;
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (open) {
            if (/^\}/.test(line)) {
                open = null;
            } else {
                addMember(open, line);
            }
            continue;
        }
        if (/^(direction|note|classDef|click|style|cssClass)\b/i.test(line)) {
            continue;
        }
        var declared = line.match(/^class\s+([A-Za-z0-9_][\w.~-]*)\s*(?:\[[^\]]*\])?\s*(\{)?/i);
        if (declared) {
            var node = graph.node(declared[1], { text: declared[1], shape: "class" });
            if (node && !node.members) {
                node.members = [];
            }
            if (declared[2] && node) {
                open = node;
            }
            continue;
        }
        var relation = readClassRelation(line, graph);
        if (relation) {
            continue;
        }
        // `Animal : +String name`
        var member = line.match(/^([A-Za-z0-9_][\w.~-]*)\s*:\s*(.+)$/);
        if (member) {
            var owner = graph.node(member[1], { text: member[1], shape: "class" });
            addMember(owner, member[2]);
        }
    }
    return graph;
}

function addMember(node, text) {
    if (!node) {
        return;
    }
    var member = diagramText(text);
    if (!member) {
        return;
    }
    if (!node.members) {
        node.members = [];
    }
    // A dozen members is a diagram; eighty is a document, and one class as tall
    // as the whole preview tells the reader nothing.
    if (node.members.length < 40) {
        node.members.push(member);
    }
}

function readClassRelation(line, graph) {
    for (var i = 0; i < CLASS_RELATIONS.length; i++) {
        var relation = CLASS_RELATIONS[i];
        var at = line.indexOf(relation.op);
        if (at <= 0) {
            continue;
        }
        var left = line.slice(0, at);
        var right = line.slice(at + relation.op.length);
        // The label, and the cardinalities Mermaid puts in quotes either side of
        // the operator. The quotes are dropped rather than drawn: they are the
        // syntax, not the multiplicity.
        var label = "";
        var tail = right.match(/^([^:]*):\s*(.*)$/);
        if (tail) {
            right = tail[1];
            label = diagramText(tail[2]);
        }
        var fromID = (left.replace(/"[^"]*"/g, "").trim().match(/([A-Za-z0-9_][\w.~-]*)\s*$/) || [])[1];
        var toID = (right.replace(/"[^"]*"/g, "").trim().match(/^([A-Za-z0-9_][\w.~-]*)/) || [])[1];
        if (!fromID || !toID) {
            continue;
        }
        var from = graph.node(fromID, { text: fromID, shape: "class" });
        var to = graph.node(toID, { text: toID, shape: "class" });
        graph.edge(from, to, {
            text: label,
            dashed: !!relation.dashed,
            arrowEnd: false,
            headStart: relation.at === "from" ? relation.head : null,
            headEnd: relation.at === "to" ? relation.head : null
        });
        return true;
    }
    return null;
}

// How big each node has to be to hold what is written in it.
function sizeNodes(graph, measurer) {
    for (var i = 0; i < graph.nodes.length; i++) {
        var node = graph.nodes[i];
        if (node.virtual) {
            continue;
        }
        if (node.shape === "terminal") {
            node.width = 18;
            node.height = 18;
            continue;
        }
        if (node.shape === "class") {
            sizeClassNode(node, measurer);
            continue;
        }
        var text = measureLines(measurer, node.text, LABEL_SIZE, false, false);
        node.width = Math.max(MIN_NODE_WIDTH, text.width + NODE_PAD_X * 2);
        node.height = text.height + NODE_PAD_Y * 2;
        if (node.shape === "diamond") {
            // A diamond only touches its label at the middle of each edge, so a
            // box-sized one crosses the words at the corners. Widening it is
            // what every diagramming tool does and it is cheaper than clipping
            // the text to the rhombus.
            node.width = node.width * 1.45;
            node.height = node.height * 1.7;
        } else if (node.shape === "circle") {
            var diameter = Math.max(node.width, node.height + NODE_PAD_Y * 2);
            node.width = diameter;
            node.height = diameter;
        }
    }
}

function sizeClassNode(node, measurer) {
    var title = measurer.size(node.text, LABEL_SIZE, true, false);
    var width = title.width;
    var height = title.height + NODE_PAD_Y * 2;
    if (node.stereotype) {
        var mark = measurer.size(node.stereotype, SMALL_LABEL_SIZE, false, false);
        width = Math.max(width, mark.width);
        height += mark.height;
        node.stereotypeHeight = mark.height;
    }
    var members = node.members || [];
    node.rows = [];
    for (var i = 0; i < members.length; i++) {
        var row = measurer.size(members[i], SMALL_LABEL_SIZE, false, true);
        width = Math.max(width, row.width);
        node.rows.push({ text: members[i], height: row.height + 4 });
        height += row.height + 4;
    }
    if (members.length) {
        height += NODE_PAD_Y;
    }
    node.width = Math.max(MIN_NODE_WIDTH + 40, width + NODE_PAD_X * 2);
    node.height = height;
    node.titleHeight = title.height + NODE_PAD_Y * 2 + (node.stereotypeHeight || 0);
}

// Which row (or column) each node belongs in.
//
// Longest-path layering over the edges, walked depth-first with the nodes
// currently on the stack tracked: a cycle is normal in a state diagram and in
// plenty of flowcharts, and an edge that closes one is simply not allowed to
// push its target down a rank. Without that check the walk does not terminate,
// which in a preview is the whole editor stopping on a keystroke.
function rankNodes(graph) {
    var outgoing = {};
    for (var i = 0; i < graph.edges.length; i++) {
        var edge = graph.edges[i];
        (outgoing[edge.from] = outgoing[edge.from] || []).push(edge.to);
    }
    var rank = {};
    var onStack = {};
    var settled = {};

    function visit(id, depth) {
        if (onStack[id]) {
            return;
        }
        if (settled[id] && rank[id] >= depth) {
            return;
        }
        rank[id] = Math.max(rank[id] || 0, depth);
        settled[id] = true;
        onStack[id] = true;
        var next = outgoing[id] || [];
        for (var n = 0; n < next.length; n++) {
            visit(next[n], rank[id] + 1);
        }
        onStack[id] = false;
    }

    // Sources first, so the ordinary diagram reads from its beginning; anything
    // left over is in a cycle with no way in, and starts a rank of its own.
    var hasIncoming = {};
    for (var e = 0; e < graph.edges.length; e++) {
        hasIncoming[graph.edges[e].to] = true;
    }
    for (var s = 0; s < graph.nodes.length; s++) {
        if (!hasIncoming[graph.nodes[s].id]) {
            visit(graph.nodes[s].id, 0);
        }
    }
    for (var r = 0; r < graph.nodes.length; r++) {
        if (!settled[graph.nodes[r].id]) {
            visit(graph.nodes[r].id, 0);
        }
    }
    for (var k = 0; k < graph.nodes.length; k++) {
        graph.nodes[k].rank = rank[graph.nodes[k].id] || 0;
    }
}

// Where in its rank each node sits.
//
// Two barycentre sweeps: each node moves to the average position of what it is
// joined to in the rank before, then the same going back. It is the cheap half
// of the standard algorithm and it is what stops the edges of an ordinary tree
// crossing — the expensive half buys little on diagrams of this size and costs
// it on every keystroke.
// Gives every edge that spans more than one rank somewhere to *be* in the ranks
// it crosses.
//
// Without this an edge is a line from one box to another straight over whatever
// stands between them, and in a diagram as small as four classes it already
// happens: an aggregation from a base class to a leaf ran through the middle of
// the subclass between them. The standard answer is a node per crossed rank that
// occupies a lane and is never drawn — the edge is then routed through the
// corridor those reserve, and, because they take part in the ordering pass, a
// long edge also pulls the boxes either side of it into line.
function expandEdges(graph) {
    var segments = [];
    var routes = [];
    var virtuals = 0;
    for (var i = 0; i < graph.edges.length; i++) {
        var edge = graph.edges[i];
        var from = graph.byID[edge.from];
        var to = graph.byID[edge.to];
        routes.push([]);
        if (!from || !to || from === to) {
            continue;
        }
        var step = to.rank > from.rank ? 1 : -1;
        var span = Math.abs(to.rank - from.rank);
        if (span < 2) {
            segments.push({ from: edge.from, to: edge.to });
            continue;
        }
        var previous = from.id;
        for (var rank = from.rank + step; rank !== to.rank; rank += step) {
            var waypoint = {
                id: "__waypoint" + (virtuals++),
                text: "", shape: "waypoint", virtual: true,
                rank: rank, index: graph.nodes.length,
                width: 18, height: 1
            };
            graph.nodes.push(waypoint);
            graph.byID[waypoint.id] = waypoint;
            routes[i].push(waypoint);
            segments.push({ from: previous, to: waypoint.id });
            previous = waypoint.id;
        }
        segments.push({ from: previous, to: edge.to });
    }
    // `segments` is what the ordering pass walks — a long edge as the chain of
    // short ones it has become — and `routes` is what the drawing walks, one
    // list of waypoints per original edge.
    return { segments: segments, routes: routes };
}

function orderRanks(ranks, segments) {
    var neighbours = {};
    for (var i = 0; i < segments.length; i++) {
        var edge = segments[i];
        (neighbours[edge.to] = neighbours[edge.to] || []).push(edge.from);
        (neighbours[edge.from] = neighbours[edge.from] || []).push(edge.to);
    }
    for (var pass = 0; pass < 2; pass++) {
        var order = {};
        for (var r = 0; r < ranks.length; r++) {
            for (var n = 0; n < ranks[r].length; n++) {
                order[ranks[r][n].id] = n;
            }
        }
        for (var rank = 0; rank < ranks.length; rank++) {
            var row = ranks[rank];
            for (var m = 0; m < row.length; m++) {
                var joined = neighbours[row[m].id] || [];
                var total = 0;
                var count = 0;
                for (var j = 0; j < joined.length; j++) {
                    if (order[joined[j]] !== undefined) {
                        total += order[joined[j]];
                        count++;
                    }
                }
                // No neighbour placed yet: hold the position it came in with,
                // rather than collapsing every such node onto zero.
                row[m].weight = count ? total / count : m;
            }
            row.sort(function (a, b) {
                return a.weight === b.weight ? a.index - b.index : a.weight - b.weight;
            });
        }
    }
}

// Lays a graph out and draws it. `direction` is Mermaid's: TD and TB run down
// the page, LR runs across, and BT and RL are those two reversed — done by
// flipping the coordinates at the end rather than by a second layout, so there
// is one set of arithmetic to get right instead of four.
function layoutGraph(graph, direction, measurer, sourceOffset, label) {
    if (!graph.nodes.length) {
        return null;
    }
    sizeNodes(graph, measurer);
    rankNodes(graph);
    var expanded = expandEdges(graph);

    var ranks = [];
    for (var i = 0; i < graph.nodes.length; i++) {
        var node = graph.nodes[i];
        (ranks[node.rank] = ranks[node.rank] || []).push(node);
    }
    for (var r = 0; r < ranks.length; r++) {
        ranks[r] = ranks[r] || [];
    }
    orderRanks(ranks, expanded.segments);

    var horizontal = direction === "LR" || direction === "RL";
    // "Along" runs across a rank, "down" runs from one rank to the next. Naming
    // them that way is what lets one pass place both directions.
    var down = 0;
    var extentAlong = 0;
    for (var rank = 0; rank < ranks.length; rank++) {
        var row = ranks[rank];
        var thickness = 0;
        var along = 0;
        for (var n = 0; n < row.length; n++) {
            var member = row[n];
            member.along = along;
            member.down = down;
            along += (horizontal ? member.height : member.width) + SIBLING_GAP;
            thickness = Math.max(thickness, horizontal ? member.width : member.height);
        }
        // Centred on the widest rank, which is what makes a tree look like one.
        row.spread = along - SIBLING_GAP;
        extentAlong = Math.max(extentAlong, row.spread);
        down += thickness + RANK_GAP;
    }
    var extentDown = down - RANK_GAP;

    for (var q = 0; q < ranks.length; q++) {
        var offset = (extentAlong - ranks[q].spread) / 2;
        for (var m = 0; m < ranks[q].length; m++) {
            var placed = ranks[q][m];
            if (horizontal) {
                placed.x = placed.down;
                placed.y = placed.along + offset;
            } else {
                placed.x = placed.along + offset;
                placed.y = placed.down;
            }
        }
    }

    var width = horizontal ? extentDown : extentAlong;
    var height = horizontal ? extentAlong : extentDown;
    if (direction === "BT" || direction === "RL") {
        for (var f = 0; f < graph.nodes.length; f++) {
            var flipped = graph.nodes[f];
            if (direction === "BT") {
                flipped.y = height - flipped.y - flipped.height;
            } else {
                flipped.x = width - flipped.x - flipped.width;
            }
        }
    }

    var figure = new Figure();
    drawEdges(figure, graph, measurer, horizontal, expanded.routes);
    drawNodes(figure, graph, measurer);
    return figure.figure(width, height, label, sourceOffset);
}

function centreOf(node) {
    return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

// Where an edge meets a box: the point on its border in the direction of the
// other end. Done by intersecting the centre-to-centre line with the border
// rather than by picking a side, so a diagonal edge lands where it points
// instead of at the middle of a face it is nowhere near.
function borderPoint(node, towards) {
    var centre = centreOf(node);
    var dx = towards.x - centre.x;
    var dy = towards.y - centre.y;
    if (!dx && !dy) {
        return centre;
    }
    var halfWidth = node.width / 2;
    var halfHeight = node.height / 2;
    var scale;
    if (Math.abs(dx) * halfHeight > Math.abs(dy) * halfWidth) {
        scale = halfWidth / Math.abs(dx);
    } else {
        scale = halfHeight / Math.abs(dy);
    }
    return { x: centre.x + dx * scale, y: centre.y + dy * scale };
}

function drawEdges(figure, graph, measurer, horizontal, routes) {
    for (var i = 0; i < graph.edges.length; i++) {
        var edge = graph.edges[i];
        var from = graph.byID[edge.from];
        var to = graph.byID[edge.to];
        if (!from || !to || from === to) {
            // A self-edge has nowhere to go in a layered layout; it is dropped
            // rather than drawn as a line from a box to itself, which is a dot.
            continue;
        }
        var waypoints = ((routes && routes[i]) || []).map(centreOf);
        var start = borderPoint(from, waypoints.length ? waypoints[0] : centreOf(to));
        var end = borderPoint(to, waypoints.length
            ? waypoints[waypoints.length - 1] : centreOf(from));
        // An edge with waypoints is already going somewhere deliberate — through
        // the corridor they reserved — so it is drawn as the polyline it is. The
        // elbow is for the short edge with nothing between its ends, where a
        // diagonal reads as a line to somewhere else.
        var points = waypoints.length
            ? [start].concat(waypoints, [end])
            : elbow(start, end, horizontal);
        var head = edge.headEnd || (edge.arrowEnd ? "arrow" : null);
        var tail = edge.headStart || (edge.arrowStart ? "arrow" : null);
        // A shape at the end needs the line to stop short of it, or the stroke
        // shows through a hollow head as a line drawn across it.
        if (head && head !== "arrow") {
            points[points.length - 1] = backOff(points[points.length - 1],
                                                points[points.length - 2], headLength(head));
        }
        if (tail && tail !== "arrow") {
            points[0] = backOff(points[0], points[1], headLength(tail));
        }
        figure.line(points, {
            stroke: "foreground",
            strokeWidth: edge.thick ? 2.2 : 1.3,
            dashed: edge.dashed,
            arrowEnd: head === "arrow",
            arrowStart: tail === "arrow"
        });
        if (head && head !== "arrow") {
            drawHead(figure, head, end, points[points.length - 2]);
        }
        if (tail && tail !== "arrow") {
            drawHead(figure, tail, start, points[1]);
        }
        if (edge.text) {
            var middle = points[Math.floor(points.length / 2)];
            var previous = points[Math.floor(points.length / 2) - 1] || points[0];
            figure.edgeLabel(measurer, edge.text,
                             (middle.x + previous.x) / 2, (middle.y + previous.y) / 2);
        }
    }
}

// Two straight segments joined at a right angle when the ends do not line up.
// A single diagonal across three ranks reads as a line to somewhere else; the
// elbow is what makes it obvious which two boxes an edge joins.
function elbow(start, end, horizontal) {
    var slack = 2;
    if (Math.abs(start.x - end.x) < slack || Math.abs(start.y - end.y) < slack) {
        return [start, end];
    }
    if (horizontal) {
        var midX = (start.x + end.x) / 2;
        return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
    }
    var midY = (start.y + end.y) / 2;
    return [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end];
}

function headLength(head) {
    return head === "hollowTriangle" ? 11 : 13;
}

function backOff(tip, from, distance) {
    var dx = tip.x - from.x;
    var dy = tip.y - from.y;
    var length = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: tip.x - (dx / length) * distance, y: tip.y - (dy / length) * distance };
}

// UML's ends, as closed polygons. A hollow one is filled with the page rather
// than left empty, which is what hides the edge behind it.
function drawHead(figure, kind, tip, from) {
    var dx = tip.x - from.x;
    var dy = tip.y - from.y;
    var length = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / length;
    var uy = dy / length;
    var size = headLength(kind);
    var half = size * 0.42;
    var base = { x: tip.x - ux * size, y: tip.y - uy * size };
    var left = { x: base.x - uy * half, y: base.y + ux * half };
    var right = { x: base.x + uy * half, y: base.y - ux * half };
    if (kind === "hollowTriangle") {
        figure.line([tip, left, right], {
            closed: true, fill: "background", stroke: "foreground", strokeWidth: 1.3
        });
        return;
    }
    var back = { x: tip.x - ux * size * 2, y: tip.y - uy * size * 2 };
    figure.line([tip, left, back, right], {
        closed: true,
        fill: kind === "filledDiamond" ? "foreground" : "background",
        stroke: "foreground",
        strokeWidth: 1.3
    });
}

function drawNodes(figure, graph, measurer) {
    for (var i = 0; i < graph.nodes.length; i++) {
        var node = graph.nodes[i];
        if (node.virtual) {
            continue;
        }
        var centre = centreOf(node);
        switch (node.shape) {
        case "terminal":
            figure.box(node.x, node.y, node.width, node.height,
                       { ellipse: true, fill: "foreground", stroke: "foreground" });
            break;
        case "circle":
            figure.box(node.x, node.y, node.width, node.height, { ellipse: true });
            drawLines(figure, measurer, node.text, centre.x, centre.y, {});
            break;
        case "stadium":
            figure.box(node.x, node.y, node.width, node.height, { radius: node.height / 2 });
            drawLines(figure, measurer, node.text, centre.x, centre.y, {});
            break;
        case "rounded":
            figure.box(node.x, node.y, node.width, node.height, { radius: 8 });
            drawLines(figure, measurer, node.text, centre.x, centre.y, {});
            break;
        case "diamond":
            figure.line([
                { x: centre.x, y: node.y },
                { x: node.x + node.width, y: centre.y },
                { x: centre.x, y: node.y + node.height },
                { x: node.x, y: centre.y }
            ], { closed: true, fill: "surface", stroke: "border", strokeWidth: 1 });
            drawLines(figure, measurer, node.text, centre.x, centre.y, {});
            break;
        case "hexagon":
            var inset = Math.min(16, node.width / 4);
            figure.line([
                { x: node.x + inset, y: node.y },
                { x: node.x + node.width - inset, y: node.y },
                { x: node.x + node.width, y: centre.y },
                { x: node.x + node.width - inset, y: node.y + node.height },
                { x: node.x + inset, y: node.y + node.height },
                { x: node.x, y: centre.y }
            ], { closed: true, fill: "surface", stroke: "border", strokeWidth: 1 });
            drawLines(figure, measurer, node.text, centre.x, centre.y, {});
            break;
        case "subroutine":
            figure.box(node.x, node.y, node.width, node.height, {});
            figure.line([{ x: node.x + 6, y: node.y }, { x: node.x + 6, y: node.y + node.height }],
                        { stroke: "border" });
            figure.line([{ x: node.x + node.width - 6, y: node.y },
                         { x: node.x + node.width - 6, y: node.y + node.height }],
                        { stroke: "border" });
            drawLines(figure, measurer, node.text, centre.x, centre.y, {});
            break;
        case "class":
            drawClassNode(figure, measurer, node);
            break;
        default:
            figure.box(node.x, node.y, node.width, node.height, { radius: 3 });
            drawLines(figure, measurer, node.text, centre.x, centre.y, {});
            break;
        }
    }
}

// A class: a name, a rule, and its members in a monospaced column. Left-aligned
// under a centred name, which is how UML sets one and how the eye finds the
// member it is looking for.
function drawClassNode(figure, measurer, node) {
    figure.box(node.x, node.y, node.width, node.height, {});
    if (node.stereotype) {
        // Above the name and set smaller, which is how UML says "this box is an
        // interface" when the box itself is the same box as a class's.
        var middle = node.y + NODE_PAD_Y + node.stereotypeHeight / 2;
        figure.label(node.stereotype, node.x + node.width / 2, middle,
                     { size: SMALL_LABEL_SIZE, italic: true, ink: "secondary" });
        figure.label(node.text, node.x + node.width / 2,
                     node.y + node.stereotypeHeight + (node.titleHeight - node.stereotypeHeight) / 2,
                     { bold: true });
    } else {
        figure.label(node.text, node.x + node.width / 2, node.y + node.titleHeight / 2,
                     { bold: true });
    }
    var rows = node.rows || [];
    if (!rows.length) {
        return;
    }
    var y = node.y + node.titleHeight;
    figure.line([{ x: node.x, y: y }, { x: node.x + node.width, y: y }], { stroke: "border" });
    y += NODE_PAD_Y / 2;
    for (var i = 0; i < rows.length; i++) {
        figure.label(rows[i].text, node.x + NODE_PAD_X, y + rows[i].height / 2,
                     { size: SMALL_LABEL_SIZE, mono: true, align: "leading" });
        y += rows[i].height;
    }
}

// `sequenceDiagram`.
//
// The one kind here that is not a graph: participants are a fixed row across the
// top and time runs down the page, so the layered layout above has nothing to
// offer it and it gets a pass of its own. What it shares is everything below the
// waist — the same Figure, the same measurer, the same inks.
// The participants and the messages between them, in order. A type of its own
// because two languages fill it: Mermaid's `sequenceDiagram` and PlantUML's
// arrows, which differ in every character of their syntax and in none of what
// they mean.
function SequenceDiagram() {
    this.participants = [];
    this.byID = {};
    this.steps = [];
}

SequenceDiagram.prototype.participant = function (name, label) {
    var id = String(name == null ? "" : name).trim();
    if (!id) {
        return null;
    }
    var existing = this.byID[id];
    if (existing) {
        // A name declared after it was first used keeps the declaration, which
        // is how `participant A as Alice` reads however far down it is written.
        if (label) {
            existing.text = label;
        }
        return existing;
    }
    if (this.participants.length >= DIAGRAM_MAX_NODES) {
        return null;
    }
    var made = { id: id, text: label || id, index: this.participants.length };
    this.participants.push(made);
    this.byID[id] = made;
    return made;
};

function parseSequence(lines) {
    var diagram = new SequenceDiagram();

    function participant(name, label) {
        return diagram.participant(name, label);
    }

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var declared = line.match(/^(?:participant|actor)\s+([^\s:]+)(?:\s+as\s+(.+))?$/i);
        if (declared) {
            participant(declared[1], declared[2] ? diagramText(declared[2]) : "");
            continue;
        }
        var note = line.match(/^note\s+(?:(over)\s+([^:]+)|(?:left|right)\s+of\s+([^:]+)):\s*(.*)$/i);
        if (note) {
            var over = (note[2] || note[3] || "").split(",").map(function (name) {
                return participant(name.trim(), "");
            });
            diagram.steps.push({ kind: "note", over: over, text: diagramText(note[4]) });
            continue;
        }
        // Blocks — loop, alt, opt, par — are not drawn. Their *contents* are, so
        // a diagram using them still reads as a sequence of messages rather than
        // disappearing; §6 records the frame as missing.
        if (/^(loop|alt|else|opt|par|and|rect|activate|deactivate|end|autonumber|box)\b/i.test(line)) {
            continue;
        }
        var message = line.match(/^([^\s:>-]+)\s*(-?->>?|-\)|--\))\s*([^\s:]+)\s*:\s*(.*)$/);
        if (!message) {
            continue;
        }
        var from = participant(message[1], "");
        var to = participant(message[3], "");
        if (!from || !to || diagram.steps.length >= DIAGRAM_MAX_EDGES) {
            continue;
        }
        diagram.steps.push({
            kind: "message", from: from, to: to,
            text: diagramText(message[4]),
            dashed: message[2].indexOf("--") === 0
        });
    }
    return diagram;
}

var SEQUENCE_GAP = 34;
var SEQUENCE_STEP = 38;
var SELF_MESSAGE_DROP = 26;

function layoutSequence(diagram, measurer, sourceOffset) {
    if (!diagram.participants.length || !diagram.steps.length) {
        return null;
    }
    // Each participant is as wide as its own name, and at least as wide as the
    // longest message it sends: a heading narrower than the arrow under it
    // leaves the label overhanging the lifeline it belongs to.
    var widest = 0;
    for (var s = 0; s < diagram.steps.length; s++) {
        var step = diagram.steps[s];
        if (step.text) {
            widest = Math.max(widest,
                              measurer.size(step.text, SMALL_LABEL_SIZE, false, false).width);
        }
    }
    var headHeight = 0;
    var x = 0;
    for (var p = 0; p < diagram.participants.length; p++) {
        var person = diagram.participants[p];
        var name = measureLines(measurer, person.text, LABEL_SIZE, true, false);
        person.width = Math.max(MIN_NODE_WIDTH + 20, name.width + NODE_PAD_X * 2);
        person.height = name.height + NODE_PAD_Y * 2;
        headHeight = Math.max(headHeight, person.height);
        person.x = x;
        x += person.width + Math.max(SEQUENCE_GAP, widest / 2);
    }
    var width = x - Math.max(SEQUENCE_GAP, widest / 2);

    var figure = new Figure();
    var top = headHeight;
    var y = top + 18;
    var steps = [];
    for (var i = 0; i < diagram.steps.length; i++) {
        var entry = diagram.steps[i];
        entry.y = y;
        steps.push(entry);
        if (entry.kind === "message" && entry.from === entry.to) {
            y += SEQUENCE_STEP + SELF_MESSAGE_DROP;
        } else if (entry.kind === "note") {
            y += SEQUENCE_STEP + 8;
        } else {
            y += SEQUENCE_STEP;
        }
    }
    var height = y;

    // Lifelines first: everything else is drawn over them.
    for (var l = 0; l < diagram.participants.length; l++) {
        var line = diagram.participants[l];
        var centre = line.x + line.width / 2;
        figure.line([{ x: centre, y: top }, { x: centre, y: height - 10 }],
                    { stroke: "border", dashed: true });
    }
    for (var h = 0; h < diagram.participants.length; h++) {
        var head = diagram.participants[h];
        figure.box(head.x, (headHeight - head.height) / 2, head.width, head.height,
                   { radius: 4 });
        drawLines(figure, measurer, head.text, head.x + head.width / 2, headHeight / 2,
                  { bold: true });
    }

    for (var m = 0; m < steps.length; m++) {
        drawSequenceStep(figure, measurer, steps[m], width);
    }
    return figure.figure(width, height, "Sequence diagram", sourceOffset);
}

function lifelineX(person) {
    return person.x + person.width / 2;
}

function drawSequenceStep(figure, measurer, step, width) {
    if (step.kind === "note") {
        var over = (step.over || []).filter(Boolean);
        var left = over.length ? lifelineX(over[0]) - 60 : 0;
        var right = over.length ? lifelineX(over[over.length - 1]) + 60 : width;
        var size = measureLines(measurer, step.text, SMALL_LABEL_SIZE, false, false);
        var noteWidth = Math.max(size.width + NODE_PAD_X * 2, right - left);
        figure.box(left, step.y - size.height / 2 - 6, noteWidth, size.height + 12,
                   { fill: "background", stroke: "border", dashed: true, radius: 2 });
        drawLines(figure, measurer, step.text, left + noteWidth / 2, step.y,
                  { size: SMALL_LABEL_SIZE, ink: "secondary" });
        return;
    }
    var fromX = lifelineX(step.from);
    var toX = lifelineX(step.to);
    if (step.from === step.to) {
        // A message to itself: out, down and back, which is the only way to draw
        // one that does not end where it started.
        var out = fromX + 46;
        figure.line([
            { x: fromX, y: step.y },
            { x: out, y: step.y },
            { x: out, y: step.y + SELF_MESSAGE_DROP },
            { x: fromX, y: step.y + SELF_MESSAGE_DROP }
        ], { stroke: "foreground", strokeWidth: 1.3, dashed: step.dashed, arrowEnd: true });
        if (step.text) {
            figure.label(step.text, out + 10, step.y + SELF_MESSAGE_DROP / 2,
                         { size: SMALL_LABEL_SIZE, align: "leading", ink: "secondary" });
        }
        return;
    }
    figure.line([{ x: fromX, y: step.y }, { x: toX, y: step.y }],
                { stroke: "foreground", strokeWidth: 1.3, dashed: step.dashed, arrowEnd: true });
    if (step.text) {
        // Above the arrow rather than on it: a sequence diagram is read down the
        // page, and a label boxed into the line breaks that column of arrows.
        figure.label(step.text, (fromX + toX) / 2, step.y - 9,
                     { size: SMALL_LABEL_SIZE, ink: "secondary" });
    }
}


// ---------------------------------------------------------------------------
// PlantUML
//
// The same figures from a different language, and no editor work at all: it
// produces the Graph and SequenceDiagram the Mermaid side already builds, and
// everything from layout down is shared. What is genuinely different is that
// PlantUML does not say what kind of diagram it is — Mermaid's first word does,
// and here it has to be worked out from the statements.
// ---------------------------------------------------------------------------

// Directives, styling and the parts of the language that describe a picture we
// do not draw. Skipped rather than refused: a file full of `skinparam` should
// still show its classes, minus the colours the editor's theme decides anyway.
var PLANT_IGNORED = /^(@start\w*|@end\w*|skinparam|skin\b|!|title\b|header\b|footer\b|legend\b|end\s?legend|hide\b|show\b|scale\b|caption\b|autonumber\b|activate\b|deactivate\b|destroy\b|newpage\b|allow_mixing\b|left\s+to\s+right\b|top\s+to\s+bottom\b|together\b|package\b|namespace\b|node\b|folder\b|frame\b|database\b|rectangle\b|card\b)/i;

// The block-shaped keywords. Their *contents* are drawn and their frames are
// not, so a diagram using them reads as what it is rather than disappearing.
var PLANT_BLOCKS = /^(alt|else|opt|loop|par|group|critical|break|ref|box|end\b|end$|\}|\{)/i;

// A relation's length and direction are hints about layout, not about meaning:
// `-up->` and `---->` are `-->` with an opinion about where to put the boxes.
// Normalising them away is what lets one table of operators serve both
// languages, since the remainder is Mermaid's exactly.
function plantNormalizeArrows(line) {
    return line
        .replace(/-(?:up|down|left|right|u|d|l|r)-(?=[->|.*o])/gi, "-")
        .replace(/-(?:up|down|left|right|u|d|l|r)->/gi, "-->")
        .replace(/-{3,}/g, "--")
        .replace(/\.{3,}/g, "..");
}

// PlantUML comments: `'` to the end of a line, and `/' … '/` across them.
function plantLines(source) {
    var withoutBlocks = String(source).replace(/\/'[\s\S]*?'\//g, " ");
    var lines = [];
    var raw = withoutBlocks.split(/\r\n|\r|\n/);
    for (var i = 0; i < raw.length && lines.length <= DIAGRAM_MAX_LINES; i++) {
        var line = raw[i].replace(/^\s*'.*$/, "").trim();
        if (line) {
            lines.push(line);
        }
    }
    return lines;
}

// Which kind of diagram this is, decided by what the file actually contains.
//
// Order matters and is not arbitrary. A class declaration or a UML relation end
// is unambiguous, so it wins. A message with a colon after an arrow is a
// sequence — and has to be tested before the state rules, because `A -> B : x`
// would otherwise read as a transition between two states. `[*]` is a state
// diagram's start marker and nothing else uses it. What is left, if it has
// arrows at all, is drawn as a graph: an activity or state diagram written
// without either marker still reads as boxes joined by lines.
function plantKind(lines) {
    var arrows = false;
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (/^(abstract\s+class|abstract|class|interface|enum|entity|struct|protocol|annotation)\s+\S/i.test(line)) {
            return "class";
        }
        if (/(<\|--|<\|\.\.|--\|>|\.\.\|>|\*--|--\*|o--|--o)/.test(line)) {
            return "class";
        }
        if (/^[^:]*(<-|->|-->|<--|->>|<<-)[^:]*:/.test(line)) {
            return "sequence";
        }
        if (/\[\*\]/.test(line) || /^state\s+\S/i.test(line)) {
            return "state";
        }
        if (/(-->|->)/.test(line)) {
            arrows = true;
        }
    }
    return arrows ? "state" : null;
}

function renderPlantDiagram(source, sourceOffset) {
    var lines = plantLines(source);
    if (!lines.length || lines.length > DIAGRAM_MAX_LINES) {
        return null;
    }
    var body = [];
    for (var i = 0; i < lines.length; i++) {
        if (!PLANT_IGNORED.test(lines[i])) {
            body.push(lines[i]);
        }
    }
    var measurer = new Measurer();
    switch (plantKind(body)) {
    case "class":
        return layoutGraph(parsePlantClass(body), "TD", measurer, sourceOffset, "Class diagram");
    case "sequence":
        return layoutSequence(parsePlantSequence(body), measurer, sourceOffset);
    case "state":
        return layoutGraph(parsePlantState(body), "TD", measurer, sourceOffset, "State diagram");
    default:
        return null;
    }
}

// A class diagram. The relation operators are Mermaid's own once the direction
// hints are normalised away, so `readClassRelation` does that half unchanged;
// what differs is the declaration syntax and the stereotypes.
function parsePlantClass(lines) {
    var graph = new Graph();
    var open = null;
    for (var i = 0; i < lines.length; i++) {
        var line = plantNormalizeArrows(lines[i]);
        if (open) {
            if (/^\}/.test(line)) {
                open = null;
            } else {
                addMember(open, plantMember(line));
            }
            continue;
        }
        var declared = line.match(
            /^(?:abstract\s+)?(class|interface|enum|entity|struct|protocol|annotation)\s+("[^"]+"|[\w.$]+)(?:\s+as\s+([\w.$]+))?[^{]*?(\{)?\s*$/i);
        if (declared) {
            var name = diagramText(declared[2]);
            var alias = declared[3] || name;
            var node = graph.node(alias, { text: name, shape: "class" });
            if (node && !node.members) {
                node.members = [];
            }
            // A stereotype is what tells an interface from a class when both are
            // drawn as the same box, and PlantUML's own rendering says it the
            // same way.
            if (node && /^(interface|enum|annotation)$/i.test(declared[1])
                && node.members.length === 0) {
                node.stereotype = "<<" + declared[1].toLowerCase() + ">>";
            }
            if (declared[4] && node) {
                open = node;
            }
            continue;
        }
        if (readClassRelation(line, graph)) {
            continue;
        }
        // `Animal : +String name`, the one-at-a-time form.
        var member = line.match(/^([\w.$]+)\s*:\s*(.+)$/);
        if (member) {
            addMember(graph.node(member[1], { text: member[1], shape: "class" }),
                      plantMember(member[2]));
        }
    }
    return graph;
}

// A member line, with the parts that are about drawing taken off: PlantUML's
// visibility sigils are `+ - # ~`, which are UML's own and are kept, but its
// `{static}` and `{abstract}` modifiers are formatting instructions and go.
function plantMember(text) {
    return diagramText(String(text).replace(/\{(static|abstract|field|method)\}/gi, "").trim());
}

// A sequence diagram. PlantUML's arrows carry their meaning in punctuation —
// dashes for a dotted line, the head's direction in which end the `<` is on —
// and a message is anything with a colon after one.
function parsePlantSequence(lines) {
    var diagram = new SequenceDiagram();
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var declared = line.match(
            /^(?:participant|actor|boundary|control|entity|database|collections|queue)\s+("[^"]+"|[\w.$]+)(?:\s+as\s+("[^"]+"|[\w.$]+))?/i);
        if (declared) {
            // `participant Alice as A` names the thing first and the handle
            // second, which is the opposite way round from Mermaid.
            var first = diagramText(declared[1]);
            if (declared[2]) {
                diagram.participant(diagramText(declared[2]), first);
            } else {
                diagram.participant(first, first);
            }
            continue;
        }
        var note = line.match(/^(?:h?note)\s+(?:(over)\s+([^:]+)|(?:left|right)\s+of\s+([^:]+)):\s*(.*)$/i);
        if (note) {
            var over = (note[2] || note[3] || "").split(",").map(function (name) {
                return diagram.participant(name.trim().replace(/^"|"$/g, ""), "");
            });
            diagram.steps.push({ kind: "note", over: over, text: diagramText(note[4]) });
            continue;
        }
        if (PLANT_BLOCKS.test(line)) {
            continue;
        }
        var message = line.match(
            /^("[^"]+"|[\w.$]+)\s*(<?-{1,2}>?>?|<<?-{1,2})\s*("[^"]+"|[\w.$]+)\s*:\s*(.*)$/);
        if (!message || !/[<>]/.test(message[2])) {
            continue;
        }
        var arrow = message[2];
        var left = diagram.participant(diagramText(message[1]), "");
        var right = diagram.participant(diagramText(message[3]), "");
        if (!left || !right || diagram.steps.length >= DIAGRAM_MAX_EDGES) {
            continue;
        }
        // `B <- A` is `A -> B` written backwards, and drawing it as it is
        // written would point the arrow at the sender.
        var backwards = arrow.charAt(0) === "<";
        diagram.steps.push({
            kind: "message",
            from: backwards ? right : left,
            to: backwards ? left : right,
            text: diagramText(message[4]),
            dashed: arrow.indexOf("--") >= 0
        });
    }
    return diagram;
}

// A state or activity diagram: `[*]`, states, and the transitions between them.
function parsePlantState(lines) {
    var graph = new Graph();
    var terminals = 0;

    function state(name) {
        var id = String(name).trim().replace(/^"|"$/g, "");
        if (id === "[*]") {
            // One per marker, or the start of the diagram would be joined to its
            // end by an edge nobody wrote.
            return graph.node("__terminal" + (terminals++), { text: "", shape: "terminal" });
        }
        return graph.node(id, { text: id, shape: "rounded" });
    }

    for (var i = 0; i < lines.length; i++) {
        var line = plantNormalizeArrows(lines[i]);
        var declared = line.match(/^state\s+("[^"]+"|[\w.$]+)(?:\s+as\s+([\w.$]+))?/i);
        if (declared && !/-->/.test(line)) {
            var name = diagramText(declared[1]);
            graph.node(declared[2] || name, { text: name, shape: "rounded" });
            continue;
        }
        if (PLANT_BLOCKS.test(line)) {
            continue;
        }
        var parts = line.split(/\s*-->\s*/);
        if (parts.length < 2) {
            continue;
        }
        var label = "";
        var tail = parts[parts.length - 1].match(/^([^:]*):\s*(.*)$/);
        if (tail) {
            parts[parts.length - 1] = tail[1];
            label = diagramText(tail[2]);
        }
        var previous = null;
        for (var p = 0; p < parts.length; p++) {
            var text = parts[p].trim();
            if (!text) {
                continue;
            }
            var node = state(text);
            if (previous) {
                graph.edge(previous, node, { text: p === parts.length - 1 ? label : "" });
            }
            previous = node;
        }
    }
    return graph;
}

// A fenced block that is a picture rather than code. Which language it names
// decides which parser reads it, and either may decline — an unknown header, a
// diagram past its caps, or one that parses to nothing all fall through to the
// code block, which is readable and honest about not having been rendered.
// MARK: - draw.io
//
// A `.drawio` file is the one diagram here that arrives already laid out. Mermaid and
// PlantUML say what connects to what and leave the placing to us; draw.io says where every
// box *is*, because somebody dragged it there. So this half of the plugin has no layout at
// all — it reads geometry and paints it, and the reason it is worth having is that the
// arrangement is the author's own and should survive being read in an editor.
//
// **What cannot survive is the colour.** A figure names meanings — `accent`, `positive`,
// `negative` — and the theme owns the palette, which is what stops a diagram being
// invisible on somebody's background. draw.io files carry real hex fills, so they are read
// as the meaning they were probably chosen for: green for good, red for bad, amber for a
// warning, blue for emphasis, everything else for a plain surface. A diagram that used
// colour decoratively comes out quieter than it went in; one that used it to say something
// keeps what it was saying.

var DRAWIO_MAX_CELLS = 900;
var DRAWIO_MAX_PAGES = 12;
// A canvas is measured in the file's own points, and pages are commonly 1600 wide. The
// preview scales a figure down to the pane, so a big diagram is small rather than cut off —
// but past a point the words in it stop being words, and a cap that says so is better than
// one that draws a grey smudge.
var DRAWIO_MAX_SPAN = 12000;

// A minimal XML reader, for this format rather than for XML.
//
// The HTML parser above cannot serve: it knows void elements, implied ends and raw-text
// tags, none of which exist here, and it drops `<svg>` and friends — where `<mxCell>` would
// simply be an unknown tag. This wants the opposite of tolerance: a fixed, machine-written
// vocabulary read exactly, and anything it does not understand left alone.
function xmlParse(text) {
    var root = { tag: "#root", attrs: {}, children: [], text: "" };
    var stack = [root];
    var pattern = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([A-Za-z_][\w.:-]*)\s*>|<([A-Za-z_][\w.:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
    var at = 0;
    var match;
    var guard = 0;
    while ((match = pattern.exec(text)) !== null) {
        if (++guard > 200000) {
            return null;
        }
        var top = stack[stack.length - 1];
        // Whatever sat between the last tag and this one belongs to the element holding it.
        // Only `<diagram>` ever has any, and there it is the compressed payload.
        if (match.index > at) {
            top.text += text.slice(at, match.index);
        }
        at = pattern.lastIndex;
        if (match[1] !== undefined) {
            top.text += match[1];
            continue;
        }
        if (match[2] !== undefined) {
            // A stray close tag closes nothing rather than unwinding the whole document.
            for (var up = stack.length - 1; up > 0; up--) {
                if (stack[up].tag === match[2]) {
                    stack.length = up;
                    break;
                }
            }
            continue;
        }
        if (match[3] === undefined) {
            continue;
        }
        var raw = match[4] || "";
        var node = { tag: match[3], attrs: xmlAttributes(raw), children: [], text: "" };
        top.children.push(node);
        if (!/\/\s*$/.test(raw)) {
            stack.push(node);
            if (stack.length > 64) {
                return null;
            }
        }
    }
    return root;
}

var XML_ATTR = /([A-Za-z_][\w.:-]*)\s*=\s*("[^"]*"|'[^']*')/g;

function xmlAttributes(raw) {
    var attrs = {};
    var match;
    XML_ATTR.lastIndex = 0;
    while ((match = XML_ATTR.exec(raw)) !== null) {
        attrs[match[1]] = decode(match[2].slice(1, -1));
    }
    return attrs;
}

function xmlFind(node, tag, out) {
    out = out || [];
    for (var i = 0; i < node.children.length; i++) {
        var child = node.children[i];
        if (child.tag === tag) {
            out.push(child);
        }
        xmlFind(child, tag, out);
    }
    return out;
}

// `key=value;flag;key=value` — draw.io's own style language. A bare word is a flag, and the
// first one is usually the shape: `ellipse;whiteSpace=wrap` is an ellipse.
function drawioStyle(text) {
    var style = { _first: "" };
    var parts = String(text || "").split(";");
    for (var i = 0; i < parts.length; i++) {
        var part = parts[i].trim();
        if (!part) {
            continue;
        }
        var cut = part.indexOf("=");
        if (cut === -1) {
            style[part.toLowerCase()] = true;
            if (!style._first) {
                style._first = part.toLowerCase();
            }
        } else {
            style[part.slice(0, cut).trim().toLowerCase()] = part.slice(cut + 1).trim();
        }
    }
    return style;
}

// A cell's label. draw.io writes rich text into it when `html=1`, which is most of the time,
// so the tags have to come out — and `<br>` and `</div>` are line breaks rather than
// nothing, which is the difference between a three-line box and one very wide line.
function drawioLabel(value) {
    var text = String(value == null ? "" : value);
    if (!text) {
        return "";
    }
    text = text.replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(div|p|li|h[1-6])>/gi, "\n")
        .replace(/<li\b[^>]*>/gi, "• ")
        .replace(/<[^>]*>/g, "");
    return decode(text).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// What a fill was probably *for*.
//
// Hue rather than a table of draw.io's swatches: the defaults are the common case but
// nothing stops somebody picking their own green, and a green nobody listed should still
// read as one. Anything too pale or too grey to carry a meaning is a plain surface.
function drawioInk(colour, fallback) {
    var text = String(colour || "").trim().toLowerCase();
    if (text === "none") { return "none"; }
    if (/^#[0-9a-f]{6}$/.test(text)) { return text; }
    if (/^#[0-9a-f]{3}$/.test(text)) {
        return "#" + text.slice(1).split("").map(function (c) { return c + c; }).join("");
    }
    return fallback;
}

// One page's cells, read out of its `<mxGraphModel>`.
//
// `<object>` and `<UserObject>` wrap a cell to hang custom properties on it, and when they
// do, the *label* is theirs rather than the cell's. Reading only `<mxCell>` loses the text
// of every box in a file that uses them, which looks like a diagram of empty rectangles.
function drawioCells(model) {
    var cells = [];
    var byID = {};
    var wrappers = xmlFind(model, "object").concat(xmlFind(model, "UserObject"));
    var labelled = {};
    for (var w = 0; w < wrappers.length; w++) {
        var inner = wrappers[w].children.filter(function (child) { return child.tag === "mxCell"; })[0];
        if (inner) {
            labelled[wrappers[w].attrs.id || ""] = wrappers[w];
            inner.attrs.id = inner.attrs.id || wrappers[w].attrs.id;
            inner.attrs.value = wrappers[w].attrs.label != null
                ? wrappers[w].attrs.label : inner.attrs.value;
        }
    }
    var found = xmlFind(model, "mxCell");
    for (var i = 0; i < found.length && cells.length < DRAWIO_MAX_CELLS; i++) {
        var node = found[i];
        var attrs = node.attrs;
        var geometry = node.children.filter(function (child) { return child.tag === "mxGeometry"; })[0];
        var cell = {
            id: attrs.id || ("cell" + i),
            parent: attrs.parent || "",
            value: attrs.value || "",
            style: drawioStyle(attrs.style),
            isVertex: attrs.vertex === "1",
            isEdge: attrs.edge === "1",
            source: attrs.source || "",
            target: attrs.target || "",
            x: 0, y: 0, width: 0, height: 0,
            relative: false,
            points: [],
            sourcePoint: null,
            targetPoint: null,
            offset: null
        };
        if (geometry) {
            cell.x = drawioNumber(geometry.attrs.x);
            cell.y = drawioNumber(geometry.attrs.y);
            cell.width = drawioNumber(geometry.attrs.width);
            cell.height = drawioNumber(geometry.attrs.height);
            cell.relative = geometry.attrs.relative === "1";
            for (var g = 0; g < geometry.children.length; g++) {
                var part = geometry.children[g];
                if (part.tag === "Array" && part.attrs.as === "points") {
                    for (var p = 0; p < part.children.length; p++) {
                        if (part.children[p].tag === "mxPoint") {
                            cell.points.push({ x: drawioNumber(part.children[p].attrs.x),
                                               y: drawioNumber(part.children[p].attrs.y) });
                        }
                    }
                } else if (part.tag === "mxPoint") {
                    if (part.attrs.as === "sourcePoint") {
                        cell.sourcePoint = { x: drawioNumber(part.attrs.x), y: drawioNumber(part.attrs.y) };
                    } else if (part.attrs.as === "targetPoint") {
                        cell.targetPoint = { x: drawioNumber(part.attrs.x), y: drawioNumber(part.attrs.y) };
                    } else if (part.attrs.as === "offset") {
                        cell.offset = { x: drawioNumber(part.attrs.x), y: drawioNumber(part.attrs.y) };
                    }
                }
            }
        }
        cells.push(cell);
        byID[cell.id] = cell;
    }
    return { cells: cells, byID: byID };
}

function drawioNumber(text) {
    var value = parseFloat(text);
    return isFinite(value) ? value : 0;
}

// Where each box actually is on the page.
//
// A cell inside a container — a swimlane, a group — is positioned relative to that
// container's own corner, so the coordinate in the file is not the coordinate on the page.
// Walking the parent chain is the whole of it, with a depth cap because a malformed file can
// name a parent that names it back.
function drawioPlace(model) {
    var byID = model.byID;
    for (var i = 0; i < model.cells.length; i++) {
        var cell = model.cells[i];
        cell.ax = cell.x;
        cell.ay = cell.y;
        if (!cell.isVertex) {
            continue;
        }
        var parent = byID[cell.parent];
        var depth = 0;
        while (parent && parent.isVertex && depth++ < 16) {
            cell.ax += parent.x;
            cell.ay += parent.y;
            parent = byID[parent.parent];
        }
    }
}

// The centre of a cell, and the point on its border facing somewhere else. An edge that
// stopped at the centre would be drawn under the box it points at.
function drawioCentre(cell) {
    return { x: cell.ax + cell.width / 2, y: cell.ay + cell.height / 2 };
}

function drawioBorder(cell, towards) {
    var centre = drawioCentre(cell);
    var dx = towards.x - centre.x;
    var dy = towards.y - centre.y;
    if (!dx && !dy) {
        return centre;
    }
    var halfW = Math.max(cell.width / 2, 1);
    var halfH = Math.max(cell.height / 2, 1);
    var scale = Math.min(halfW / Math.abs(dx || 0.0001), halfH / Math.abs(dy || 0.0001));
    return { x: centre.x + dx * scale, y: centre.y + dy * scale };
}

// The shapes draw.io files here actually contain, plus a fallback that is never nothing.
//
// An unknown shape is drawn as a plain box rather than skipped: draw.io ships hundreds of
// stencil libraries and this will never know them all, but a labelled rectangle where a
// network switch should be still says what is connected to what — which is what somebody
// reading a diagram in an editor came for. Skipping it loses a node and the edges into it.
function drawioVertexShape(figure, cell) {
    var style = cell.style;
    var shape = String(style.shape || style._first || "").toLowerCase();
    var x = cell.ax;
    var y = cell.ay;
    var w = cell.width;
    var h = cell.height;
    var fill = drawioInk(style.fillcolor, "#ffffff");
    var stroke = drawioInk(style.strokecolor, "#000000");
    var dashed = style.dashed === "1";
    var thick = drawioNumber(style.strokewidth) > 1.5 ? 2 : 1;
    var options = { fill: fill, stroke: stroke, dashed: dashed, strokeWidth: thick };

    // A label with no box around it. Drawn as nothing here; the text pass puts the words in.
    if (shape === "text" || style.text === true) {
        return;
    }
    if (shape === "ellipse" || style.ellipse === true) {
        figure.box(x, y, w, h, { fill: fill, stroke: stroke, dashed: dashed,
                                 strokeWidth: thick, ellipse: true });
        return;
    }
    if (shape === "rhombus" || style.rhombus === true) {
        figure.line([{ x: x + w / 2, y: y }, { x: x + w, y: y + h / 2 },
                     { x: x + w / 2, y: y + h }, { x: x, y: y + h / 2 }],
                    { closed: true, fill: fill, stroke: stroke, dashed: dashed });
        return;
    }
    if (shape === "hexagon") {
        var inset = Math.min(w / 4, h / 2);
        figure.line([{ x: x + inset, y: y }, { x: x + w - inset, y: y },
                     { x: x + w, y: y + h / 2 }, { x: x + w - inset, y: y + h },
                     { x: x + inset, y: y + h }, { x: x, y: y + h / 2 }],
                    { closed: true, fill: fill, stroke: stroke, dashed: dashed });
        return;
    }
    if (shape === "cylinder" || shape === "cylinder3" || shape === "datastore") {
        var lip = Math.min(h / 2, drawioNumber(style.size) || Math.min(h * 0.18, 14));
        // One cylinder silhouette: upper back rim, straight sides and curved base.
        // A rounded rectangle underneath an ellipse leaves an extra horizontal outline.
        function arc(cy, start, end) {
            var points = [];
            for (var i = 0; i <= 24; i++) {
                var angle = start + (end - start) * i / 24;
                points.push({ x: x + w / 2 + w / 2 * Math.cos(angle),
                              y: cy + lip * Math.sin(angle) });
            }
            return points;
        }
        figure.line(arc(y + lip, Math.PI, Math.PI * 2).concat(arc(y + h - lip, 0, Math.PI)),
            { closed: true, fill: fill, stroke: stroke, strokeWidth: thick, dashed: dashed });
        figure.line(arc(y + lip, 0, Math.PI),
            { stroke: stroke, strokeWidth: thick, dashed: dashed });
        return;
    }
    if (shape === "umlactor" || shape === "actor") {
        var head = Math.min(w, h) * 0.22;
        var cx = x + w / 2;
        figure.box(cx - head, y, head * 2, head * 2, { fill: fill, stroke: stroke, ellipse: true });
        figure.line([{ x: cx, y: y + head * 2 }, { x: cx, y: y + h * 0.68 }], { stroke: stroke });
        figure.line([{ x: x + w * 0.18, y: y + h * 0.42 }, { x: x + w * 0.82, y: y + h * 0.42 }],
                    { stroke: stroke });
        figure.line([{ x: x + w * 0.2, y: y + h }, { x: cx, y: y + h * 0.68 },
                     { x: x + w * 0.8, y: y + h }], { stroke: stroke });
        return;
    }
    if (shape === "umllifeline") {
        var headHeight = Math.min(h * 0.2, 44);
        figure.box(x, y, w, headHeight, options);
        figure.line([{ x: x + w / 2, y: y + headHeight }, { x: x + w / 2, y: y + h }],
                    { stroke: "border", dashed: true });
        return;
    }
    if (shape === "note") {
        var fold = Math.min(w, h) * 0.22;
        figure.line([{ x: x, y: y }, { x: x + w - fold, y: y }, { x: x + w, y: y + fold },
                     { x: x + w, y: y + h }, { x: x, y: y + h }],
                    { closed: true, fill: fill, stroke: stroke, dashed: dashed });
        figure.line([{ x: x + w - fold, y: y }, { x: x + w - fold, y: y + fold },
                     { x: x + w, y: y + fold }], { stroke: stroke });
        return;
    }
    if (shape === "process") {
        figure.box(x, y, w, h, options);
        var bar = Math.min(w * 0.12, 16);
        figure.line([{ x: x + bar, y: y }, { x: x + bar, y: y + h }], { stroke: stroke });
        figure.line([{ x: x + w - bar, y: y }, { x: x + w - bar, y: y + h }], { stroke: stroke });
        return;
    }
    if (shape === "document") {
        figure.line([{ x: x, y: y }, { x: x + w, y: y }, { x: x + w, y: y + h * 0.86 },
                     { x: x + w * 0.5, y: y + h }, { x: x, y: y + h * 0.86 }],
                    { closed: true, fill: fill, stroke: stroke, dashed: dashed });
        return;
    }
    if (style.swimlane === true || shape === "swimlane") {
        var title = drawioNumber(style.startsize) || 23;
        figure.box(x, y, w, h, { fill: "none", stroke: stroke, dashed: dashed });
        figure.box(x, y, w, Math.min(title, h), { fill: fill, stroke: stroke });
        return;
    }
    // Everything else, including every stencil this does not know: a rectangle, rounded
    // when the file says so.
    figure.box(x, y, w, h, {
        fill: fill, stroke: stroke, dashed: dashed, strokeWidth: thick,
        radius: style.rounded === "1" ? Math.min(drawioNumber(style.arcsize) || 10, h / 2) : 0
    });
}

// What colour the words in a box can safely be.
//
// Not the file's `fontColor`, which is the mistake this replaced: run through the same hue
// table as the fills, a purple label on a purple box came out purple on purple and the text
// simply was not there. A figure's palette names meanings, and only two pairings in it are
// *guaranteed* to be legible — that is what has to be leaned on.
//
// On a coloured fill the words are drawn in the page colour. The theme's accent and its
// string, number and comment colours are all chosen to be readable against the page, and
// contrast is symmetric, so the page is readable against them whichever way round the theme
// is. On a plain surface, or on no box at all, the ordinary foreground is right — and grey
// text stays quiet, since a subtitle written in grey meant to be a subtitle.
function drawioLabelInk(style, fill) {
    return drawioInk(style.fontcolor, "#000000");
}

// How light a colour is, when it is grey enough for lightness to be all it says. -1 for
// anything with a hue in it, or nothing written at all.
function drawioGreyLevel(colour) {
    var hex = String(colour || "").trim().toLowerCase().match(/^#?([0-9a-f]{6})$/);
    if (!hex) {
        return -1;
    }
    var value = parseInt(hex[1], 16);
    var r = ((value >> 16) & 255) / 255;
    var g = ((value >> 8) & 255) / 255;
    var b = (value & 255) / 255;
    if (Math.max(r, g, b) - Math.min(r, g, b) >= 0.06) {
        return -1;
    }
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

// The words in a box, where the file says to put them.
// Wrap at measured word boundaries, splitting long tokens when necessary.
function drawioWrapLabel(text, measurer, size, bold, width) {
    return text.split("\n").map(function (paragraph) {
        var lines = [], line = "";
        paragraph.split(/\s+/).forEach(function (word) {
            if (!word) { return; }
            var candidate = line ? line + " " + word : word;
            if (measurer.size(candidate, size, bold, false).width <= width) {
                line = candidate;
                return;
            }
            if (line) { lines.push(line); line = ""; }
            Array.from(word).forEach(function (character) {
                if (line && measurer.size(line + character, size, bold, false).width > width) {
                    lines.push(line); line = "";
                }
                line += character;
            });
        });
        lines.push(line);
        return lines.join("\n");
    }).join("\n");
}

function drawioVertexLabel(figure, measurer, cell) {
    var text = drawioLabel(cell.value);
    if (!text) {
        return;
    }
    var style = cell.style;
    var shape = String(style.shape || style._first || "").toLowerCase();
    // The same fill the shape was drawn with, so the words know what they are sitting on.
    // A text-only cell has no box under it, whatever its style says it would be filled with.
    var boxed = !(shape === "text" || style.text === true);
    var fill = boxed ? drawioInk(style.fillcolor, "#ffffff") : "none";
    var size = Math.max(8, Math.min(drawioNumber(style.fontsize) || LABEL_SIZE, 28));
    var bits = drawioNumber(style.fontstyle);
    var swimlane = style.swimlane === true || shape === "swimlane";
    var top = style.verticalalign === "top" || swimlane;
    // Where the words sit across the box. draw.io's default is centred, and a cell that says
    // otherwise usually means it: a bulleted list of outputs set to `align=left` reads as a
    // list when it is left-aligned and as a poem when it is not.
    var align = String(style.align || "center").toLowerCase();
    var spacing = style.spacing === undefined ? 2 : drawioNumber(style.spacing);
    var pad = Math.max(0, spacing + drawioNumber(style.spacingleft)) + 2;
    var rightPad = Math.max(0, spacing + drawioNumber(style.spacingright)) + 2;
    var topPad = Math.max(0, spacing + drawioNumber(style.spacingtop)) + 2;
    var bottomPad = Math.max(0, spacing + drawioNumber(style.spacingbottom)) + 2;
    var bold = (bits & 1) === 1 || swimlane;
    var availableWidth = Math.max(1, cell.width - pad - rightPad);
    var availableHeight = Math.max(1, (swimlane
        ? Math.min(drawioNumber(style.startsize) || 23, cell.height) : cell.height) - topPad - bottomPad);
    var original = text;
    var measured;
    do {
        text = drawioWrapLabel(original, measurer, size, bold, availableWidth);
        measured = measureLines(measurer, text, size, bold, false);
        if (measured.height <= availableHeight || size <= 1) { break; }
        size = Math.max(1, size - 1);
    } while (true);
    var x = cell.ax + pad + availableWidth / 2;
    if (align === "left") {
        x = cell.ax + pad;
    } else if (align === "right") {
        x = cell.ax + cell.width - rightPad;
    }
    var y = cell.ay + topPad + availableHeight / 2;
    if (swimlane) {
        y = cell.ay + Math.min(drawioNumber(style.startsize) || 23, cell.height) / 2;
    } else if (top) {
        y = cell.ay + measured.height / 2 + topPad;
    } else if (style.verticalalign === "bottom") {
        y = cell.ay + cell.height - measured.height / 2 - bottomPad;
    }
    if (cell.offset) { x += cell.offset.x; y += cell.offset.y; }
    drawLines(figure, measurer, text, x, y, {
        size: size,
        align: align === "left" || align === "right" ? align : "center",
        bold: (bits & 1) === 1 || swimlane,
        italic: (bits & 2) === 2,
        ink: drawioLabelInk(style, fill)
    });
}

// An edge, from wherever the file says it starts to wherever it says it ends.
//
// draw.io keeps the *waypoints* somebody dragged, and those are the shape of the line: an
// edge redrawn as a straight run between two boxes goes through everything the author moved
// it around. What is not in the file is where it meets each box — that is computed from the
// direction it arrives in, which is why an edge with no waypoints still leaves and lands
// somewhere sensible.
function drawioPort(vertex, style, prefix, towards) {
    if (!vertex || !vertex.isVertex) { return null; }
    if (style[prefix + "x"] === undefined || style[prefix + "y"] === undefined) {
        return drawioBorder(vertex, towards);
    }
    return { x: vertex.ax + drawioNumber(style[prefix + "x"]) * vertex.width
                + drawioNumber(style[prefix + "dx"]),
             y: vertex.ay + drawioNumber(style[prefix + "y"]) * vertex.height
                + drawioNumber(style[prefix + "dy"]) };
}

function drawioDirection(vertex, point) {
    if (!vertex) { return { x: 1, y: 0 }; }
    var sides = [
        { d: Math.abs(point.x - vertex.ax), x: -1, y: 0 },
        { d: Math.abs(point.x - vertex.ax - vertex.width), x: 1, y: 0 },
        { d: Math.abs(point.y - vertex.ay), x: 0, y: -1 },
        { d: Math.abs(point.y - vertex.ay - vertex.height), x: 0, y: 1 }
    ];
    sides.sort(function (a, b) { return a.d - b.d; });
    return sides[0];
}

function drawioEdgePath(cell, byID) {
    var from = byID[cell.source], to = byID[cell.target];
    var parent = byID[cell.parent];
    var ox = parent && parent.isVertex ? parent.ax : 0;
    var oy = parent && parent.isVertex ? parent.ay : 0;
    function absolute(p) { return p ? { x: p.x + ox, y: p.y + oy } : null; }
    var waypoints = cell.points.map(absolute);
    var start = from && from.isVertex ? drawioCentre(from) : absolute(cell.sourcePoint);
    var end = to && to.isVertex ? drawioCentre(to) : absolute(cell.targetPoint);
    if (!start || !end) { return null; }
    start = drawioPort(from, cell.style, "exit", waypoints[0] || end) || start;
    end = drawioPort(to, cell.style, "entry", waypoints[waypoints.length - 1] || start) || end;
    var points = [start].concat(waypoints, [end]);
    if (/orthogonal|elbow/i.test(cell.style.edgestyle || "")) {
        var a = drawioDirection(from, start), b = drawioDirection(to, end);
        var jetty = Math.max(12, drawioNumber(cell.style.jettysize) || 20);
        var first = { x: start.x + a.x * jetty, y: start.y + a.y * jetty };
        var last = { x: end.x + b.x * jetty, y: end.y + b.y * jetty };
        var middle = waypoints;
        if (!middle.length) {
            if (a.x && b.x) {
                var mx = (first.x + last.x) / 2;
                middle = [{ x: mx, y: first.y }, { x: mx, y: last.y }];
            } else if (a.y && b.y) {
                var my = (first.y + last.y) / 2;
                middle = [{ x: first.x, y: my }, { x: last.x, y: my }];
            } else {
                middle = [a.x ? { x: last.x, y: first.y } : { x: first.x, y: last.y }];
            }
        }
        points = [start].concat(drawioOrthogonal([first].concat(middle, [last])), [end]);
    }
    var clean = points.filter(function (p, i) {
        return !i || Math.abs(p.x - points[i - 1].x) + Math.abs(p.y - points[i - 1].y) > 0.001;
    });
    for (var i = 1; i < clean.length - 1;) {
        var a = clean[i - 1], b = clean[i], c = clean[i + 1];
        if ((b.x-a.x)*(c.y-b.y) === (b.y-a.y)*(c.x-b.x)
            && (b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y) >= 0) { clean.splice(i, 1); }
        else { i++; }
    }
    return clean;
}

// Approximate rounded elbows with short segments in the native polyline vocabulary.
function drawioRound(points) {
    var out = [points[0]];
    for (var i = 1; i < points.length - 1; i++) {
        var p = points[i], before = points[i - 1], after = points[i + 1];
        var d1 = Math.hypot(p.x - before.x, p.y - before.y);
        var d2 = Math.hypot(after.x - p.x, after.y - p.y);
        var r = Math.min(8, d1 / 2, d2 / 2);
        var a = { x: p.x + (before.x - p.x) * r / d1, y: p.y + (before.y - p.y) * r / d1 };
        var b = { x: p.x + (after.x - p.x) * r / d2, y: p.y + (after.y - p.y) * r / d2 };
        out.push(a);
        for (var j = 1; j <= 4; j++) {
            var t = j / 4, u = 1 - t;
            out.push({ x: u*u*a.x + 2*u*t*p.x + t*t*b.x,
                       y: u*u*a.y + 2*u*t*p.y + t*t*b.y });
        }
    }
    out.push(points[points.length - 1]);
    return out;
}

// Corners rather than diagonals, for an edge whose style asks for them. Each pair that is
// neither level nor plumb gains one turn: horizontal first, which is what draw.io's own
// router does for the common left-to-right case.
function drawioOrthogonal(points) {
    var out = [points[0]];
    for (var i = 1; i < points.length; i++) {
        var previous = out[out.length - 1];
        var next = points[i];
        var dx = Math.abs(next.x - previous.x);
        var dy = Math.abs(next.y - previous.y);
        if (dx > 1 && dy > 1) {
            out.push(dx >= dy ? { x: next.x, y: previous.y } : { x: previous.x, y: next.y });
        }
        out.push(next);
    }
    return out;
}

// An edge's words, on the line, however many lines they are. `Figure.edgeLabel` knocks the
// line out from under one row of text; a label with a break in it needs one per row, stacked
// about the point rather than all at it.
function drawioEdgeText(figure, measurer, text, x, y, style) {
    style = style || {};
    var size = Math.max(1, Math.min(drawioNumber(style.fontsize) || SMALL_LABEL_SIZE, 400));
    var bold = (drawioNumber(style.fontstyle) & 1) !== 0;
    var measured = measureLines(measurer, text, size, bold, false);
    var align = style.align || "center";
    var left = align === "left" ? x : align === "right" ? x - measured.width : x - measured.width / 2;
    figure.box(left - 3, y - measured.height / 2 - 1, measured.width + 6, measured.height + 2,
        { fill: drawioInk(style.labelbackgroundcolor, "#ffffff"), stroke: "none" });
    drawLines(figure, measurer, text, x, y, { size: size, bold: bold, align: align,
        italic: (drawioNumber(style.fontstyle) & 2) !== 0, ink: drawioLabelInk(style, "none") });
}

function drawioMarker(figure, tip, origin, kind, size, filled, ink, width) {
    if (kind === "none" || kind === "false") { return; }
    var dx = tip.x - origin.x, dy = tip.y - origin.y;
    var length = Math.hypot(dx, dy);
    if (!length) { return; }
    var ux = dx / length, uy = dy / length;
    function point(back, side) {
        return { x: tip.x - ux * back - uy * side, y: tip.y - uy * back + ux * side };
    }
    var points;
    if (kind === "diamond" || kind === "diamondthin") {
        points = [tip, point(size / 2, size * 0.4), point(size, 0), point(size / 2, -size * 0.4)];
    } else if (kind === "oval") {
        points = [];
        for (var i = 0; i < 16; i++) {
            var angle = i * Math.PI / 8;
            points.push(point(size / 2 + Math.cos(angle) * size / 2, Math.sin(angle) * size / 2));
        }
    } else {
        points = [point(size, size * 0.45), tip, point(size, -size * 0.45)];
        if (/classic/.test(kind)) { points.push(point(size * 0.75, 0)); }
    }
    var open = /^open/.test(kind);
    figure.line(points, { stroke: ink, strokeWidth: width, closed: !open,
        fill: open ? "none" : filled ? ink : "#ffffff" });
}

function drawioEdge(figure, cell, byID) {
    var points = drawioEdgePath(cell, byID);
    if (!points || points.length < 2) { return null; }
    var style = cell.style;
    var ink = drawioInk(style.strokecolor, "#000000");
    if (ink === "surface") { ink = "secondary"; }
    var width = Math.max(1, drawioNumber(style.strokewidth) || 1);
    var shaft = points.map(function (p) { return { x: p.x, y: p.y }; });
    // Stop the shaft at the base of closed markers so it cannot poke through the tip.
    function shorten(index, adjacent, kind, size) {
        if (kind === "none" || kind === "false" || /^open/.test(kind)) { return; }
        var tip = shaft[index], towards = shaft[adjacent];
        var length = Math.hypot(towards.x - tip.x, towards.y - tip.y);
        var amount = Math.min(size * (/classic/.test(kind) ? 0.75 : 1), length * 0.8);
        if (length) { shaft[index] = { x: tip.x + (towards.x - tip.x) * amount / length,
                                      y: tip.y + (towards.y - tip.y) * amount / length }; }
    }
    shorten(0, 1, String(style.startarrow || "none"), Math.max(12, drawioNumber(style.startsize) * 2 || 12, width * 5));
    shorten(shaft.length - 1, shaft.length - 2, String(style.endarrow === undefined ? "block" : style.endarrow),
        Math.max(12, drawioNumber(style.endsize) * 2 || 12, width * 5));
    var rendered = style.rounded === "1" ? drawioRound(shaft) : shaft;
    // The host accepts at most 64 points in one primitive.
    for (var i = 0; i < rendered.length - 1; i += 63) {
        figure.line(rendered.slice(i, i + 64), {
            stroke: ink, dashed: style.dashed === "1", strokeWidth: width
        });
    }
    drawioMarker(figure, points[0], points[1], String(style.startarrow || "none").toLowerCase(),
        Math.max(12, drawioNumber(style.startsize) * 2 || 12, width * 5), style.startfill !== "0", ink, width);
    drawioMarker(figure, points[points.length - 1], points[points.length - 2],
        String(style.endarrow === undefined ? "block" : style.endarrow).toLowerCase(),
        Math.max(12, drawioNumber(style.endsize) * 2 || 12, width * 5), style.endfill !== "0", ink, width);
    return points;
}

// A point some fraction of the way along a path, measured in length rather than in corners:
// a long run followed by a short one has its middle in the long one, which is where a reader
// looks for the label.
function drawioAlong(points, fraction) {
    var lengths = [];
    var total = 0;
    var i;
    for (i = 1; i < points.length; i++) {
        var dx = points[i].x - points[i - 1].x;
        var dy = points[i].y - points[i - 1].y;
        var length = Math.sqrt(dx * dx + dy * dy);
        lengths.push(length);
        total += length;
    }
    if (!total) {
        return { x: points[0].x, y: points[0].y };
    }
    var walked = 0;
    var want = total * Math.min(Math.max(fraction, 0), 1);
    for (i = 0; i < lengths.length; i++) {
        if (walked + lengths[i] >= want) {
            var t = lengths[i] ? (want - walked) / lengths[i] : 0;
            return { x: points[i].x + (points[i + 1].x - points[i].x) * t,
                     y: points[i].y + (points[i + 1].y - points[i].y) * t };
        }
        walked += lengths[i];
    }
    return { x: points[points.length - 1].x, y: points[points.length - 1].y };
}

// Whether one box wholly contains another, which is what makes the first a region rather
// than a node — a hair of tolerance, since a child flush against a container's edge is still
// inside it as far as anybody reading the diagram is concerned.
function drawioHolds(outer, inner) {
    return inner.x >= outer.x - 2 && inner.y >= outer.y - 2
        && inner.x + inner.width <= outer.x + outer.width + 2
        && inner.y + inner.height <= outer.y + outer.height + 2;
}

function drawioInsideAny(point, boxes) {
    for (var i = 0; i < boxes.length; i++) {
        var box = boxes[i];
        if (point.x > box.x - 4 && point.x < box.x + box.width + 4
            && point.y > box.y - 4 && point.y < box.y + box.height + 4) {
            return true;
        }
    }
    return false;
}

// Honor the saved along-edge position, perpendicular distance and absolute offset.
function drawioEdgeLabelPoint(points, cell, boxes) {
    var fraction = cell && cell.relative ? (cell.x + 1) / 2 : 0.5;
    var point = drawioAlong(points, fraction);
    if (cell && cell.relative && cell.y) {
        var before = drawioAlong(points, Math.max(0, fraction - 0.0001));
        var after = drawioAlong(points, Math.min(1, fraction + 0.0001));
        var dx = after.x - before.x, dy = after.y - before.y;
        var length = Math.hypot(dx, dy) || 1;
        point.x += dy / length * cell.y;
        point.y -= dx / length * cell.y;
    }
    if (cell && cell.offset) {
        point.x += cell.offset.x; point.y += cell.offset.y;
    }
    return point;
}

// One page, painted.
//
// The order is the z-order and there is no other: edges first so a box is never drawn with a
// line across its face, then the boxes, then every label, so a container drawn after its
// contents cannot bury their words.
function drawioPage(page, measurer, source) {
    var model = drawioCells(page.model);
    drawioPlace(model);
    var cells = model.cells;
    var figure = new Figure();
    var paths = {};
    var boxes = [];
    var i;

    var regions = {};
    cells.forEach(function (cell) {
        if (!cell.isVertex || !cell.width || !cell.height) { return; }
        regions[cell.id] = cells.some(function (other) {
            return other.id !== cell.id && other.isVertex && other.width > 0 && other.height > 0
                && cell.width * cell.height > other.width * other.height
                && drawioHolds({ x: cell.ax, y: cell.ay, width: cell.width, height: cell.height },
                    { x: other.ax, y: other.ay, width: other.width, height: other.height });
        });
    });
    cells.filter(function (cell) { return regions[cell.id]; })
        .sort(function (a, b) { return b.width * b.height - a.width * a.height; })
        .forEach(function (cell) { drawioVertexShape(figure, cell); });

    for (i = 0; i < cells.length; i++) {
        if (cells[i].isEdge) {
            var path = drawioEdge(figure, cells[i], model.byID);
            if (path) {
                paths[cells[i].id] = path;
            }
        }
    }
    for (i = 0; i < cells.length; i++) {
        if (cells[i].isVertex && !regions[cells[i].id] && !cells[i].style.edgelabel && cells[i].width > 0) {
            drawioVertexShape(figure, cells[i]);
        }
    }
    for (i = 0; i < cells.length; i++) {
        var cell = cells[i];
        if (!cell.isVertex) {
            continue;
        }
        // A label attached to an edge rides on the line rather than sitting in a box of its
        // own — which is what it looks like in draw.io, and it is how a "yes" branch is told
        // from a "no" one.
        if (cell.style.edgelabel || (cell.relative && paths[cell.parent])) {
            var attached = drawioLabel(cell.value);
            if (attached && paths[cell.parent]) {
                var at = drawioEdgeLabelPoint(paths[cell.parent], cell, null);
                drawioEdgeText(figure, measurer, attached, at.x, at.y, cell.style);
            }
        } else if (cell.width > 0) {
            drawioVertexLabel(figure, measurer, cell);
        }
    }
    // An edge's *own* value is a label on the line too, and in real files it is far commoner
    // than the separate cell above: 264 of them against 76 across the diagrams this was
    // built on. Drawn last, with the rest of the words, so nothing is laid over them.
    for (i = 0; i < cells.length; i++) {
        if (cells[i].isEdge && paths[cells[i].id]) {
            var own = drawioLabel(cells[i].value);
            if (own) {
                var point = drawioEdgeLabelPoint(paths[cells[i].id], cells[i], boxes);
                drawioEdgeText(figure, measurer, own, point.x, point.y, cells[i].style);
            }
        }
    }

    var bounds = drawioBounds(figure.shapes, measurer);
    if (!bounds) {
        return null;
    }
    if (bounds.width > DRAWIO_MAX_SPAN || bounds.height > DRAWIO_MAX_SPAN) {
        return null;
    }
    // The page's own coordinates start wherever the author happened to drag the first box.
    // A figure starts at its own origin, so everything moves by the same amount and nothing
    // about the arrangement changes.
    for (i = 0; i < figure.shapes.length; i++) {
        shiftShape(figure.shapes[i], -bounds.x, -bounds.y);
    }
    figure.shapes.unshift({ type: "box", x: 0, y: 0, width: bounds.width, height: bounds.height,
        fill: drawioInk(page.model.attrs.background, "#ffffff"), stroke: "none" });
    return figure.figure(bounds.width, bounds.height, page.name || null, source);
}

// What the page occupies, from what was actually drawn rather than from the geometry: a
// cylinder's cap and an actor's arms stick out past the cell they came from.
function drawioBounds(shapes, measurer) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < shapes.length; i++) {
        var shape = shapes[i];
        if (shape.type === "line") {
            for (var p = 0; p < shape.points.length; p++) {
                minX = Math.min(minX, shape.points[p].x);
                maxX = Math.max(maxX, shape.points[p].x);
                minY = Math.min(minY, shape.points[p].y);
                maxY = Math.max(maxY, shape.points[p].y);
            }
        } else if (shape.type === "label") {
            var measured = measurer.size(shape.text, shape.size, shape.bold, shape.mono);
            var left = shape.x - (shape.align === "trailing" ? measured.width : shape.align === "leading" ? 0 : measured.width / 2);
            minX = Math.min(minX, left);
            maxX = Math.max(maxX, left + measured.width);
            minY = Math.min(minY, shape.y - measured.height / 2);
            maxY = Math.max(maxY, shape.y + measured.height / 2);
        } else {
            minX = Math.min(minX, shape.x);
            maxX = Math.max(maxX, shape.x + shape.width);
            minY = Math.min(minY, shape.y);
            maxY = Math.max(maxY, shape.y + shape.height);
        }
    }
    if (!isFinite(minX) || !isFinite(minY) || maxX <= minX || maxY <= minY) {
        return null;
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// The pages in the file. A `.drawio` holds one `<diagram>` per tab along the bottom of
// draw.io's own window, and losing all but the first would silently hide most of a document
// somebody spent an afternoon on.
function drawioPages(text) {
    var root = xmlParse(text);
    if (!root) {
        return null;
    }
    var diagrams = xmlFind(root, "diagram");
    if (!diagrams.length) {
        return null;
    }
    var pages = [];
    for (var i = 0; i < diagrams.length && pages.length < DRAWIO_MAX_PAGES; i++) {
        var model = diagrams[i].children.filter(function (child) {
            return child.tag === "mxGraphModel";
        })[0];
        pages.push({
            name: diagrams[i].attrs.name || "",
            model: model || null,
            // No model and a payload of text means the diagram is deflate-compressed, which
            // this cannot read. Recorded rather than ignored so the reader is told which
            // switch to turn off, instead of being shown an empty page.
            compressed: !model && /[A-Za-z0-9+/=]{40,}/.test(diagrams[i].text || "")
        });
    }
    return pages;
}

function renderDrawio(text) {
    if (text.length > PREVIEW_LIMIT) {
        return tooLarge(text);
    }
    var pages = drawioPages(text);
    if (!pages) {
        return [
            { type: "heading", level: 3, source: 0,
              spans: [span("Not a draw.io file this preview can read", {})] },
            { type: "paragraph", source: 0, spans: [span(
                "A .drawio file is an <mxfile> holding one <diagram> per page. This one has "
                + "neither.", {})] }
        ];
    }
    var measurer = new Measurer();
    var blocks = [];
    var drawn = 0;
    for (var i = 0; i < pages.length; i++) {
        var page = pages[i];
        // Named only when there is more than one, since a heading above the single page of a
        // one-page file is a title nobody asked for.
        if (pages.length > 1 && page.name) {
            blocks.push({ type: "heading", level: 3, source: 0,
                          spans: [span(page.name, {})] });
        }
        if (page.compressed) {
            blocks.push({ type: "paragraph", source: 0, spans: [span(
                "This page is stored compressed, which this preview cannot read. In draw.io, "
                + "turn it off with File ▸ Properties ▸ Compressed and save again.", {})] });
            continue;
        }
        var figure = page.model ? drawioPage(page, measurer, 0) : null;
        if (figure) {
            blocks.push(figure);
            drawn++;
        } else {
            blocks.push({ type: "paragraph", source: 0, spans: [span(
                "This page has nothing to draw.", {})] });
        }
    }
    if (!drawn && !blocks.length) {
        return [{ type: "paragraph", source: 0,
                  spans: [span("This file has no pages to draw.", {})] }];
    }
    return blocks;
}

function renderFencedDiagram(language, text, source) {
    if (/^mermaid$/i.test(language)) {
        return renderDiagram(text, source);
    }
    if (/^(plantuml|puml|uml)$/i.test(language)) {
        return renderPlantDiagram(text, source);
    }
    return null;
}

// A file that is nothing but a diagram. The same engine, given the whole buffer
// instead of a fence, so `.mmd` next to a README renders the same way the fence
// in the README does — and a file that does not parse says so as a heading
// rather than drawing an empty page.
function renderMermaid(text) {
    if (text.length > PREVIEW_LIMIT) {
        return tooLarge(text);
    }
    var drawn = renderDiagram(text, 0);
    if (drawn) {
        return [drawn];
    }
    return [
        { type: "heading", level: 3, spans: [span("Not a diagram this preview can draw", {})],
          source: 0 },
        { type: "paragraph", source: 0, spans: [span(
            "Supported: flowchart, graph, classDiagram, stateDiagram-v2 and sequenceDiagram.",
            {})] },
        { type: "code", text: String(text), language: "mermaid", source: 0 }
    ];
}

function renderPlantUML(text) {
    if (text.length > PREVIEW_LIMIT) {
        return tooLarge(text);
    }
    var drawn = renderPlantDiagram(text, 0);
    if (drawn) {
        return [drawn];
    }
    return [
        { type: "heading", level: 3, spans: [span("Not a diagram this preview can draw", {})],
          source: 0 },
        { type: "paragraph", source: 0, spans: [span(
            "Supported: class, sequence and state diagrams. Deployment, component, timing "
            + "and the rest come out as their own source.", {})] },
        { type: "code", text: String(text), language: "plantuml", source: 0 }
    ];
}

linelark.addPreview({
    id: "plantuml",
    title: "Diagram",
    extensions: ["puml", "plantuml", "pu", "iuml", "wsd"],
    languages: ["plantuml"],
    render: renderPlantUML
});

linelark.addPreview({
    id: "mermaid",
    title: "Diagram",
    extensions: ["mmd", "mermaid"],
    languages: ["mermaid"],
    render: renderMermaid
});

linelark.addPreview({
    id: "drawio",
    title: "Diagram",
    extensions: ["drawio", "dio"],
    render: renderDrawio
});

linelark.addPreview({
    id: "markdown",
    title: "Markdown",
    extensions: ["md", "markdown", "mdown", "mkd", "mkdn", "mdtext"],
    languages: ["markdown"],
    render: renderMarkdown
});

linelark.addPreview({
    id: "html",
    title: "HTML",
    extensions: ["html", "htm", "xhtml", "shtml"],
    languages: ["html"],
    render: renderHTML
});

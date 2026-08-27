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
        return { type: "code", text: token.text,
                 language: token.lang ? String(token.lang).split(/\s+/)[0] : "",
                 source: source };
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

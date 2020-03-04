(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/*
Copyright (c) 2015, Yahoo! Inc. All rights reserved.
Copyrights licensed under the New BSD License.
See the accompanying LICENSE file for terms.

Authors: Nera Liu <neraliu@yahoo-inc.com>
         Adonis Fung <adon@yahoo-inc.com>
         Albert Yu <albertyu@yahoo-inc.com>
*/
/*jshint node: true */

exports._getPrivFilters = function () {

    var LT     = /</g,
        QUOT   = /"/g,
        SQUOT  = /'/g,
        AMP    = /&/g,
        NULL   = /\x00/g,
        SPECIAL_ATTR_VALUE_UNQUOTED_CHARS = /(?:^$|[\x00\x09-\x0D "'`=<>])/g,
        SPECIAL_HTML_CHARS = /[&<>"'`]/g, 
        SPECIAL_COMMENT_CHARS = /(?:\x00|^-*!?>|--!?>|--?!?$|\]>|\]$)/g;

    // CSS sensitive chars: ()"'/,!*@{}:;
    // By CSS: (Tab|NewLine|colon|semi|lpar|rpar|apos|sol|comma|excl|ast|midast);|(quot|QUOT)
    // By URI_PROTOCOL: (Tab|NewLine);
    var SENSITIVE_HTML_ENTITIES = /&(?:#([xX][0-9A-Fa-f]+|\d+);?|(Tab|NewLine|colon|semi|lpar|rpar|apos|sol|comma|excl|ast|midast|ensp|emsp|thinsp);|(nbsp|amp|AMP|lt|LT|gt|GT|quot|QUOT);?)/g,
        SENSITIVE_NAMED_REF_MAP = {Tab: '\t', NewLine: '\n', colon: ':', semi: ';', lpar: '(', rpar: ')', apos: '\'', sol: '/', comma: ',', excl: '!', ast: '*', midast: '*', ensp: '\u2002', emsp: '\u2003', thinsp: '\u2009', nbsp: '\xA0', amp: '&', lt: '<', gt: '>', quot: '"', QUOT: '"'};

    // var CSS_VALID_VALUE = 
    //     /^(?:
    //     (?!-*expression)#?[-\w]+
    //     |[+-]?(?:\d+|\d*\.\d+)(?:em|ex|ch|rem|px|mm|cm|in|pt|pc|%|vh|vw|vmin|vmax)?
    //     |!important
    //     | //empty
    //     )$/i;
    var CSS_VALID_VALUE = /^(?:(?!-*expression)#?[-\w]+|[+-]?(?:\d+|\d*\.\d+)(?:r?em|ex|ch|cm|mm|in|px|pt|pc|%|vh|vw|vmin|vmax)?|!important|)$/i,
        // TODO: prevent double css escaping by not encoding \ again, but this may require CSS decoding
        // \x7F and \x01-\x1F less \x09 are for Safari 5.0, added []{}/* for unbalanced quote
        CSS_DOUBLE_QUOTED_CHARS = /[\x00-\x1F\x7F\[\]{}\\"]/g,
        CSS_SINGLE_QUOTED_CHARS = /[\x00-\x1F\x7F\[\]{}\\']/g,
        // (, \u207D and \u208D can be used in background: 'url(...)' in IE, assumed all \ chars are encoded by QUOTED_CHARS, and null is already replaced with \uFFFD
        // otherwise, use this CSS_BLACKLIST instead (enhance it with url matching): /(?:\\?\(|[\u207D\u208D]|\\0{0,4}28 ?|\\0{0,2}20[78][Dd] ?)+/g
        CSS_BLACKLIST = /url[\(\u207D\u208D]+/g,
        // this assumes encodeURI() and encodeURIComponent() has escaped 1-32, 127 for IE8
        CSS_UNQUOTED_URL = /['\(\)]/g; // " \ treated by encodeURI()

    // Given a full URI, need to support "[" ( IPv6address ) "]" in URI as per RFC3986
    // Reference: https://tools.ietf.org/html/rfc3986
    var URL_IPV6 = /\/\/%5[Bb]([A-Fa-f0-9:]+)%5[Dd]/;


    // Reference: http://shazzer.co.uk/database/All/characters-allowd-in-html-entities
    // Reference: http://shazzer.co.uk/vector/Characters-allowed-after-ampersand-in-named-character-references
    // Reference: http://shazzer.co.uk/database/All/Characters-before-javascript-uri
    // Reference: http://shazzer.co.uk/database/All/Characters-after-javascript-uri
    // Reference: https://html.spec.whatwg.org/multipage/syntax.html#consume-a-character-reference
    // Reference for named characters: https://html.spec.whatwg.org/multipage/entities.json
    var URI_BLACKLIST_PROTOCOLS = {'javascript':1, 'data':1, 'vbscript':1, 'mhtml':1, 'x-schema':1},
        URI_PROTOCOL_COLON = /(?::|&#[xX]0*3[aA];?|&#0*58;?|&colon;)/,
        URI_PROTOCOL_WHITESPACES = /(?:^[\x00-\x20]+|[\t\n\r\x00]+)/g,
        URI_PROTOCOL_NAMED_REF_MAP = {Tab: '\t', NewLine: '\n'};

    var x, 
        strReplace = function (s, regexp, callback) {
            return s === undefined ? 'undefined'
                    : s === null            ? 'null'
                    : s.toString().replace(regexp, callback);
        },
        fromCodePoint = String.fromCodePoint || function(codePoint) {
            if (arguments.length === 0) {
                return '';
            }
            if (codePoint <= 0xFFFF) { // BMP code point
                return String.fromCharCode(codePoint);
            }

            // Astral code point; split in surrogate halves
            // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
            codePoint -= 0x10000;
            return String.fromCharCode((codePoint >> 10) + 0xD800, (codePoint % 0x400) + 0xDC00);
        };


    function getProtocol(str) {
        var s = str.split(URI_PROTOCOL_COLON, 2);
        // str.length !== s[0].length is for older IE (e.g., v8), where delimeter residing at last will result in length equals 1, but not 2
        return (s[0] && (s.length === 2 || str.length !== s[0].length)) ? s[0] : null;
    }

    function htmlDecode(s, namedRefMap, reNamedRef, skipReplacement) {
        
        namedRefMap = namedRefMap || SENSITIVE_NAMED_REF_MAP;
        reNamedRef = reNamedRef || SENSITIVE_HTML_ENTITIES;

        function regExpFunction(m, num, named, named1) {
            if (num) {
                num = Number(num[0] <= '9' ? num : '0' + num);
                // switch(num) {
                //     case 0x80: return '\u20AC';  // EURO SIGN (€)
                //     case 0x82: return '\u201A';  // SINGLE LOW-9 QUOTATION MARK (‚)
                //     case 0x83: return '\u0192';  // LATIN SMALL LETTER F WITH HOOK (ƒ)
                //     case 0x84: return '\u201E';  // DOUBLE LOW-9 QUOTATION MARK („)
                //     case 0x85: return '\u2026';  // HORIZONTAL ELLIPSIS (…)
                //     case 0x86: return '\u2020';  // DAGGER (†)
                //     case 0x87: return '\u2021';  // DOUBLE DAGGER (‡)
                //     case 0x88: return '\u02C6';  // MODIFIER LETTER CIRCUMFLEX ACCENT (ˆ)
                //     case 0x89: return '\u2030';  // PER MILLE SIGN (‰)
                //     case 0x8A: return '\u0160';  // LATIN CAPITAL LETTER S WITH CARON (Š)
                //     case 0x8B: return '\u2039';  // SINGLE LEFT-POINTING ANGLE QUOTATION MARK (‹)
                //     case 0x8C: return '\u0152';  // LATIN CAPITAL LIGATURE OE (Œ)
                //     case 0x8E: return '\u017D';  // LATIN CAPITAL LETTER Z WITH CARON (Ž)
                //     case 0x91: return '\u2018';  // LEFT SINGLE QUOTATION MARK (‘)
                //     case 0x92: return '\u2019';  // RIGHT SINGLE QUOTATION MARK (’)
                //     case 0x93: return '\u201C';  // LEFT DOUBLE QUOTATION MARK (“)
                //     case 0x94: return '\u201D';  // RIGHT DOUBLE QUOTATION MARK (”)
                //     case 0x95: return '\u2022';  // BULLET (•)
                //     case 0x96: return '\u2013';  // EN DASH (–)
                //     case 0x97: return '\u2014';  // EM DASH (—)
                //     case 0x98: return '\u02DC';  // SMALL TILDE (˜)
                //     case 0x99: return '\u2122';  // TRADE MARK SIGN (™)
                //     case 0x9A: return '\u0161';  // LATIN SMALL LETTER S WITH CARON (š)
                //     case 0x9B: return '\u203A';  // SINGLE RIGHT-POINTING ANGLE QUOTATION MARK (›)
                //     case 0x9C: return '\u0153';  // LATIN SMALL LIGATURE OE (œ)
                //     case 0x9E: return '\u017E';  // LATIN SMALL LETTER Z WITH CARON (ž)
                //     case 0x9F: return '\u0178';  // LATIN CAPITAL LETTER Y WITH DIAERESIS (Ÿ)
                // }
                // // num >= 0xD800 && num <= 0xDFFF, and 0x0D is separately handled, as it doesn't fall into the range of x.pec()
                // return (num >= 0xD800 && num <= 0xDFFF) || num === 0x0D ? '\uFFFD' : x.frCoPt(num);

                return skipReplacement ? fromCodePoint(num)
                        : num === 0x80 ? '\u20AC'  // EURO SIGN (€)
                        : num === 0x82 ? '\u201A'  // SINGLE LOW-9 QUOTATION MARK (‚)
                        : num === 0x83 ? '\u0192'  // LATIN SMALL LETTER F WITH HOOK (ƒ)
                        : num === 0x84 ? '\u201E'  // DOUBLE LOW-9 QUOTATION MARK („)
                        : num === 0x85 ? '\u2026'  // HORIZONTAL ELLIPSIS (…)
                        : num === 0x86 ? '\u2020'  // DAGGER (†)
                        : num === 0x87 ? '\u2021'  // DOUBLE DAGGER (‡)
                        : num === 0x88 ? '\u02C6'  // MODIFIER LETTER CIRCUMFLEX ACCENT (ˆ)
                        : num === 0x89 ? '\u2030'  // PER MILLE SIGN (‰)
                        : num === 0x8A ? '\u0160'  // LATIN CAPITAL LETTER S WITH CARON (Š)
                        : num === 0x8B ? '\u2039'  // SINGLE LEFT-POINTING ANGLE QUOTATION MARK (‹)
                        : num === 0x8C ? '\u0152'  // LATIN CAPITAL LIGATURE OE (Œ)
                        : num === 0x8E ? '\u017D'  // LATIN CAPITAL LETTER Z WITH CARON (Ž)
                        : num === 0x91 ? '\u2018'  // LEFT SINGLE QUOTATION MARK (‘)
                        : num === 0x92 ? '\u2019'  // RIGHT SINGLE QUOTATION MARK (’)
                        : num === 0x93 ? '\u201C'  // LEFT DOUBLE QUOTATION MARK (“)
                        : num === 0x94 ? '\u201D'  // RIGHT DOUBLE QUOTATION MARK (”)
                        : num === 0x95 ? '\u2022'  // BULLET (•)
                        : num === 0x96 ? '\u2013'  // EN DASH (–)
                        : num === 0x97 ? '\u2014'  // EM DASH (—)
                        : num === 0x98 ? '\u02DC'  // SMALL TILDE (˜)
                        : num === 0x99 ? '\u2122'  // TRADE MARK SIGN (™)
                        : num === 0x9A ? '\u0161'  // LATIN SMALL LETTER S WITH CARON (š)
                        : num === 0x9B ? '\u203A'  // SINGLE RIGHT-POINTING ANGLE QUOTATION MARK (›)
                        : num === 0x9C ? '\u0153'  // LATIN SMALL LIGATURE OE (œ)
                        : num === 0x9E ? '\u017E'  // LATIN SMALL LETTER Z WITH CARON (ž)
                        : num === 0x9F ? '\u0178'  // LATIN CAPITAL LETTER Y WITH DIAERESIS (Ÿ)
                        : (num >= 0xD800 && num <= 0xDFFF) || num === 0x0D ? '\uFFFD'
                        : x.frCoPt(num);
            }
            return namedRefMap[named || named1] || m;
        }

        return s === undefined  ? 'undefined'
            : s === null        ? 'null'
            : s.toString().replace(NULL, '\uFFFD').replace(reNamedRef, regExpFunction);
    }

    function cssEncode(chr) {
        // space after \\HEX is needed by spec
        return '\\' + chr.charCodeAt(0).toString(16).toLowerCase() + ' ';
    }
    function cssBlacklist(s) {
        return s.replace(CSS_BLACKLIST, function(m){ return '-x-' + m; });
    }
    function cssUrl(s) {
        // encodeURI() in yufull() will throw error for use of the CSS_UNSUPPORTED_CODE_POINT (i.e., [\uD800-\uDFFF])
        s = x.yufull(htmlDecode(s));
        var protocol = getProtocol(s);

        // prefix ## for blacklisted protocols
        // here .replace(URI_PROTOCOL_WHITESPACES, '') is not needed since yufull has already percent-encoded the whitespaces
        return (protocol && URI_BLACKLIST_PROTOCOLS[protocol.toLowerCase()]) ? '##' + s : s;
    }

    return (x = {
        // turn invalid codePoints and that of non-characters to \uFFFD, and then fromCodePoint()
        frCoPt: function(num) {
            return num === undefined || num === null ? '' :
                !isFinite(num = Number(num)) || // `NaN`, `+Infinity`, or `-Infinity`
                num <= 0 ||                     // not a valid Unicode code point
                num > 0x10FFFF ||               // not a valid Unicode code point
                // Math.floor(num) != num || 

                (num >= 0x01 && num <= 0x08) ||
                (num >= 0x0E && num <= 0x1F) ||
                (num >= 0x7F && num <= 0x9F) ||
                (num >= 0xFDD0 && num <= 0xFDEF) ||
                
                 num === 0x0B || 
                (num & 0xFFFF) === 0xFFFF || 
                (num & 0xFFFF) === 0xFFFE ? '\uFFFD' : fromCodePoint(num);
        },
        d: htmlDecode,
        /*
         * @param {string} s - An untrusted uri input
         * @returns {string} s - null if relative url, otherwise the protocol with whitespaces stripped and lower-cased
         */
        yup: function(s) {
            s = getProtocol(s.replace(NULL, ''));
            // URI_PROTOCOL_WHITESPACES is required for left trim and remove interim whitespaces
            return s ? htmlDecode(s, URI_PROTOCOL_NAMED_REF_MAP, null, true).replace(URI_PROTOCOL_WHITESPACES, '').toLowerCase() : null;
        },

        /*
         * @deprecated
         * @param {string} s - An untrusted user input
         * @returns {string} s - The original user input with & < > " ' ` encoded respectively as &amp; &lt; &gt; &quot; &#39; and &#96;.
         *
         */
        y: function(s) {
            return strReplace(s, SPECIAL_HTML_CHARS, function (m) {
                return m === '&' ? '&amp;'
                    :  m === '<' ? '&lt;'
                    :  m === '>' ? '&gt;'
                    :  m === '"' ? '&quot;'
                    :  m === "'" ? '&#39;'
                    :  /*m === '`'*/ '&#96;';       // in hex: 60
            });
        },

        // This filter is meant to introduce double-encoding, and should be used with extra care.
        ya: function(s) {
            return strReplace(s, AMP, '&amp;');
        },

        // FOR DETAILS, refer to inHTMLData()
        // Reference: https://html.spec.whatwg.org/multipage/syntax.html#data-state
        yd: function (s) {
            return strReplace(s, LT, '&lt;');
        },

        // FOR DETAILS, refer to inHTMLComment()
        // All NULL characters in s are first replaced with \uFFFD.
        // If s contains -->, --!>, or starts with -*>, insert a space right before > to stop state breaking at <!--{{{yc s}}}-->
        // If s ends with --!, --, or -, append a space to stop collaborative state breaking at {{{yc s}}}>, {{{yc s}}}!>, {{{yc s}}}-!>, {{{yc s}}}->
        // Reference: https://html.spec.whatwg.org/multipage/syntax.html#comment-state
        // Reference: http://shazzer.co.uk/vector/Characters-that-close-a-HTML-comment-3
        // Reference: http://shazzer.co.uk/vector/Characters-that-close-a-HTML-comment
        // Reference: http://shazzer.co.uk/vector/Characters-that-close-a-HTML-comment-0021
        // If s contains ]> or ends with ], append a space after ] is verified in IE to stop IE conditional comments.
        // Reference: http://msdn.microsoft.com/en-us/library/ms537512%28v=vs.85%29.aspx
        // We do not care --\s>, which can possibly be intepreted as a valid close comment tag in very old browsers (e.g., firefox 3.6), as specified in the html4 spec
        // Reference: http://www.w3.org/TR/html401/intro/sgmltut.html#h-3.2.4
        yc: function (s) {
            return strReplace(s, SPECIAL_COMMENT_CHARS, function(m){
                return m === '\x00' ? '\uFFFD'
                    : m === '--!' || m === '--' || m === '-' || m === ']' ? m + ' '
                    :/*
                    :  m === ']>'   ? '] >'
                    :  m === '-->'  ? '-- >'
                    :  m === '--!>' ? '--! >'
                    : /-*!?>/.test(m) ? */ m.slice(0, -1) + ' >';
            });
        },

        // FOR DETAILS, refer to inDoubleQuotedAttr()
        // Reference: https://html.spec.whatwg.org/multipage/syntax.html#attribute-value-(double-quoted)-state
        yavd: function (s) {
            return strReplace(s, QUOT, '&quot;');
        },

        // FOR DETAILS, refer to inSingleQuotedAttr()
        // Reference: https://html.spec.whatwg.org/multipage/syntax.html#attribute-value-(single-quoted)-state
        yavs: function (s) {
            return strReplace(s, SQUOT, '&#39;');
        },

        // FOR DETAILS, refer to inUnQuotedAttr()
        // PART A.
        // if s contains any state breaking chars (\t, \n, \v, \f, \r, space, and >),
        // they are escaped and encoded into their equivalent HTML entity representations. 
        // Reference: http://shazzer.co.uk/database/All/Characters-which-break-attributes-without-quotes
        // Reference: https://html.spec.whatwg.org/multipage/syntax.html#attribute-value-(unquoted)-state
        //
        // PART B. 
        // if s starts with ', " or `, encode it resp. as &#39;, &quot;, or &#96; to 
        // enforce the attr value (unquoted) state
        // Reference: https://html.spec.whatwg.org/multipage/syntax.html#before-attribute-value-state
        // Reference: http://shazzer.co.uk/vector/Characters-allowed-attribute-quote
        // 
        // PART C.
        // Inject a \uFFFD character if an empty or all null string is encountered in 
        // unquoted attribute value state.
        // 
        // Rationale 1: our belief is that developers wouldn't expect an 
        //   empty string would result in ' name="passwd"' rendered as 
        //   attribute value, even though this is how HTML5 is specified.
        // Rationale 2: an empty or all null string (for IE) can 
        //   effectively alter its immediate subsequent state, we choose
        //   \uFFFD to end the unquoted attr 
        //   state, which therefore will not mess up later contexts.
        // Rationale 3: Since IE 6, it is verified that NULL chars are stripped.
        // Reference: https://html.spec.whatwg.org/multipage/syntax.html#attribute-value-(unquoted)-state
        // 
        // Example:
        // <input value={{{yavu s}}} name="passwd"/>
        yavu: function (s) {
            return strReplace(s, SPECIAL_ATTR_VALUE_UNQUOTED_CHARS, function (m) {
                return m === '\t'   ? '&#9;'  // in hex: 09
                    :  m === '\n'   ? '&#10;' // in hex: 0A
                    :  m === '\x0B' ? '&#11;' // in hex: 0B  for IE. IE<9 \v equals v, so use \x0B instead
                    :  m === '\f'   ? '&#12;' // in hex: 0C
                    :  m === '\r'   ? '&#13;' // in hex: 0D
                    :  m === ' '    ? '&#32;' // in hex: 20
                    :  m === '='    ? '&#61;' // in hex: 3D
                    :  m === '<'    ? '&lt;'
                    :  m === '>'    ? '&gt;'
                    :  m === '"'    ? '&quot;'
                    :  m === "'"    ? '&#39;'
                    :  m === '`'    ? '&#96;'
                    : /*empty or null*/ '\uFFFD';
            });
        },

        yu: encodeURI,
        yuc: encodeURIComponent,

        // Notice that yubl MUST BE APPLIED LAST, and will not be used independently (expected output from encodeURI/encodeURIComponent and yavd/yavs/yavu)
        // This is used to disable JS execution capabilities by prefixing x- to ^javascript:, ^vbscript: or ^data: that possibly could trigger script execution in URI attribute context
        yubl: function (s) {
            return URI_BLACKLIST_PROTOCOLS[x.yup(s)] ? 'x-' + s : s;
        },

        // This is NOT a security-critical filter.
        // Reference: https://tools.ietf.org/html/rfc3986
        yufull: function (s) {
            return x.yu(s).replace(URL_IPV6, function(m, p) {
                return '//[' + p + ']';
            });
        },

        // chain yufull() with yubl()
        yublf: function (s) {
            return x.yubl(x.yufull(s));
        },

        // The design principle of the CSS filter MUST meet the following goal(s).
        // (1) The input cannot break out of the context (expr) and this is to fulfill the just sufficient encoding principle.
        // (2) The input cannot introduce CSS parsing error and this is to address the concern of UI redressing.
        //
        // term
        //   : unary_operator?
        //     [ NUMBER S* | PERCENTAGE S* | LENGTH S* | EMS S* | EXS S* | ANGLE S* |
        //     TIME S* | FREQ S* ]
        //   | STRING S* | IDENT S* | URI S* | hexcolor | function
        // 
        // Reference:
        // * http://www.w3.org/TR/CSS21/grammar.html 
        // * http://www.w3.org/TR/css-syntax-3/
        // 
        // NOTE: delimiter in CSS -  \  _  :  ;  (  )  "  '  /  ,  %  #  !  *  @  .  {  }
        //                        2d 5c 5f 3a 3b 28 29 22 27 2f 2c 25 23 21 2a 40 2e 7b 7d

        yceu: function(s) {
            s = htmlDecode(s);
            return CSS_VALID_VALUE.test(s) ? s : ";-x:'" + cssBlacklist(s.replace(CSS_SINGLE_QUOTED_CHARS, cssEncode)) + "';-v:";
        },

        // string1 = \"([^\n\r\f\\"]|\\{nl}|\\[^\n\r\f0-9a-f]|\\[0-9a-f]{1,6}(\r\n|[ \n\r\t\f])?)*\"
        yced: function(s) {
            return cssBlacklist(htmlDecode(s).replace(CSS_DOUBLE_QUOTED_CHARS, cssEncode));
        },

        // string2 = \'([^\n\r\f\\']|\\{nl}|\\[^\n\r\f0-9a-f]|\\[0-9a-f]{1,6}(\r\n|[ \n\r\t\f])?)*\'
        yces: function(s) {
            return cssBlacklist(htmlDecode(s).replace(CSS_SINGLE_QUOTED_CHARS, cssEncode));
        },

        // for url({{{yceuu url}}}
        // unquoted_url = ([!#$%&*-~]|\\{h}{1,6}(\r\n|[ \t\r\n\f])?|\\[^\r\n\f0-9a-f])* (CSS 2.1 definition)
        // unquoted_url = ([^"'()\\ \t\n\r\f\v\u0000\u0008\u000b\u000e-\u001f\u007f]|\\{h}{1,6}(\r\n|[ \t\r\n\f])?|\\[^\r\n\f0-9a-f])* (CSS 3.0 definition)
        // The state machine in CSS 3.0 is more well defined - http://www.w3.org/TR/css-syntax-3/#consume-a-url-token0
        // CSS_UNQUOTED_URL = /['\(\)]/g; // " \ treated by encodeURI()   
        yceuu: function(s) {
            return cssUrl(s).replace(CSS_UNQUOTED_URL, function (chr) {
                return  chr === '\''        ? '\\27 ' :
                        chr === '('         ? '%28' :
                        /* chr === ')' ? */   '%29';
            });
        },

        // for url("{{{yceud url}}}
        yceud: function(s) { 
            return cssUrl(s);
        },

        // for url('{{{yceus url}}}
        yceus: function(s) { 
            return cssUrl(s).replace(SQUOT, '\\27 ');
        }
    });
};

// exposing privFilters
// this is an undocumented feature, and please use it with extra care
var privFilters = exports._privFilters = exports._getPrivFilters();


/* chaining filters */

// uriInAttr and literally uriPathInAttr
// yubl is always used 
// Rationale: given pattern like this: <a href="{{{uriPathInDoubleQuotedAttr s}}}">
//            developer may expect s is always prefixed with ? or /, but an attacker can abuse it with 'javascript:alert(1)'
function uriInAttr (s, yav, yu) {
    return privFilters.yubl(yav((yu || privFilters.yufull)(s)));
}

/** 
* Yahoo Secure XSS Filters - just sufficient output filtering to prevent XSS!
* @module xss-filters 
*/

/**
* @function module:xss-filters#inHTMLData
*
* @param {string} s - An untrusted user input
* @returns {string} The string s with '<' encoded as '&amp;lt;'
*
* @description
* This filter is to be placed in HTML Data context to encode all '<' characters into '&amp;lt;'
* <ul>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#data-state">HTML5 Data State</a></li>
* </ul>
*
* @example
* // output context to be applied by this filter.
* <div>{{{inHTMLData htmlData}}}</div>
*
*/
exports.inHTMLData = privFilters.yd;

/**
* @function module:xss-filters#inHTMLComment
*
* @param {string} s - An untrusted user input
* @returns {string} All NULL characters in s are first replaced with \uFFFD. If s contains -->, --!>, or starts with -*>, insert a space right before > to stop state breaking at <!--{{{yc s}}}-->. If s ends with --!, --, or -, append a space to stop collaborative state breaking at {{{yc s}}}>, {{{yc s}}}!>, {{{yc s}}}-!>, {{{yc s}}}->. If s contains ]> or ends with ], append a space after ] is verified in IE to stop IE conditional comments.
*
* @description
* This filter is to be placed in HTML Comment context
* <ul>
* <li><a href="http://shazzer.co.uk/vector/Characters-that-close-a-HTML-comment-3">Shazzer - Closing comments for -.-></a>
* <li><a href="http://shazzer.co.uk/vector/Characters-that-close-a-HTML-comment">Shazzer - Closing comments for --.></a>
* <li><a href="http://shazzer.co.uk/vector/Characters-that-close-a-HTML-comment-0021">Shazzer - Closing comments for .></a>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#comment-start-state">HTML5 Comment Start State</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#comment-start-dash-state">HTML5 Comment Start Dash State</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#comment-state">HTML5 Comment State</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#comment-end-dash-state">HTML5 Comment End Dash State</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#comment-end-state">HTML5 Comment End State</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#comment-end-bang-state">HTML5 Comment End Bang State</a></li>
* <li><a href="http://msdn.microsoft.com/en-us/library/ms537512%28v=vs.85%29.aspx">Conditional Comments in Internet Explorer</a></li>
* </ul>
*
* @example
* // output context to be applied by this filter.
* <!-- {{{inHTMLComment html_comment}}} -->
*
*/
exports.inHTMLComment = privFilters.yc;

/**
* @function module:xss-filters#inSingleQuotedAttr
*
* @param {string} s - An untrusted user input
* @returns {string} The string s with any single-quote characters encoded into '&amp;&#39;'.
*
* @description
* <p class="warning">Warning: This is NOT designed for any onX (e.g., onclick) attributes!</p>
* <p class="warning">Warning: If you're working on URI/components, use the more specific uri___InSingleQuotedAttr filter </p>
* This filter is to be placed in HTML Attribute Value (single-quoted) state to encode all single-quote characters into '&amp;&#39;'
*
* <ul>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#attribute-value-(single-quoted)-state">HTML5 Attribute Value (Single-Quoted) State</a></li>
* </ul>
*
* @example
* // output context to be applied by this filter.
* <input name='firstname' value='{{{inSingleQuotedAttr firstname}}}' />
*
*/
exports.inSingleQuotedAttr = privFilters.yavs;

/**
* @function module:xss-filters#inDoubleQuotedAttr
*
* @param {string} s - An untrusted user input
* @returns {string} The string s with any single-quote characters encoded into '&amp;&quot;'.
*
* @description
* <p class="warning">Warning: This is NOT designed for any onX (e.g., onclick) attributes!</p>
* <p class="warning">Warning: If you're working on URI/components, use the more specific uri___InDoubleQuotedAttr filter </p>
* This filter is to be placed in HTML Attribute Value (double-quoted) state to encode all single-quote characters into '&amp;&quot;'
*
* <ul>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#attribute-value-(double-quoted)-state">HTML5 Attribute Value (Double-Quoted) State</a></li>
* </ul>
*
* @example
* // output context to be applied by this filter.
* <input name="firstname" value="{{{inDoubleQuotedAttr firstname}}}" />
*
*/
exports.inDoubleQuotedAttr = privFilters.yavd;

/**
* @function module:xss-filters#inUnQuotedAttr
*
* @param {string} s - An untrusted user input
* @returns {string} If s contains any state breaking chars (\t, \n, \v, \f, \r, space, null, ', ", `, <, >, and =), they are escaped and encoded into their equivalent HTML entity representations. If the string is empty, inject a \uFFFD character.
*
* @description
* <p class="warning">Warning: This is NOT designed for any onX (e.g., onclick) attributes!</p>
* <p class="warning">Warning: If you're working on URI/components, use the more specific uri___InUnQuotedAttr filter </p>
* <p>Regarding \uFFFD injection, given <a id={{{id}}} name="passwd">,<br/>
*        Rationale 1: our belief is that developers wouldn't expect when id equals an
*          empty string would result in ' name="passwd"' rendered as 
*          attribute value, even though this is how HTML5 is specified.<br/>
*        Rationale 2: an empty or all null string (for IE) can 
*          effectively alter its immediate subsequent state, we choose
*          \uFFFD to end the unquoted attr 
*          state, which therefore will not mess up later contexts.<br/>
*        Rationale 3: Since IE 6, it is verified that NULL chars are stripped.<br/>
*        Reference: https://html.spec.whatwg.org/multipage/syntax.html#attribute-value-(unquoted)-state</p>
* <ul>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#attribute-value-(unquoted)-state">HTML5 Attribute Value (Unquoted) State</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#before-attribute-value-state">HTML5 Before Attribute Value State</a></li>
* <li><a href="http://shazzer.co.uk/database/All/Characters-which-break-attributes-without-quotes">Shazzer - Characters-which-break-attributes-without-quotes</a></li>
* <li><a href="http://shazzer.co.uk/vector/Characters-allowed-attribute-quote">Shazzer - Characters-allowed-attribute-quote</a></li>
* </ul>
*
* @example
* // output context to be applied by this filter.
* <input name="firstname" value={{{inUnQuotedAttr firstname}}} />
*
*/
exports.inUnQuotedAttr = privFilters.yavu;


/**
* @function module:xss-filters#uriInSingleQuotedAttr
*
* @param {string} s - An untrusted user input, supposedly an <strong>absolute</strong> URI
* @returns {string} The string s encoded first by window.encodeURI(), then inSingleQuotedAttr(), and finally prefix the resulted string with 'x-' if it begins with 'javascript:' or 'vbscript:' that could possibly lead to script execution
*
* @description
* This filter is to be placed in HTML Attribute Value (single-quoted) state for an <strong>absolute</strong> URI.<br/>
* The correct order of encoders is thus: first window.encodeURI(), then inSingleQuotedAttr(), and finally prefix the resulted string with 'x-' if it begins with 'javascript:' or 'vbscript:' that could possibly lead to script execution
*
* <p>Notice: This filter is IPv6 friendly by not encoding '[' and ']'.</p>
*
* <ul>
* <li><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURI">encodeURI | MDN</a></li>
* <li><a href="http://tools.ietf.org/html/rfc3986">RFC 3986</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#attribute-value-(single-quoted)-state">HTML5 Attribute Value (Single-Quoted) State</a></li>
* </ul>
*
* @example
* // output context to be applied by this filter.
* <a href='{{{uriInSingleQuotedAttr full_uri}}}'>link</a>
* 
*/
exports.uriInSingleQuotedAttr = function (s) {
    return uriInAttr(s, privFilters.yavs);
};

/**
* @function module:xss-filters#uriInDoubleQuotedAttr
*
* @param {string} s - An untrusted user input, supposedly an <strong>absolute</strong> URI
* @returns {string} The string s encoded first by window.encodeURI(), then inDoubleQuotedAttr(), and finally prefix the resulted string with 'x-' if it begins with 'javascript:' or 'vbscript:' that could possibly lead to script execution
*
* @description
* This filter is to be placed in HTML Attribute Value (double-quoted) state for an <strong>absolute</strong> URI.<br/>
* The correct order of encoders is thus: first window.encodeURI(), then inDoubleQuotedAttr(), and finally prefix the resulted string with 'x-' if it begins with 'javascript:' or 'vbscript:' that could possibly lead to script execution
*
* <p>Notice: This filter is IPv6 friendly by not encoding '[' and ']'.</p>
*
* <ul>
* <li><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURI">encodeURI | MDN</a></li>
* <li><a href="http://tools.ietf.org/html/rfc3986">RFC 3986</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#attribute-value-(double-quoted)-state">HTML5 Attribute Value (Double-Quoted) State</a></li>
* </ul>
*
* @example
* // output context to be applied by this filter.
* <a href="{{{uriInDoubleQuotedAttr full_uri}}}">link</a>
* 
*/
exports.uriInDoubleQuotedAttr = function (s) {
    return uriInAttr(s, privFilters.yavd);
};


/**
* @function module:xss-filters#uriInUnQuotedAttr
*
* @param {string} s - An untrusted user input, supposedly an <strong>absolute</strong> URI
* @returns {string} The string s encoded first by window.encodeURI(), then inUnQuotedAttr(), and finally prefix the resulted string with 'x-' if it begins with 'javascript:' or 'vbscript:' that could possibly lead to script execution
*
* @description
* This filter is to be placed in HTML Attribute Value (unquoted) state for an <strong>absolute</strong> URI.<br/>
* The correct order of encoders is thus: first the built-in encodeURI(), then inUnQuotedAttr(), and finally prefix the resulted string with 'x-' if it begins with 'javascript:' or 'vbscript:' that could possibly lead to script execution
*
* <p>Notice: This filter is IPv6 friendly by not encoding '[' and ']'.</p>
*
* <ul>
* <li><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURI">encodeURI | MDN</a></li>
* <li><a href="http://tools.ietf.org/html/rfc3986">RFC 3986</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#attribute-value-(unquoted)-state">HTML5 Attribute Value (Unquoted) State</a></li>
* </ul>
*
* @example
* // output context to be applied by this filter.
* <a href={{{uriInUnQuotedAttr full_uri}}}>link</a>
* 
*/
exports.uriInUnQuotedAttr = function (s) {
    return uriInAttr(s, privFilters.yavu);
};

/**
* @function module:xss-filters#uriInHTMLData
*
* @param {string} s - An untrusted user input, supposedly an <strong>absolute</strong> URI
* @returns {string} The string s encoded by window.encodeURI() and then inHTMLData()
*
* @description
* This filter is to be placed in HTML Data state for an <strong>absolute</strong> URI.
*
* <p>Notice: The actual implementation skips inHTMLData(), since '<' is already encoded as '%3C' by encodeURI().</p>
* <p>Notice: This filter is IPv6 friendly by not encoding '[' and ']'.</p>
*
* <ul>
* <li><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURI">encodeURI | MDN</a></li>
* <li><a href="http://tools.ietf.org/html/rfc3986">RFC 3986</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#data-state">HTML5 Data State</a></li>
* </ul>
*
* @example
* // output context to be applied by this filter.
* <a href="/somewhere">{{{uriInHTMLData full_uri}}}</a>
* 
*/
exports.uriInHTMLData = privFilters.yufull;


/**
* @function module:xss-filters#uriInHTMLComment
*
* @param {string} s - An untrusted user input, supposedly an <strong>absolute</strong> URI
* @returns {string} The string s encoded by window.encodeURI(), and finally inHTMLComment()
*
* @description
* This filter is to be placed in HTML Comment state for an <strong>absolute</strong> URI.
*
* <p>Notice: This filter is IPv6 friendly by not encoding '[' and ']'.</p>
*
* <ul>
* <li><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURI">encodeURI | MDN</a></li>
* <li><a href="http://tools.ietf.org/html/rfc3986">RFC 3986</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#data-state">HTML5 Data State</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#comment-state">HTML5 Comment State</a></li>
* </ul>
*
* @example
* // output context to be applied by this filter.
* <!-- {{{uriInHTMLComment full_uri}}} -->
* 
*/
exports.uriInHTMLComment = function (s) {
    return privFilters.yc(privFilters.yufull(s));
};




/**
* @function module:xss-filters#uriPathInSingleQuotedAttr
*
* @param {string} s - An untrusted user input, supposedly a URI Path/Query or relative URI
* @returns {string} The string s encoded first by window.encodeURI(), then inSingleQuotedAttr(), and finally prefix the resulted string with 'x-' if it begins with 'javascript:' or 'vbscript:' that could possibly lead to script execution
*
* @description
* This filter is to be placed in HTML Attribute Value (single-quoted) state for a URI Path/Query or relative URI.<br/>
* The correct order of encoders is thus: first window.encodeURI(), then inSingleQuotedAttr(), and finally prefix the resulted string with 'x-' if it begins with 'javascript:' or 'vbscript:' that could possibly lead to script execution
*
* <ul>
* <li><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURI">encodeURI | MDN</a></li>
* <li><a href="http://tools.ietf.org/html/rfc3986">RFC 3986</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#attribute-value-(single-quoted)-state">HTML5 Attribute Value (Single-Quoted) State</a></li>
* </ul>
*
* @example
* // output context to be applied by this filter.
* <a href='http://example.com/{{{uriPathInSingleQuotedAttr uri_path}}}'>link</a>
* <a href='http://example.com/?{{{uriQueryInSingleQuotedAttr uri_query}}}'>link</a>
* 
*/
exports.uriPathInSingleQuotedAttr = function (s) {
    return uriInAttr(s, privFilters.yavs, privFilters.yu);
};

/**
* @function module:xss-filters#uriPathInDoubleQuotedAttr
*
* @param {string} s - An untrusted user input, supposedly a URI Path/Query or relative URI
* @returns {string} The string s encoded first by window.encodeURI(), then inDoubleQuotedAttr(), and finally prefix the resulted string with 'x-' if it begins with 'javascript:' or 'vbscript:' that could possibly lead to script execution
*
* @description
* This filter is to be placed in HTML Attribute Value (double-quoted) state for a URI Path/Query or relative URI.<br/>
* The correct order of encoders is thus: first window.encodeURI(), then inDoubleQuotedAttr(), and finally prefix the resulted string with 'x-' if it begins with 'javascript:' or 'vbscript:' that could possibly lead to script execution
*
* <ul>
* <li><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURI">encodeURI | MDN</a></li>
* <li><a href="http://tools.ietf.org/html/rfc3986">RFC 3986</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#attribute-value-(double-quoted)-state">HTML5 Attribute Value (Double-Quoted) State</a></li>
* </ul>
*
* @example
* // output context to be applied by this filter.
* <a href="http://example.com/{{{uriPathInDoubleQuotedAttr uri_path}}}">link</a>
* <a href="http://example.com/?{{{uriQueryInDoubleQuotedAttr uri_query}}}">link</a>
* 
*/
exports.uriPathInDoubleQuotedAttr = function (s) {
    return uriInAttr(s, privFilters.yavd, privFilters.yu);
};


/**
* @function module:xss-filters#uriPathInUnQuotedAttr
*
* @param {string} s - An untrusted user input, supposedly a URI Path/Query or relative URI
* @returns {string} The string s encoded first by window.encodeURI(), then inUnQuotedAttr(), and finally prefix the resulted string with 'x-' if it begins with 'javascript:' or 'vbscript:' that could possibly lead to script execution
*
* @description
* This filter is to be placed in HTML Attribute Value (unquoted) state for a URI Path/Query or relative URI.<br/>
* The correct order of encoders is thus: first the built-in encodeURI(), then inUnQuotedAttr(), and finally prefix the resulted string with 'x-' if it begins with 'javascript:' or 'vbscript:' that could possibly lead to script execution
*
* <ul>
* <li><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURI">encodeURI | MDN</a></li>
* <li><a href="http://tools.ietf.org/html/rfc3986">RFC 3986</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#attribute-value-(unquoted)-state">HTML5 Attribute Value (Unquoted) State</a></li>
* </ul>
*
* @example
* // output context to be applied by this filter.
* <a href=http://example.com/{{{uriPathInUnQuotedAttr uri_path}}}>link</a>
* <a href=http://example.com/?{{{uriQueryInUnQuotedAttr uri_query}}}>link</a>
* 
*/
exports.uriPathInUnQuotedAttr = function (s) {
    return uriInAttr(s, privFilters.yavu, privFilters.yu);
};

/**
* @function module:xss-filters#uriPathInHTMLData
*
* @param {string} s - An untrusted user input, supposedly a URI Path/Query or relative URI
* @returns {string} The string s encoded by window.encodeURI() and then inHTMLData()
*
* @description
* This filter is to be placed in HTML Data state for a URI Path/Query or relative URI.
*
* <p>Notice: The actual implementation skips inHTMLData(), since '<' is already encoded as '%3C' by encodeURI().</p>
*
* <ul>
* <li><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURI">encodeURI | MDN</a></li>
* <li><a href="http://tools.ietf.org/html/rfc3986">RFC 3986</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#data-state">HTML5 Data State</a></li>
* </ul>
*
* @example
* // output context to be applied by this filter.
* <a href="http://example.com/">http://example.com/{{{uriPathInHTMLData uri_path}}}</a>
* <a href="http://example.com/">http://example.com/?{{{uriQueryInHTMLData uri_query}}}</a>
* 
*/
exports.uriPathInHTMLData = privFilters.yu;


/**
* @function module:xss-filters#uriPathInHTMLComment
*
* @param {string} s - An untrusted user input, supposedly a URI Path/Query or relative URI
* @returns {string} The string s encoded by window.encodeURI(), and finally inHTMLComment()
*
* @description
* This filter is to be placed in HTML Comment state for a URI Path/Query or relative URI.
*
* <ul>
* <li><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURI">encodeURI | MDN</a></li>
* <li><a href="http://tools.ietf.org/html/rfc3986">RFC 3986</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#data-state">HTML5 Data State</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#comment-state">HTML5 Comment State</a></li>
* </ul>
*
* @example
* // output context to be applied by this filter.
* <!-- http://example.com/{{{uriPathInHTMLComment uri_path}}} -->
* <!-- http://example.com/?{{{uriQueryInHTMLComment uri_query}}} -->
*/
exports.uriPathInHTMLComment = function (s) {
    return privFilters.yc(privFilters.yu(s));
};


/**
* @function module:xss-filters#uriQueryInSingleQuotedAttr
* @description This is an alias of {@link module:xss-filters#uriPathInSingleQuotedAttr}
* 
* @alias module:xss-filters#uriPathInSingleQuotedAttr
*/
exports.uriQueryInSingleQuotedAttr = exports.uriPathInSingleQuotedAttr;

/**
* @function module:xss-filters#uriQueryInDoubleQuotedAttr
* @description This is an alias of {@link module:xss-filters#uriPathInDoubleQuotedAttr}
* 
* @alias module:xss-filters#uriPathInDoubleQuotedAttr
*/
exports.uriQueryInDoubleQuotedAttr = exports.uriPathInDoubleQuotedAttr;

/**
* @function module:xss-filters#uriQueryInUnQuotedAttr
* @description This is an alias of {@link module:xss-filters#uriPathInUnQuotedAttr}
* 
* @alias module:xss-filters#uriPathInUnQuotedAttr
*/
exports.uriQueryInUnQuotedAttr = exports.uriPathInUnQuotedAttr;

/**
* @function module:xss-filters#uriQueryInHTMLData
* @description This is an alias of {@link module:xss-filters#uriPathInHTMLData}
* 
* @alias module:xss-filters#uriPathInHTMLData
*/
exports.uriQueryInHTMLData = exports.uriPathInHTMLData;

/**
* @function module:xss-filters#uriQueryInHTMLComment
* @description This is an alias of {@link module:xss-filters#uriPathInHTMLComment}
* 
* @alias module:xss-filters#uriPathInHTMLComment
*/
exports.uriQueryInHTMLComment = exports.uriPathInHTMLComment;



/**
* @function module:xss-filters#uriComponentInSingleQuotedAttr
*
* @param {string} s - An untrusted user input, supposedly a URI Component
* @returns {string} The string s encoded first by window.encodeURIComponent(), then inSingleQuotedAttr()
*
* @description
* This filter is to be placed in HTML Attribute Value (single-quoted) state for a URI Component.<br/>
* The correct order of encoders is thus: first window.encodeURIComponent(), then inSingleQuotedAttr()
*
*
* <ul>
* <li><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent">encodeURIComponent | MDN</a></li>
* <li><a href="http://tools.ietf.org/html/rfc3986">RFC 3986</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#attribute-value-(single-quoted)-state">HTML5 Attribute Value (Single-Quoted) State</a></li>
* </ul>
*
* @example
* // output context to be applied by this filter.
* <a href='http://example.com/?q={{{uriComponentInSingleQuotedAttr uri_component}}}'>link</a>
* 
*/
exports.uriComponentInSingleQuotedAttr = function (s) {
    return privFilters.yavs(privFilters.yuc(s));
};

/**
* @function module:xss-filters#uriComponentInDoubleQuotedAttr
*
* @param {string} s - An untrusted user input, supposedly a URI Component
* @returns {string} The string s encoded first by window.encodeURIComponent(), then inDoubleQuotedAttr()
*
* @description
* This filter is to be placed in HTML Attribute Value (double-quoted) state for a URI Component.<br/>
* The correct order of encoders is thus: first window.encodeURIComponent(), then inDoubleQuotedAttr()
*
*
* <ul>
* <li><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent">encodeURIComponent | MDN</a></li>
* <li><a href="http://tools.ietf.org/html/rfc3986">RFC 3986</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#attribute-value-(double-quoted)-state">HTML5 Attribute Value (Double-Quoted) State</a></li>
* </ul>
*
* @example
* // output context to be applied by this filter.
* <a href="http://example.com/?q={{{uriComponentInDoubleQuotedAttr uri_component}}}">link</a>
* 
*/
exports.uriComponentInDoubleQuotedAttr = function (s) {
    return privFilters.yavd(privFilters.yuc(s));
};


/**
* @function module:xss-filters#uriComponentInUnQuotedAttr
*
* @param {string} s - An untrusted user input, supposedly a URI Component
* @returns {string} The string s encoded first by window.encodeURIComponent(), then inUnQuotedAttr()
*
* @description
* This filter is to be placed in HTML Attribute Value (unquoted) state for a URI Component.<br/>
* The correct order of encoders is thus: first the built-in encodeURIComponent(), then inUnQuotedAttr()
*
*
* <ul>
* <li><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent">encodeURIComponent | MDN</a></li>
* <li><a href="http://tools.ietf.org/html/rfc3986">RFC 3986</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#attribute-value-(unquoted)-state">HTML5 Attribute Value (Unquoted) State</a></li>
* </ul>
*
* @example
* // output context to be applied by this filter.
* <a href=http://example.com/?q={{{uriComponentInUnQuotedAttr uri_component}}}>link</a>
* 
*/
exports.uriComponentInUnQuotedAttr = function (s) {
    return privFilters.yavu(privFilters.yuc(s));
};

/**
* @function module:xss-filters#uriComponentInHTMLData
*
* @param {string} s - An untrusted user input, supposedly a URI Component
* @returns {string} The string s encoded by window.encodeURIComponent() and then inHTMLData()
*
* @description
* This filter is to be placed in HTML Data state for a URI Component.
*
* <p>Notice: The actual implementation skips inHTMLData(), since '<' is already encoded as '%3C' by encodeURIComponent().</p>
*
* <ul>
* <li><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent">encodeURIComponent | MDN</a></li>
* <li><a href="http://tools.ietf.org/html/rfc3986">RFC 3986</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#data-state">HTML5 Data State</a></li>
* </ul>
*
* @example
* // output context to be applied by this filter.
* <a href="http://example.com/">http://example.com/?q={{{uriComponentInHTMLData uri_component}}}</a>
* <a href="http://example.com/">http://example.com/#{{{uriComponentInHTMLData uri_fragment}}}</a>
* 
*/
exports.uriComponentInHTMLData = privFilters.yuc;


/**
* @function module:xss-filters#uriComponentInHTMLComment
*
* @param {string} s - An untrusted user input, supposedly a URI Component
* @returns {string} The string s encoded by window.encodeURIComponent(), and finally inHTMLComment()
*
* @description
* This filter is to be placed in HTML Comment state for a URI Component.
*
* <ul>
* <li><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent">encodeURIComponent | MDN</a></li>
* <li><a href="http://tools.ietf.org/html/rfc3986">RFC 3986</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#data-state">HTML5 Data State</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#comment-state">HTML5 Comment State</a></li>
* </ul>
*
* @example
* // output context to be applied by this filter.
* <!-- http://example.com/?q={{{uriComponentInHTMLComment uri_component}}} -->
* <!-- http://example.com/#{{{uriComponentInHTMLComment uri_fragment}}} -->
*/
exports.uriComponentInHTMLComment = function (s) {
    return privFilters.yc(privFilters.yuc(s));
};


// uriFragmentInSingleQuotedAttr
// added yubl on top of uriComponentInAttr 
// Rationale: given pattern like this: <a href='{{{uriFragmentInSingleQuotedAttr s}}}'>
//            developer may expect s is always prefixed with #, but an attacker can abuse it with 'javascript:alert(1)'

/**
* @function module:xss-filters#uriFragmentInSingleQuotedAttr
*
* @param {string} s - An untrusted user input, supposedly a URI Fragment
* @returns {string} The string s encoded first by window.encodeURIComponent(), then inSingleQuotedAttr(), and finally prefix the resulted string with 'x-' if it begins with 'javascript:' or 'vbscript:' that could possibly lead to script execution
*
* @description
* This filter is to be placed in HTML Attribute Value (single-quoted) state for a URI Fragment.<br/>
* The correct order of encoders is thus: first window.encodeURIComponent(), then inSingleQuotedAttr(), and finally prefix the resulted string with 'x-' if it begins with 'javascript:' or 'vbscript:' that could possibly lead to script execution
*
*
* <ul>
* <li><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent">encodeURIComponent | MDN</a></li>
* <li><a href="http://tools.ietf.org/html/rfc3986">RFC 3986</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#attribute-value-(single-quoted)-state">HTML5 Attribute Value (Single-Quoted) State</a></li>
* </ul>
*
* @example
* // output context to be applied by this filter.
* <a href='http://example.com/#{{{uriFragmentInSingleQuotedAttr uri_fragment}}}'>link</a>
* 
*/
exports.uriFragmentInSingleQuotedAttr = function (s) {
    return privFilters.yubl(privFilters.yavs(privFilters.yuc(s)));
};

// uriFragmentInDoubleQuotedAttr
// added yubl on top of uriComponentInAttr 
// Rationale: given pattern like this: <a href="{{{uriFragmentInDoubleQuotedAttr s}}}">
//            developer may expect s is always prefixed with #, but an attacker can abuse it with 'javascript:alert(1)'

/**
* @function module:xss-filters#uriFragmentInDoubleQuotedAttr
*
* @param {string} s - An untrusted user input, supposedly a URI Fragment
* @returns {string} The string s encoded first by window.encodeURIComponent(), then inDoubleQuotedAttr(), and finally prefix the resulted string with 'x-' if it begins with 'javascript:' or 'vbscript:' that could possibly lead to script execution
*
* @description
* This filter is to be placed in HTML Attribute Value (double-quoted) state for a URI Fragment.<br/>
* The correct order of encoders is thus: first window.encodeURIComponent(), then inDoubleQuotedAttr(), and finally prefix the resulted string with 'x-' if it begins with 'javascript:' or 'vbscript:' that could possibly lead to script execution
*
*
* <ul>
* <li><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent">encodeURIComponent | MDN</a></li>
* <li><a href="http://tools.ietf.org/html/rfc3986">RFC 3986</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#attribute-value-(double-quoted)-state">HTML5 Attribute Value (Double-Quoted) State</a></li>
* </ul>
*
* @example
* // output context to be applied by this filter.
* <a href="http://example.com/#{{{uriFragmentInDoubleQuotedAttr uri_fragment}}}">link</a>
* 
*/
exports.uriFragmentInDoubleQuotedAttr = function (s) {
    return privFilters.yubl(privFilters.yavd(privFilters.yuc(s)));
};

// uriFragmentInUnQuotedAttr
// added yubl on top of uriComponentInAttr 
// Rationale: given pattern like this: <a href={{{uriFragmentInUnQuotedAttr s}}}>
//            developer may expect s is always prefixed with #, but an attacker can abuse it with 'javascript:alert(1)'

/**
* @function module:xss-filters#uriFragmentInUnQuotedAttr
*
* @param {string} s - An untrusted user input, supposedly a URI Fragment
* @returns {string} The string s encoded first by window.encodeURIComponent(), then inUnQuotedAttr(), and finally prefix the resulted string with 'x-' if it begins with 'javascript:' or 'vbscript:' that could possibly lead to script execution
*
* @description
* This filter is to be placed in HTML Attribute Value (unquoted) state for a URI Fragment.<br/>
* The correct order of encoders is thus: first the built-in encodeURIComponent(), then inUnQuotedAttr(), and finally prefix the resulted string with 'x-' if it begins with 'javascript:' or 'vbscript:' that could possibly lead to script execution
*
* <ul>
* <li><a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent">encodeURIComponent | MDN</a></li>
* <li><a href="http://tools.ietf.org/html/rfc3986">RFC 3986</a></li>
* <li><a href="https://html.spec.whatwg.org/multipage/syntax.html#attribute-value-(unquoted)-state">HTML5 Attribute Value (Unquoted) State</a></li>
* </ul>
*
* @example
* // output context to be applied by this filter.
* <a href=http://example.com/#{{{uriFragmentInUnQuotedAttr uri_fragment}}}>link</a>
* 
*/
exports.uriFragmentInUnQuotedAttr = function (s) {
    return privFilters.yubl(privFilters.yavu(privFilters.yuc(s)));
};


/**
* @function module:xss-filters#uriFragmentInHTMLData
* @description This is an alias of {@link module:xss-filters#uriComponentInHTMLData}
* 
* @alias module:xss-filters#uriComponentInHTMLData
*/
exports.uriFragmentInHTMLData = exports.uriComponentInHTMLData;

/**
* @function module:xss-filters#uriFragmentInHTMLComment
* @description This is an alias of {@link module:xss-filters#uriComponentInHTMLComment}
* 
* @alias module:xss-filters#uriComponentInHTMLComment
*/
exports.uriFragmentInHTMLComment = exports.uriComponentInHTMLComment;

},{}],2:[function(require,module,exports){
"use strict";

// src/api.js

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.API = undefined;

var _constants = require("./constants");

var API = exports.API = {
  fetch: function fetch(path) {
    return new Promise(function (resolve, reject) {
      var uri = _constants.BASE_URI + "/" + path;
      var request = new XMLHttpRequest();

      request.open("GET", uri, true);
      request.onload = function () {
        var status = request.status;

        if (status >= 200 && status < 400) {
          resolve(JSON.parse(request.response));
        }
      };

      request.onerror = function () {
        reject(new Error(_constants.ERROR_MESSAGE));
      };

      request.send();
    });
  }
};

},{"./constants":4}],3:[function(require,module,exports){
"use strict";

// src/app.js

var _post = require("./post");

var _user = require("./user");

var _ui = require("./ui");

_post.Post.findAll().then(_ui.ui.renderPosts).catch(function (error) {
  console.error("Error: ", error);
});

_user.User.findRecent().then(_ui.ui.renderUsers).catch(function (error) {
  console.error("Error: ", error);
});

},{"./post":5,"./ui":6,"./user":7}],4:[function(require,module,exports){
"use strict";

// src/constants.js

Object.defineProperty(exports, "__esModule", {
  value: true
});
var BASE_URI = "http://localhost:3000";
var ERROR_MESSAGE = "Something went wrong on the API";
var POSTS_URI = "posts";
var ACTIVE_USERS_URI = "activeUsers";
var POSTS_DOM_TARGET = ".container";
var USERS_DOM_TARGET = ".sidebar-content";

exports.BASE_URI = BASE_URI;
exports.ERROR_MESSAGE = ERROR_MESSAGE;
exports.POSTS_URI = POSTS_URI;
exports.ACTIVE_USERS_URI = ACTIVE_USERS_URI;
exports.POSTS_DOM_TARGET = POSTS_DOM_TARGET;
exports.USERS_DOM_TARGET = USERS_DOM_TARGET;

},{}],5:[function(require,module,exports){
"use strict";

// src/post.js

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Post = undefined;

var _api = require("./api");

var _constants = require("./constants");

var Post = exports.Post = {
  findAll: function findAll() {
    return _api.API.fetch(_constants.POSTS_URI);
  }
};

},{"./api":2,"./constants":4}],6:[function(require,module,exports){
"use strict";

// src/ui.js

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ui = undefined;

var _xssFilters = require("xss-filters");

var _xssFilters2 = _interopRequireDefault(_xssFilters);

var _constants = require("./constants");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function articleTemplate(title, lastReply) {
  var safeTitle = _xssFilters2.default.inHTMLData(title);
  var safeLastReply = _xssFilters2.default.inHTMLData(lastReply);

  var template = "\n    <article class=\"post\">\n      <h2 class=\"post-title\">\n        " + safeTitle + "\n      </h2>\n      <p class=\"post-meta\">\n        " + safeLastReply + "\n      </p>\n    </article>";

  return template;
}

function userTemplate(name, avatar) {
  var safeName = _xssFilters2.default.inHTMLData(name);
  var safeAvatar = _xssFilters2.default.inHTMLData(avatar);

  var template = "\n    <div class=\"active-avatar\">\n      <img width=\"54\" src=\"./assets/images/" + safeAvatar + "\" alt=\"" + safeName + "\"/>\n      <h5 class=\"post-author\">\n        " + safeName + "\n      </h5>\n    </div>";

  return template;
}

var ui = exports.ui = {
  renderPosts: function renderPosts(posts) {
    var elements = posts.map(function (post) {
      var title = post.title,
          lastReply = post.lastReply;


      return articleTemplate(title, lastReply);
    });

    var target = document.querySelector(_constants.POSTS_DOM_TARGET);
    target.innerHTML = elements.join("");
  },
  renderUsers: function renderUsers(users) {
    var elements = users.map(function (user) {
      var name = user.name,
          avatar = user.avatar;


      return userTemplate(name, avatar);
    });

    var target = document.querySelector(_constants.USERS_DOM_TARGET);
    target.innerHTML = elements.join("");
  }
};

},{"./constants":4,"xss-filters":1}],7:[function(require,module,exports){
"use strict";

// src/user.js

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.User = undefined;

var _api = require("./api");

var _constants = require("./constants");

var User = exports.User = {
  findRecent: function findRecent() {
    return _api.API.fetch(_constants.ACTIVE_USERS_URI);
  }
};

},{"./api":2,"./constants":4}]},{},[3])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMveHNzLWZpbHRlcnMvc3JjL3hzcy1maWx0ZXJzLmpzIiwic3JjL2FwaS5qcyIsInNyYy9hcHAuanMiLCJzcmMvY29uc3RhbnRzLmpzIiwic3JjL3Bvc3QuanMiLCJzcmMvdWkuanMiLCJzcmMvdXNlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM2tDQTs7QUFFQTs7Ozs7OztBQUVBOztBQUtPLElBQU0sb0JBQU07QUFDakIsT0FEaUIsaUJBQ1gsSUFEVyxFQUNMO0FBQ1YsV0FBTyxJQUFJLE9BQUosQ0FBWSxVQUFDLE9BQUQsRUFBVSxNQUFWLEVBQXFCO0FBQ3RDLFVBQUksTUFBUyxtQkFBVCxTQUFxQixJQUF6QjtBQUNBLFVBQUksVUFBVSxJQUFJLGNBQUosRUFBZDs7QUFFQSxjQUFRLElBQVIsQ0FBYSxLQUFiLEVBQW9CLEdBQXBCLEVBQXlCLElBQXpCO0FBQ0EsY0FBUSxNQUFSLEdBQWlCLFlBQU07QUFDckIsWUFBSSxTQUFTLFFBQVEsTUFBckI7O0FBRUEsWUFBSSxVQUFVLEdBQVYsSUFBaUIsU0FBUyxHQUE5QixFQUFtQztBQUNqQyxrQkFBUSxLQUFLLEtBQUwsQ0FBVyxRQUFRLFFBQW5CLENBQVI7QUFDRDtBQUNGLE9BTkQ7O0FBUUEsY0FBUSxPQUFSLEdBQWtCLFlBQU07QUFDdEIsZUFBTyxJQUFJLEtBQUosQ0FBVSx3QkFBVixDQUFQO0FBQ0QsT0FGRDs7QUFJQSxjQUFRLElBQVI7QUFDRCxLQWxCTSxDQUFQO0FBbUJEO0FBckJnQixDQUFaOzs7QUNUUDs7QUFFQTs7QUFFQTs7QUFDQTs7QUFDQTs7QUFFQSxXQUFLLE9BQUwsR0FDRyxJQURILENBQ1EsT0FBRyxXQURYLEVBRUcsS0FGSCxDQUVTLFVBQUMsS0FBRCxFQUFXO0FBQ2hCLFVBQVEsS0FBUixDQUFjLFNBQWQsRUFBeUIsS0FBekI7QUFDRCxDQUpIOztBQU1BLFdBQUssVUFBTCxHQUNHLElBREgsQ0FDUSxPQUFHLFdBRFgsRUFFRyxLQUZILENBRVMsVUFBQyxLQUFELEVBQVc7QUFDaEIsVUFBUSxLQUFSLENBQWMsU0FBZCxFQUF5QixLQUF6QjtBQUNELENBSkg7OztBQ2RBOztBQUVBOzs7OztBQUVBLElBQU0sV0FBVyx1QkFBakI7QUFDQSxJQUFNLGdCQUFnQixpQ0FBdEI7QUFDQSxJQUFNLFlBQVksT0FBbEI7QUFDQSxJQUFNLG1CQUFtQixhQUF6QjtBQUNBLElBQU0sbUJBQW1CLFlBQXpCO0FBQ0EsSUFBTSxtQkFBbUIsa0JBQXpCOztRQUdFLFEsR0FBQSxRO1FBQ0EsYSxHQUFBLGE7UUFDQSxTLEdBQUEsUztRQUNBLGdCLEdBQUEsZ0I7UUFDQSxnQixHQUFBLGdCO1FBQ0EsZ0IsR0FBQSxnQjs7O0FDakJGOztBQUVBOzs7Ozs7O0FBRUE7O0FBQ0E7O0FBRU8sSUFBTSxzQkFBTztBQUNsQixTQURrQixxQkFDUjtBQUNSLFdBQU8sU0FBSSxLQUFKLENBQVUsb0JBQVYsQ0FBUDtBQUNEO0FBSGlCLENBQWI7OztBQ1BQOztBQUVBOzs7Ozs7O0FBRUE7Ozs7QUFFQTs7OztBQUtBLFNBQVMsZUFBVCxDQUF5QixLQUF6QixFQUFnQyxTQUFoQyxFQUEyQztBQUN6QyxNQUFJLFlBQVkscUJBQUksVUFBSixDQUFlLEtBQWYsQ0FBaEI7QUFDQSxNQUFJLGdCQUFnQixxQkFBSSxVQUFKLENBQWUsU0FBZixDQUFwQjs7QUFFQSxNQUFJLHlGQUdJLFNBSEosOERBTUksYUFOSixpQ0FBSjs7QUFVQSxTQUFPLFFBQVA7QUFDRDs7QUFFRCxTQUFTLFlBQVQsQ0FBc0IsSUFBdEIsRUFBNEIsTUFBNUIsRUFBb0M7QUFDbEMsTUFBSSxXQUFXLHFCQUFJLFVBQUosQ0FBZSxJQUFmLENBQWY7QUFDQSxNQUFJLGFBQWEscUJBQUksVUFBSixDQUFlLE1BQWYsQ0FBakI7O0FBRUEsTUFBSSxtR0FFdUMsVUFGdkMsaUJBRTJELFFBRjNELHdEQUlJLFFBSkosOEJBQUo7O0FBUUEsU0FBTyxRQUFQO0FBQ0Q7O0FBRU0sSUFBTSxrQkFBSztBQUNoQixhQURnQix1QkFDSixLQURJLEVBQ0c7QUFDakIsUUFBSSxXQUFXLE1BQU0sR0FBTixDQUFVLFVBQUMsSUFBRCxFQUFVO0FBQUEsVUFFL0IsS0FGK0IsR0FJN0IsSUFKNkIsQ0FFL0IsS0FGK0I7QUFBQSxVQUcvQixTQUgrQixHQUk3QixJQUo2QixDQUcvQixTQUgrQjs7O0FBTWpDLGFBQU8sZ0JBQWdCLEtBQWhCLEVBQXVCLFNBQXZCLENBQVA7QUFDRCxLQVBjLENBQWY7O0FBU0EsUUFBSSxTQUFTLFNBQVMsYUFBVCxDQUF1QiwyQkFBdkIsQ0FBYjtBQUNBLFdBQU8sU0FBUCxHQUFtQixTQUFTLElBQVQsQ0FBYyxFQUFkLENBQW5CO0FBQ0QsR0FiZTtBQWVoQixhQWZnQix1QkFlSixLQWZJLEVBZUc7QUFDakIsUUFBSSxXQUFXLE1BQU0sR0FBTixDQUFXLFVBQUMsSUFBRCxFQUFVO0FBQUEsVUFFaEMsSUFGZ0MsR0FJOUIsSUFKOEIsQ0FFaEMsSUFGZ0M7QUFBQSxVQUdoQyxNQUhnQyxHQUk5QixJQUo4QixDQUdoQyxNQUhnQzs7O0FBTWxDLGFBQU8sYUFBYSxJQUFiLEVBQW1CLE1BQW5CLENBQVA7QUFDRCxLQVBjLENBQWY7O0FBU0EsUUFBSSxTQUFTLFNBQVMsYUFBVCxDQUF1QiwyQkFBdkIsQ0FBYjtBQUNBLFdBQU8sU0FBUCxHQUFtQixTQUFTLElBQVQsQ0FBYyxFQUFkLENBQW5CO0FBQ0Q7QUEzQmUsQ0FBWDs7O0FDM0NQOztBQUVBOzs7Ozs7O0FBRUE7O0FBQ0E7O0FBRU8sSUFBTSxzQkFBTztBQUNsQixZQURrQix3QkFDTDtBQUNYLFdBQU8sU0FBSSxLQUFKLENBQVUsMkJBQVYsQ0FBUDtBQUNEO0FBSGlCLENBQWIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCIvKlxuQ29weXJpZ2h0IChjKSAyMDE1LCBZYWhvbyEgSW5jLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuQ29weXJpZ2h0cyBsaWNlbnNlZCB1bmRlciB0aGUgTmV3IEJTRCBMaWNlbnNlLlxuU2VlIHRoZSBhY2NvbXBhbnlpbmcgTElDRU5TRSBmaWxlIGZvciB0ZXJtcy5cblxuQXV0aG9yczogTmVyYSBMaXUgPG5lcmFsaXVAeWFob28taW5jLmNvbT5cbiAgICAgICAgIEFkb25pcyBGdW5nIDxhZG9uQHlhaG9vLWluYy5jb20+XG4gICAgICAgICBBbGJlcnQgWXUgPGFsYmVydHl1QHlhaG9vLWluYy5jb20+XG4qL1xuLypqc2hpbnQgbm9kZTogdHJ1ZSAqL1xuXG5leHBvcnRzLl9nZXRQcml2RmlsdGVycyA9IGZ1bmN0aW9uICgpIHtcblxuICAgIHZhciBMVCAgICAgPSAvPC9nLFxuICAgICAgICBRVU9UICAgPSAvXCIvZyxcbiAgICAgICAgU1FVT1QgID0gLycvZyxcbiAgICAgICAgQU1QICAgID0gLyYvZyxcbiAgICAgICAgTlVMTCAgID0gL1xceDAwL2csXG4gICAgICAgIFNQRUNJQUxfQVRUUl9WQUxVRV9VTlFVT1RFRF9DSEFSUyA9IC8oPzpeJHxbXFx4MDBcXHgwOS1cXHgwRCBcIidgPTw+XSkvZyxcbiAgICAgICAgU1BFQ0lBTF9IVE1MX0NIQVJTID0gL1smPD5cIidgXS9nLCBcbiAgICAgICAgU1BFQ0lBTF9DT01NRU5UX0NIQVJTID0gLyg/OlxceDAwfF4tKiE/PnwtLSE/PnwtLT8hPyR8XFxdPnxcXF0kKS9nO1xuXG4gICAgLy8gQ1NTIHNlbnNpdGl2ZSBjaGFyczogKClcIicvLCEqQHt9OjtcbiAgICAvLyBCeSBDU1M6IChUYWJ8TmV3TGluZXxjb2xvbnxzZW1pfGxwYXJ8cnBhcnxhcG9zfHNvbHxjb21tYXxleGNsfGFzdHxtaWRhc3QpO3wocXVvdHxRVU9UKVxuICAgIC8vIEJ5IFVSSV9QUk9UT0NPTDogKFRhYnxOZXdMaW5lKTtcbiAgICB2YXIgU0VOU0lUSVZFX0hUTUxfRU5USVRJRVMgPSAvJig/OiMoW3hYXVswLTlBLUZhLWZdK3xcXGQrKTs/fChUYWJ8TmV3TGluZXxjb2xvbnxzZW1pfGxwYXJ8cnBhcnxhcG9zfHNvbHxjb21tYXxleGNsfGFzdHxtaWRhc3R8ZW5zcHxlbXNwfHRoaW5zcCk7fChuYnNwfGFtcHxBTVB8bHR8TFR8Z3R8R1R8cXVvdHxRVU9UKTs/KS9nLFxuICAgICAgICBTRU5TSVRJVkVfTkFNRURfUkVGX01BUCA9IHtUYWI6ICdcXHQnLCBOZXdMaW5lOiAnXFxuJywgY29sb246ICc6Jywgc2VtaTogJzsnLCBscGFyOiAnKCcsIHJwYXI6ICcpJywgYXBvczogJ1xcJycsIHNvbDogJy8nLCBjb21tYTogJywnLCBleGNsOiAnIScsIGFzdDogJyonLCBtaWRhc3Q6ICcqJywgZW5zcDogJ1xcdTIwMDInLCBlbXNwOiAnXFx1MjAwMycsIHRoaW5zcDogJ1xcdTIwMDknLCBuYnNwOiAnXFx4QTAnLCBhbXA6ICcmJywgbHQ6ICc8JywgZ3Q6ICc+JywgcXVvdDogJ1wiJywgUVVPVDogJ1wiJ307XG5cbiAgICAvLyB2YXIgQ1NTX1ZBTElEX1ZBTFVFID0gXG4gICAgLy8gICAgIC9eKD86XG4gICAgLy8gICAgICg/IS0qZXhwcmVzc2lvbikjP1stXFx3XStcbiAgICAvLyAgICAgfFsrLV0/KD86XFxkK3xcXGQqXFwuXFxkKykoPzplbXxleHxjaHxyZW18cHh8bW18Y218aW58cHR8cGN8JXx2aHx2d3x2bWlufHZtYXgpP1xuICAgIC8vICAgICB8IWltcG9ydGFudFxuICAgIC8vICAgICB8IC8vZW1wdHlcbiAgICAvLyAgICAgKSQvaTtcbiAgICB2YXIgQ1NTX1ZBTElEX1ZBTFVFID0gL14oPzooPyEtKmV4cHJlc3Npb24pIz9bLVxcd10rfFsrLV0/KD86XFxkK3xcXGQqXFwuXFxkKykoPzpyP2VtfGV4fGNofGNtfG1tfGlufHB4fHB0fHBjfCV8dmh8dnd8dm1pbnx2bWF4KT98IWltcG9ydGFudHwpJC9pLFxuICAgICAgICAvLyBUT0RPOiBwcmV2ZW50IGRvdWJsZSBjc3MgZXNjYXBpbmcgYnkgbm90IGVuY29kaW5nIFxcIGFnYWluLCBidXQgdGhpcyBtYXkgcmVxdWlyZSBDU1MgZGVjb2RpbmdcbiAgICAgICAgLy8gXFx4N0YgYW5kIFxceDAxLVxceDFGIGxlc3MgXFx4MDkgYXJlIGZvciBTYWZhcmkgNS4wLCBhZGRlZCBbXXt9LyogZm9yIHVuYmFsYW5jZWQgcXVvdGVcbiAgICAgICAgQ1NTX0RPVUJMRV9RVU9URURfQ0hBUlMgPSAvW1xceDAwLVxceDFGXFx4N0ZcXFtcXF17fVxcXFxcIl0vZyxcbiAgICAgICAgQ1NTX1NJTkdMRV9RVU9URURfQ0hBUlMgPSAvW1xceDAwLVxceDFGXFx4N0ZcXFtcXF17fVxcXFwnXS9nLFxuICAgICAgICAvLyAoLCBcXHUyMDdEIGFuZCBcXHUyMDhEIGNhbiBiZSB1c2VkIGluIGJhY2tncm91bmQ6ICd1cmwoLi4uKScgaW4gSUUsIGFzc3VtZWQgYWxsIFxcIGNoYXJzIGFyZSBlbmNvZGVkIGJ5IFFVT1RFRF9DSEFSUywgYW5kIG51bGwgaXMgYWxyZWFkeSByZXBsYWNlZCB3aXRoIFxcdUZGRkRcbiAgICAgICAgLy8gb3RoZXJ3aXNlLCB1c2UgdGhpcyBDU1NfQkxBQ0tMSVNUIGluc3RlYWQgKGVuaGFuY2UgaXQgd2l0aCB1cmwgbWF0Y2hpbmcpOiAvKD86XFxcXD9cXCh8W1xcdTIwN0RcXHUyMDhEXXxcXFxcMHswLDR9MjggP3xcXFxcMHswLDJ9MjBbNzhdW0RkXSA/KSsvZ1xuICAgICAgICBDU1NfQkxBQ0tMSVNUID0gL3VybFtcXChcXHUyMDdEXFx1MjA4RF0rL2csXG4gICAgICAgIC8vIHRoaXMgYXNzdW1lcyBlbmNvZGVVUkkoKSBhbmQgZW5jb2RlVVJJQ29tcG9uZW50KCkgaGFzIGVzY2FwZWQgMS0zMiwgMTI3IGZvciBJRThcbiAgICAgICAgQ1NTX1VOUVVPVEVEX1VSTCA9IC9bJ1xcKFxcKV0vZzsgLy8gXCIgXFwgdHJlYXRlZCBieSBlbmNvZGVVUkkoKVxuXG4gICAgLy8gR2l2ZW4gYSBmdWxsIFVSSSwgbmVlZCB0byBzdXBwb3J0IFwiW1wiICggSVB2NmFkZHJlc3MgKSBcIl1cIiBpbiBVUkkgYXMgcGVyIFJGQzM5ODZcbiAgICAvLyBSZWZlcmVuY2U6IGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMzOTg2XG4gICAgdmFyIFVSTF9JUFY2ID0gL1xcL1xcLyU1W0JiXShbQS1GYS1mMC05Ol0rKSU1W0RkXS87XG5cblxuICAgIC8vIFJlZmVyZW5jZTogaHR0cDovL3NoYXp6ZXIuY28udWsvZGF0YWJhc2UvQWxsL2NoYXJhY3RlcnMtYWxsb3dkLWluLWh0bWwtZW50aXRpZXNcbiAgICAvLyBSZWZlcmVuY2U6IGh0dHA6Ly9zaGF6emVyLmNvLnVrL3ZlY3Rvci9DaGFyYWN0ZXJzLWFsbG93ZWQtYWZ0ZXItYW1wZXJzYW5kLWluLW5hbWVkLWNoYXJhY3Rlci1yZWZlcmVuY2VzXG4gICAgLy8gUmVmZXJlbmNlOiBodHRwOi8vc2hhenplci5jby51ay9kYXRhYmFzZS9BbGwvQ2hhcmFjdGVycy1iZWZvcmUtamF2YXNjcmlwdC11cmlcbiAgICAvLyBSZWZlcmVuY2U6IGh0dHA6Ly9zaGF6emVyLmNvLnVrL2RhdGFiYXNlL0FsbC9DaGFyYWN0ZXJzLWFmdGVyLWphdmFzY3JpcHQtdXJpXG4gICAgLy8gUmVmZXJlbmNlOiBodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9zeW50YXguaHRtbCNjb25zdW1lLWEtY2hhcmFjdGVyLXJlZmVyZW5jZVxuICAgIC8vIFJlZmVyZW5jZSBmb3IgbmFtZWQgY2hhcmFjdGVyczogaHR0cHM6Ly9odG1sLnNwZWMud2hhdHdnLm9yZy9tdWx0aXBhZ2UvZW50aXRpZXMuanNvblxuICAgIHZhciBVUklfQkxBQ0tMSVNUX1BST1RPQ09MUyA9IHsnamF2YXNjcmlwdCc6MSwgJ2RhdGEnOjEsICd2YnNjcmlwdCc6MSwgJ21odG1sJzoxLCAneC1zY2hlbWEnOjF9LFxuICAgICAgICBVUklfUFJPVE9DT0xfQ09MT04gPSAvKD86OnwmI1t4WF0wKjNbYUFdOz98JiMwKjU4Oz98JmNvbG9uOykvLFxuICAgICAgICBVUklfUFJPVE9DT0xfV0hJVEVTUEFDRVMgPSAvKD86XltcXHgwMC1cXHgyMF0rfFtcXHRcXG5cXHJcXHgwMF0rKS9nLFxuICAgICAgICBVUklfUFJPVE9DT0xfTkFNRURfUkVGX01BUCA9IHtUYWI6ICdcXHQnLCBOZXdMaW5lOiAnXFxuJ307XG5cbiAgICB2YXIgeCwgXG4gICAgICAgIHN0clJlcGxhY2UgPSBmdW5jdGlvbiAocywgcmVnZXhwLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgcmV0dXJuIHMgPT09IHVuZGVmaW5lZCA/ICd1bmRlZmluZWQnXG4gICAgICAgICAgICAgICAgICAgIDogcyA9PT0gbnVsbCAgICAgICAgICAgID8gJ251bGwnXG4gICAgICAgICAgICAgICAgICAgIDogcy50b1N0cmluZygpLnJlcGxhY2UocmVnZXhwLCBjYWxsYmFjayk7XG4gICAgICAgIH0sXG4gICAgICAgIGZyb21Db2RlUG9pbnQgPSBTdHJpbmcuZnJvbUNvZGVQb2ludCB8fCBmdW5jdGlvbihjb2RlUG9pbnQpIHtcbiAgICAgICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGNvZGVQb2ludCA8PSAweEZGRkYpIHsgLy8gQk1QIGNvZGUgcG9pbnRcbiAgICAgICAgICAgICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShjb2RlUG9pbnQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBBc3RyYWwgY29kZSBwb2ludDsgc3BsaXQgaW4gc3Vycm9nYXRlIGhhbHZlc1xuICAgICAgICAgICAgLy8gaHR0cDovL21hdGhpYXNieW5lbnMuYmUvbm90ZXMvamF2YXNjcmlwdC1lbmNvZGluZyNzdXJyb2dhdGUtZm9ybXVsYWVcbiAgICAgICAgICAgIGNvZGVQb2ludCAtPSAweDEwMDAwO1xuICAgICAgICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoKGNvZGVQb2ludCA+PiAxMCkgKyAweEQ4MDAsIChjb2RlUG9pbnQgJSAweDQwMCkgKyAweERDMDApO1xuICAgICAgICB9O1xuXG5cbiAgICBmdW5jdGlvbiBnZXRQcm90b2NvbChzdHIpIHtcbiAgICAgICAgdmFyIHMgPSBzdHIuc3BsaXQoVVJJX1BST1RPQ09MX0NPTE9OLCAyKTtcbiAgICAgICAgLy8gc3RyLmxlbmd0aCAhPT0gc1swXS5sZW5ndGggaXMgZm9yIG9sZGVyIElFIChlLmcuLCB2OCksIHdoZXJlIGRlbGltZXRlciByZXNpZGluZyBhdCBsYXN0IHdpbGwgcmVzdWx0IGluIGxlbmd0aCBlcXVhbHMgMSwgYnV0IG5vdCAyXG4gICAgICAgIHJldHVybiAoc1swXSAmJiAocy5sZW5ndGggPT09IDIgfHwgc3RyLmxlbmd0aCAhPT0gc1swXS5sZW5ndGgpKSA/IHNbMF0gOiBudWxsO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGh0bWxEZWNvZGUocywgbmFtZWRSZWZNYXAsIHJlTmFtZWRSZWYsIHNraXBSZXBsYWNlbWVudCkge1xuICAgICAgICBcbiAgICAgICAgbmFtZWRSZWZNYXAgPSBuYW1lZFJlZk1hcCB8fCBTRU5TSVRJVkVfTkFNRURfUkVGX01BUDtcbiAgICAgICAgcmVOYW1lZFJlZiA9IHJlTmFtZWRSZWYgfHwgU0VOU0lUSVZFX0hUTUxfRU5USVRJRVM7XG5cbiAgICAgICAgZnVuY3Rpb24gcmVnRXhwRnVuY3Rpb24obSwgbnVtLCBuYW1lZCwgbmFtZWQxKSB7XG4gICAgICAgICAgICBpZiAobnVtKSB7XG4gICAgICAgICAgICAgICAgbnVtID0gTnVtYmVyKG51bVswXSA8PSAnOScgPyBudW0gOiAnMCcgKyBudW0pO1xuICAgICAgICAgICAgICAgIC8vIHN3aXRjaChudW0pIHtcbiAgICAgICAgICAgICAgICAvLyAgICAgY2FzZSAweDgwOiByZXR1cm4gJ1xcdTIwQUMnOyAgLy8gRVVSTyBTSUdOICjigqwpXG4gICAgICAgICAgICAgICAgLy8gICAgIGNhc2UgMHg4MjogcmV0dXJuICdcXHUyMDFBJzsgIC8vIFNJTkdMRSBMT1ctOSBRVU9UQVRJT04gTUFSSyAo4oCaKVxuICAgICAgICAgICAgICAgIC8vICAgICBjYXNlIDB4ODM6IHJldHVybiAnXFx1MDE5Mic7ICAvLyBMQVRJTiBTTUFMTCBMRVRURVIgRiBXSVRIIEhPT0sgKMaSKVxuICAgICAgICAgICAgICAgIC8vICAgICBjYXNlIDB4ODQ6IHJldHVybiAnXFx1MjAxRSc7ICAvLyBET1VCTEUgTE9XLTkgUVVPVEFUSU9OIE1BUksgKOKAnilcbiAgICAgICAgICAgICAgICAvLyAgICAgY2FzZSAweDg1OiByZXR1cm4gJ1xcdTIwMjYnOyAgLy8gSE9SSVpPTlRBTCBFTExJUFNJUyAo4oCmKVxuICAgICAgICAgICAgICAgIC8vICAgICBjYXNlIDB4ODY6IHJldHVybiAnXFx1MjAyMCc7ICAvLyBEQUdHRVIgKOKAoClcbiAgICAgICAgICAgICAgICAvLyAgICAgY2FzZSAweDg3OiByZXR1cm4gJ1xcdTIwMjEnOyAgLy8gRE9VQkxFIERBR0dFUiAo4oChKVxuICAgICAgICAgICAgICAgIC8vICAgICBjYXNlIDB4ODg6IHJldHVybiAnXFx1MDJDNic7ICAvLyBNT0RJRklFUiBMRVRURVIgQ0lSQ1VNRkxFWCBBQ0NFTlQgKMuGKVxuICAgICAgICAgICAgICAgIC8vICAgICBjYXNlIDB4ODk6IHJldHVybiAnXFx1MjAzMCc7ICAvLyBQRVIgTUlMTEUgU0lHTiAo4oCwKVxuICAgICAgICAgICAgICAgIC8vICAgICBjYXNlIDB4OEE6IHJldHVybiAnXFx1MDE2MCc7ICAvLyBMQVRJTiBDQVBJVEFMIExFVFRFUiBTIFdJVEggQ0FST04gKMWgKVxuICAgICAgICAgICAgICAgIC8vICAgICBjYXNlIDB4OEI6IHJldHVybiAnXFx1MjAzOSc7ICAvLyBTSU5HTEUgTEVGVC1QT0lOVElORyBBTkdMRSBRVU9UQVRJT04gTUFSSyAo4oC5KVxuICAgICAgICAgICAgICAgIC8vICAgICBjYXNlIDB4OEM6IHJldHVybiAnXFx1MDE1Mic7ICAvLyBMQVRJTiBDQVBJVEFMIExJR0FUVVJFIE9FICjFkilcbiAgICAgICAgICAgICAgICAvLyAgICAgY2FzZSAweDhFOiByZXR1cm4gJ1xcdTAxN0QnOyAgLy8gTEFUSU4gQ0FQSVRBTCBMRVRURVIgWiBXSVRIIENBUk9OICjFvSlcbiAgICAgICAgICAgICAgICAvLyAgICAgY2FzZSAweDkxOiByZXR1cm4gJ1xcdTIwMTgnOyAgLy8gTEVGVCBTSU5HTEUgUVVPVEFUSU9OIE1BUksgKOKAmClcbiAgICAgICAgICAgICAgICAvLyAgICAgY2FzZSAweDkyOiByZXR1cm4gJ1xcdTIwMTknOyAgLy8gUklHSFQgU0lOR0xFIFFVT1RBVElPTiBNQVJLICjigJkpXG4gICAgICAgICAgICAgICAgLy8gICAgIGNhc2UgMHg5MzogcmV0dXJuICdcXHUyMDFDJzsgIC8vIExFRlQgRE9VQkxFIFFVT1RBVElPTiBNQVJLICjigJwpXG4gICAgICAgICAgICAgICAgLy8gICAgIGNhc2UgMHg5NDogcmV0dXJuICdcXHUyMDFEJzsgIC8vIFJJR0hUIERPVUJMRSBRVU9UQVRJT04gTUFSSyAo4oCdKVxuICAgICAgICAgICAgICAgIC8vICAgICBjYXNlIDB4OTU6IHJldHVybiAnXFx1MjAyMic7ICAvLyBCVUxMRVQgKOKAoilcbiAgICAgICAgICAgICAgICAvLyAgICAgY2FzZSAweDk2OiByZXR1cm4gJ1xcdTIwMTMnOyAgLy8gRU4gREFTSCAo4oCTKVxuICAgICAgICAgICAgICAgIC8vICAgICBjYXNlIDB4OTc6IHJldHVybiAnXFx1MjAxNCc7ICAvLyBFTSBEQVNIICjigJQpXG4gICAgICAgICAgICAgICAgLy8gICAgIGNhc2UgMHg5ODogcmV0dXJuICdcXHUwMkRDJzsgIC8vIFNNQUxMIFRJTERFICjLnClcbiAgICAgICAgICAgICAgICAvLyAgICAgY2FzZSAweDk5OiByZXR1cm4gJ1xcdTIxMjInOyAgLy8gVFJBREUgTUFSSyBTSUdOICjihKIpXG4gICAgICAgICAgICAgICAgLy8gICAgIGNhc2UgMHg5QTogcmV0dXJuICdcXHUwMTYxJzsgIC8vIExBVElOIFNNQUxMIExFVFRFUiBTIFdJVEggQ0FST04gKMWhKVxuICAgICAgICAgICAgICAgIC8vICAgICBjYXNlIDB4OUI6IHJldHVybiAnXFx1MjAzQSc7ICAvLyBTSU5HTEUgUklHSFQtUE9JTlRJTkcgQU5HTEUgUVVPVEFUSU9OIE1BUksgKOKAuilcbiAgICAgICAgICAgICAgICAvLyAgICAgY2FzZSAweDlDOiByZXR1cm4gJ1xcdTAxNTMnOyAgLy8gTEFUSU4gU01BTEwgTElHQVRVUkUgT0UgKMWTKVxuICAgICAgICAgICAgICAgIC8vICAgICBjYXNlIDB4OUU6IHJldHVybiAnXFx1MDE3RSc7ICAvLyBMQVRJTiBTTUFMTCBMRVRURVIgWiBXSVRIIENBUk9OICjFvilcbiAgICAgICAgICAgICAgICAvLyAgICAgY2FzZSAweDlGOiByZXR1cm4gJ1xcdTAxNzgnOyAgLy8gTEFUSU4gQ0FQSVRBTCBMRVRURVIgWSBXSVRIIERJQUVSRVNJUyAoxbgpXG4gICAgICAgICAgICAgICAgLy8gfVxuICAgICAgICAgICAgICAgIC8vIC8vIG51bSA+PSAweEQ4MDAgJiYgbnVtIDw9IDB4REZGRiwgYW5kIDB4MEQgaXMgc2VwYXJhdGVseSBoYW5kbGVkLCBhcyBpdCBkb2Vzbid0IGZhbGwgaW50byB0aGUgcmFuZ2Ugb2YgeC5wZWMoKVxuICAgICAgICAgICAgICAgIC8vIHJldHVybiAobnVtID49IDB4RDgwMCAmJiBudW0gPD0gMHhERkZGKSB8fCBudW0gPT09IDB4MEQgPyAnXFx1RkZGRCcgOiB4LmZyQ29QdChudW0pO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHNraXBSZXBsYWNlbWVudCA/IGZyb21Db2RlUG9pbnQobnVtKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBudW0gPT09IDB4ODAgPyAnXFx1MjBBQycgIC8vIEVVUk8gU0lHTiAo4oKsKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBudW0gPT09IDB4ODIgPyAnXFx1MjAxQScgIC8vIFNJTkdMRSBMT1ctOSBRVU9UQVRJT04gTUFSSyAo4oCaKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBudW0gPT09IDB4ODMgPyAnXFx1MDE5MicgIC8vIExBVElOIFNNQUxMIExFVFRFUiBGIFdJVEggSE9PSyAoxpIpXG4gICAgICAgICAgICAgICAgICAgICAgICA6IG51bSA9PT0gMHg4NCA/ICdcXHUyMDFFJyAgLy8gRE9VQkxFIExPVy05IFFVT1RBVElPTiBNQVJLICjigJ4pXG4gICAgICAgICAgICAgICAgICAgICAgICA6IG51bSA9PT0gMHg4NSA/ICdcXHUyMDI2JyAgLy8gSE9SSVpPTlRBTCBFTExJUFNJUyAo4oCmKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBudW0gPT09IDB4ODYgPyAnXFx1MjAyMCcgIC8vIERBR0dFUiAo4oCgKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBudW0gPT09IDB4ODcgPyAnXFx1MjAyMScgIC8vIERPVUJMRSBEQUdHRVIgKOKAoSlcbiAgICAgICAgICAgICAgICAgICAgICAgIDogbnVtID09PSAweDg4ID8gJ1xcdTAyQzYnICAvLyBNT0RJRklFUiBMRVRURVIgQ0lSQ1VNRkxFWCBBQ0NFTlQgKMuGKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBudW0gPT09IDB4ODkgPyAnXFx1MjAzMCcgIC8vIFBFUiBNSUxMRSBTSUdOICjigLApXG4gICAgICAgICAgICAgICAgICAgICAgICA6IG51bSA9PT0gMHg4QSA/ICdcXHUwMTYwJyAgLy8gTEFUSU4gQ0FQSVRBTCBMRVRURVIgUyBXSVRIIENBUk9OICjFoClcbiAgICAgICAgICAgICAgICAgICAgICAgIDogbnVtID09PSAweDhCID8gJ1xcdTIwMzknICAvLyBTSU5HTEUgTEVGVC1QT0lOVElORyBBTkdMRSBRVU9UQVRJT04gTUFSSyAo4oC5KVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBudW0gPT09IDB4OEMgPyAnXFx1MDE1MicgIC8vIExBVElOIENBUElUQUwgTElHQVRVUkUgT0UgKMWSKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBudW0gPT09IDB4OEUgPyAnXFx1MDE3RCcgIC8vIExBVElOIENBUElUQUwgTEVUVEVSIFogV0lUSCBDQVJPTiAoxb0pXG4gICAgICAgICAgICAgICAgICAgICAgICA6IG51bSA9PT0gMHg5MSA/ICdcXHUyMDE4JyAgLy8gTEVGVCBTSU5HTEUgUVVPVEFUSU9OIE1BUksgKOKAmClcbiAgICAgICAgICAgICAgICAgICAgICAgIDogbnVtID09PSAweDkyID8gJ1xcdTIwMTknICAvLyBSSUdIVCBTSU5HTEUgUVVPVEFUSU9OIE1BUksgKOKAmSlcbiAgICAgICAgICAgICAgICAgICAgICAgIDogbnVtID09PSAweDkzID8gJ1xcdTIwMUMnICAvLyBMRUZUIERPVUJMRSBRVU9UQVRJT04gTUFSSyAo4oCcKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBudW0gPT09IDB4OTQgPyAnXFx1MjAxRCcgIC8vIFJJR0hUIERPVUJMRSBRVU9UQVRJT04gTUFSSyAo4oCdKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBudW0gPT09IDB4OTUgPyAnXFx1MjAyMicgIC8vIEJVTExFVCAo4oCiKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBudW0gPT09IDB4OTYgPyAnXFx1MjAxMycgIC8vIEVOIERBU0ggKOKAkylcbiAgICAgICAgICAgICAgICAgICAgICAgIDogbnVtID09PSAweDk3ID8gJ1xcdTIwMTQnICAvLyBFTSBEQVNIICjigJQpXG4gICAgICAgICAgICAgICAgICAgICAgICA6IG51bSA9PT0gMHg5OCA/ICdcXHUwMkRDJyAgLy8gU01BTEwgVElMREUgKMucKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBudW0gPT09IDB4OTkgPyAnXFx1MjEyMicgIC8vIFRSQURFIE1BUksgU0lHTiAo4oSiKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBudW0gPT09IDB4OUEgPyAnXFx1MDE2MScgIC8vIExBVElOIFNNQUxMIExFVFRFUiBTIFdJVEggQ0FST04gKMWhKVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBudW0gPT09IDB4OUIgPyAnXFx1MjAzQScgIC8vIFNJTkdMRSBSSUdIVC1QT0lOVElORyBBTkdMRSBRVU9UQVRJT04gTUFSSyAo4oC6KVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBudW0gPT09IDB4OUMgPyAnXFx1MDE1MycgIC8vIExBVElOIFNNQUxMIExJR0FUVVJFIE9FICjFkylcbiAgICAgICAgICAgICAgICAgICAgICAgIDogbnVtID09PSAweDlFID8gJ1xcdTAxN0UnICAvLyBMQVRJTiBTTUFMTCBMRVRURVIgWiBXSVRIIENBUk9OICjFvilcbiAgICAgICAgICAgICAgICAgICAgICAgIDogbnVtID09PSAweDlGID8gJ1xcdTAxNzgnICAvLyBMQVRJTiBDQVBJVEFMIExFVFRFUiBZIFdJVEggRElBRVJFU0lTICjFuClcbiAgICAgICAgICAgICAgICAgICAgICAgIDogKG51bSA+PSAweEQ4MDAgJiYgbnVtIDw9IDB4REZGRikgfHwgbnVtID09PSAweDBEID8gJ1xcdUZGRkQnXG4gICAgICAgICAgICAgICAgICAgICAgICA6IHguZnJDb1B0KG51bSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbmFtZWRSZWZNYXBbbmFtZWQgfHwgbmFtZWQxXSB8fCBtO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHMgPT09IHVuZGVmaW5lZCAgPyAndW5kZWZpbmVkJ1xuICAgICAgICAgICAgOiBzID09PSBudWxsICAgICAgICA/ICdudWxsJ1xuICAgICAgICAgICAgOiBzLnRvU3RyaW5nKCkucmVwbGFjZShOVUxMLCAnXFx1RkZGRCcpLnJlcGxhY2UocmVOYW1lZFJlZiwgcmVnRXhwRnVuY3Rpb24pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNzc0VuY29kZShjaHIpIHtcbiAgICAgICAgLy8gc3BhY2UgYWZ0ZXIgXFxcXEhFWCBpcyBuZWVkZWQgYnkgc3BlY1xuICAgICAgICByZXR1cm4gJ1xcXFwnICsgY2hyLmNoYXJDb2RlQXQoMCkudG9TdHJpbmcoMTYpLnRvTG93ZXJDYXNlKCkgKyAnICc7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGNzc0JsYWNrbGlzdChzKSB7XG4gICAgICAgIHJldHVybiBzLnJlcGxhY2UoQ1NTX0JMQUNLTElTVCwgZnVuY3Rpb24obSl7IHJldHVybiAnLXgtJyArIG07IH0pO1xuICAgIH1cbiAgICBmdW5jdGlvbiBjc3NVcmwocykge1xuICAgICAgICAvLyBlbmNvZGVVUkkoKSBpbiB5dWZ1bGwoKSB3aWxsIHRocm93IGVycm9yIGZvciB1c2Ugb2YgdGhlIENTU19VTlNVUFBPUlRFRF9DT0RFX1BPSU5UIChpLmUuLCBbXFx1RDgwMC1cXHVERkZGXSlcbiAgICAgICAgcyA9IHgueXVmdWxsKGh0bWxEZWNvZGUocykpO1xuICAgICAgICB2YXIgcHJvdG9jb2wgPSBnZXRQcm90b2NvbChzKTtcblxuICAgICAgICAvLyBwcmVmaXggIyMgZm9yIGJsYWNrbGlzdGVkIHByb3RvY29sc1xuICAgICAgICAvLyBoZXJlIC5yZXBsYWNlKFVSSV9QUk9UT0NPTF9XSElURVNQQUNFUywgJycpIGlzIG5vdCBuZWVkZWQgc2luY2UgeXVmdWxsIGhhcyBhbHJlYWR5IHBlcmNlbnQtZW5jb2RlZCB0aGUgd2hpdGVzcGFjZXNcbiAgICAgICAgcmV0dXJuIChwcm90b2NvbCAmJiBVUklfQkxBQ0tMSVNUX1BST1RPQ09MU1twcm90b2NvbC50b0xvd2VyQ2FzZSgpXSkgPyAnIyMnICsgcyA6IHM7XG4gICAgfVxuXG4gICAgcmV0dXJuICh4ID0ge1xuICAgICAgICAvLyB0dXJuIGludmFsaWQgY29kZVBvaW50cyBhbmQgdGhhdCBvZiBub24tY2hhcmFjdGVycyB0byBcXHVGRkZELCBhbmQgdGhlbiBmcm9tQ29kZVBvaW50KClcbiAgICAgICAgZnJDb1B0OiBmdW5jdGlvbihudW0pIHtcbiAgICAgICAgICAgIHJldHVybiBudW0gPT09IHVuZGVmaW5lZCB8fCBudW0gPT09IG51bGwgPyAnJyA6XG4gICAgICAgICAgICAgICAgIWlzRmluaXRlKG51bSA9IE51bWJlcihudW0pKSB8fCAvLyBgTmFOYCwgYCtJbmZpbml0eWAsIG9yIGAtSW5maW5pdHlgXG4gICAgICAgICAgICAgICAgbnVtIDw9IDAgfHwgICAgICAgICAgICAgICAgICAgICAvLyBub3QgYSB2YWxpZCBVbmljb2RlIGNvZGUgcG9pbnRcbiAgICAgICAgICAgICAgICBudW0gPiAweDEwRkZGRiB8fCAgICAgICAgICAgICAgIC8vIG5vdCBhIHZhbGlkIFVuaWNvZGUgY29kZSBwb2ludFxuICAgICAgICAgICAgICAgIC8vIE1hdGguZmxvb3IobnVtKSAhPSBudW0gfHwgXG5cbiAgICAgICAgICAgICAgICAobnVtID49IDB4MDEgJiYgbnVtIDw9IDB4MDgpIHx8XG4gICAgICAgICAgICAgICAgKG51bSA+PSAweDBFICYmIG51bSA8PSAweDFGKSB8fFxuICAgICAgICAgICAgICAgIChudW0gPj0gMHg3RiAmJiBudW0gPD0gMHg5RikgfHxcbiAgICAgICAgICAgICAgICAobnVtID49IDB4RkREMCAmJiBudW0gPD0gMHhGREVGKSB8fFxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICBudW0gPT09IDB4MEIgfHwgXG4gICAgICAgICAgICAgICAgKG51bSAmIDB4RkZGRikgPT09IDB4RkZGRiB8fCBcbiAgICAgICAgICAgICAgICAobnVtICYgMHhGRkZGKSA9PT0gMHhGRkZFID8gJ1xcdUZGRkQnIDogZnJvbUNvZGVQb2ludChudW0pO1xuICAgICAgICB9LFxuICAgICAgICBkOiBodG1sRGVjb2RlLFxuICAgICAgICAvKlxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gcyAtIEFuIHVudHJ1c3RlZCB1cmkgaW5wdXRcbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ30gcyAtIG51bGwgaWYgcmVsYXRpdmUgdXJsLCBvdGhlcndpc2UgdGhlIHByb3RvY29sIHdpdGggd2hpdGVzcGFjZXMgc3RyaXBwZWQgYW5kIGxvd2VyLWNhc2VkXG4gICAgICAgICAqL1xuICAgICAgICB5dXA6IGZ1bmN0aW9uKHMpIHtcbiAgICAgICAgICAgIHMgPSBnZXRQcm90b2NvbChzLnJlcGxhY2UoTlVMTCwgJycpKTtcbiAgICAgICAgICAgIC8vIFVSSV9QUk9UT0NPTF9XSElURVNQQUNFUyBpcyByZXF1aXJlZCBmb3IgbGVmdCB0cmltIGFuZCByZW1vdmUgaW50ZXJpbSB3aGl0ZXNwYWNlc1xuICAgICAgICAgICAgcmV0dXJuIHMgPyBodG1sRGVjb2RlKHMsIFVSSV9QUk9UT0NPTF9OQU1FRF9SRUZfTUFQLCBudWxsLCB0cnVlKS5yZXBsYWNlKFVSSV9QUk9UT0NPTF9XSElURVNQQUNFUywgJycpLnRvTG93ZXJDYXNlKCkgOiBudWxsO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qXG4gICAgICAgICAqIEBkZXByZWNhdGVkXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzIC0gQW4gdW50cnVzdGVkIHVzZXIgaW5wdXRcbiAgICAgICAgICogQHJldHVybnMge3N0cmluZ30gcyAtIFRoZSBvcmlnaW5hbCB1c2VyIGlucHV0IHdpdGggJiA8ID4gXCIgJyBgIGVuY29kZWQgcmVzcGVjdGl2ZWx5IGFzICZhbXA7ICZsdDsgJmd0OyAmcXVvdDsgJiMzOTsgYW5kICYjOTY7LlxuICAgICAgICAgKlxuICAgICAgICAgKi9cbiAgICAgICAgeTogZnVuY3Rpb24ocykge1xuICAgICAgICAgICAgcmV0dXJuIHN0clJlcGxhY2UocywgU1BFQ0lBTF9IVE1MX0NIQVJTLCBmdW5jdGlvbiAobSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBtID09PSAnJicgPyAnJmFtcDsnXG4gICAgICAgICAgICAgICAgICAgIDogIG0gPT09ICc8JyA/ICcmbHQ7J1xuICAgICAgICAgICAgICAgICAgICA6ICBtID09PSAnPicgPyAnJmd0OydcbiAgICAgICAgICAgICAgICAgICAgOiAgbSA9PT0gJ1wiJyA/ICcmcXVvdDsnXG4gICAgICAgICAgICAgICAgICAgIDogIG0gPT09IFwiJ1wiID8gJyYjMzk7J1xuICAgICAgICAgICAgICAgICAgICA6ICAvKm0gPT09ICdgJyovICcmIzk2Oyc7ICAgICAgIC8vIGluIGhleDogNjBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vIFRoaXMgZmlsdGVyIGlzIG1lYW50IHRvIGludHJvZHVjZSBkb3VibGUtZW5jb2RpbmcsIGFuZCBzaG91bGQgYmUgdXNlZCB3aXRoIGV4dHJhIGNhcmUuXG4gICAgICAgIHlhOiBmdW5jdGlvbihzKSB7XG4gICAgICAgICAgICByZXR1cm4gc3RyUmVwbGFjZShzLCBBTVAsICcmYW1wOycpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vIEZPUiBERVRBSUxTLCByZWZlciB0byBpbkhUTUxEYXRhKClcbiAgICAgICAgLy8gUmVmZXJlbmNlOiBodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9zeW50YXguaHRtbCNkYXRhLXN0YXRlXG4gICAgICAgIHlkOiBmdW5jdGlvbiAocykge1xuICAgICAgICAgICAgcmV0dXJuIHN0clJlcGxhY2UocywgTFQsICcmbHQ7Jyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gRk9SIERFVEFJTFMsIHJlZmVyIHRvIGluSFRNTENvbW1lbnQoKVxuICAgICAgICAvLyBBbGwgTlVMTCBjaGFyYWN0ZXJzIGluIHMgYXJlIGZpcnN0IHJlcGxhY2VkIHdpdGggXFx1RkZGRC5cbiAgICAgICAgLy8gSWYgcyBjb250YWlucyAtLT4sIC0tIT4sIG9yIHN0YXJ0cyB3aXRoIC0qPiwgaW5zZXJ0IGEgc3BhY2UgcmlnaHQgYmVmb3JlID4gdG8gc3RvcCBzdGF0ZSBicmVha2luZyBhdCA8IS0te3t7eWMgc319fS0tPlxuICAgICAgICAvLyBJZiBzIGVuZHMgd2l0aCAtLSEsIC0tLCBvciAtLCBhcHBlbmQgYSBzcGFjZSB0byBzdG9wIGNvbGxhYm9yYXRpdmUgc3RhdGUgYnJlYWtpbmcgYXQge3t7eWMgc319fT4sIHt7e3ljIHN9fX0hPiwge3t7eWMgc319fS0hPiwge3t7eWMgc319fS0+XG4gICAgICAgIC8vIFJlZmVyZW5jZTogaHR0cHM6Ly9odG1sLnNwZWMud2hhdHdnLm9yZy9tdWx0aXBhZ2Uvc3ludGF4Lmh0bWwjY29tbWVudC1zdGF0ZVxuICAgICAgICAvLyBSZWZlcmVuY2U6IGh0dHA6Ly9zaGF6emVyLmNvLnVrL3ZlY3Rvci9DaGFyYWN0ZXJzLXRoYXQtY2xvc2UtYS1IVE1MLWNvbW1lbnQtM1xuICAgICAgICAvLyBSZWZlcmVuY2U6IGh0dHA6Ly9zaGF6emVyLmNvLnVrL3ZlY3Rvci9DaGFyYWN0ZXJzLXRoYXQtY2xvc2UtYS1IVE1MLWNvbW1lbnRcbiAgICAgICAgLy8gUmVmZXJlbmNlOiBodHRwOi8vc2hhenplci5jby51ay92ZWN0b3IvQ2hhcmFjdGVycy10aGF0LWNsb3NlLWEtSFRNTC1jb21tZW50LTAwMjFcbiAgICAgICAgLy8gSWYgcyBjb250YWlucyBdPiBvciBlbmRzIHdpdGggXSwgYXBwZW5kIGEgc3BhY2UgYWZ0ZXIgXSBpcyB2ZXJpZmllZCBpbiBJRSB0byBzdG9wIElFIGNvbmRpdGlvbmFsIGNvbW1lbnRzLlxuICAgICAgICAvLyBSZWZlcmVuY2U6IGh0dHA6Ly9tc2RuLm1pY3Jvc29mdC5jb20vZW4tdXMvbGlicmFyeS9tczUzNzUxMiUyOHY9dnMuODUlMjkuYXNweFxuICAgICAgICAvLyBXZSBkbyBub3QgY2FyZSAtLVxccz4sIHdoaWNoIGNhbiBwb3NzaWJseSBiZSBpbnRlcHJldGVkIGFzIGEgdmFsaWQgY2xvc2UgY29tbWVudCB0YWcgaW4gdmVyeSBvbGQgYnJvd3NlcnMgKGUuZy4sIGZpcmVmb3ggMy42KSwgYXMgc3BlY2lmaWVkIGluIHRoZSBodG1sNCBzcGVjXG4gICAgICAgIC8vIFJlZmVyZW5jZTogaHR0cDovL3d3dy53My5vcmcvVFIvaHRtbDQwMS9pbnRyby9zZ21sdHV0Lmh0bWwjaC0zLjIuNFxuICAgICAgICB5YzogZnVuY3Rpb24gKHMpIHtcbiAgICAgICAgICAgIHJldHVybiBzdHJSZXBsYWNlKHMsIFNQRUNJQUxfQ09NTUVOVF9DSEFSUywgZnVuY3Rpb24obSl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG0gPT09ICdcXHgwMCcgPyAnXFx1RkZGRCdcbiAgICAgICAgICAgICAgICAgICAgOiBtID09PSAnLS0hJyB8fCBtID09PSAnLS0nIHx8IG0gPT09ICctJyB8fCBtID09PSAnXScgPyBtICsgJyAnXG4gICAgICAgICAgICAgICAgICAgIDovKlxuICAgICAgICAgICAgICAgICAgICA6ICBtID09PSAnXT4nICAgPyAnXSA+J1xuICAgICAgICAgICAgICAgICAgICA6ICBtID09PSAnLS0+JyAgPyAnLS0gPidcbiAgICAgICAgICAgICAgICAgICAgOiAgbSA9PT0gJy0tIT4nID8gJy0tISA+J1xuICAgICAgICAgICAgICAgICAgICA6IC8tKiE/Pi8udGVzdChtKSA/ICovIG0uc2xpY2UoMCwgLTEpICsgJyA+JztcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vIEZPUiBERVRBSUxTLCByZWZlciB0byBpbkRvdWJsZVF1b3RlZEF0dHIoKVxuICAgICAgICAvLyBSZWZlcmVuY2U6IGh0dHBzOi8vaHRtbC5zcGVjLndoYXR3Zy5vcmcvbXVsdGlwYWdlL3N5bnRheC5odG1sI2F0dHJpYnV0ZS12YWx1ZS0oZG91YmxlLXF1b3RlZCktc3RhdGVcbiAgICAgICAgeWF2ZDogZnVuY3Rpb24gKHMpIHtcbiAgICAgICAgICAgIHJldHVybiBzdHJSZXBsYWNlKHMsIFFVT1QsICcmcXVvdDsnKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBGT1IgREVUQUlMUywgcmVmZXIgdG8gaW5TaW5nbGVRdW90ZWRBdHRyKClcbiAgICAgICAgLy8gUmVmZXJlbmNlOiBodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9zeW50YXguaHRtbCNhdHRyaWJ1dGUtdmFsdWUtKHNpbmdsZS1xdW90ZWQpLXN0YXRlXG4gICAgICAgIHlhdnM6IGZ1bmN0aW9uIChzKSB7XG4gICAgICAgICAgICByZXR1cm4gc3RyUmVwbGFjZShzLCBTUVVPVCwgJyYjMzk7Jyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gRk9SIERFVEFJTFMsIHJlZmVyIHRvIGluVW5RdW90ZWRBdHRyKClcbiAgICAgICAgLy8gUEFSVCBBLlxuICAgICAgICAvLyBpZiBzIGNvbnRhaW5zIGFueSBzdGF0ZSBicmVha2luZyBjaGFycyAoXFx0LCBcXG4sIFxcdiwgXFxmLCBcXHIsIHNwYWNlLCBhbmQgPiksXG4gICAgICAgIC8vIHRoZXkgYXJlIGVzY2FwZWQgYW5kIGVuY29kZWQgaW50byB0aGVpciBlcXVpdmFsZW50IEhUTUwgZW50aXR5IHJlcHJlc2VudGF0aW9ucy4gXG4gICAgICAgIC8vIFJlZmVyZW5jZTogaHR0cDovL3NoYXp6ZXIuY28udWsvZGF0YWJhc2UvQWxsL0NoYXJhY3RlcnMtd2hpY2gtYnJlYWstYXR0cmlidXRlcy13aXRob3V0LXF1b3Rlc1xuICAgICAgICAvLyBSZWZlcmVuY2U6IGh0dHBzOi8vaHRtbC5zcGVjLndoYXR3Zy5vcmcvbXVsdGlwYWdlL3N5bnRheC5odG1sI2F0dHJpYnV0ZS12YWx1ZS0odW5xdW90ZWQpLXN0YXRlXG4gICAgICAgIC8vXG4gICAgICAgIC8vIFBBUlQgQi4gXG4gICAgICAgIC8vIGlmIHMgc3RhcnRzIHdpdGggJywgXCIgb3IgYCwgZW5jb2RlIGl0IHJlc3AuIGFzICYjMzk7LCAmcXVvdDssIG9yICYjOTY7IHRvIFxuICAgICAgICAvLyBlbmZvcmNlIHRoZSBhdHRyIHZhbHVlICh1bnF1b3RlZCkgc3RhdGVcbiAgICAgICAgLy8gUmVmZXJlbmNlOiBodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9zeW50YXguaHRtbCNiZWZvcmUtYXR0cmlidXRlLXZhbHVlLXN0YXRlXG4gICAgICAgIC8vIFJlZmVyZW5jZTogaHR0cDovL3NoYXp6ZXIuY28udWsvdmVjdG9yL0NoYXJhY3RlcnMtYWxsb3dlZC1hdHRyaWJ1dGUtcXVvdGVcbiAgICAgICAgLy8gXG4gICAgICAgIC8vIFBBUlQgQy5cbiAgICAgICAgLy8gSW5qZWN0IGEgXFx1RkZGRCBjaGFyYWN0ZXIgaWYgYW4gZW1wdHkgb3IgYWxsIG51bGwgc3RyaW5nIGlzIGVuY291bnRlcmVkIGluIFxuICAgICAgICAvLyB1bnF1b3RlZCBhdHRyaWJ1dGUgdmFsdWUgc3RhdGUuXG4gICAgICAgIC8vIFxuICAgICAgICAvLyBSYXRpb25hbGUgMTogb3VyIGJlbGllZiBpcyB0aGF0IGRldmVsb3BlcnMgd291bGRuJ3QgZXhwZWN0IGFuIFxuICAgICAgICAvLyAgIGVtcHR5IHN0cmluZyB3b3VsZCByZXN1bHQgaW4gJyBuYW1lPVwicGFzc3dkXCInIHJlbmRlcmVkIGFzIFxuICAgICAgICAvLyAgIGF0dHJpYnV0ZSB2YWx1ZSwgZXZlbiB0aG91Z2ggdGhpcyBpcyBob3cgSFRNTDUgaXMgc3BlY2lmaWVkLlxuICAgICAgICAvLyBSYXRpb25hbGUgMjogYW4gZW1wdHkgb3IgYWxsIG51bGwgc3RyaW5nIChmb3IgSUUpIGNhbiBcbiAgICAgICAgLy8gICBlZmZlY3RpdmVseSBhbHRlciBpdHMgaW1tZWRpYXRlIHN1YnNlcXVlbnQgc3RhdGUsIHdlIGNob29zZVxuICAgICAgICAvLyAgIFxcdUZGRkQgdG8gZW5kIHRoZSB1bnF1b3RlZCBhdHRyIFxuICAgICAgICAvLyAgIHN0YXRlLCB3aGljaCB0aGVyZWZvcmUgd2lsbCBub3QgbWVzcyB1cCBsYXRlciBjb250ZXh0cy5cbiAgICAgICAgLy8gUmF0aW9uYWxlIDM6IFNpbmNlIElFIDYsIGl0IGlzIHZlcmlmaWVkIHRoYXQgTlVMTCBjaGFycyBhcmUgc3RyaXBwZWQuXG4gICAgICAgIC8vIFJlZmVyZW5jZTogaHR0cHM6Ly9odG1sLnNwZWMud2hhdHdnLm9yZy9tdWx0aXBhZ2Uvc3ludGF4Lmh0bWwjYXR0cmlidXRlLXZhbHVlLSh1bnF1b3RlZCktc3RhdGVcbiAgICAgICAgLy8gXG4gICAgICAgIC8vIEV4YW1wbGU6XG4gICAgICAgIC8vIDxpbnB1dCB2YWx1ZT17e3t5YXZ1IHN9fX0gbmFtZT1cInBhc3N3ZFwiLz5cbiAgICAgICAgeWF2dTogZnVuY3Rpb24gKHMpIHtcbiAgICAgICAgICAgIHJldHVybiBzdHJSZXBsYWNlKHMsIFNQRUNJQUxfQVRUUl9WQUxVRV9VTlFVT1RFRF9DSEFSUywgZnVuY3Rpb24gKG0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbSA9PT0gJ1xcdCcgICA/ICcmIzk7JyAgLy8gaW4gaGV4OiAwOVxuICAgICAgICAgICAgICAgICAgICA6ICBtID09PSAnXFxuJyAgID8gJyYjMTA7JyAvLyBpbiBoZXg6IDBBXG4gICAgICAgICAgICAgICAgICAgIDogIG0gPT09ICdcXHgwQicgPyAnJiMxMTsnIC8vIGluIGhleDogMEIgIGZvciBJRS4gSUU8OSBcXHYgZXF1YWxzIHYsIHNvIHVzZSBcXHgwQiBpbnN0ZWFkXG4gICAgICAgICAgICAgICAgICAgIDogIG0gPT09ICdcXGYnICAgPyAnJiMxMjsnIC8vIGluIGhleDogMENcbiAgICAgICAgICAgICAgICAgICAgOiAgbSA9PT0gJ1xccicgICA/ICcmIzEzOycgLy8gaW4gaGV4OiAwRFxuICAgICAgICAgICAgICAgICAgICA6ICBtID09PSAnICcgICAgPyAnJiMzMjsnIC8vIGluIGhleDogMjBcbiAgICAgICAgICAgICAgICAgICAgOiAgbSA9PT0gJz0nICAgID8gJyYjNjE7JyAvLyBpbiBoZXg6IDNEXG4gICAgICAgICAgICAgICAgICAgIDogIG0gPT09ICc8JyAgICA/ICcmbHQ7J1xuICAgICAgICAgICAgICAgICAgICA6ICBtID09PSAnPicgICAgPyAnJmd0OydcbiAgICAgICAgICAgICAgICAgICAgOiAgbSA9PT0gJ1wiJyAgICA/ICcmcXVvdDsnXG4gICAgICAgICAgICAgICAgICAgIDogIG0gPT09IFwiJ1wiICAgID8gJyYjMzk7J1xuICAgICAgICAgICAgICAgICAgICA6ICBtID09PSAnYCcgICAgPyAnJiM5NjsnXG4gICAgICAgICAgICAgICAgICAgIDogLyplbXB0eSBvciBudWxsKi8gJ1xcdUZGRkQnO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgeXU6IGVuY29kZVVSSSxcbiAgICAgICAgeXVjOiBlbmNvZGVVUklDb21wb25lbnQsXG5cbiAgICAgICAgLy8gTm90aWNlIHRoYXQgeXVibCBNVVNUIEJFIEFQUExJRUQgTEFTVCwgYW5kIHdpbGwgbm90IGJlIHVzZWQgaW5kZXBlbmRlbnRseSAoZXhwZWN0ZWQgb3V0cHV0IGZyb20gZW5jb2RlVVJJL2VuY29kZVVSSUNvbXBvbmVudCBhbmQgeWF2ZC95YXZzL3lhdnUpXG4gICAgICAgIC8vIFRoaXMgaXMgdXNlZCB0byBkaXNhYmxlIEpTIGV4ZWN1dGlvbiBjYXBhYmlsaXRpZXMgYnkgcHJlZml4aW5nIHgtIHRvIF5qYXZhc2NyaXB0OiwgXnZic2NyaXB0OiBvciBeZGF0YTogdGhhdCBwb3NzaWJseSBjb3VsZCB0cmlnZ2VyIHNjcmlwdCBleGVjdXRpb24gaW4gVVJJIGF0dHJpYnV0ZSBjb250ZXh0XG4gICAgICAgIHl1Ymw6IGZ1bmN0aW9uIChzKSB7XG4gICAgICAgICAgICByZXR1cm4gVVJJX0JMQUNLTElTVF9QUk9UT0NPTFNbeC55dXAocyldID8gJ3gtJyArIHMgOiBzO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vIFRoaXMgaXMgTk9UIGEgc2VjdXJpdHktY3JpdGljYWwgZmlsdGVyLlxuICAgICAgICAvLyBSZWZlcmVuY2U6IGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMzOTg2XG4gICAgICAgIHl1ZnVsbDogZnVuY3Rpb24gKHMpIHtcbiAgICAgICAgICAgIHJldHVybiB4Lnl1KHMpLnJlcGxhY2UoVVJMX0lQVjYsIGZ1bmN0aW9uKG0sIHApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJy8vWycgKyBwICsgJ10nO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gY2hhaW4geXVmdWxsKCkgd2l0aCB5dWJsKClcbiAgICAgICAgeXVibGY6IGZ1bmN0aW9uIChzKSB7XG4gICAgICAgICAgICByZXR1cm4geC55dWJsKHgueXVmdWxsKHMpKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBUaGUgZGVzaWduIHByaW5jaXBsZSBvZiB0aGUgQ1NTIGZpbHRlciBNVVNUIG1lZXQgdGhlIGZvbGxvd2luZyBnb2FsKHMpLlxuICAgICAgICAvLyAoMSkgVGhlIGlucHV0IGNhbm5vdCBicmVhayBvdXQgb2YgdGhlIGNvbnRleHQgKGV4cHIpIGFuZCB0aGlzIGlzIHRvIGZ1bGZpbGwgdGhlIGp1c3Qgc3VmZmljaWVudCBlbmNvZGluZyBwcmluY2lwbGUuXG4gICAgICAgIC8vICgyKSBUaGUgaW5wdXQgY2Fubm90IGludHJvZHVjZSBDU1MgcGFyc2luZyBlcnJvciBhbmQgdGhpcyBpcyB0byBhZGRyZXNzIHRoZSBjb25jZXJuIG9mIFVJIHJlZHJlc3NpbmcuXG4gICAgICAgIC8vXG4gICAgICAgIC8vIHRlcm1cbiAgICAgICAgLy8gICA6IHVuYXJ5X29wZXJhdG9yP1xuICAgICAgICAvLyAgICAgWyBOVU1CRVIgUyogfCBQRVJDRU5UQUdFIFMqIHwgTEVOR1RIIFMqIHwgRU1TIFMqIHwgRVhTIFMqIHwgQU5HTEUgUyogfFxuICAgICAgICAvLyAgICAgVElNRSBTKiB8IEZSRVEgUyogXVxuICAgICAgICAvLyAgIHwgU1RSSU5HIFMqIHwgSURFTlQgUyogfCBVUkkgUyogfCBoZXhjb2xvciB8IGZ1bmN0aW9uXG4gICAgICAgIC8vIFxuICAgICAgICAvLyBSZWZlcmVuY2U6XG4gICAgICAgIC8vICogaHR0cDovL3d3dy53My5vcmcvVFIvQ1NTMjEvZ3JhbW1hci5odG1sIFxuICAgICAgICAvLyAqIGh0dHA6Ly93d3cudzMub3JnL1RSL2Nzcy1zeW50YXgtMy9cbiAgICAgICAgLy8gXG4gICAgICAgIC8vIE5PVEU6IGRlbGltaXRlciBpbiBDU1MgLSAgXFwgIF8gIDogIDsgICggICkgIFwiICAnICAvICAsICAlICAjICAhICAqICBAICAuICB7ICB9XG4gICAgICAgIC8vICAgICAgICAgICAgICAgICAgICAgICAgMmQgNWMgNWYgM2EgM2IgMjggMjkgMjIgMjcgMmYgMmMgMjUgMjMgMjEgMmEgNDAgMmUgN2IgN2RcblxuICAgICAgICB5Y2V1OiBmdW5jdGlvbihzKSB7XG4gICAgICAgICAgICBzID0gaHRtbERlY29kZShzKTtcbiAgICAgICAgICAgIHJldHVybiBDU1NfVkFMSURfVkFMVUUudGVzdChzKSA/IHMgOiBcIjsteDonXCIgKyBjc3NCbGFja2xpc3Qocy5yZXBsYWNlKENTU19TSU5HTEVfUVVPVEVEX0NIQVJTLCBjc3NFbmNvZGUpKSArIFwiJzstdjpcIjtcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBzdHJpbmcxID0gXFxcIihbXlxcblxcclxcZlxcXFxcIl18XFxcXHtubH18XFxcXFteXFxuXFxyXFxmMC05YS1mXXxcXFxcWzAtOWEtZl17MSw2fShcXHJcXG58WyBcXG5cXHJcXHRcXGZdKT8pKlxcXCJcbiAgICAgICAgeWNlZDogZnVuY3Rpb24ocykge1xuICAgICAgICAgICAgcmV0dXJuIGNzc0JsYWNrbGlzdChodG1sRGVjb2RlKHMpLnJlcGxhY2UoQ1NTX0RPVUJMRV9RVU9URURfQ0hBUlMsIGNzc0VuY29kZSkpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vIHN0cmluZzIgPSBcXCcoW15cXG5cXHJcXGZcXFxcJ118XFxcXHtubH18XFxcXFteXFxuXFxyXFxmMC05YS1mXXxcXFxcWzAtOWEtZl17MSw2fShcXHJcXG58WyBcXG5cXHJcXHRcXGZdKT8pKlxcJ1xuICAgICAgICB5Y2VzOiBmdW5jdGlvbihzKSB7XG4gICAgICAgICAgICByZXR1cm4gY3NzQmxhY2tsaXN0KGh0bWxEZWNvZGUocykucmVwbGFjZShDU1NfU0lOR0xFX1FVT1RFRF9DSEFSUywgY3NzRW5jb2RlKSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gZm9yIHVybCh7e3t5Y2V1dSB1cmx9fX1cbiAgICAgICAgLy8gdW5xdW90ZWRfdXJsID0gKFshIyQlJiotfl18XFxcXHtofXsxLDZ9KFxcclxcbnxbIFxcdFxcclxcblxcZl0pP3xcXFxcW15cXHJcXG5cXGYwLTlhLWZdKSogKENTUyAyLjEgZGVmaW5pdGlvbilcbiAgICAgICAgLy8gdW5xdW90ZWRfdXJsID0gKFteXCInKClcXFxcIFxcdFxcblxcclxcZlxcdlxcdTAwMDBcXHUwMDA4XFx1MDAwYlxcdTAwMGUtXFx1MDAxZlxcdTAwN2ZdfFxcXFx7aH17MSw2fShcXHJcXG58WyBcXHRcXHJcXG5cXGZdKT98XFxcXFteXFxyXFxuXFxmMC05YS1mXSkqIChDU1MgMy4wIGRlZmluaXRpb24pXG4gICAgICAgIC8vIFRoZSBzdGF0ZSBtYWNoaW5lIGluIENTUyAzLjAgaXMgbW9yZSB3ZWxsIGRlZmluZWQgLSBodHRwOi8vd3d3LnczLm9yZy9UUi9jc3Mtc3ludGF4LTMvI2NvbnN1bWUtYS11cmwtdG9rZW4wXG4gICAgICAgIC8vIENTU19VTlFVT1RFRF9VUkwgPSAvWydcXChcXCldL2c7IC8vIFwiIFxcIHRyZWF0ZWQgYnkgZW5jb2RlVVJJKCkgICBcbiAgICAgICAgeWNldXU6IGZ1bmN0aW9uKHMpIHtcbiAgICAgICAgICAgIHJldHVybiBjc3NVcmwocykucmVwbGFjZShDU1NfVU5RVU9URURfVVJMLCBmdW5jdGlvbiAoY2hyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICBjaHIgPT09ICdcXCcnICAgICAgICA/ICdcXFxcMjcgJyA6XG4gICAgICAgICAgICAgICAgICAgICAgICBjaHIgPT09ICcoJyAgICAgICAgID8gJyUyOCcgOlxuICAgICAgICAgICAgICAgICAgICAgICAgLyogY2hyID09PSAnKScgPyAqLyAgICclMjknO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gZm9yIHVybChcInt7e3ljZXVkIHVybH19fVxuICAgICAgICB5Y2V1ZDogZnVuY3Rpb24ocykgeyBcbiAgICAgICAgICAgIHJldHVybiBjc3NVcmwocyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gZm9yIHVybCgne3t7eWNldXMgdXJsfX19XG4gICAgICAgIHljZXVzOiBmdW5jdGlvbihzKSB7IFxuICAgICAgICAgICAgcmV0dXJuIGNzc1VybChzKS5yZXBsYWNlKFNRVU9ULCAnXFxcXDI3ICcpO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4vLyBleHBvc2luZyBwcml2RmlsdGVyc1xuLy8gdGhpcyBpcyBhbiB1bmRvY3VtZW50ZWQgZmVhdHVyZSwgYW5kIHBsZWFzZSB1c2UgaXQgd2l0aCBleHRyYSBjYXJlXG52YXIgcHJpdkZpbHRlcnMgPSBleHBvcnRzLl9wcml2RmlsdGVycyA9IGV4cG9ydHMuX2dldFByaXZGaWx0ZXJzKCk7XG5cblxuLyogY2hhaW5pbmcgZmlsdGVycyAqL1xuXG4vLyB1cmlJbkF0dHIgYW5kIGxpdGVyYWxseSB1cmlQYXRoSW5BdHRyXG4vLyB5dWJsIGlzIGFsd2F5cyB1c2VkIFxuLy8gUmF0aW9uYWxlOiBnaXZlbiBwYXR0ZXJuIGxpa2UgdGhpczogPGEgaHJlZj1cInt7e3VyaVBhdGhJbkRvdWJsZVF1b3RlZEF0dHIgc319fVwiPlxuLy8gICAgICAgICAgICBkZXZlbG9wZXIgbWF5IGV4cGVjdCBzIGlzIGFsd2F5cyBwcmVmaXhlZCB3aXRoID8gb3IgLywgYnV0IGFuIGF0dGFja2VyIGNhbiBhYnVzZSBpdCB3aXRoICdqYXZhc2NyaXB0OmFsZXJ0KDEpJ1xuZnVuY3Rpb24gdXJpSW5BdHRyIChzLCB5YXYsIHl1KSB7XG4gICAgcmV0dXJuIHByaXZGaWx0ZXJzLnl1YmwoeWF2KCh5dSB8fCBwcml2RmlsdGVycy55dWZ1bGwpKHMpKSk7XG59XG5cbi8qKiBcbiogWWFob28gU2VjdXJlIFhTUyBGaWx0ZXJzIC0ganVzdCBzdWZmaWNpZW50IG91dHB1dCBmaWx0ZXJpbmcgdG8gcHJldmVudCBYU1MhXG4qIEBtb2R1bGUgeHNzLWZpbHRlcnMgXG4qL1xuXG4vKipcbiogQGZ1bmN0aW9uIG1vZHVsZTp4c3MtZmlsdGVycyNpbkhUTUxEYXRhXG4qXG4qIEBwYXJhbSB7c3RyaW5nfSBzIC0gQW4gdW50cnVzdGVkIHVzZXIgaW5wdXRcbiogQHJldHVybnMge3N0cmluZ30gVGhlIHN0cmluZyBzIHdpdGggJzwnIGVuY29kZWQgYXMgJyZhbXA7bHQ7J1xuKlxuKiBAZGVzY3JpcHRpb25cbiogVGhpcyBmaWx0ZXIgaXMgdG8gYmUgcGxhY2VkIGluIEhUTUwgRGF0YSBjb250ZXh0IHRvIGVuY29kZSBhbGwgJzwnIGNoYXJhY3RlcnMgaW50byAnJmFtcDtsdDsnXG4qIDx1bD5cbiogPGxpPjxhIGhyZWY9XCJodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9zeW50YXguaHRtbCNkYXRhLXN0YXRlXCI+SFRNTDUgRGF0YSBTdGF0ZTwvYT48L2xpPlxuKiA8L3VsPlxuKlxuKiBAZXhhbXBsZVxuKiAvLyBvdXRwdXQgY29udGV4dCB0byBiZSBhcHBsaWVkIGJ5IHRoaXMgZmlsdGVyLlxuKiA8ZGl2Pnt7e2luSFRNTERhdGEgaHRtbERhdGF9fX08L2Rpdj5cbipcbiovXG5leHBvcnRzLmluSFRNTERhdGEgPSBwcml2RmlsdGVycy55ZDtcblxuLyoqXG4qIEBmdW5jdGlvbiBtb2R1bGU6eHNzLWZpbHRlcnMjaW5IVE1MQ29tbWVudFxuKlxuKiBAcGFyYW0ge3N0cmluZ30gcyAtIEFuIHVudHJ1c3RlZCB1c2VyIGlucHV0XG4qIEByZXR1cm5zIHtzdHJpbmd9IEFsbCBOVUxMIGNoYXJhY3RlcnMgaW4gcyBhcmUgZmlyc3QgcmVwbGFjZWQgd2l0aCBcXHVGRkZELiBJZiBzIGNvbnRhaW5zIC0tPiwgLS0hPiwgb3Igc3RhcnRzIHdpdGggLSo+LCBpbnNlcnQgYSBzcGFjZSByaWdodCBiZWZvcmUgPiB0byBzdG9wIHN0YXRlIGJyZWFraW5nIGF0IDwhLS17e3t5YyBzfX19LS0+LiBJZiBzIGVuZHMgd2l0aCAtLSEsIC0tLCBvciAtLCBhcHBlbmQgYSBzcGFjZSB0byBzdG9wIGNvbGxhYm9yYXRpdmUgc3RhdGUgYnJlYWtpbmcgYXQge3t7eWMgc319fT4sIHt7e3ljIHN9fX0hPiwge3t7eWMgc319fS0hPiwge3t7eWMgc319fS0+LiBJZiBzIGNvbnRhaW5zIF0+IG9yIGVuZHMgd2l0aCBdLCBhcHBlbmQgYSBzcGFjZSBhZnRlciBdIGlzIHZlcmlmaWVkIGluIElFIHRvIHN0b3AgSUUgY29uZGl0aW9uYWwgY29tbWVudHMuXG4qXG4qIEBkZXNjcmlwdGlvblxuKiBUaGlzIGZpbHRlciBpcyB0byBiZSBwbGFjZWQgaW4gSFRNTCBDb21tZW50IGNvbnRleHRcbiogPHVsPlxuKiA8bGk+PGEgaHJlZj1cImh0dHA6Ly9zaGF6emVyLmNvLnVrL3ZlY3Rvci9DaGFyYWN0ZXJzLXRoYXQtY2xvc2UtYS1IVE1MLWNvbW1lbnQtM1wiPlNoYXp6ZXIgLSBDbG9zaW5nIGNvbW1lbnRzIGZvciAtLi0+PC9hPlxuKiA8bGk+PGEgaHJlZj1cImh0dHA6Ly9zaGF6emVyLmNvLnVrL3ZlY3Rvci9DaGFyYWN0ZXJzLXRoYXQtY2xvc2UtYS1IVE1MLWNvbW1lbnRcIj5TaGF6emVyIC0gQ2xvc2luZyBjb21tZW50cyBmb3IgLS0uPjwvYT5cbiogPGxpPjxhIGhyZWY9XCJodHRwOi8vc2hhenplci5jby51ay92ZWN0b3IvQ2hhcmFjdGVycy10aGF0LWNsb3NlLWEtSFRNTC1jb21tZW50LTAwMjFcIj5TaGF6emVyIC0gQ2xvc2luZyBjb21tZW50cyBmb3IgLj48L2E+XG4qIDxsaT48YSBocmVmPVwiaHR0cHM6Ly9odG1sLnNwZWMud2hhdHdnLm9yZy9tdWx0aXBhZ2Uvc3ludGF4Lmh0bWwjY29tbWVudC1zdGFydC1zdGF0ZVwiPkhUTUw1IENvbW1lbnQgU3RhcnQgU3RhdGU8L2E+PC9saT5cbiogPGxpPjxhIGhyZWY9XCJodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9zeW50YXguaHRtbCNjb21tZW50LXN0YXJ0LWRhc2gtc3RhdGVcIj5IVE1MNSBDb21tZW50IFN0YXJ0IERhc2ggU3RhdGU8L2E+PC9saT5cbiogPGxpPjxhIGhyZWY9XCJodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9zeW50YXguaHRtbCNjb21tZW50LXN0YXRlXCI+SFRNTDUgQ29tbWVudCBTdGF0ZTwvYT48L2xpPlxuKiA8bGk+PGEgaHJlZj1cImh0dHBzOi8vaHRtbC5zcGVjLndoYXR3Zy5vcmcvbXVsdGlwYWdlL3N5bnRheC5odG1sI2NvbW1lbnQtZW5kLWRhc2gtc3RhdGVcIj5IVE1MNSBDb21tZW50IEVuZCBEYXNoIFN0YXRlPC9hPjwvbGk+XG4qIDxsaT48YSBocmVmPVwiaHR0cHM6Ly9odG1sLnNwZWMud2hhdHdnLm9yZy9tdWx0aXBhZ2Uvc3ludGF4Lmh0bWwjY29tbWVudC1lbmQtc3RhdGVcIj5IVE1MNSBDb21tZW50IEVuZCBTdGF0ZTwvYT48L2xpPlxuKiA8bGk+PGEgaHJlZj1cImh0dHBzOi8vaHRtbC5zcGVjLndoYXR3Zy5vcmcvbXVsdGlwYWdlL3N5bnRheC5odG1sI2NvbW1lbnQtZW5kLWJhbmctc3RhdGVcIj5IVE1MNSBDb21tZW50IEVuZCBCYW5nIFN0YXRlPC9hPjwvbGk+XG4qIDxsaT48YSBocmVmPVwiaHR0cDovL21zZG4ubWljcm9zb2Z0LmNvbS9lbi11cy9saWJyYXJ5L21zNTM3NTEyJTI4dj12cy44NSUyOS5hc3B4XCI+Q29uZGl0aW9uYWwgQ29tbWVudHMgaW4gSW50ZXJuZXQgRXhwbG9yZXI8L2E+PC9saT5cbiogPC91bD5cbipcbiogQGV4YW1wbGVcbiogLy8gb3V0cHV0IGNvbnRleHQgdG8gYmUgYXBwbGllZCBieSB0aGlzIGZpbHRlci5cbiogPCEtLSB7e3tpbkhUTUxDb21tZW50IGh0bWxfY29tbWVudH19fSAtLT5cbipcbiovXG5leHBvcnRzLmluSFRNTENvbW1lbnQgPSBwcml2RmlsdGVycy55YztcblxuLyoqXG4qIEBmdW5jdGlvbiBtb2R1bGU6eHNzLWZpbHRlcnMjaW5TaW5nbGVRdW90ZWRBdHRyXG4qXG4qIEBwYXJhbSB7c3RyaW5nfSBzIC0gQW4gdW50cnVzdGVkIHVzZXIgaW5wdXRcbiogQHJldHVybnMge3N0cmluZ30gVGhlIHN0cmluZyBzIHdpdGggYW55IHNpbmdsZS1xdW90ZSBjaGFyYWN0ZXJzIGVuY29kZWQgaW50byAnJmFtcDsmIzM5OycuXG4qXG4qIEBkZXNjcmlwdGlvblxuKiA8cCBjbGFzcz1cIndhcm5pbmdcIj5XYXJuaW5nOiBUaGlzIGlzIE5PVCBkZXNpZ25lZCBmb3IgYW55IG9uWCAoZS5nLiwgb25jbGljaykgYXR0cmlidXRlcyE8L3A+XG4qIDxwIGNsYXNzPVwid2FybmluZ1wiPldhcm5pbmc6IElmIHlvdSdyZSB3b3JraW5nIG9uIFVSSS9jb21wb25lbnRzLCB1c2UgdGhlIG1vcmUgc3BlY2lmaWMgdXJpX19fSW5TaW5nbGVRdW90ZWRBdHRyIGZpbHRlciA8L3A+XG4qIFRoaXMgZmlsdGVyIGlzIHRvIGJlIHBsYWNlZCBpbiBIVE1MIEF0dHJpYnV0ZSBWYWx1ZSAoc2luZ2xlLXF1b3RlZCkgc3RhdGUgdG8gZW5jb2RlIGFsbCBzaW5nbGUtcXVvdGUgY2hhcmFjdGVycyBpbnRvICcmYW1wOyYjMzk7J1xuKlxuKiA8dWw+XG4qIDxsaT48YSBocmVmPVwiaHR0cHM6Ly9odG1sLnNwZWMud2hhdHdnLm9yZy9tdWx0aXBhZ2Uvc3ludGF4Lmh0bWwjYXR0cmlidXRlLXZhbHVlLShzaW5nbGUtcXVvdGVkKS1zdGF0ZVwiPkhUTUw1IEF0dHJpYnV0ZSBWYWx1ZSAoU2luZ2xlLVF1b3RlZCkgU3RhdGU8L2E+PC9saT5cbiogPC91bD5cbipcbiogQGV4YW1wbGVcbiogLy8gb3V0cHV0IGNvbnRleHQgdG8gYmUgYXBwbGllZCBieSB0aGlzIGZpbHRlci5cbiogPGlucHV0IG5hbWU9J2ZpcnN0bmFtZScgdmFsdWU9J3t7e2luU2luZ2xlUXVvdGVkQXR0ciBmaXJzdG5hbWV9fX0nIC8+XG4qXG4qL1xuZXhwb3J0cy5pblNpbmdsZVF1b3RlZEF0dHIgPSBwcml2RmlsdGVycy55YXZzO1xuXG4vKipcbiogQGZ1bmN0aW9uIG1vZHVsZTp4c3MtZmlsdGVycyNpbkRvdWJsZVF1b3RlZEF0dHJcbipcbiogQHBhcmFtIHtzdHJpbmd9IHMgLSBBbiB1bnRydXN0ZWQgdXNlciBpbnB1dFxuKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgc3RyaW5nIHMgd2l0aCBhbnkgc2luZ2xlLXF1b3RlIGNoYXJhY3RlcnMgZW5jb2RlZCBpbnRvICcmYW1wOyZxdW90OycuXG4qXG4qIEBkZXNjcmlwdGlvblxuKiA8cCBjbGFzcz1cIndhcm5pbmdcIj5XYXJuaW5nOiBUaGlzIGlzIE5PVCBkZXNpZ25lZCBmb3IgYW55IG9uWCAoZS5nLiwgb25jbGljaykgYXR0cmlidXRlcyE8L3A+XG4qIDxwIGNsYXNzPVwid2FybmluZ1wiPldhcm5pbmc6IElmIHlvdSdyZSB3b3JraW5nIG9uIFVSSS9jb21wb25lbnRzLCB1c2UgdGhlIG1vcmUgc3BlY2lmaWMgdXJpX19fSW5Eb3VibGVRdW90ZWRBdHRyIGZpbHRlciA8L3A+XG4qIFRoaXMgZmlsdGVyIGlzIHRvIGJlIHBsYWNlZCBpbiBIVE1MIEF0dHJpYnV0ZSBWYWx1ZSAoZG91YmxlLXF1b3RlZCkgc3RhdGUgdG8gZW5jb2RlIGFsbCBzaW5nbGUtcXVvdGUgY2hhcmFjdGVycyBpbnRvICcmYW1wOyZxdW90OydcbipcbiogPHVsPlxuKiA8bGk+PGEgaHJlZj1cImh0dHBzOi8vaHRtbC5zcGVjLndoYXR3Zy5vcmcvbXVsdGlwYWdlL3N5bnRheC5odG1sI2F0dHJpYnV0ZS12YWx1ZS0oZG91YmxlLXF1b3RlZCktc3RhdGVcIj5IVE1MNSBBdHRyaWJ1dGUgVmFsdWUgKERvdWJsZS1RdW90ZWQpIFN0YXRlPC9hPjwvbGk+XG4qIDwvdWw+XG4qXG4qIEBleGFtcGxlXG4qIC8vIG91dHB1dCBjb250ZXh0IHRvIGJlIGFwcGxpZWQgYnkgdGhpcyBmaWx0ZXIuXG4qIDxpbnB1dCBuYW1lPVwiZmlyc3RuYW1lXCIgdmFsdWU9XCJ7e3tpbkRvdWJsZVF1b3RlZEF0dHIgZmlyc3RuYW1lfX19XCIgLz5cbipcbiovXG5leHBvcnRzLmluRG91YmxlUXVvdGVkQXR0ciA9IHByaXZGaWx0ZXJzLnlhdmQ7XG5cbi8qKlxuKiBAZnVuY3Rpb24gbW9kdWxlOnhzcy1maWx0ZXJzI2luVW5RdW90ZWRBdHRyXG4qXG4qIEBwYXJhbSB7c3RyaW5nfSBzIC0gQW4gdW50cnVzdGVkIHVzZXIgaW5wdXRcbiogQHJldHVybnMge3N0cmluZ30gSWYgcyBjb250YWlucyBhbnkgc3RhdGUgYnJlYWtpbmcgY2hhcnMgKFxcdCwgXFxuLCBcXHYsIFxcZiwgXFxyLCBzcGFjZSwgbnVsbCwgJywgXCIsIGAsIDwsID4sIGFuZCA9KSwgdGhleSBhcmUgZXNjYXBlZCBhbmQgZW5jb2RlZCBpbnRvIHRoZWlyIGVxdWl2YWxlbnQgSFRNTCBlbnRpdHkgcmVwcmVzZW50YXRpb25zLiBJZiB0aGUgc3RyaW5nIGlzIGVtcHR5LCBpbmplY3QgYSBcXHVGRkZEIGNoYXJhY3Rlci5cbipcbiogQGRlc2NyaXB0aW9uXG4qIDxwIGNsYXNzPVwid2FybmluZ1wiPldhcm5pbmc6IFRoaXMgaXMgTk9UIGRlc2lnbmVkIGZvciBhbnkgb25YIChlLmcuLCBvbmNsaWNrKSBhdHRyaWJ1dGVzITwvcD5cbiogPHAgY2xhc3M9XCJ3YXJuaW5nXCI+V2FybmluZzogSWYgeW91J3JlIHdvcmtpbmcgb24gVVJJL2NvbXBvbmVudHMsIHVzZSB0aGUgbW9yZSBzcGVjaWZpYyB1cmlfX19JblVuUXVvdGVkQXR0ciBmaWx0ZXIgPC9wPlxuKiA8cD5SZWdhcmRpbmcgXFx1RkZGRCBpbmplY3Rpb24sIGdpdmVuIDxhIGlkPXt7e2lkfX19IG5hbWU9XCJwYXNzd2RcIj4sPGJyLz5cbiogICAgICAgIFJhdGlvbmFsZSAxOiBvdXIgYmVsaWVmIGlzIHRoYXQgZGV2ZWxvcGVycyB3b3VsZG4ndCBleHBlY3Qgd2hlbiBpZCBlcXVhbHMgYW5cbiogICAgICAgICAgZW1wdHkgc3RyaW5nIHdvdWxkIHJlc3VsdCBpbiAnIG5hbWU9XCJwYXNzd2RcIicgcmVuZGVyZWQgYXMgXG4qICAgICAgICAgIGF0dHJpYnV0ZSB2YWx1ZSwgZXZlbiB0aG91Z2ggdGhpcyBpcyBob3cgSFRNTDUgaXMgc3BlY2lmaWVkLjxici8+XG4qICAgICAgICBSYXRpb25hbGUgMjogYW4gZW1wdHkgb3IgYWxsIG51bGwgc3RyaW5nIChmb3IgSUUpIGNhbiBcbiogICAgICAgICAgZWZmZWN0aXZlbHkgYWx0ZXIgaXRzIGltbWVkaWF0ZSBzdWJzZXF1ZW50IHN0YXRlLCB3ZSBjaG9vc2VcbiogICAgICAgICAgXFx1RkZGRCB0byBlbmQgdGhlIHVucXVvdGVkIGF0dHIgXG4qICAgICAgICAgIHN0YXRlLCB3aGljaCB0aGVyZWZvcmUgd2lsbCBub3QgbWVzcyB1cCBsYXRlciBjb250ZXh0cy48YnIvPlxuKiAgICAgICAgUmF0aW9uYWxlIDM6IFNpbmNlIElFIDYsIGl0IGlzIHZlcmlmaWVkIHRoYXQgTlVMTCBjaGFycyBhcmUgc3RyaXBwZWQuPGJyLz5cbiogICAgICAgIFJlZmVyZW5jZTogaHR0cHM6Ly9odG1sLnNwZWMud2hhdHdnLm9yZy9tdWx0aXBhZ2Uvc3ludGF4Lmh0bWwjYXR0cmlidXRlLXZhbHVlLSh1bnF1b3RlZCktc3RhdGU8L3A+XG4qIDx1bD5cbiogPGxpPjxhIGhyZWY9XCJodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9zeW50YXguaHRtbCNhdHRyaWJ1dGUtdmFsdWUtKHVucXVvdGVkKS1zdGF0ZVwiPkhUTUw1IEF0dHJpYnV0ZSBWYWx1ZSAoVW5xdW90ZWQpIFN0YXRlPC9hPjwvbGk+XG4qIDxsaT48YSBocmVmPVwiaHR0cHM6Ly9odG1sLnNwZWMud2hhdHdnLm9yZy9tdWx0aXBhZ2Uvc3ludGF4Lmh0bWwjYmVmb3JlLWF0dHJpYnV0ZS12YWx1ZS1zdGF0ZVwiPkhUTUw1IEJlZm9yZSBBdHRyaWJ1dGUgVmFsdWUgU3RhdGU8L2E+PC9saT5cbiogPGxpPjxhIGhyZWY9XCJodHRwOi8vc2hhenplci5jby51ay9kYXRhYmFzZS9BbGwvQ2hhcmFjdGVycy13aGljaC1icmVhay1hdHRyaWJ1dGVzLXdpdGhvdXQtcXVvdGVzXCI+U2hhenplciAtIENoYXJhY3RlcnMtd2hpY2gtYnJlYWstYXR0cmlidXRlcy13aXRob3V0LXF1b3RlczwvYT48L2xpPlxuKiA8bGk+PGEgaHJlZj1cImh0dHA6Ly9zaGF6emVyLmNvLnVrL3ZlY3Rvci9DaGFyYWN0ZXJzLWFsbG93ZWQtYXR0cmlidXRlLXF1b3RlXCI+U2hhenplciAtIENoYXJhY3RlcnMtYWxsb3dlZC1hdHRyaWJ1dGUtcXVvdGU8L2E+PC9saT5cbiogPC91bD5cbipcbiogQGV4YW1wbGVcbiogLy8gb3V0cHV0IGNvbnRleHQgdG8gYmUgYXBwbGllZCBieSB0aGlzIGZpbHRlci5cbiogPGlucHV0IG5hbWU9XCJmaXJzdG5hbWVcIiB2YWx1ZT17e3tpblVuUXVvdGVkQXR0ciBmaXJzdG5hbWV9fX0gLz5cbipcbiovXG5leHBvcnRzLmluVW5RdW90ZWRBdHRyID0gcHJpdkZpbHRlcnMueWF2dTtcblxuXG4vKipcbiogQGZ1bmN0aW9uIG1vZHVsZTp4c3MtZmlsdGVycyN1cmlJblNpbmdsZVF1b3RlZEF0dHJcbipcbiogQHBhcmFtIHtzdHJpbmd9IHMgLSBBbiB1bnRydXN0ZWQgdXNlciBpbnB1dCwgc3VwcG9zZWRseSBhbiA8c3Ryb25nPmFic29sdXRlPC9zdHJvbmc+IFVSSVxuKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgc3RyaW5nIHMgZW5jb2RlZCBmaXJzdCBieSB3aW5kb3cuZW5jb2RlVVJJKCksIHRoZW4gaW5TaW5nbGVRdW90ZWRBdHRyKCksIGFuZCBmaW5hbGx5IHByZWZpeCB0aGUgcmVzdWx0ZWQgc3RyaW5nIHdpdGggJ3gtJyBpZiBpdCBiZWdpbnMgd2l0aCAnamF2YXNjcmlwdDonIG9yICd2YnNjcmlwdDonIHRoYXQgY291bGQgcG9zc2libHkgbGVhZCB0byBzY3JpcHQgZXhlY3V0aW9uXG4qXG4qIEBkZXNjcmlwdGlvblxuKiBUaGlzIGZpbHRlciBpcyB0byBiZSBwbGFjZWQgaW4gSFRNTCBBdHRyaWJ1dGUgVmFsdWUgKHNpbmdsZS1xdW90ZWQpIHN0YXRlIGZvciBhbiA8c3Ryb25nPmFic29sdXRlPC9zdHJvbmc+IFVSSS48YnIvPlxuKiBUaGUgY29ycmVjdCBvcmRlciBvZiBlbmNvZGVycyBpcyB0aHVzOiBmaXJzdCB3aW5kb3cuZW5jb2RlVVJJKCksIHRoZW4gaW5TaW5nbGVRdW90ZWRBdHRyKCksIGFuZCBmaW5hbGx5IHByZWZpeCB0aGUgcmVzdWx0ZWQgc3RyaW5nIHdpdGggJ3gtJyBpZiBpdCBiZWdpbnMgd2l0aCAnamF2YXNjcmlwdDonIG9yICd2YnNjcmlwdDonIHRoYXQgY291bGQgcG9zc2libHkgbGVhZCB0byBzY3JpcHQgZXhlY3V0aW9uXG4qXG4qIDxwPk5vdGljZTogVGhpcyBmaWx0ZXIgaXMgSVB2NiBmcmllbmRseSBieSBub3QgZW5jb2RpbmcgJ1snIGFuZCAnXScuPC9wPlxuKlxuKiA8dWw+XG4qIDxsaT48YSBocmVmPVwiaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvZW5jb2RlVVJJXCI+ZW5jb2RlVVJJIHwgTUROPC9hPjwvbGk+XG4qIDxsaT48YSBocmVmPVwiaHR0cDovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMzk4NlwiPlJGQyAzOTg2PC9hPjwvbGk+XG4qIDxsaT48YSBocmVmPVwiaHR0cHM6Ly9odG1sLnNwZWMud2hhdHdnLm9yZy9tdWx0aXBhZ2Uvc3ludGF4Lmh0bWwjYXR0cmlidXRlLXZhbHVlLShzaW5nbGUtcXVvdGVkKS1zdGF0ZVwiPkhUTUw1IEF0dHJpYnV0ZSBWYWx1ZSAoU2luZ2xlLVF1b3RlZCkgU3RhdGU8L2E+PC9saT5cbiogPC91bD5cbipcbiogQGV4YW1wbGVcbiogLy8gb3V0cHV0IGNvbnRleHQgdG8gYmUgYXBwbGllZCBieSB0aGlzIGZpbHRlci5cbiogPGEgaHJlZj0ne3t7dXJpSW5TaW5nbGVRdW90ZWRBdHRyIGZ1bGxfdXJpfX19Jz5saW5rPC9hPlxuKiBcbiovXG5leHBvcnRzLnVyaUluU2luZ2xlUXVvdGVkQXR0ciA9IGZ1bmN0aW9uIChzKSB7XG4gICAgcmV0dXJuIHVyaUluQXR0cihzLCBwcml2RmlsdGVycy55YXZzKTtcbn07XG5cbi8qKlxuKiBAZnVuY3Rpb24gbW9kdWxlOnhzcy1maWx0ZXJzI3VyaUluRG91YmxlUXVvdGVkQXR0clxuKlxuKiBAcGFyYW0ge3N0cmluZ30gcyAtIEFuIHVudHJ1c3RlZCB1c2VyIGlucHV0LCBzdXBwb3NlZGx5IGFuIDxzdHJvbmc+YWJzb2x1dGU8L3N0cm9uZz4gVVJJXG4qIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBzdHJpbmcgcyBlbmNvZGVkIGZpcnN0IGJ5IHdpbmRvdy5lbmNvZGVVUkkoKSwgdGhlbiBpbkRvdWJsZVF1b3RlZEF0dHIoKSwgYW5kIGZpbmFsbHkgcHJlZml4IHRoZSByZXN1bHRlZCBzdHJpbmcgd2l0aCAneC0nIGlmIGl0IGJlZ2lucyB3aXRoICdqYXZhc2NyaXB0Oicgb3IgJ3Zic2NyaXB0OicgdGhhdCBjb3VsZCBwb3NzaWJseSBsZWFkIHRvIHNjcmlwdCBleGVjdXRpb25cbipcbiogQGRlc2NyaXB0aW9uXG4qIFRoaXMgZmlsdGVyIGlzIHRvIGJlIHBsYWNlZCBpbiBIVE1MIEF0dHJpYnV0ZSBWYWx1ZSAoZG91YmxlLXF1b3RlZCkgc3RhdGUgZm9yIGFuIDxzdHJvbmc+YWJzb2x1dGU8L3N0cm9uZz4gVVJJLjxici8+XG4qIFRoZSBjb3JyZWN0IG9yZGVyIG9mIGVuY29kZXJzIGlzIHRodXM6IGZpcnN0IHdpbmRvdy5lbmNvZGVVUkkoKSwgdGhlbiBpbkRvdWJsZVF1b3RlZEF0dHIoKSwgYW5kIGZpbmFsbHkgcHJlZml4IHRoZSByZXN1bHRlZCBzdHJpbmcgd2l0aCAneC0nIGlmIGl0IGJlZ2lucyB3aXRoICdqYXZhc2NyaXB0Oicgb3IgJ3Zic2NyaXB0OicgdGhhdCBjb3VsZCBwb3NzaWJseSBsZWFkIHRvIHNjcmlwdCBleGVjdXRpb25cbipcbiogPHA+Tm90aWNlOiBUaGlzIGZpbHRlciBpcyBJUHY2IGZyaWVuZGx5IGJ5IG5vdCBlbmNvZGluZyAnWycgYW5kICddJy48L3A+XG4qXG4qIDx1bD5cbiogPGxpPjxhIGhyZWY9XCJodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9lbmNvZGVVUklcIj5lbmNvZGVVUkkgfCBNRE48L2E+PC9saT5cbiogPGxpPjxhIGhyZWY9XCJodHRwOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMzOTg2XCI+UkZDIDM5ODY8L2E+PC9saT5cbiogPGxpPjxhIGhyZWY9XCJodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9zeW50YXguaHRtbCNhdHRyaWJ1dGUtdmFsdWUtKGRvdWJsZS1xdW90ZWQpLXN0YXRlXCI+SFRNTDUgQXR0cmlidXRlIFZhbHVlIChEb3VibGUtUXVvdGVkKSBTdGF0ZTwvYT48L2xpPlxuKiA8L3VsPlxuKlxuKiBAZXhhbXBsZVxuKiAvLyBvdXRwdXQgY29udGV4dCB0byBiZSBhcHBsaWVkIGJ5IHRoaXMgZmlsdGVyLlxuKiA8YSBocmVmPVwie3t7dXJpSW5Eb3VibGVRdW90ZWRBdHRyIGZ1bGxfdXJpfX19XCI+bGluazwvYT5cbiogXG4qL1xuZXhwb3J0cy51cmlJbkRvdWJsZVF1b3RlZEF0dHIgPSBmdW5jdGlvbiAocykge1xuICAgIHJldHVybiB1cmlJbkF0dHIocywgcHJpdkZpbHRlcnMueWF2ZCk7XG59O1xuXG5cbi8qKlxuKiBAZnVuY3Rpb24gbW9kdWxlOnhzcy1maWx0ZXJzI3VyaUluVW5RdW90ZWRBdHRyXG4qXG4qIEBwYXJhbSB7c3RyaW5nfSBzIC0gQW4gdW50cnVzdGVkIHVzZXIgaW5wdXQsIHN1cHBvc2VkbHkgYW4gPHN0cm9uZz5hYnNvbHV0ZTwvc3Ryb25nPiBVUklcbiogQHJldHVybnMge3N0cmluZ30gVGhlIHN0cmluZyBzIGVuY29kZWQgZmlyc3QgYnkgd2luZG93LmVuY29kZVVSSSgpLCB0aGVuIGluVW5RdW90ZWRBdHRyKCksIGFuZCBmaW5hbGx5IHByZWZpeCB0aGUgcmVzdWx0ZWQgc3RyaW5nIHdpdGggJ3gtJyBpZiBpdCBiZWdpbnMgd2l0aCAnamF2YXNjcmlwdDonIG9yICd2YnNjcmlwdDonIHRoYXQgY291bGQgcG9zc2libHkgbGVhZCB0byBzY3JpcHQgZXhlY3V0aW9uXG4qXG4qIEBkZXNjcmlwdGlvblxuKiBUaGlzIGZpbHRlciBpcyB0byBiZSBwbGFjZWQgaW4gSFRNTCBBdHRyaWJ1dGUgVmFsdWUgKHVucXVvdGVkKSBzdGF0ZSBmb3IgYW4gPHN0cm9uZz5hYnNvbHV0ZTwvc3Ryb25nPiBVUkkuPGJyLz5cbiogVGhlIGNvcnJlY3Qgb3JkZXIgb2YgZW5jb2RlcnMgaXMgdGh1czogZmlyc3QgdGhlIGJ1aWx0LWluIGVuY29kZVVSSSgpLCB0aGVuIGluVW5RdW90ZWRBdHRyKCksIGFuZCBmaW5hbGx5IHByZWZpeCB0aGUgcmVzdWx0ZWQgc3RyaW5nIHdpdGggJ3gtJyBpZiBpdCBiZWdpbnMgd2l0aCAnamF2YXNjcmlwdDonIG9yICd2YnNjcmlwdDonIHRoYXQgY291bGQgcG9zc2libHkgbGVhZCB0byBzY3JpcHQgZXhlY3V0aW9uXG4qXG4qIDxwPk5vdGljZTogVGhpcyBmaWx0ZXIgaXMgSVB2NiBmcmllbmRseSBieSBub3QgZW5jb2RpbmcgJ1snIGFuZCAnXScuPC9wPlxuKlxuKiA8dWw+XG4qIDxsaT48YSBocmVmPVwiaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvZW5jb2RlVVJJXCI+ZW5jb2RlVVJJIHwgTUROPC9hPjwvbGk+XG4qIDxsaT48YSBocmVmPVwiaHR0cDovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMzk4NlwiPlJGQyAzOTg2PC9hPjwvbGk+XG4qIDxsaT48YSBocmVmPVwiaHR0cHM6Ly9odG1sLnNwZWMud2hhdHdnLm9yZy9tdWx0aXBhZ2Uvc3ludGF4Lmh0bWwjYXR0cmlidXRlLXZhbHVlLSh1bnF1b3RlZCktc3RhdGVcIj5IVE1MNSBBdHRyaWJ1dGUgVmFsdWUgKFVucXVvdGVkKSBTdGF0ZTwvYT48L2xpPlxuKiA8L3VsPlxuKlxuKiBAZXhhbXBsZVxuKiAvLyBvdXRwdXQgY29udGV4dCB0byBiZSBhcHBsaWVkIGJ5IHRoaXMgZmlsdGVyLlxuKiA8YSBocmVmPXt7e3VyaUluVW5RdW90ZWRBdHRyIGZ1bGxfdXJpfX19Pmxpbms8L2E+XG4qIFxuKi9cbmV4cG9ydHMudXJpSW5VblF1b3RlZEF0dHIgPSBmdW5jdGlvbiAocykge1xuICAgIHJldHVybiB1cmlJbkF0dHIocywgcHJpdkZpbHRlcnMueWF2dSk7XG59O1xuXG4vKipcbiogQGZ1bmN0aW9uIG1vZHVsZTp4c3MtZmlsdGVycyN1cmlJbkhUTUxEYXRhXG4qXG4qIEBwYXJhbSB7c3RyaW5nfSBzIC0gQW4gdW50cnVzdGVkIHVzZXIgaW5wdXQsIHN1cHBvc2VkbHkgYW4gPHN0cm9uZz5hYnNvbHV0ZTwvc3Ryb25nPiBVUklcbiogQHJldHVybnMge3N0cmluZ30gVGhlIHN0cmluZyBzIGVuY29kZWQgYnkgd2luZG93LmVuY29kZVVSSSgpIGFuZCB0aGVuIGluSFRNTERhdGEoKVxuKlxuKiBAZGVzY3JpcHRpb25cbiogVGhpcyBmaWx0ZXIgaXMgdG8gYmUgcGxhY2VkIGluIEhUTUwgRGF0YSBzdGF0ZSBmb3IgYW4gPHN0cm9uZz5hYnNvbHV0ZTwvc3Ryb25nPiBVUkkuXG4qXG4qIDxwPk5vdGljZTogVGhlIGFjdHVhbCBpbXBsZW1lbnRhdGlvbiBza2lwcyBpbkhUTUxEYXRhKCksIHNpbmNlICc8JyBpcyBhbHJlYWR5IGVuY29kZWQgYXMgJyUzQycgYnkgZW5jb2RlVVJJKCkuPC9wPlxuKiA8cD5Ob3RpY2U6IFRoaXMgZmlsdGVyIGlzIElQdjYgZnJpZW5kbHkgYnkgbm90IGVuY29kaW5nICdbJyBhbmQgJ10nLjwvcD5cbipcbiogPHVsPlxuKiA8bGk+PGEgaHJlZj1cImh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL2VuY29kZVVSSVwiPmVuY29kZVVSSSB8IE1ETjwvYT48L2xpPlxuKiA8bGk+PGEgaHJlZj1cImh0dHA6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzM5ODZcIj5SRkMgMzk4NjwvYT48L2xpPlxuKiA8bGk+PGEgaHJlZj1cImh0dHBzOi8vaHRtbC5zcGVjLndoYXR3Zy5vcmcvbXVsdGlwYWdlL3N5bnRheC5odG1sI2RhdGEtc3RhdGVcIj5IVE1MNSBEYXRhIFN0YXRlPC9hPjwvbGk+XG4qIDwvdWw+XG4qXG4qIEBleGFtcGxlXG4qIC8vIG91dHB1dCBjb250ZXh0IHRvIGJlIGFwcGxpZWQgYnkgdGhpcyBmaWx0ZXIuXG4qIDxhIGhyZWY9XCIvc29tZXdoZXJlXCI+e3t7dXJpSW5IVE1MRGF0YSBmdWxsX3VyaX19fTwvYT5cbiogXG4qL1xuZXhwb3J0cy51cmlJbkhUTUxEYXRhID0gcHJpdkZpbHRlcnMueXVmdWxsO1xuXG5cbi8qKlxuKiBAZnVuY3Rpb24gbW9kdWxlOnhzcy1maWx0ZXJzI3VyaUluSFRNTENvbW1lbnRcbipcbiogQHBhcmFtIHtzdHJpbmd9IHMgLSBBbiB1bnRydXN0ZWQgdXNlciBpbnB1dCwgc3VwcG9zZWRseSBhbiA8c3Ryb25nPmFic29sdXRlPC9zdHJvbmc+IFVSSVxuKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgc3RyaW5nIHMgZW5jb2RlZCBieSB3aW5kb3cuZW5jb2RlVVJJKCksIGFuZCBmaW5hbGx5IGluSFRNTENvbW1lbnQoKVxuKlxuKiBAZGVzY3JpcHRpb25cbiogVGhpcyBmaWx0ZXIgaXMgdG8gYmUgcGxhY2VkIGluIEhUTUwgQ29tbWVudCBzdGF0ZSBmb3IgYW4gPHN0cm9uZz5hYnNvbHV0ZTwvc3Ryb25nPiBVUkkuXG4qXG4qIDxwPk5vdGljZTogVGhpcyBmaWx0ZXIgaXMgSVB2NiBmcmllbmRseSBieSBub3QgZW5jb2RpbmcgJ1snIGFuZCAnXScuPC9wPlxuKlxuKiA8dWw+XG4qIDxsaT48YSBocmVmPVwiaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvZW5jb2RlVVJJXCI+ZW5jb2RlVVJJIHwgTUROPC9hPjwvbGk+XG4qIDxsaT48YSBocmVmPVwiaHR0cDovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMzk4NlwiPlJGQyAzOTg2PC9hPjwvbGk+XG4qIDxsaT48YSBocmVmPVwiaHR0cHM6Ly9odG1sLnNwZWMud2hhdHdnLm9yZy9tdWx0aXBhZ2Uvc3ludGF4Lmh0bWwjZGF0YS1zdGF0ZVwiPkhUTUw1IERhdGEgU3RhdGU8L2E+PC9saT5cbiogPGxpPjxhIGhyZWY9XCJodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9zeW50YXguaHRtbCNjb21tZW50LXN0YXRlXCI+SFRNTDUgQ29tbWVudCBTdGF0ZTwvYT48L2xpPlxuKiA8L3VsPlxuKlxuKiBAZXhhbXBsZVxuKiAvLyBvdXRwdXQgY29udGV4dCB0byBiZSBhcHBsaWVkIGJ5IHRoaXMgZmlsdGVyLlxuKiA8IS0tIHt7e3VyaUluSFRNTENvbW1lbnQgZnVsbF91cml9fX0gLS0+XG4qIFxuKi9cbmV4cG9ydHMudXJpSW5IVE1MQ29tbWVudCA9IGZ1bmN0aW9uIChzKSB7XG4gICAgcmV0dXJuIHByaXZGaWx0ZXJzLnljKHByaXZGaWx0ZXJzLnl1ZnVsbChzKSk7XG59O1xuXG5cblxuXG4vKipcbiogQGZ1bmN0aW9uIG1vZHVsZTp4c3MtZmlsdGVycyN1cmlQYXRoSW5TaW5nbGVRdW90ZWRBdHRyXG4qXG4qIEBwYXJhbSB7c3RyaW5nfSBzIC0gQW4gdW50cnVzdGVkIHVzZXIgaW5wdXQsIHN1cHBvc2VkbHkgYSBVUkkgUGF0aC9RdWVyeSBvciByZWxhdGl2ZSBVUklcbiogQHJldHVybnMge3N0cmluZ30gVGhlIHN0cmluZyBzIGVuY29kZWQgZmlyc3QgYnkgd2luZG93LmVuY29kZVVSSSgpLCB0aGVuIGluU2luZ2xlUXVvdGVkQXR0cigpLCBhbmQgZmluYWxseSBwcmVmaXggdGhlIHJlc3VsdGVkIHN0cmluZyB3aXRoICd4LScgaWYgaXQgYmVnaW5zIHdpdGggJ2phdmFzY3JpcHQ6JyBvciAndmJzY3JpcHQ6JyB0aGF0IGNvdWxkIHBvc3NpYmx5IGxlYWQgdG8gc2NyaXB0IGV4ZWN1dGlvblxuKlxuKiBAZGVzY3JpcHRpb25cbiogVGhpcyBmaWx0ZXIgaXMgdG8gYmUgcGxhY2VkIGluIEhUTUwgQXR0cmlidXRlIFZhbHVlIChzaW5nbGUtcXVvdGVkKSBzdGF0ZSBmb3IgYSBVUkkgUGF0aC9RdWVyeSBvciByZWxhdGl2ZSBVUkkuPGJyLz5cbiogVGhlIGNvcnJlY3Qgb3JkZXIgb2YgZW5jb2RlcnMgaXMgdGh1czogZmlyc3Qgd2luZG93LmVuY29kZVVSSSgpLCB0aGVuIGluU2luZ2xlUXVvdGVkQXR0cigpLCBhbmQgZmluYWxseSBwcmVmaXggdGhlIHJlc3VsdGVkIHN0cmluZyB3aXRoICd4LScgaWYgaXQgYmVnaW5zIHdpdGggJ2phdmFzY3JpcHQ6JyBvciAndmJzY3JpcHQ6JyB0aGF0IGNvdWxkIHBvc3NpYmx5IGxlYWQgdG8gc2NyaXB0IGV4ZWN1dGlvblxuKlxuKiA8dWw+XG4qIDxsaT48YSBocmVmPVwiaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvZW5jb2RlVVJJXCI+ZW5jb2RlVVJJIHwgTUROPC9hPjwvbGk+XG4qIDxsaT48YSBocmVmPVwiaHR0cDovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMzk4NlwiPlJGQyAzOTg2PC9hPjwvbGk+XG4qIDxsaT48YSBocmVmPVwiaHR0cHM6Ly9odG1sLnNwZWMud2hhdHdnLm9yZy9tdWx0aXBhZ2Uvc3ludGF4Lmh0bWwjYXR0cmlidXRlLXZhbHVlLShzaW5nbGUtcXVvdGVkKS1zdGF0ZVwiPkhUTUw1IEF0dHJpYnV0ZSBWYWx1ZSAoU2luZ2xlLVF1b3RlZCkgU3RhdGU8L2E+PC9saT5cbiogPC91bD5cbipcbiogQGV4YW1wbGVcbiogLy8gb3V0cHV0IGNvbnRleHQgdG8gYmUgYXBwbGllZCBieSB0aGlzIGZpbHRlci5cbiogPGEgaHJlZj0naHR0cDovL2V4YW1wbGUuY29tL3t7e3VyaVBhdGhJblNpbmdsZVF1b3RlZEF0dHIgdXJpX3BhdGh9fX0nPmxpbms8L2E+XG4qIDxhIGhyZWY9J2h0dHA6Ly9leGFtcGxlLmNvbS8/e3t7dXJpUXVlcnlJblNpbmdsZVF1b3RlZEF0dHIgdXJpX3F1ZXJ5fX19Jz5saW5rPC9hPlxuKiBcbiovXG5leHBvcnRzLnVyaVBhdGhJblNpbmdsZVF1b3RlZEF0dHIgPSBmdW5jdGlvbiAocykge1xuICAgIHJldHVybiB1cmlJbkF0dHIocywgcHJpdkZpbHRlcnMueWF2cywgcHJpdkZpbHRlcnMueXUpO1xufTtcblxuLyoqXG4qIEBmdW5jdGlvbiBtb2R1bGU6eHNzLWZpbHRlcnMjdXJpUGF0aEluRG91YmxlUXVvdGVkQXR0clxuKlxuKiBAcGFyYW0ge3N0cmluZ30gcyAtIEFuIHVudHJ1c3RlZCB1c2VyIGlucHV0LCBzdXBwb3NlZGx5IGEgVVJJIFBhdGgvUXVlcnkgb3IgcmVsYXRpdmUgVVJJXG4qIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBzdHJpbmcgcyBlbmNvZGVkIGZpcnN0IGJ5IHdpbmRvdy5lbmNvZGVVUkkoKSwgdGhlbiBpbkRvdWJsZVF1b3RlZEF0dHIoKSwgYW5kIGZpbmFsbHkgcHJlZml4IHRoZSByZXN1bHRlZCBzdHJpbmcgd2l0aCAneC0nIGlmIGl0IGJlZ2lucyB3aXRoICdqYXZhc2NyaXB0Oicgb3IgJ3Zic2NyaXB0OicgdGhhdCBjb3VsZCBwb3NzaWJseSBsZWFkIHRvIHNjcmlwdCBleGVjdXRpb25cbipcbiogQGRlc2NyaXB0aW9uXG4qIFRoaXMgZmlsdGVyIGlzIHRvIGJlIHBsYWNlZCBpbiBIVE1MIEF0dHJpYnV0ZSBWYWx1ZSAoZG91YmxlLXF1b3RlZCkgc3RhdGUgZm9yIGEgVVJJIFBhdGgvUXVlcnkgb3IgcmVsYXRpdmUgVVJJLjxici8+XG4qIFRoZSBjb3JyZWN0IG9yZGVyIG9mIGVuY29kZXJzIGlzIHRodXM6IGZpcnN0IHdpbmRvdy5lbmNvZGVVUkkoKSwgdGhlbiBpbkRvdWJsZVF1b3RlZEF0dHIoKSwgYW5kIGZpbmFsbHkgcHJlZml4IHRoZSByZXN1bHRlZCBzdHJpbmcgd2l0aCAneC0nIGlmIGl0IGJlZ2lucyB3aXRoICdqYXZhc2NyaXB0Oicgb3IgJ3Zic2NyaXB0OicgdGhhdCBjb3VsZCBwb3NzaWJseSBsZWFkIHRvIHNjcmlwdCBleGVjdXRpb25cbipcbiogPHVsPlxuKiA8bGk+PGEgaHJlZj1cImh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL2VuY29kZVVSSVwiPmVuY29kZVVSSSB8IE1ETjwvYT48L2xpPlxuKiA8bGk+PGEgaHJlZj1cImh0dHA6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzM5ODZcIj5SRkMgMzk4NjwvYT48L2xpPlxuKiA8bGk+PGEgaHJlZj1cImh0dHBzOi8vaHRtbC5zcGVjLndoYXR3Zy5vcmcvbXVsdGlwYWdlL3N5bnRheC5odG1sI2F0dHJpYnV0ZS12YWx1ZS0oZG91YmxlLXF1b3RlZCktc3RhdGVcIj5IVE1MNSBBdHRyaWJ1dGUgVmFsdWUgKERvdWJsZS1RdW90ZWQpIFN0YXRlPC9hPjwvbGk+XG4qIDwvdWw+XG4qXG4qIEBleGFtcGxlXG4qIC8vIG91dHB1dCBjb250ZXh0IHRvIGJlIGFwcGxpZWQgYnkgdGhpcyBmaWx0ZXIuXG4qIDxhIGhyZWY9XCJodHRwOi8vZXhhbXBsZS5jb20ve3t7dXJpUGF0aEluRG91YmxlUXVvdGVkQXR0ciB1cmlfcGF0aH19fVwiPmxpbms8L2E+XG4qIDxhIGhyZWY9XCJodHRwOi8vZXhhbXBsZS5jb20vP3t7e3VyaVF1ZXJ5SW5Eb3VibGVRdW90ZWRBdHRyIHVyaV9xdWVyeX19fVwiPmxpbms8L2E+XG4qIFxuKi9cbmV4cG9ydHMudXJpUGF0aEluRG91YmxlUXVvdGVkQXR0ciA9IGZ1bmN0aW9uIChzKSB7XG4gICAgcmV0dXJuIHVyaUluQXR0cihzLCBwcml2RmlsdGVycy55YXZkLCBwcml2RmlsdGVycy55dSk7XG59O1xuXG5cbi8qKlxuKiBAZnVuY3Rpb24gbW9kdWxlOnhzcy1maWx0ZXJzI3VyaVBhdGhJblVuUXVvdGVkQXR0clxuKlxuKiBAcGFyYW0ge3N0cmluZ30gcyAtIEFuIHVudHJ1c3RlZCB1c2VyIGlucHV0LCBzdXBwb3NlZGx5IGEgVVJJIFBhdGgvUXVlcnkgb3IgcmVsYXRpdmUgVVJJXG4qIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBzdHJpbmcgcyBlbmNvZGVkIGZpcnN0IGJ5IHdpbmRvdy5lbmNvZGVVUkkoKSwgdGhlbiBpblVuUXVvdGVkQXR0cigpLCBhbmQgZmluYWxseSBwcmVmaXggdGhlIHJlc3VsdGVkIHN0cmluZyB3aXRoICd4LScgaWYgaXQgYmVnaW5zIHdpdGggJ2phdmFzY3JpcHQ6JyBvciAndmJzY3JpcHQ6JyB0aGF0IGNvdWxkIHBvc3NpYmx5IGxlYWQgdG8gc2NyaXB0IGV4ZWN1dGlvblxuKlxuKiBAZGVzY3JpcHRpb25cbiogVGhpcyBmaWx0ZXIgaXMgdG8gYmUgcGxhY2VkIGluIEhUTUwgQXR0cmlidXRlIFZhbHVlICh1bnF1b3RlZCkgc3RhdGUgZm9yIGEgVVJJIFBhdGgvUXVlcnkgb3IgcmVsYXRpdmUgVVJJLjxici8+XG4qIFRoZSBjb3JyZWN0IG9yZGVyIG9mIGVuY29kZXJzIGlzIHRodXM6IGZpcnN0IHRoZSBidWlsdC1pbiBlbmNvZGVVUkkoKSwgdGhlbiBpblVuUXVvdGVkQXR0cigpLCBhbmQgZmluYWxseSBwcmVmaXggdGhlIHJlc3VsdGVkIHN0cmluZyB3aXRoICd4LScgaWYgaXQgYmVnaW5zIHdpdGggJ2phdmFzY3JpcHQ6JyBvciAndmJzY3JpcHQ6JyB0aGF0IGNvdWxkIHBvc3NpYmx5IGxlYWQgdG8gc2NyaXB0IGV4ZWN1dGlvblxuKlxuKiA8dWw+XG4qIDxsaT48YSBocmVmPVwiaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvZW5jb2RlVVJJXCI+ZW5jb2RlVVJJIHwgTUROPC9hPjwvbGk+XG4qIDxsaT48YSBocmVmPVwiaHR0cDovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMzk4NlwiPlJGQyAzOTg2PC9hPjwvbGk+XG4qIDxsaT48YSBocmVmPVwiaHR0cHM6Ly9odG1sLnNwZWMud2hhdHdnLm9yZy9tdWx0aXBhZ2Uvc3ludGF4Lmh0bWwjYXR0cmlidXRlLXZhbHVlLSh1bnF1b3RlZCktc3RhdGVcIj5IVE1MNSBBdHRyaWJ1dGUgVmFsdWUgKFVucXVvdGVkKSBTdGF0ZTwvYT48L2xpPlxuKiA8L3VsPlxuKlxuKiBAZXhhbXBsZVxuKiAvLyBvdXRwdXQgY29udGV4dCB0byBiZSBhcHBsaWVkIGJ5IHRoaXMgZmlsdGVyLlxuKiA8YSBocmVmPWh0dHA6Ly9leGFtcGxlLmNvbS97e3t1cmlQYXRoSW5VblF1b3RlZEF0dHIgdXJpX3BhdGh9fX0+bGluazwvYT5cbiogPGEgaHJlZj1odHRwOi8vZXhhbXBsZS5jb20vP3t7e3VyaVF1ZXJ5SW5VblF1b3RlZEF0dHIgdXJpX3F1ZXJ5fX19Pmxpbms8L2E+XG4qIFxuKi9cbmV4cG9ydHMudXJpUGF0aEluVW5RdW90ZWRBdHRyID0gZnVuY3Rpb24gKHMpIHtcbiAgICByZXR1cm4gdXJpSW5BdHRyKHMsIHByaXZGaWx0ZXJzLnlhdnUsIHByaXZGaWx0ZXJzLnl1KTtcbn07XG5cbi8qKlxuKiBAZnVuY3Rpb24gbW9kdWxlOnhzcy1maWx0ZXJzI3VyaVBhdGhJbkhUTUxEYXRhXG4qXG4qIEBwYXJhbSB7c3RyaW5nfSBzIC0gQW4gdW50cnVzdGVkIHVzZXIgaW5wdXQsIHN1cHBvc2VkbHkgYSBVUkkgUGF0aC9RdWVyeSBvciByZWxhdGl2ZSBVUklcbiogQHJldHVybnMge3N0cmluZ30gVGhlIHN0cmluZyBzIGVuY29kZWQgYnkgd2luZG93LmVuY29kZVVSSSgpIGFuZCB0aGVuIGluSFRNTERhdGEoKVxuKlxuKiBAZGVzY3JpcHRpb25cbiogVGhpcyBmaWx0ZXIgaXMgdG8gYmUgcGxhY2VkIGluIEhUTUwgRGF0YSBzdGF0ZSBmb3IgYSBVUkkgUGF0aC9RdWVyeSBvciByZWxhdGl2ZSBVUkkuXG4qXG4qIDxwPk5vdGljZTogVGhlIGFjdHVhbCBpbXBsZW1lbnRhdGlvbiBza2lwcyBpbkhUTUxEYXRhKCksIHNpbmNlICc8JyBpcyBhbHJlYWR5IGVuY29kZWQgYXMgJyUzQycgYnkgZW5jb2RlVVJJKCkuPC9wPlxuKlxuKiA8dWw+XG4qIDxsaT48YSBocmVmPVwiaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvZW5jb2RlVVJJXCI+ZW5jb2RlVVJJIHwgTUROPC9hPjwvbGk+XG4qIDxsaT48YSBocmVmPVwiaHR0cDovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMzk4NlwiPlJGQyAzOTg2PC9hPjwvbGk+XG4qIDxsaT48YSBocmVmPVwiaHR0cHM6Ly9odG1sLnNwZWMud2hhdHdnLm9yZy9tdWx0aXBhZ2Uvc3ludGF4Lmh0bWwjZGF0YS1zdGF0ZVwiPkhUTUw1IERhdGEgU3RhdGU8L2E+PC9saT5cbiogPC91bD5cbipcbiogQGV4YW1wbGVcbiogLy8gb3V0cHV0IGNvbnRleHQgdG8gYmUgYXBwbGllZCBieSB0aGlzIGZpbHRlci5cbiogPGEgaHJlZj1cImh0dHA6Ly9leGFtcGxlLmNvbS9cIj5odHRwOi8vZXhhbXBsZS5jb20ve3t7dXJpUGF0aEluSFRNTERhdGEgdXJpX3BhdGh9fX08L2E+XG4qIDxhIGhyZWY9XCJodHRwOi8vZXhhbXBsZS5jb20vXCI+aHR0cDovL2V4YW1wbGUuY29tLz97e3t1cmlRdWVyeUluSFRNTERhdGEgdXJpX3F1ZXJ5fX19PC9hPlxuKiBcbiovXG5leHBvcnRzLnVyaVBhdGhJbkhUTUxEYXRhID0gcHJpdkZpbHRlcnMueXU7XG5cblxuLyoqXG4qIEBmdW5jdGlvbiBtb2R1bGU6eHNzLWZpbHRlcnMjdXJpUGF0aEluSFRNTENvbW1lbnRcbipcbiogQHBhcmFtIHtzdHJpbmd9IHMgLSBBbiB1bnRydXN0ZWQgdXNlciBpbnB1dCwgc3VwcG9zZWRseSBhIFVSSSBQYXRoL1F1ZXJ5IG9yIHJlbGF0aXZlIFVSSVxuKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgc3RyaW5nIHMgZW5jb2RlZCBieSB3aW5kb3cuZW5jb2RlVVJJKCksIGFuZCBmaW5hbGx5IGluSFRNTENvbW1lbnQoKVxuKlxuKiBAZGVzY3JpcHRpb25cbiogVGhpcyBmaWx0ZXIgaXMgdG8gYmUgcGxhY2VkIGluIEhUTUwgQ29tbWVudCBzdGF0ZSBmb3IgYSBVUkkgUGF0aC9RdWVyeSBvciByZWxhdGl2ZSBVUkkuXG4qXG4qIDx1bD5cbiogPGxpPjxhIGhyZWY9XCJodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9lbmNvZGVVUklcIj5lbmNvZGVVUkkgfCBNRE48L2E+PC9saT5cbiogPGxpPjxhIGhyZWY9XCJodHRwOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMzOTg2XCI+UkZDIDM5ODY8L2E+PC9saT5cbiogPGxpPjxhIGhyZWY9XCJodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9zeW50YXguaHRtbCNkYXRhLXN0YXRlXCI+SFRNTDUgRGF0YSBTdGF0ZTwvYT48L2xpPlxuKiA8bGk+PGEgaHJlZj1cImh0dHBzOi8vaHRtbC5zcGVjLndoYXR3Zy5vcmcvbXVsdGlwYWdlL3N5bnRheC5odG1sI2NvbW1lbnQtc3RhdGVcIj5IVE1MNSBDb21tZW50IFN0YXRlPC9hPjwvbGk+XG4qIDwvdWw+XG4qXG4qIEBleGFtcGxlXG4qIC8vIG91dHB1dCBjb250ZXh0IHRvIGJlIGFwcGxpZWQgYnkgdGhpcyBmaWx0ZXIuXG4qIDwhLS0gaHR0cDovL2V4YW1wbGUuY29tL3t7e3VyaVBhdGhJbkhUTUxDb21tZW50IHVyaV9wYXRofX19IC0tPlxuKiA8IS0tIGh0dHA6Ly9leGFtcGxlLmNvbS8/e3t7dXJpUXVlcnlJbkhUTUxDb21tZW50IHVyaV9xdWVyeX19fSAtLT5cbiovXG5leHBvcnRzLnVyaVBhdGhJbkhUTUxDb21tZW50ID0gZnVuY3Rpb24gKHMpIHtcbiAgICByZXR1cm4gcHJpdkZpbHRlcnMueWMocHJpdkZpbHRlcnMueXUocykpO1xufTtcblxuXG4vKipcbiogQGZ1bmN0aW9uIG1vZHVsZTp4c3MtZmlsdGVycyN1cmlRdWVyeUluU2luZ2xlUXVvdGVkQXR0clxuKiBAZGVzY3JpcHRpb24gVGhpcyBpcyBhbiBhbGlhcyBvZiB7QGxpbmsgbW9kdWxlOnhzcy1maWx0ZXJzI3VyaVBhdGhJblNpbmdsZVF1b3RlZEF0dHJ9XG4qIFxuKiBAYWxpYXMgbW9kdWxlOnhzcy1maWx0ZXJzI3VyaVBhdGhJblNpbmdsZVF1b3RlZEF0dHJcbiovXG5leHBvcnRzLnVyaVF1ZXJ5SW5TaW5nbGVRdW90ZWRBdHRyID0gZXhwb3J0cy51cmlQYXRoSW5TaW5nbGVRdW90ZWRBdHRyO1xuXG4vKipcbiogQGZ1bmN0aW9uIG1vZHVsZTp4c3MtZmlsdGVycyN1cmlRdWVyeUluRG91YmxlUXVvdGVkQXR0clxuKiBAZGVzY3JpcHRpb24gVGhpcyBpcyBhbiBhbGlhcyBvZiB7QGxpbmsgbW9kdWxlOnhzcy1maWx0ZXJzI3VyaVBhdGhJbkRvdWJsZVF1b3RlZEF0dHJ9XG4qIFxuKiBAYWxpYXMgbW9kdWxlOnhzcy1maWx0ZXJzI3VyaVBhdGhJbkRvdWJsZVF1b3RlZEF0dHJcbiovXG5leHBvcnRzLnVyaVF1ZXJ5SW5Eb3VibGVRdW90ZWRBdHRyID0gZXhwb3J0cy51cmlQYXRoSW5Eb3VibGVRdW90ZWRBdHRyO1xuXG4vKipcbiogQGZ1bmN0aW9uIG1vZHVsZTp4c3MtZmlsdGVycyN1cmlRdWVyeUluVW5RdW90ZWRBdHRyXG4qIEBkZXNjcmlwdGlvbiBUaGlzIGlzIGFuIGFsaWFzIG9mIHtAbGluayBtb2R1bGU6eHNzLWZpbHRlcnMjdXJpUGF0aEluVW5RdW90ZWRBdHRyfVxuKiBcbiogQGFsaWFzIG1vZHVsZTp4c3MtZmlsdGVycyN1cmlQYXRoSW5VblF1b3RlZEF0dHJcbiovXG5leHBvcnRzLnVyaVF1ZXJ5SW5VblF1b3RlZEF0dHIgPSBleHBvcnRzLnVyaVBhdGhJblVuUXVvdGVkQXR0cjtcblxuLyoqXG4qIEBmdW5jdGlvbiBtb2R1bGU6eHNzLWZpbHRlcnMjdXJpUXVlcnlJbkhUTUxEYXRhXG4qIEBkZXNjcmlwdGlvbiBUaGlzIGlzIGFuIGFsaWFzIG9mIHtAbGluayBtb2R1bGU6eHNzLWZpbHRlcnMjdXJpUGF0aEluSFRNTERhdGF9XG4qIFxuKiBAYWxpYXMgbW9kdWxlOnhzcy1maWx0ZXJzI3VyaVBhdGhJbkhUTUxEYXRhXG4qL1xuZXhwb3J0cy51cmlRdWVyeUluSFRNTERhdGEgPSBleHBvcnRzLnVyaVBhdGhJbkhUTUxEYXRhO1xuXG4vKipcbiogQGZ1bmN0aW9uIG1vZHVsZTp4c3MtZmlsdGVycyN1cmlRdWVyeUluSFRNTENvbW1lbnRcbiogQGRlc2NyaXB0aW9uIFRoaXMgaXMgYW4gYWxpYXMgb2Yge0BsaW5rIG1vZHVsZTp4c3MtZmlsdGVycyN1cmlQYXRoSW5IVE1MQ29tbWVudH1cbiogXG4qIEBhbGlhcyBtb2R1bGU6eHNzLWZpbHRlcnMjdXJpUGF0aEluSFRNTENvbW1lbnRcbiovXG5leHBvcnRzLnVyaVF1ZXJ5SW5IVE1MQ29tbWVudCA9IGV4cG9ydHMudXJpUGF0aEluSFRNTENvbW1lbnQ7XG5cblxuXG4vKipcbiogQGZ1bmN0aW9uIG1vZHVsZTp4c3MtZmlsdGVycyN1cmlDb21wb25lbnRJblNpbmdsZVF1b3RlZEF0dHJcbipcbiogQHBhcmFtIHtzdHJpbmd9IHMgLSBBbiB1bnRydXN0ZWQgdXNlciBpbnB1dCwgc3VwcG9zZWRseSBhIFVSSSBDb21wb25lbnRcbiogQHJldHVybnMge3N0cmluZ30gVGhlIHN0cmluZyBzIGVuY29kZWQgZmlyc3QgYnkgd2luZG93LmVuY29kZVVSSUNvbXBvbmVudCgpLCB0aGVuIGluU2luZ2xlUXVvdGVkQXR0cigpXG4qXG4qIEBkZXNjcmlwdGlvblxuKiBUaGlzIGZpbHRlciBpcyB0byBiZSBwbGFjZWQgaW4gSFRNTCBBdHRyaWJ1dGUgVmFsdWUgKHNpbmdsZS1xdW90ZWQpIHN0YXRlIGZvciBhIFVSSSBDb21wb25lbnQuPGJyLz5cbiogVGhlIGNvcnJlY3Qgb3JkZXIgb2YgZW5jb2RlcnMgaXMgdGh1czogZmlyc3Qgd2luZG93LmVuY29kZVVSSUNvbXBvbmVudCgpLCB0aGVuIGluU2luZ2xlUXVvdGVkQXR0cigpXG4qXG4qXG4qIDx1bD5cbiogPGxpPjxhIGhyZWY9XCJodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9lbmNvZGVVUklDb21wb25lbnRcIj5lbmNvZGVVUklDb21wb25lbnQgfCBNRE48L2E+PC9saT5cbiogPGxpPjxhIGhyZWY9XCJodHRwOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMzOTg2XCI+UkZDIDM5ODY8L2E+PC9saT5cbiogPGxpPjxhIGhyZWY9XCJodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9zeW50YXguaHRtbCNhdHRyaWJ1dGUtdmFsdWUtKHNpbmdsZS1xdW90ZWQpLXN0YXRlXCI+SFRNTDUgQXR0cmlidXRlIFZhbHVlIChTaW5nbGUtUXVvdGVkKSBTdGF0ZTwvYT48L2xpPlxuKiA8L3VsPlxuKlxuKiBAZXhhbXBsZVxuKiAvLyBvdXRwdXQgY29udGV4dCB0byBiZSBhcHBsaWVkIGJ5IHRoaXMgZmlsdGVyLlxuKiA8YSBocmVmPSdodHRwOi8vZXhhbXBsZS5jb20vP3E9e3t7dXJpQ29tcG9uZW50SW5TaW5nbGVRdW90ZWRBdHRyIHVyaV9jb21wb25lbnR9fX0nPmxpbms8L2E+XG4qIFxuKi9cbmV4cG9ydHMudXJpQ29tcG9uZW50SW5TaW5nbGVRdW90ZWRBdHRyID0gZnVuY3Rpb24gKHMpIHtcbiAgICByZXR1cm4gcHJpdkZpbHRlcnMueWF2cyhwcml2RmlsdGVycy55dWMocykpO1xufTtcblxuLyoqXG4qIEBmdW5jdGlvbiBtb2R1bGU6eHNzLWZpbHRlcnMjdXJpQ29tcG9uZW50SW5Eb3VibGVRdW90ZWRBdHRyXG4qXG4qIEBwYXJhbSB7c3RyaW5nfSBzIC0gQW4gdW50cnVzdGVkIHVzZXIgaW5wdXQsIHN1cHBvc2VkbHkgYSBVUkkgQ29tcG9uZW50XG4qIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBzdHJpbmcgcyBlbmNvZGVkIGZpcnN0IGJ5IHdpbmRvdy5lbmNvZGVVUklDb21wb25lbnQoKSwgdGhlbiBpbkRvdWJsZVF1b3RlZEF0dHIoKVxuKlxuKiBAZGVzY3JpcHRpb25cbiogVGhpcyBmaWx0ZXIgaXMgdG8gYmUgcGxhY2VkIGluIEhUTUwgQXR0cmlidXRlIFZhbHVlIChkb3VibGUtcXVvdGVkKSBzdGF0ZSBmb3IgYSBVUkkgQ29tcG9uZW50Ljxici8+XG4qIFRoZSBjb3JyZWN0IG9yZGVyIG9mIGVuY29kZXJzIGlzIHRodXM6IGZpcnN0IHdpbmRvdy5lbmNvZGVVUklDb21wb25lbnQoKSwgdGhlbiBpbkRvdWJsZVF1b3RlZEF0dHIoKVxuKlxuKlxuKiA8dWw+XG4qIDxsaT48YSBocmVmPVwiaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvZW5jb2RlVVJJQ29tcG9uZW50XCI+ZW5jb2RlVVJJQ29tcG9uZW50IHwgTUROPC9hPjwvbGk+XG4qIDxsaT48YSBocmVmPVwiaHR0cDovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMzk4NlwiPlJGQyAzOTg2PC9hPjwvbGk+XG4qIDxsaT48YSBocmVmPVwiaHR0cHM6Ly9odG1sLnNwZWMud2hhdHdnLm9yZy9tdWx0aXBhZ2Uvc3ludGF4Lmh0bWwjYXR0cmlidXRlLXZhbHVlLShkb3VibGUtcXVvdGVkKS1zdGF0ZVwiPkhUTUw1IEF0dHJpYnV0ZSBWYWx1ZSAoRG91YmxlLVF1b3RlZCkgU3RhdGU8L2E+PC9saT5cbiogPC91bD5cbipcbiogQGV4YW1wbGVcbiogLy8gb3V0cHV0IGNvbnRleHQgdG8gYmUgYXBwbGllZCBieSB0aGlzIGZpbHRlci5cbiogPGEgaHJlZj1cImh0dHA6Ly9leGFtcGxlLmNvbS8/cT17e3t1cmlDb21wb25lbnRJbkRvdWJsZVF1b3RlZEF0dHIgdXJpX2NvbXBvbmVudH19fVwiPmxpbms8L2E+XG4qIFxuKi9cbmV4cG9ydHMudXJpQ29tcG9uZW50SW5Eb3VibGVRdW90ZWRBdHRyID0gZnVuY3Rpb24gKHMpIHtcbiAgICByZXR1cm4gcHJpdkZpbHRlcnMueWF2ZChwcml2RmlsdGVycy55dWMocykpO1xufTtcblxuXG4vKipcbiogQGZ1bmN0aW9uIG1vZHVsZTp4c3MtZmlsdGVycyN1cmlDb21wb25lbnRJblVuUXVvdGVkQXR0clxuKlxuKiBAcGFyYW0ge3N0cmluZ30gcyAtIEFuIHVudHJ1c3RlZCB1c2VyIGlucHV0LCBzdXBwb3NlZGx5IGEgVVJJIENvbXBvbmVudFxuKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgc3RyaW5nIHMgZW5jb2RlZCBmaXJzdCBieSB3aW5kb3cuZW5jb2RlVVJJQ29tcG9uZW50KCksIHRoZW4gaW5VblF1b3RlZEF0dHIoKVxuKlxuKiBAZGVzY3JpcHRpb25cbiogVGhpcyBmaWx0ZXIgaXMgdG8gYmUgcGxhY2VkIGluIEhUTUwgQXR0cmlidXRlIFZhbHVlICh1bnF1b3RlZCkgc3RhdGUgZm9yIGEgVVJJIENvbXBvbmVudC48YnIvPlxuKiBUaGUgY29ycmVjdCBvcmRlciBvZiBlbmNvZGVycyBpcyB0aHVzOiBmaXJzdCB0aGUgYnVpbHQtaW4gZW5jb2RlVVJJQ29tcG9uZW50KCksIHRoZW4gaW5VblF1b3RlZEF0dHIoKVxuKlxuKlxuKiA8dWw+XG4qIDxsaT48YSBocmVmPVwiaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvZW5jb2RlVVJJQ29tcG9uZW50XCI+ZW5jb2RlVVJJQ29tcG9uZW50IHwgTUROPC9hPjwvbGk+XG4qIDxsaT48YSBocmVmPVwiaHR0cDovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMzk4NlwiPlJGQyAzOTg2PC9hPjwvbGk+XG4qIDxsaT48YSBocmVmPVwiaHR0cHM6Ly9odG1sLnNwZWMud2hhdHdnLm9yZy9tdWx0aXBhZ2Uvc3ludGF4Lmh0bWwjYXR0cmlidXRlLXZhbHVlLSh1bnF1b3RlZCktc3RhdGVcIj5IVE1MNSBBdHRyaWJ1dGUgVmFsdWUgKFVucXVvdGVkKSBTdGF0ZTwvYT48L2xpPlxuKiA8L3VsPlxuKlxuKiBAZXhhbXBsZVxuKiAvLyBvdXRwdXQgY29udGV4dCB0byBiZSBhcHBsaWVkIGJ5IHRoaXMgZmlsdGVyLlxuKiA8YSBocmVmPWh0dHA6Ly9leGFtcGxlLmNvbS8/cT17e3t1cmlDb21wb25lbnRJblVuUXVvdGVkQXR0ciB1cmlfY29tcG9uZW50fX19Pmxpbms8L2E+XG4qIFxuKi9cbmV4cG9ydHMudXJpQ29tcG9uZW50SW5VblF1b3RlZEF0dHIgPSBmdW5jdGlvbiAocykge1xuICAgIHJldHVybiBwcml2RmlsdGVycy55YXZ1KHByaXZGaWx0ZXJzLnl1YyhzKSk7XG59O1xuXG4vKipcbiogQGZ1bmN0aW9uIG1vZHVsZTp4c3MtZmlsdGVycyN1cmlDb21wb25lbnRJbkhUTUxEYXRhXG4qXG4qIEBwYXJhbSB7c3RyaW5nfSBzIC0gQW4gdW50cnVzdGVkIHVzZXIgaW5wdXQsIHN1cHBvc2VkbHkgYSBVUkkgQ29tcG9uZW50XG4qIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBzdHJpbmcgcyBlbmNvZGVkIGJ5IHdpbmRvdy5lbmNvZGVVUklDb21wb25lbnQoKSBhbmQgdGhlbiBpbkhUTUxEYXRhKClcbipcbiogQGRlc2NyaXB0aW9uXG4qIFRoaXMgZmlsdGVyIGlzIHRvIGJlIHBsYWNlZCBpbiBIVE1MIERhdGEgc3RhdGUgZm9yIGEgVVJJIENvbXBvbmVudC5cbipcbiogPHA+Tm90aWNlOiBUaGUgYWN0dWFsIGltcGxlbWVudGF0aW9uIHNraXBzIGluSFRNTERhdGEoKSwgc2luY2UgJzwnIGlzIGFscmVhZHkgZW5jb2RlZCBhcyAnJTNDJyBieSBlbmNvZGVVUklDb21wb25lbnQoKS48L3A+XG4qXG4qIDx1bD5cbiogPGxpPjxhIGhyZWY9XCJodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9lbmNvZGVVUklDb21wb25lbnRcIj5lbmNvZGVVUklDb21wb25lbnQgfCBNRE48L2E+PC9saT5cbiogPGxpPjxhIGhyZWY9XCJodHRwOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMzOTg2XCI+UkZDIDM5ODY8L2E+PC9saT5cbiogPGxpPjxhIGhyZWY9XCJodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9zeW50YXguaHRtbCNkYXRhLXN0YXRlXCI+SFRNTDUgRGF0YSBTdGF0ZTwvYT48L2xpPlxuKiA8L3VsPlxuKlxuKiBAZXhhbXBsZVxuKiAvLyBvdXRwdXQgY29udGV4dCB0byBiZSBhcHBsaWVkIGJ5IHRoaXMgZmlsdGVyLlxuKiA8YSBocmVmPVwiaHR0cDovL2V4YW1wbGUuY29tL1wiPmh0dHA6Ly9leGFtcGxlLmNvbS8/cT17e3t1cmlDb21wb25lbnRJbkhUTUxEYXRhIHVyaV9jb21wb25lbnR9fX08L2E+XG4qIDxhIGhyZWY9XCJodHRwOi8vZXhhbXBsZS5jb20vXCI+aHR0cDovL2V4YW1wbGUuY29tLyN7e3t1cmlDb21wb25lbnRJbkhUTUxEYXRhIHVyaV9mcmFnbWVudH19fTwvYT5cbiogXG4qL1xuZXhwb3J0cy51cmlDb21wb25lbnRJbkhUTUxEYXRhID0gcHJpdkZpbHRlcnMueXVjO1xuXG5cbi8qKlxuKiBAZnVuY3Rpb24gbW9kdWxlOnhzcy1maWx0ZXJzI3VyaUNvbXBvbmVudEluSFRNTENvbW1lbnRcbipcbiogQHBhcmFtIHtzdHJpbmd9IHMgLSBBbiB1bnRydXN0ZWQgdXNlciBpbnB1dCwgc3VwcG9zZWRseSBhIFVSSSBDb21wb25lbnRcbiogQHJldHVybnMge3N0cmluZ30gVGhlIHN0cmluZyBzIGVuY29kZWQgYnkgd2luZG93LmVuY29kZVVSSUNvbXBvbmVudCgpLCBhbmQgZmluYWxseSBpbkhUTUxDb21tZW50KClcbipcbiogQGRlc2NyaXB0aW9uXG4qIFRoaXMgZmlsdGVyIGlzIHRvIGJlIHBsYWNlZCBpbiBIVE1MIENvbW1lbnQgc3RhdGUgZm9yIGEgVVJJIENvbXBvbmVudC5cbipcbiogPHVsPlxuKiA8bGk+PGEgaHJlZj1cImh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL2VuY29kZVVSSUNvbXBvbmVudFwiPmVuY29kZVVSSUNvbXBvbmVudCB8IE1ETjwvYT48L2xpPlxuKiA8bGk+PGEgaHJlZj1cImh0dHA6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzM5ODZcIj5SRkMgMzk4NjwvYT48L2xpPlxuKiA8bGk+PGEgaHJlZj1cImh0dHBzOi8vaHRtbC5zcGVjLndoYXR3Zy5vcmcvbXVsdGlwYWdlL3N5bnRheC5odG1sI2RhdGEtc3RhdGVcIj5IVE1MNSBEYXRhIFN0YXRlPC9hPjwvbGk+XG4qIDxsaT48YSBocmVmPVwiaHR0cHM6Ly9odG1sLnNwZWMud2hhdHdnLm9yZy9tdWx0aXBhZ2Uvc3ludGF4Lmh0bWwjY29tbWVudC1zdGF0ZVwiPkhUTUw1IENvbW1lbnQgU3RhdGU8L2E+PC9saT5cbiogPC91bD5cbipcbiogQGV4YW1wbGVcbiogLy8gb3V0cHV0IGNvbnRleHQgdG8gYmUgYXBwbGllZCBieSB0aGlzIGZpbHRlci5cbiogPCEtLSBodHRwOi8vZXhhbXBsZS5jb20vP3E9e3t7dXJpQ29tcG9uZW50SW5IVE1MQ29tbWVudCB1cmlfY29tcG9uZW50fX19IC0tPlxuKiA8IS0tIGh0dHA6Ly9leGFtcGxlLmNvbS8je3t7dXJpQ29tcG9uZW50SW5IVE1MQ29tbWVudCB1cmlfZnJhZ21lbnR9fX0gLS0+XG4qL1xuZXhwb3J0cy51cmlDb21wb25lbnRJbkhUTUxDb21tZW50ID0gZnVuY3Rpb24gKHMpIHtcbiAgICByZXR1cm4gcHJpdkZpbHRlcnMueWMocHJpdkZpbHRlcnMueXVjKHMpKTtcbn07XG5cblxuLy8gdXJpRnJhZ21lbnRJblNpbmdsZVF1b3RlZEF0dHJcbi8vIGFkZGVkIHl1Ymwgb24gdG9wIG9mIHVyaUNvbXBvbmVudEluQXR0ciBcbi8vIFJhdGlvbmFsZTogZ2l2ZW4gcGF0dGVybiBsaWtlIHRoaXM6IDxhIGhyZWY9J3t7e3VyaUZyYWdtZW50SW5TaW5nbGVRdW90ZWRBdHRyIHN9fX0nPlxuLy8gICAgICAgICAgICBkZXZlbG9wZXIgbWF5IGV4cGVjdCBzIGlzIGFsd2F5cyBwcmVmaXhlZCB3aXRoICMsIGJ1dCBhbiBhdHRhY2tlciBjYW4gYWJ1c2UgaXQgd2l0aCAnamF2YXNjcmlwdDphbGVydCgxKSdcblxuLyoqXG4qIEBmdW5jdGlvbiBtb2R1bGU6eHNzLWZpbHRlcnMjdXJpRnJhZ21lbnRJblNpbmdsZVF1b3RlZEF0dHJcbipcbiogQHBhcmFtIHtzdHJpbmd9IHMgLSBBbiB1bnRydXN0ZWQgdXNlciBpbnB1dCwgc3VwcG9zZWRseSBhIFVSSSBGcmFnbWVudFxuKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgc3RyaW5nIHMgZW5jb2RlZCBmaXJzdCBieSB3aW5kb3cuZW5jb2RlVVJJQ29tcG9uZW50KCksIHRoZW4gaW5TaW5nbGVRdW90ZWRBdHRyKCksIGFuZCBmaW5hbGx5IHByZWZpeCB0aGUgcmVzdWx0ZWQgc3RyaW5nIHdpdGggJ3gtJyBpZiBpdCBiZWdpbnMgd2l0aCAnamF2YXNjcmlwdDonIG9yICd2YnNjcmlwdDonIHRoYXQgY291bGQgcG9zc2libHkgbGVhZCB0byBzY3JpcHQgZXhlY3V0aW9uXG4qXG4qIEBkZXNjcmlwdGlvblxuKiBUaGlzIGZpbHRlciBpcyB0byBiZSBwbGFjZWQgaW4gSFRNTCBBdHRyaWJ1dGUgVmFsdWUgKHNpbmdsZS1xdW90ZWQpIHN0YXRlIGZvciBhIFVSSSBGcmFnbWVudC48YnIvPlxuKiBUaGUgY29ycmVjdCBvcmRlciBvZiBlbmNvZGVycyBpcyB0aHVzOiBmaXJzdCB3aW5kb3cuZW5jb2RlVVJJQ29tcG9uZW50KCksIHRoZW4gaW5TaW5nbGVRdW90ZWRBdHRyKCksIGFuZCBmaW5hbGx5IHByZWZpeCB0aGUgcmVzdWx0ZWQgc3RyaW5nIHdpdGggJ3gtJyBpZiBpdCBiZWdpbnMgd2l0aCAnamF2YXNjcmlwdDonIG9yICd2YnNjcmlwdDonIHRoYXQgY291bGQgcG9zc2libHkgbGVhZCB0byBzY3JpcHQgZXhlY3V0aW9uXG4qXG4qXG4qIDx1bD5cbiogPGxpPjxhIGhyZWY9XCJodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9lbmNvZGVVUklDb21wb25lbnRcIj5lbmNvZGVVUklDb21wb25lbnQgfCBNRE48L2E+PC9saT5cbiogPGxpPjxhIGhyZWY9XCJodHRwOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMzOTg2XCI+UkZDIDM5ODY8L2E+PC9saT5cbiogPGxpPjxhIGhyZWY9XCJodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9zeW50YXguaHRtbCNhdHRyaWJ1dGUtdmFsdWUtKHNpbmdsZS1xdW90ZWQpLXN0YXRlXCI+SFRNTDUgQXR0cmlidXRlIFZhbHVlIChTaW5nbGUtUXVvdGVkKSBTdGF0ZTwvYT48L2xpPlxuKiA8L3VsPlxuKlxuKiBAZXhhbXBsZVxuKiAvLyBvdXRwdXQgY29udGV4dCB0byBiZSBhcHBsaWVkIGJ5IHRoaXMgZmlsdGVyLlxuKiA8YSBocmVmPSdodHRwOi8vZXhhbXBsZS5jb20vI3t7e3VyaUZyYWdtZW50SW5TaW5nbGVRdW90ZWRBdHRyIHVyaV9mcmFnbWVudH19fSc+bGluazwvYT5cbiogXG4qL1xuZXhwb3J0cy51cmlGcmFnbWVudEluU2luZ2xlUXVvdGVkQXR0ciA9IGZ1bmN0aW9uIChzKSB7XG4gICAgcmV0dXJuIHByaXZGaWx0ZXJzLnl1YmwocHJpdkZpbHRlcnMueWF2cyhwcml2RmlsdGVycy55dWMocykpKTtcbn07XG5cbi8vIHVyaUZyYWdtZW50SW5Eb3VibGVRdW90ZWRBdHRyXG4vLyBhZGRlZCB5dWJsIG9uIHRvcCBvZiB1cmlDb21wb25lbnRJbkF0dHIgXG4vLyBSYXRpb25hbGU6IGdpdmVuIHBhdHRlcm4gbGlrZSB0aGlzOiA8YSBocmVmPVwie3t7dXJpRnJhZ21lbnRJbkRvdWJsZVF1b3RlZEF0dHIgc319fVwiPlxuLy8gICAgICAgICAgICBkZXZlbG9wZXIgbWF5IGV4cGVjdCBzIGlzIGFsd2F5cyBwcmVmaXhlZCB3aXRoICMsIGJ1dCBhbiBhdHRhY2tlciBjYW4gYWJ1c2UgaXQgd2l0aCAnamF2YXNjcmlwdDphbGVydCgxKSdcblxuLyoqXG4qIEBmdW5jdGlvbiBtb2R1bGU6eHNzLWZpbHRlcnMjdXJpRnJhZ21lbnRJbkRvdWJsZVF1b3RlZEF0dHJcbipcbiogQHBhcmFtIHtzdHJpbmd9IHMgLSBBbiB1bnRydXN0ZWQgdXNlciBpbnB1dCwgc3VwcG9zZWRseSBhIFVSSSBGcmFnbWVudFxuKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgc3RyaW5nIHMgZW5jb2RlZCBmaXJzdCBieSB3aW5kb3cuZW5jb2RlVVJJQ29tcG9uZW50KCksIHRoZW4gaW5Eb3VibGVRdW90ZWRBdHRyKCksIGFuZCBmaW5hbGx5IHByZWZpeCB0aGUgcmVzdWx0ZWQgc3RyaW5nIHdpdGggJ3gtJyBpZiBpdCBiZWdpbnMgd2l0aCAnamF2YXNjcmlwdDonIG9yICd2YnNjcmlwdDonIHRoYXQgY291bGQgcG9zc2libHkgbGVhZCB0byBzY3JpcHQgZXhlY3V0aW9uXG4qXG4qIEBkZXNjcmlwdGlvblxuKiBUaGlzIGZpbHRlciBpcyB0byBiZSBwbGFjZWQgaW4gSFRNTCBBdHRyaWJ1dGUgVmFsdWUgKGRvdWJsZS1xdW90ZWQpIHN0YXRlIGZvciBhIFVSSSBGcmFnbWVudC48YnIvPlxuKiBUaGUgY29ycmVjdCBvcmRlciBvZiBlbmNvZGVycyBpcyB0aHVzOiBmaXJzdCB3aW5kb3cuZW5jb2RlVVJJQ29tcG9uZW50KCksIHRoZW4gaW5Eb3VibGVRdW90ZWRBdHRyKCksIGFuZCBmaW5hbGx5IHByZWZpeCB0aGUgcmVzdWx0ZWQgc3RyaW5nIHdpdGggJ3gtJyBpZiBpdCBiZWdpbnMgd2l0aCAnamF2YXNjcmlwdDonIG9yICd2YnNjcmlwdDonIHRoYXQgY291bGQgcG9zc2libHkgbGVhZCB0byBzY3JpcHQgZXhlY3V0aW9uXG4qXG4qXG4qIDx1bD5cbiogPGxpPjxhIGhyZWY9XCJodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9lbmNvZGVVUklDb21wb25lbnRcIj5lbmNvZGVVUklDb21wb25lbnQgfCBNRE48L2E+PC9saT5cbiogPGxpPjxhIGhyZWY9XCJodHRwOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMzOTg2XCI+UkZDIDM5ODY8L2E+PC9saT5cbiogPGxpPjxhIGhyZWY9XCJodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9zeW50YXguaHRtbCNhdHRyaWJ1dGUtdmFsdWUtKGRvdWJsZS1xdW90ZWQpLXN0YXRlXCI+SFRNTDUgQXR0cmlidXRlIFZhbHVlIChEb3VibGUtUXVvdGVkKSBTdGF0ZTwvYT48L2xpPlxuKiA8L3VsPlxuKlxuKiBAZXhhbXBsZVxuKiAvLyBvdXRwdXQgY29udGV4dCB0byBiZSBhcHBsaWVkIGJ5IHRoaXMgZmlsdGVyLlxuKiA8YSBocmVmPVwiaHR0cDovL2V4YW1wbGUuY29tLyN7e3t1cmlGcmFnbWVudEluRG91YmxlUXVvdGVkQXR0ciB1cmlfZnJhZ21lbnR9fX1cIj5saW5rPC9hPlxuKiBcbiovXG5leHBvcnRzLnVyaUZyYWdtZW50SW5Eb3VibGVRdW90ZWRBdHRyID0gZnVuY3Rpb24gKHMpIHtcbiAgICByZXR1cm4gcHJpdkZpbHRlcnMueXVibChwcml2RmlsdGVycy55YXZkKHByaXZGaWx0ZXJzLnl1YyhzKSkpO1xufTtcblxuLy8gdXJpRnJhZ21lbnRJblVuUXVvdGVkQXR0clxuLy8gYWRkZWQgeXVibCBvbiB0b3Agb2YgdXJpQ29tcG9uZW50SW5BdHRyIFxuLy8gUmF0aW9uYWxlOiBnaXZlbiBwYXR0ZXJuIGxpa2UgdGhpczogPGEgaHJlZj17e3t1cmlGcmFnbWVudEluVW5RdW90ZWRBdHRyIHN9fX0+XG4vLyAgICAgICAgICAgIGRldmVsb3BlciBtYXkgZXhwZWN0IHMgaXMgYWx3YXlzIHByZWZpeGVkIHdpdGggIywgYnV0IGFuIGF0dGFja2VyIGNhbiBhYnVzZSBpdCB3aXRoICdqYXZhc2NyaXB0OmFsZXJ0KDEpJ1xuXG4vKipcbiogQGZ1bmN0aW9uIG1vZHVsZTp4c3MtZmlsdGVycyN1cmlGcmFnbWVudEluVW5RdW90ZWRBdHRyXG4qXG4qIEBwYXJhbSB7c3RyaW5nfSBzIC0gQW4gdW50cnVzdGVkIHVzZXIgaW5wdXQsIHN1cHBvc2VkbHkgYSBVUkkgRnJhZ21lbnRcbiogQHJldHVybnMge3N0cmluZ30gVGhlIHN0cmluZyBzIGVuY29kZWQgZmlyc3QgYnkgd2luZG93LmVuY29kZVVSSUNvbXBvbmVudCgpLCB0aGVuIGluVW5RdW90ZWRBdHRyKCksIGFuZCBmaW5hbGx5IHByZWZpeCB0aGUgcmVzdWx0ZWQgc3RyaW5nIHdpdGggJ3gtJyBpZiBpdCBiZWdpbnMgd2l0aCAnamF2YXNjcmlwdDonIG9yICd2YnNjcmlwdDonIHRoYXQgY291bGQgcG9zc2libHkgbGVhZCB0byBzY3JpcHQgZXhlY3V0aW9uXG4qXG4qIEBkZXNjcmlwdGlvblxuKiBUaGlzIGZpbHRlciBpcyB0byBiZSBwbGFjZWQgaW4gSFRNTCBBdHRyaWJ1dGUgVmFsdWUgKHVucXVvdGVkKSBzdGF0ZSBmb3IgYSBVUkkgRnJhZ21lbnQuPGJyLz5cbiogVGhlIGNvcnJlY3Qgb3JkZXIgb2YgZW5jb2RlcnMgaXMgdGh1czogZmlyc3QgdGhlIGJ1aWx0LWluIGVuY29kZVVSSUNvbXBvbmVudCgpLCB0aGVuIGluVW5RdW90ZWRBdHRyKCksIGFuZCBmaW5hbGx5IHByZWZpeCB0aGUgcmVzdWx0ZWQgc3RyaW5nIHdpdGggJ3gtJyBpZiBpdCBiZWdpbnMgd2l0aCAnamF2YXNjcmlwdDonIG9yICd2YnNjcmlwdDonIHRoYXQgY291bGQgcG9zc2libHkgbGVhZCB0byBzY3JpcHQgZXhlY3V0aW9uXG4qXG4qIDx1bD5cbiogPGxpPjxhIGhyZWY9XCJodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9lbmNvZGVVUklDb21wb25lbnRcIj5lbmNvZGVVUklDb21wb25lbnQgfCBNRE48L2E+PC9saT5cbiogPGxpPjxhIGhyZWY9XCJodHRwOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMzOTg2XCI+UkZDIDM5ODY8L2E+PC9saT5cbiogPGxpPjxhIGhyZWY9XCJodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9zeW50YXguaHRtbCNhdHRyaWJ1dGUtdmFsdWUtKHVucXVvdGVkKS1zdGF0ZVwiPkhUTUw1IEF0dHJpYnV0ZSBWYWx1ZSAoVW5xdW90ZWQpIFN0YXRlPC9hPjwvbGk+XG4qIDwvdWw+XG4qXG4qIEBleGFtcGxlXG4qIC8vIG91dHB1dCBjb250ZXh0IHRvIGJlIGFwcGxpZWQgYnkgdGhpcyBmaWx0ZXIuXG4qIDxhIGhyZWY9aHR0cDovL2V4YW1wbGUuY29tLyN7e3t1cmlGcmFnbWVudEluVW5RdW90ZWRBdHRyIHVyaV9mcmFnbWVudH19fT5saW5rPC9hPlxuKiBcbiovXG5leHBvcnRzLnVyaUZyYWdtZW50SW5VblF1b3RlZEF0dHIgPSBmdW5jdGlvbiAocykge1xuICAgIHJldHVybiBwcml2RmlsdGVycy55dWJsKHByaXZGaWx0ZXJzLnlhdnUocHJpdkZpbHRlcnMueXVjKHMpKSk7XG59O1xuXG5cbi8qKlxuKiBAZnVuY3Rpb24gbW9kdWxlOnhzcy1maWx0ZXJzI3VyaUZyYWdtZW50SW5IVE1MRGF0YVxuKiBAZGVzY3JpcHRpb24gVGhpcyBpcyBhbiBhbGlhcyBvZiB7QGxpbmsgbW9kdWxlOnhzcy1maWx0ZXJzI3VyaUNvbXBvbmVudEluSFRNTERhdGF9XG4qIFxuKiBAYWxpYXMgbW9kdWxlOnhzcy1maWx0ZXJzI3VyaUNvbXBvbmVudEluSFRNTERhdGFcbiovXG5leHBvcnRzLnVyaUZyYWdtZW50SW5IVE1MRGF0YSA9IGV4cG9ydHMudXJpQ29tcG9uZW50SW5IVE1MRGF0YTtcblxuLyoqXG4qIEBmdW5jdGlvbiBtb2R1bGU6eHNzLWZpbHRlcnMjdXJpRnJhZ21lbnRJbkhUTUxDb21tZW50XG4qIEBkZXNjcmlwdGlvbiBUaGlzIGlzIGFuIGFsaWFzIG9mIHtAbGluayBtb2R1bGU6eHNzLWZpbHRlcnMjdXJpQ29tcG9uZW50SW5IVE1MQ29tbWVudH1cbiogXG4qIEBhbGlhcyBtb2R1bGU6eHNzLWZpbHRlcnMjdXJpQ29tcG9uZW50SW5IVE1MQ29tbWVudFxuKi9cbmV4cG9ydHMudXJpRnJhZ21lbnRJbkhUTUxDb21tZW50ID0gZXhwb3J0cy51cmlDb21wb25lbnRJbkhUTUxDb21tZW50O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbi8vIHNyYy9hcGkuanNcblxuaW1wb3J0IHtcbiAgQkFTRV9VUkksXG4gIEVSUk9SX01FU1NBR0UsXG59IGZyb20gXCIuL2NvbnN0YW50c1wiO1xuXG5leHBvcnQgY29uc3QgQVBJID0ge1xuICBmZXRjaChwYXRoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCB1cmkgPSBgJHtCQVNFX1VSSX0vJHtwYXRofWA7XG4gICAgICBsZXQgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICByZXF1ZXN0Lm9wZW4oXCJHRVRcIiwgdXJpLCB0cnVlKTtcbiAgICAgIHJlcXVlc3Qub25sb2FkID0gKCkgPT4ge1xuICAgICAgICBsZXQgc3RhdHVzID0gcmVxdWVzdC5zdGF0dXM7XG5cbiAgICAgICAgaWYgKHN0YXR1cyA+PSAyMDAgJiYgc3RhdHVzIDwgNDAwKSB7XG4gICAgICAgICAgcmVzb2x2ZShKU09OLnBhcnNlKHJlcXVlc3QucmVzcG9uc2UpKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgcmVxdWVzdC5vbmVycm9yID0gKCkgPT4ge1xuICAgICAgICByZWplY3QobmV3IEVycm9yKEVSUk9SX01FU1NBR0UpKTtcbiAgICAgIH1cblxuICAgICAgcmVxdWVzdC5zZW5kKCk7XG4gICAgfSk7XG4gIH1cbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuLy8gc3JjL2FwcC5qc1xuXG5pbXBvcnQgeyBQb3N0IH0gZnJvbSBcIi4vcG9zdFwiO1xuaW1wb3J0IHsgVXNlciB9IGZyb20gXCIuL3VzZXJcIjtcbmltcG9ydCB7IHVpIH0gZnJvbSBcIi4vdWlcIjtcblxuUG9zdC5maW5kQWxsKClcbiAgLnRoZW4odWkucmVuZGVyUG9zdHMpXG4gIC5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICBjb25zb2xlLmVycm9yKFwiRXJyb3I6IFwiLCBlcnJvcik7XG4gIH0pO1xuXG5Vc2VyLmZpbmRSZWNlbnQoKVxuICAudGhlbih1aS5yZW5kZXJVc2VycylcbiAgLmNhdGNoKChlcnJvcikgPT4ge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvcjogXCIsIGVycm9yKTtcbiAgfSk7XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuLy8gc3JjL2NvbnN0YW50cy5qc1xuXG5jb25zdCBCQVNFX1VSSSA9IFwiaHR0cDovL2xvY2FsaG9zdDozMDAwXCI7XG5jb25zdCBFUlJPUl9NRVNTQUdFID0gXCJTb21ldGhpbmcgd2VudCB3cm9uZyBvbiB0aGUgQVBJXCI7XG5jb25zdCBQT1NUU19VUkkgPSBcInBvc3RzXCI7XG5jb25zdCBBQ1RJVkVfVVNFUlNfVVJJID0gXCJhY3RpdmVVc2Vyc1wiO1xuY29uc3QgUE9TVFNfRE9NX1RBUkdFVCA9IFwiLmNvbnRhaW5lclwiO1xuY29uc3QgVVNFUlNfRE9NX1RBUkdFVCA9IFwiLnNpZGViYXItY29udGVudFwiO1xuXG5leHBvcnQge1xuICBCQVNFX1VSSSxcbiAgRVJST1JfTUVTU0FHRSxcbiAgUE9TVFNfVVJJLFxuICBBQ1RJVkVfVVNFUlNfVVJJLFxuICBQT1NUU19ET01fVEFSR0VULFxuICBVU0VSU19ET01fVEFSR0VULFxufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG4vLyBzcmMvcG9zdC5qc1xuXG5pbXBvcnQgeyBBUEkgfSBmcm9tIFwiLi9hcGlcIjtcbmltcG9ydCB7IFBPU1RTX1VSSSB9IGZyb20gXCIuL2NvbnN0YW50c1wiO1xuXG5leHBvcnQgY29uc3QgUG9zdCA9IHtcbiAgZmluZEFsbCgpIHtcbiAgICByZXR1cm4gQVBJLmZldGNoKFBPU1RTX1VSSSk7XG4gIH1cbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuLy8gc3JjL3VpLmpzXG5cbmltcG9ydCB4c3MgZnJvbSBcInhzcy1maWx0ZXJzXCI7XG5cbmltcG9ydCB7XG4gIFBPU1RTX0RPTV9UQVJHRVQsXG4gIFVTRVJTX0RPTV9UQVJHRVQsXG59IGZyb20gXCIuL2NvbnN0YW50c1wiO1xuXG5mdW5jdGlvbiBhcnRpY2xlVGVtcGxhdGUodGl0bGUsIGxhc3RSZXBseSkge1xuICBsZXQgc2FmZVRpdGxlID0geHNzLmluSFRNTERhdGEodGl0bGUpO1xuICBsZXQgc2FmZUxhc3RSZXBseSA9IHhzcy5pbkhUTUxEYXRhKGxhc3RSZXBseSk7XG5cbiAgbGV0IHRlbXBsYXRlID0gYFxuICAgIDxhcnRpY2xlIGNsYXNzPVwicG9zdFwiPlxuICAgICAgPGgyIGNsYXNzPVwicG9zdC10aXRsZVwiPlxuICAgICAgICAke3NhZmVUaXRsZX1cbiAgICAgIDwvaDI+XG4gICAgICA8cCBjbGFzcz1cInBvc3QtbWV0YVwiPlxuICAgICAgICAke3NhZmVMYXN0UmVwbHl9XG4gICAgICA8L3A+XG4gICAgPC9hcnRpY2xlPmA7XG5cbiAgcmV0dXJuIHRlbXBsYXRlO1xufVxuXG5mdW5jdGlvbiB1c2VyVGVtcGxhdGUobmFtZSwgYXZhdGFyKSB7XG4gIGxldCBzYWZlTmFtZSA9IHhzcy5pbkhUTUxEYXRhKG5hbWUpO1xuICBsZXQgc2FmZUF2YXRhciA9IHhzcy5pbkhUTUxEYXRhKGF2YXRhcik7XG5cbiAgbGV0IHRlbXBsYXRlID0gYFxuICAgIDxkaXYgY2xhc3M9XCJhY3RpdmUtYXZhdGFyXCI+XG4gICAgICA8aW1nIHdpZHRoPVwiNTRcIiBzcmM9XCIuL2Fzc2V0cy9pbWFnZXMvJHtzYWZlQXZhdGFyfVwiIGFsdD1cIiR7c2FmZU5hbWV9XCIvPlxuICAgICAgPGg1IGNsYXNzPVwicG9zdC1hdXRob3JcIj5cbiAgICAgICAgJHtzYWZlTmFtZX1cbiAgICAgIDwvaDU+XG4gICAgPC9kaXY+YDtcblxuICByZXR1cm4gdGVtcGxhdGU7XG59XG5cbmV4cG9ydCBjb25zdCB1aSA9IHtcbiAgcmVuZGVyUG9zdHMocG9zdHMpIHtcbiAgICBsZXQgZWxlbWVudHMgPSBwb3N0cy5tYXAoKHBvc3QpID0+IHtcbiAgICAgIGxldCB7XG4gICAgICAgIHRpdGxlLFxuICAgICAgICBsYXN0UmVwbHksXG4gICAgICB9ID0gcG9zdDtcblxuICAgICAgcmV0dXJuIGFydGljbGVUZW1wbGF0ZSh0aXRsZSwgbGFzdFJlcGx5KTtcbiAgICB9KTtcblxuICAgIGxldCB0YXJnZXQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFBPU1RTX0RPTV9UQVJHRVQpO1xuICAgIHRhcmdldC5pbm5lckhUTUwgPSBlbGVtZW50cy5qb2luKFwiXCIpO1xuICB9LFxuXG4gIHJlbmRlclVzZXJzKHVzZXJzKSB7XG4gICAgbGV0IGVsZW1lbnRzID0gdXNlcnMubWFwKCAodXNlcikgPT4ge1xuICAgICAgbGV0IHtcbiAgICAgICAgbmFtZSxcbiAgICAgICAgYXZhdGFyLFxuICAgICAgfSA9IHVzZXI7XG5cbiAgICAgIHJldHVybiB1c2VyVGVtcGxhdGUobmFtZSwgYXZhdGFyKTtcbiAgICB9KTtcblxuICAgIGxldCB0YXJnZXQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFVTRVJTX0RPTV9UQVJHRVQpO1xuICAgIHRhcmdldC5pbm5lckhUTUwgPSBlbGVtZW50cy5qb2luKFwiXCIpO1xuICB9XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbi8vIHNyYy91c2VyLmpzXG5cbmltcG9ydCB7IEFQSSB9IGZyb20gXCIuL2FwaVwiO1xuaW1wb3J0IHsgQUNUSVZFX1VTRVJTX1VSSSB9IGZyb20gXCIuL2NvbnN0YW50c1wiO1xuXG5leHBvcnQgY29uc3QgVXNlciA9IHtcbiAgZmluZFJlY2VudCgpIHtcbiAgICByZXR1cm4gQVBJLmZldGNoKEFDVElWRV9VU0VSU19VUkkpO1xuICB9XG59O1xuIl19

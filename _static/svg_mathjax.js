/*
 * SVG_MathJax
 *
 * Copyright 2014 Jason M. Sachs
 * Based loosely on an approach outlined by Martin Clark
 * in http://stackoverflow.com/a/21923030/44330
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Modifications: John H. Cole, 2024
 * - Updated to work with MathJax v3.
 * - keep the entire SVG, not just the g nodes.
 * - Reworked scale, width, and height calculations.
 * - Added MutationObserver to detect when SVGs are added to the DOM.
 * - Implemented polling to ensure all SVGs are injected before calling MathJax.
 * - Some refactoring to improve readability.
 */

(function() {
    // Apply a function to elements of an array x
    function forEach(x, f) {
        var n = x.length;
        for (var i = 0; i < n; ++i) {
            f(x[i]);
        }
    }

    // Find all the SVG text elements that are delimited by
    // \( \) or $ $ MathJax delimiters
    // (with optional whitespace before/after)
    function findSVGMathJax(f, context) {
        const re = /^\s*([LlRrCc]?)(\\\(.*\\\)|\$.*\$)\s*$/;
        context = context || document;
        context.querySelectorAll('svg').forEach(svg => {
            svg.querySelectorAll('text').forEach(text => {
                const match = text.textContent.match(re);
                if (match) {
                    const justification = match[1];
                    const mathmarkup = match[2].replace(/^\$(.*)\$$/,'\\($1\\)');
                    f(text, justification, mathmarkup);
                }
            });
        });
    }

    function _install(options) {
        const items = [];

        // Move the raw MathJax items to a temporary element
        MathJax.startup.promise.then(() => {
            const mathbucket = document.createElement('div');
            mathbucket.setAttribute('id', 'mathjax_svg_bucket');
            document.body.appendChild(mathbucket);

            findSVGMathJax(function(text, justification, mathmarkup) {
                const div = document.createElement('div');
                mathbucket.appendChild(div);
                div.appendChild(document.createTextNode(mathmarkup));
                items.push({text: text, div: div, align: justification});
            });

            MathJax.typesetPromise().then(() => {
                forEach(items, function(item) {
                    const svgdest = item.text;
                    const x0 =  +item.text.getAttribute('x');
                    const y0 =  +item.text.getAttribute('y');
                    const svgmath = item.div.getElementsByClassName('MathJax')[0].getElementsByTagName('svg')[0];
                    const justification = item.align;

                    let fontsize = svgdest.getAttribute('font-size');
                    // If the font-size attribute is not found, look for it in the style attribute
                    if (!fontsize) {
                        fontsize = window.getComputedStyle(svgdest).fontSize;
                    }
                    const scale = options.scale*parseFloat(fontsize);

                    let x1;
                    const svgmathinfo = {
                        width: svgmath.getBoundingClientRect().width,
                        height: svgmath.getBoundingClientRect().height
                    };
                    switch (justification.toUpperCase()) {
                        case 'L': x1 = 0; break;
                        case 'R': x1 = -svgmathinfo.width * scale; break;
                        case 'C': // default to center
                        default:  x1 = -svgmathinfo.width * 0.5 * scale; break;
                    }
                    const y1 = -svgmathinfo.height * scale;
                    svgmath.setAttribute('transform', 'translate(' + x0 + ' ' + y0 + ')'
                         +' translate(' + x1 + ' ' + y1 + ')'
                         +' scale(' + scale + ')'
                        );
                    if (options.escape_clip) {
                        svgdest.parentNode.removeAttribute('clip-path');
                    }
                    svgdest.parentNode.replaceChild(svgmath, svgdest);
                });

                // Remove the temporary items
                mathbucket.parentNode.removeChild(mathbucket);
            }).catch(err => {
                console.error('MathJax processing error:', err);
            });
        });
    }

    class F {
        constructor() {
            this.scale = 0.09;
            this.escape_clip = false;
        }

        install() {
            _install(this);
        }
    }

    window.Svg_MathJax = new F();

    // Create a MutationObserver to detect when SVGs are added to the DOM
    var observer = new MutationObserver(function(mutations) {
        // Check if all SVGs are injected
        console.log('DOM Mutated: Checking for pending SVG injection');
        if (document.querySelectorAll("img.svg-injectable").length === 0) {
            observer.disconnect();
            console.log('Finished injecting SVGs, applying MathJax');
            window.Svg_MathJax.install();
        }
    });

    // Ensure the DOM is fully loaded before setting up the observer
    document.addEventListener('DOMContentLoaded', function() {
        if (document.querySelectorAll("img.svg-injectable").length === 0) {
            console.log('No pending SVGs to inject, applying MathJax');
            window.Svg_MathJax.install();
        } else {
            // Start observing the document for added nodes
            console.log('Starting observer');
            observer.observe(document.body, { childList: true, subtree: true });
        }
    });

})();

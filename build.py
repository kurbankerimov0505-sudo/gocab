#!/usr/bin/env python3
"""
Build script for GoCab Control.

This is the Python equivalent of the spec's build.js (no Node.js is
available on this machine). It does the same two jobs:
  1. Concatenate src/modules/*.js (in numeric order) into dist/app.js
  2. Inline dist/app.js into src/index.html -> dist/gocab-control.html

Uses a replacer FUNCTION when substituting into the HTML (never a plain
string), for the same reason the spec calls out for build.js: the bundled
JS can contain "$&"-like sequences that a literal string substitution would
mis-expand.
"""
import os
import re
import glob

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
MODULES = os.path.join(SRC, 'modules')
DIST = os.path.join(ROOT, 'dist')

def build_app_js():
    files = sorted(glob.glob(os.path.join(MODULES, '*.js')))
    parts = []
    for f in files:
        with open(f, 'r', encoding='utf-8') as fh:
            parts.append('/* ---- ' + os.path.basename(f) + ' ---- */\n' + fh.read())
    js = '\n\n'.join(parts)
    os.makedirs(DIST, exist_ok=True)
    out_path = os.path.join(DIST, 'app.js')
    with open(out_path, 'w', encoding='utf-8') as fh:
        fh.write(js)
    return js, out_path

def build_index_and_bundle(js):
    index_path = os.path.join(SRC, 'index.html')
    with open(index_path, 'r', encoding='utf-8') as fh:
        h = fh.read()
    # Replacer function, not a string: avoids "$&" expansion issues.
    h = re.sub(
        r'<script src="app\.js"></script>',
        lambda m: '<script>\n' + js + '\n</script>',
        h
    )
    os.makedirs(DIST, exist_ok=True)
    with open(os.path.join(DIST, 'index.html'), 'w', encoding='utf-8') as fh:
        fh.write(h)
    final_path = os.path.join(ROOT, 'gocab-control.html')
    with open(final_path, 'w', encoding='utf-8') as fh:
        fh.write(h)
    return final_path

if __name__ == '__main__':
    js, app_js_path = build_app_js()
    final_path = build_index_and_bundle(js)
    size_kb = os.path.getsize(final_path) / 1024
    print(f'Wrote {app_js_path} ({len(js)/1024:.1f} KB)')
    print(f'Wrote {final_path} ({size_kb:.1f} KB)')

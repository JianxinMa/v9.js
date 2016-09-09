#!/usr/bin/env python

import os
import subprocess

tasks = [{ 'source': 'src/mkfs.c',
           'template': 'src/mkfs_tmpl.js',
           'target': 'assets/js/mkfs.js'},
         { 'source': 'src/xvcc.c',
           'template': 'src/xvcc_tmpl.js',
           'target': 'assets/js/xvcc.js'}]

for task in tasks:
    subprocess.call(['emcc', '-s', 'TOTAL_MEMORY=134217728', task['source'], '-o', '__tmp__.html'])
    with open('__tmp__.js') as fin:
        code_core = fin.read()
    with open(task['template']) as fin:
        code_tmpl = fin.read()
    with open(task['target'], 'w') as fout:
        fout.write(code_tmpl.replace('/* {{emcc_stub}} */', code_core))
    os.remove('__tmp__.html')
    os.remove('__tmp__.js')

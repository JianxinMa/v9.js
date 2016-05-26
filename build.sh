#!/usr/bin/env bash

src=src
dst=assets/js

for file in xvcc mkfs
do
    # Emscripten
    emcc -s TOTAL_MEMORY=134217728 $src/$file.c -o $file.html
    rm $file.html 
    # Prelude
    sed '$d' $src/$file\_prelude.js > $file.js.tmp
    cat $file.js >> $file.js.tmp
    rm $file.js
    echo "}" >> $file.js.tmp
    mv $file.js.tmp $dst/$file.js
    # Compress
    uglifyjs --compress --mangle -- $dst/$file.js > $dst/$file.min.js
    rm $dst/$file.js
done

#!/usr/bin/env bash

rm -rf xvcc mkfs root

gcc -o xvcc -O3 -m32 xvcc.c
gcc -o mkfs -O3 -m32 mkfs.c

cp -r ../root root

./xvcc -Iroot/lib -o os               root/etc/os.c
./xvcc -Iroot/lib -o root/etc/init    root/etc/init.c
./xvcc -Iroot/lib -o root/bin/sh      root/bin/sh.c
./xvcc -Iroot/lib -o root/bin/cat     root/bin/cat.c
./xvcc -Iroot/lib -o root/bin/cp      root/bin/cp.c
./xvcc -Iroot/lib -o root/bin/halt    root/bin/halt.c
./xvcc -Iroot/lib -o root/bin/ln      root/bin/ln.c
./xvcc -Iroot/lib -o root/bin/ls      root/bin/ls.c
./xvcc -Iroot/lib -o root/bin/man     root/bin/man.c
./xvcc -Iroot/lib -o root/bin/mkdir   root/bin/mkdir.c
./xvcc -Iroot/lib -o root/bin/mv      root/bin/mv.c
./xvcc -Iroot/lib -o root/bin/pwd     root/bin/pwd.c
./xvcc -Iroot/lib -o root/bin/rm      root/bin/rm.c
./xvcc -Iroot/lib -o root/bin/rmdir   root/bin/rmdir.c
./xvcc -Iroot/lib -o root/bin/echo    root/bin/echo.c
./xvcc -Iroot/lib -o root/bin/kill    root/bin/kill.c
./xvcc -Iroot/lib -o root/bin/bin2c   root/bin/bin2c.c
./xvcc -Iroot/lib -o root/bin/edit    root/bin/edit.c
./xvcc -Iroot/lib -o root/bin/grep    root/bin/grep.c
./xvcc -Iroot/lib -o root/bin/wc      root/bin/wc.c
./xvcc -Iroot/lib -o root/usr/euhello root/usr/euhello.c
./xvcc -Iroot/lib -o root/usr/hello   root/usr/hello.c
./xvcc -Iroot/lib -o root/usr/prseg   root/usr/prseg.c
./xvcc -Iroot/lib -o root/usr/sdk     root/usr/sdk.c

./mkfs fs root

rm xvcc mkfs

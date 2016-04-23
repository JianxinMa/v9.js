#!/usr/bin/env bash

gcc -o xvcc -O3 -m32 xvcc.c
gcc -o mkfs -O3 -m32 mkfs.c

cp -r ../root root

./xvcc -o os               -Iroot/lib root/etc/os.c
./xvcc -o root/etc/init    -Iroot/lib root/etc/init.c
./xvcc -o root/bin/sh      -Iroot/lib root/bin/sh.c
./xvcc -o root/bin/cat     -Iroot/lib root/bin/cat.c
./xvcc -o root/bin/cp      -Iroot/lib root/bin/cp.c
./xvcc -o root/bin/halt    -Iroot/lib root/bin/halt.c
./xvcc -o root/bin/ln      -Iroot/lib root/bin/ln.c
./xvcc -o root/bin/ls      -Iroot/lib root/bin/ls.c
./xvcc -o root/bin/man     -Iroot/lib root/bin/man.c
./xvcc -o root/bin/mkdir   -Iroot/lib root/bin/mkdir.c
./xvcc -o root/bin/mv      -Iroot/lib root/bin/mv.c
./xvcc -o root/bin/pwd     -Iroot/lib root/bin/pwd.c
./xvcc -o root/bin/rm      -Iroot/lib root/bin/rm.c
./xvcc -o root/bin/rmdir   -Iroot/lib root/bin/rmdir.c
./xvcc -o root/bin/echo    -Iroot/lib root/bin/echo.c
./xvcc -o root/bin/kill    -Iroot/lib root/bin/kill.c
./xvcc -o root/bin/bin2c   -Iroot/lib root/bin/bin2c.c
./xvcc -o root/bin/edit    -Iroot/lib root/bin/edit.c
./xvcc -o root/bin/grep    -Iroot/lib root/bin/grep.c
./xvcc -o root/bin/wc      -Iroot/lib root/bin/wc.c
./xvcc -o root/usr/euhello -Iroot/lib root/usr/euhello.c
./xvcc -o root/usr/hello   -Iroot/lib root/usr/hello.c
./xvcc -o root/usr/prseg   -Iroot/lib root/usr/prseg.c
./xvcc -o root/usr/sdk     -Iroot/lib root/usr/sdk.c

./mkfs fs root

rm -r xvcc mkfs root

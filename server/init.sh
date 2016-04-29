#!/usr/bin/env bash

# gcc -o xvcc -O3 -m32 xvcc.c
# gcc -o mkfs -O3 -m32 mkfs.c

rm -rf os hd de

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

cat root/etc/os.d \
    root/etc/init.d \
    root/bin/sh.d \
    root/bin/cat.d \
    root/bin/cp.d \
    root/bin/halt.d \
    root/bin/ln.d \
    root/bin/ls.d \
    root/bin/man.d \
    root/bin/mkdir.d \
    root/bin/mv.d \
    root/bin/pwd.d \
    root/bin/rm.d \
    root/bin/rmdir.d \
    root/bin/echo.d \
    root/bin/kill.d \
    root/bin/bin2c.d \
    root/bin/edit.d \
    root/bin/grep.d \
    root/bin/wc.d \
    root/usr/euhello.d \
    root/usr/hello.d \
    root/usr/prseg.d \
    root/usr/sdk.d \
    > de

rm root/etc/os.d \
   root/etc/init.d \
   root/bin/sh.d \
   root/bin/cat.d \
   root/bin/cp.d \
   root/bin/halt.d \
   root/bin/ln.d \
   root/bin/ls.d \
   root/bin/man.d \
   root/bin/mkdir.d \
   root/bin/mv.d \
   root/bin/pwd.d \
   root/bin/rm.d \
   root/bin/rmdir.d \
   root/bin/echo.d \
   root/bin/kill.d \
   root/bin/bin2c.d \
   root/bin/edit.d \
   root/bin/grep.d \
   root/bin/wc.d \
   root/usr/euhello.d \
   root/usr/hello.d \
   root/usr/prseg.d \
   root/usr/sdk.d

./mkfs hd root

rm root/etc/init \
   root/bin/sh \
   root/bin/cat \
   root/bin/cp \
   root/bin/halt \
   root/bin/ln \
   root/bin/ls \
   root/bin/man \
   root/bin/mkdir \
   root/bin/mv \
   root/bin/pwd \
   root/bin/rm \
   root/bin/rmdir \
   root/bin/echo \
   root/bin/kill \
   root/bin/bin2c \
   root/bin/edit \
   root/bin/grep \
   root/bin/wc \
   root/usr/euhello \
   root/usr/hello \
   root/usr/prseg \
   root/usr/sdk

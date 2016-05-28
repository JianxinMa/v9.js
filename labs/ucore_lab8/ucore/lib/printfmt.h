#ifndef __LIB_PRINTFMT_H__
#define __LIB_PRINTFMT_H__

#include <call.h>
#include <error.h>
#include <string.h>

static char * error_string[MAXERROR + 1];
// TODO init error message.

void
printfmt(void (*putch)(int, void*, int), int fd, void *putdat, char *fmt, ...);

void
vprintfmt(funcptr_t putch, int fd, void *putdat, char *fmt, va_list ap);

/* *
 * getuint - get an unsigned int of various possible sizes from a varargs list
 * @ap:         a varargs list pointer
 * @lflag:      determines the size of the vararg that @ap points to
 * */
// static unsigned long long
// getuint(va_list *ap, int lflag) {
//     if (lflag >= 2) {
//         return va_arg(*ap, unsigned long long);
//     }
//     else if (lflag) {
//         return va_arg(*ap, unsigned long);
//     }
//     else {
//         return va_arg(*ap, unsigned int);
//     }
// }
// TODO unsigned long long not supported
static uint32_t getuint(va_list *ap, int lflag) {
    return va_arg(*ap, unsigned int);
}

/* *
 * getint - same as getuint but signed, we can't use getuint because of sign extension
 * @ap:         a varargs list pointer
 * @lflag:      determines the size of the vararg that @ap points to
 * */
// static long long
// getint(va_list *ap, int lflag) {
//     if (lflag >= 2) {
//         return va_arg(*ap, long long);
//     }
//     else if (lflag) {
//         return va_arg(*ap, long);
//     }
//     else {
//         return va_arg(*ap, int);
//     }
// }
// TODO long long not supported
static int32_t getint(va_list *ap, int lflag) {
    return va_arg(*ap, int);
}

/* *
 * printnum - print a number (base <= 16) in reverse order
 * @putch:      specified putch function, print a single character
 * @putdat:     used by @putch function
 * @num:        the number will be printed
 * @base:       base for print, must be in [1, 16]
 * @width:      maximum number of digits, if the actual width is less than @width, use @padc instead
 * @padc:       character that padded on the left if the actual width is less than @width
 * */
static void
printnum(funcptr_t putch, int fd, void *putdat, unsigned int num, unsigned int base, int width, int padc) {
    unsigned int result = num;
    unsigned mod;
    mod = result % base;
    result /= base;

    // first recursively print all preceding (more significant) digits
    if (num >= base) {
        printnum(putch, fd, putdat, result, base, width - 1, padc);
    } else {
        // print any needed pad characters before first digit
        while (-- width > 0)
            call3(padc, putdat, fd, putch);
    }
    // then print this (the least significant) digit
    call3("0123456789abcdef"[mod], putdat, fd, putch);

}

/* *
 * vprintfmt - format a string and print it by using putch, it's called with a va_list
 * instead of a variable number of arguments
 * @fd:         file descriptor
 * @putch:      specified putch function, print a single character
 * @putdat:     used by @putch function
 * @fmt:        the format string to use
 * @ap:         arguments for the format string
 *
 * Call this function if you are already dealing with a va_list.
 * Or you probably want printfmt() instead.
 * */
void
vprintfmt(funcptr_t putch, int fd, void *putdat, char *fmt, va_list ap) {
    char *p;
    int ch, err;
    int num;
    int base, width, precision, lflag, altflag;
    char padc;
    while (1) {
        while ((ch = *(unsigned char *)fmt ++) != '%') {
            if (ch == '\0') {
                return;
            }
            call3(ch, putdat, fd, putch);
        }
        
        // Process a %-escape sequence
        padc = ' ';
        width = precision = -1;
        lflag = altflag = 0;

    reswitch:
        switch (ch = *(unsigned char *)fmt ++) {

        // flag to pad on the right
        case '-':
            padc = '-';
            goto reswitch;

        // flag to pad with 0's instead of spaces
        case '0':
            padc = '0';
            goto reswitch;

        // width field
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
            for (precision = 0; ; ++ fmt) {
                precision = precision * 10 + ch - '0';
                ch = *fmt;
                if (ch < '0' || ch > '9') {
                    break;
                }
            }
            goto process_precision;

        case '*':
            precision = va_arg(ap, int);
            goto process_precision;

        case '.':
            if (width < 0)
                width = 0;
            goto reswitch;

        case '#':
            altflag = 1;
            goto reswitch;

        process_precision:
            if (width < 0)
                width = precision, precision = -1;
            goto reswitch;

        // long flag (doubled for long long)
        case 'l':
            lflag ++;
            goto reswitch;

        // character
        case 'c':
            call3(va_arg(ap, int), putdat, fd, putch);
            break;

        // error message
        case 'e':
            err = va_arg(ap, int);
            if (err < 0) {
                err = -err;
            }
            if (err > MAXERROR || (p = error_string[err]) == NULL) {
                printfmt(putch, fd, putdat, "error %d", err);
            }
            else {
                printfmt(putch, fd, putdat, "%s", p);
            }
            break;

        // string
        case 's':
            if ((p = va_arg(ap, char *)) == NULL) {
                p = "(null)";
            }
            if (width > 0 && padc != '-') {
                for (width -= strnlen(p, precision); width > 0; width --) {
                    call3(padc, putdat, fd, putch);
                }
            }
            for (; (ch = *p ++) != '\0' && (precision < 0 || -- precision >= 0); width --) {
                if (altflag && (ch < ' ' || ch > '~')) {
                    call3('?', putdat, fd, putch);
                }
                else {
                    call3(ch, putdat, fd, putch);
                }
            }
            for (; width > 0; width --) {
                call3(' ', putdat, fd, putch);
            }
            break;

        // (signed) decimal
        case 'd':
            num = getint(&ap, lflag);
            if (num < 0) {
                call3('-', putdat, fd, putch);
                num = -num;
            }
            base = 10;
            goto number;
        // unsigned decimal
        case 'u':
            num = getuint(&ap, lflag);
            base = 10;
            goto number;
        // (unsigned) octal
        case 'o':
            num = getuint(&ap, lflag);
            base = 8;
            goto number;
        // pointer
        case 'p':
            call3('0', putdat, fd, putch);
            call3('x', putdat, fd, putch);
            num = (uintptr_t)va_arg(ap, void *);
            base = 16;
            goto number;

        // (unsigned) hexadecimal
        case 'x':
            num = getuint(&ap, lflag);
            base = 16;
        number:
            printnum(putch, fd, putdat, num, base, width, padc);
            break;

        // escaped '%' character
        case '%':
            call3(ch, putdat, fd, putch);
            break;

        // unrecognized escape sequence - just print it literally
        default:
            call3('%', putdat, fd, putch);
            for (fmt --; fmt[-1] != '%'; fmt --)
                /* do nothing */;
            break;
        }
    }
}

/* *
 * printfmt - format a string and print it by using putch
 * @putch:      specified putch function, print a single character
 * @fd:         file descriptor
 * @putdat:     used by @putch function
 * @fmt:        the format string to use
 * */
void
printfmt(void (*putch)(int, void*, int), int fd, void *putdat, char *fmt, ...) {
    va_list ap;

    va_start(ap, fmt);
    vprintfmt(putch, fd, putdat, fmt, ap);
    // va_end(ap);
}




/* sprintbuf is used to save enough information of a buffer */
struct sprintbuf {
    char *buf;          // address pointer points to the first unused memory
    char *ebuf;         // points the end of the buffer
    int cnt;            // the number of characters that have been placed in this buffer
};

/* *
 * sprintputch - 'print' a single character in a buffer
 * @ch:         the character will be printed
 * @b:          the buffer to place the character @ch
 * */
static void
sprintputch(int ch, struct sprintbuf *b) {
    b->cnt ++;
    if (b->buf < b->ebuf) {
        *b->buf ++ = ch;
    }
}

/* *
 * vsnprintf - format a string and place it in a buffer, it's called with a va_list
 * instead of a variable number of arguments
 * @str:        the buffer to place the result into
 * @size:       the size of buffer, including the trailing null space
 * @fmt:        the format string to use
 * @ap:         arguments for the format string
 *
 * The return value is the number of characters which would be generated for the
 * given input, excluding the trailing '\0'.
 *
 * Call this function if you are already dealing with a va_list.
 * Or you probably want snprintf() instead.
 * */
int
vsnprintf(char *str, size_t size,  char *fmt, va_list ap) {
    struct sprintbuf b;
    b.buf = str;
    b.ebuf = str + size - 1;
    b.cnt = 0;
    if (str == NULL || b.buf > b.ebuf) {
        return -E_INVAL;
    }
    // print the string to the buffer
    vprintfmt((void*)sprintputch, NO_FD, &b, fmt, ap);
    // null terminate the buffer
    *b.buf = '\0';
    return b.cnt;
}


/* *
 * snprintf - format a string and place it in a buffer
 * @str:        the buffer to place the result into
 * @size:       the size of buffer, including the trailing null space
 * @fmt:        the format string to use
 * */
int
snprintf(char *str, size_t size,  char *fmt, ...) {
    va_list ap;
    int cnt;
    va_start(ap, fmt);
    cnt = vsnprintf(str, size, fmt, ap);
    // va_end(ap);
    return cnt;
}


#endif

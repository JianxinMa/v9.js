# Debugger Design

Our goal is to support both kernel and user mode debugging without, or at least only with minimum, support from the operating system. Most work should be done by the compiler and emulator. And hopefully it can be invisible to the OS.

## Requested Features

We want to implement the following features:
- Which program we are in? Which line we are at?
- What are current values of variables?
- Single step. Break point. Continue.
  - Be careful, malicious users might try breaking at lines that cannot map to any instructions.
- Backtrace. Frame content.
  - What happens during context switching, interrupts, exceptions, etc? Can be tricky.
  - Also note that `c.c` does not use something like %ebp.
  - Might need to leverage `ENT` and `LEV`.
  - It will always use `LEV` when leaving. But `ENT` on entry only when there are locals.

## Support from Operating System

At the moment, we don't need to modify the existing OS for debugging support. 

## Support from Compiler

Compilers are required to generate necessary symbolic information for debugging support.
And yes, I am tinkering with `c.c` these days.

Here I will describe where to store this information and how does the format look like.

### Where to store the information?

First we need to review the format currently used for an executable file. And we assume little-endian here. Say we have an executable file called `a.out` generated from `a.c`. `a.out` contains three parts:
```
| hdr | text | data |
```
- The 16-byte header `hdr` consists of four 32-bit integers. The four integers are consecutively:
  - `magic` just `0xC0DEF00D` for the current format in use.
  - `bss` is the length of the .bss section. Since variables in .bss are initialized with zero, only the size, rather than the whole image, of .bss is required. .bss is allocated after .text and .data when a program is excuated.
  - `entry` stores the address (virtual if paging is enabled) of the entry point, i.e. the first PC value.
  - `flags` currently is set to `0`, and used by neither the simulator nor the OS.
- The `text` section is, of course, code. After loaded into memory, the start of text is at address 0 (virtual if paging is enabled).
- `data` is loaded into memory immediately after `text`.

To support debugging, the compiler is required to:
- Store debugging information to another file, e.g. `a.d`.
- Store a magic 32-bit number at address 0x0, i.e. the start of .text. Currently I use `0xFF2017FF` because 0xFF is not a valid instruction prefix. 
- Store a C-style string (terminated by '\0') at address 0x4, The string contains the name of the source file, e.g. `a.c`. The first line of `a.d` should contain exactly the same string.

Now, every time page tables are changed, the emulator can first peek at 0x4 and find its associated information file, e.g. `a.d` for `a.c`, to obtain necessary information.

### What is the format then?

`a.d` is simply a normal ASCII text file.

The first line, led by a `C`, of `a.d` is the same string as the one at 0x4 (in .text), e.g.
```
C a.c
```

Whatever after `#` are comments:
```
C a.c # This is a comment.
# Yet another comment.
```

Suppose that there is an instruction at address 0x00010000, which belongs to line 123 in `a.c`.
This information can be written as
```
I 0x00010000 a.c 123
```
It is led by an `I`. If there are multiple such entries for 0x00010000, all but the last one are ignored.

Regarding local variables, (still working on ...)

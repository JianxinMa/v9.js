# Debugger Design

Our goal is to support both kernel and user mode debugging without, or at least only with minimum, support from the operating system. Most work should be done by the emulator. And hopefully it can be invisible to the OS.

## Requested Features

We want to implement the following features:
- Which program we are in? Which line we are at?
- What are current values of variables?
- Single step. Break point. Continue.
  - Be careful, malicious users might try breaking at lines that cannot map to any instructions.
- Backtrace. Frame content.
  - Seems like we need extra support from the compiler (%ebp).
  - But by paying extra attention to "ENT", "LEV", etc., this can also be done purely by the emulator.
  - What happens during context switching, interrupts, exceptions, etc. Can be tricky.


## Support from Operating System

First you need to know that how the current `exec` is implemented in the OS. When you power on the system, and enter `ls` in the shell. The shell will use a fork trap to first fork itself and use another exec trap to "execuate `ls`". The OS does jumps to `exec`. However, `exec`, in fact, does not load a exectuable binary program `ls` directly. Instead, it load the C compiler (`/bin/c`). This C compiler will compile `/bin/ls.c` on the fly and run the compiled result directly while staying in exactly the same process.

Therefore, we need to the OS to:
- Change the `exec` implementation. Load `/bin/ls` directly, rather than ask `/bin/c` to run `/bin/ls.c`. We will provide the `/bin/ls` binary program by using a cross-platform compiler to compile `ls.c` in advance.

Hint: When you first `c -o hello hello.c` in the shell and use `./hello` to run the program, the OS does load the `./hello` binary program directly. This is differnt from excuting `ls`, `cp`, etc.

## Support from Compiler

Compilers are required to generate necessary symbolic information for debugging support. 

Here I will describe where to store this information and how does the format look like.

### Where to store the information?

First we need to review the format currently used for an executable file. And we assume little-endian here. Say we have an executable file called `a.out` generated from `a.c`. `a.out` contains three parts:
```
| hdr | text | data |
```
- The 16-byte header `hdr` consists of four 32-bit integers. The four integers are consecutively:
  - `magic` just `0xC0DEF00D` for the current format in use.
  - `bss` is the length of the .bss section. Since variables in .bss are initialized with zero, only the size, rather than the whole image, of .bss is required. Used by the operating system, not the simulator.
  - `entry` stores the address (virtual if paging is enabled) of the entry point, i.e. the first PC value.
  - `flags` currently is set to `0`, and used by neither the simulator nor the OS.
- The `text` section is, of course, code. After loaded into memory, the start of text is at address 0 (virtual if paging is enabled).
- `data` is loaded into memory immediately after `text`.

To support debugging, the compiler is required to:
- Store debugging information to another file, e.g. `a.out.dsym`.
- Store a magic 32-bit number at (virtual) address 0x0, i.e. the start of .text. Currently I use `0xFF3223FF` because 0xFF is not a valid instruction prefix. 
- Store a C-style string terminated by '\0' at (virtual) address 0x0, i.e. the start of .text. The string contains the path to `a.out.dsym`. 

Currently, I preserve the first 256 bytes for the magic number and the path string.

Now, every time page tables are changed, the emulator can simply peek at 0x0 and load `a.out.dsym` to find necessary information.

### What is the format then?

`a.out.dsym` is simply a normal ASCII text file. Say .text contains n instructions. Then there should be n blocks, each of which corresponds to a single instruction. A block should look like this, where whatever after `#` are comments:

```
A 0x00010000    # Virtual address of a instruction.
F a.c           # Source file name, might not exist.
L 123           # Line number, might not exist.
C myfunc        # Which function this instruction lies in.
V mylocal -24         # L means it is an argument or local variable. Here mylocal is stored at %ebp-24.
V myotherlocal 16          # There can be many mnay arguments and/or lcoal variables.
```
Orders of `F L C V` are not important. Yet every block should be led by an `A` term.

Besides these n blocks. Each global variable  corresponds to a term led by `G`.
```
G myglobe 0x01234567  # G means myglobe is a global variable, and it is stored at 0x01234567.
```

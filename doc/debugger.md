# Debugger Design (Deprecated)

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

Update: due to the handcrafted initial process in os.c, we do need a little tiny creepy bit support from OS. But I am too busy to update this document right now.

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

默认使用little endian。首先请在生成的二进制文件的.text段开头先插入`0xFF2017FF`，紧跟着插入一个以`\0` 结尾的字符串，内容为代码的文件名，比如对于`root/etc/os.c`这份代码就插入`root/etc/os.c`这个字符串。

再来考虑`root/etc/os.c`这份代码对应的符号信息，设它生成的符号信息保存在`os.d`这个文件，内容如下：
```
= root/etc/os.c
# 注意上面，文件的第一行必须以=开始，后接代码的文件名。

# 行首为`#`，表明这一行为注释。空行会被忽略。

g proc bss +0 (array(struct<proc>))
g u bss +8448 (ptr(struct<proc>))
g init bss +8452 (ptr(struct<proc>))
g mem_free bss +8456 (ptr(char))
g mem_top bss +8460 (ptr(char))
# ...省略很多很多...
# 上面这几个是全局变量，分别叫proc、u、init等等；
# 由于它们在bss段，当然了，如果变量在data段就请把bss换成data；
# bss后面的十进制数字表示这个变量的地址相对.bss开头处的偏移值，注意，是偏移值；
# 偏移值之后是类型信息，关于类型信息的格式，参见我修改的`c.c`，叫`xvcc.c`，中的`info_print_type_str`。

# ...省略很多很多...

# 接下来是某个函数相关的信息：
> 0x00000018
# 上面先用以>开头的一行表示出函数的入口；
l n stk +24 (uint)
l s stk +16 (ptr(void))
l d stk +8 (ptr(void))
# 然后立即用l（是小L，不是I）开头表示出都有什么局部变量；
# 传入的参数也视为局部变量；
# 实际上你看相对栈帧的偏移值的正负就可以判断这个局部变量是否传入参数；
# 局部变量的格式和全局变量的格式差不多；
# 这里stk表示该局部变量是在栈帧上的；
# 如果一个局部变量是static的，那么这里stk应该相应地替换成bss或data；
i 0x00000018 root/etc/os.c 213
i 0x0000001c root/etc/os.c 213
i 0x00000020 root/etc/os.c 214
i 0x00000024 root/etc/os.c 215
i 0x00000028 root/etc/os.c 216
i 0x0000002c root/etc/os.c 217
i 0x00000030 root/etc/os.c 218
# ...省略很多很多...
# 然后对函数里的每一条指令，用i开头的一行标注它的位置。

# ...省略很多很多...

# 下面是另一个函数的相关信息，作为另一个例子：
> 0x0000687c
l endbss bss +211180 (int)
l kstack bss +210924 (array(char))
l ksp stk -4 (ptr(int))
i 0x0000687c root/etc/os.c 2621
i 0x00006880 root/etc/os.c 2621
i 0x00006884 root/etc/os.c 2621
i 0x00006888 root/etc/os.c 2621
i 0x0000688c root/etc/os.c 2621
# ...省略很多很多...

# 接下来给出定义的结构体的信息：
d struct pollfd ((fd:+0:(int))(events:+4:(short))(revents:+6:(short)))
# ...省略很多很多...
# 可以看到结构体的类型信息还给出了各个成员的偏移值

# 最后给出.bss和.data的起始地址
.data 0x00006948
.bss  0x00006ed8
```
另外，
```
# 你可能会问如果一个变量的类型是一个匿名结构体，那怎么办，看下面这个例子：
l d stk -4 (ptr(struct((fd:+0:(int))(ref:+4:(int))(ino:+8:(int))(de:+12:(struct<dirent>)))))
```
抱歉，现在手头有别的事在忙，说得不是很清楚，以我修改的`c.c`（在`server/xvcc.c`）的`info_print_type_str`等相关实现为准。

仅供参考，万一我后面改了呢？

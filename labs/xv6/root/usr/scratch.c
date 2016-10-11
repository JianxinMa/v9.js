#include <libc.h>

typedef struct st_s {
    char c;
    int i;
} st_t;

int g_bss_i;
int g_data_i = -1;

int main()
{
    int i;
    double d;
    void* p;
    static int l_bss_i;
    static int l_data_i = 24;
    st_t st;
    st.c = 'a';
    st.i = 24;
    i = 4;
    d = 8;
    p = 1;
    printf("%d\n", sizeof(st_t));
    return 0;
}
